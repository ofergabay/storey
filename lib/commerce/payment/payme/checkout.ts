import type { Allocation } from "../calculate.ts";
import type { PaymeConfig } from "./config.ts";
import { captureSale, generateSale, getTransactions, refundSale, type PaymeTransport } from "./client.ts";
import type { PaymeAttempt } from "./attempts.ts";
import { classifySignature } from "./signature.ts";
import { authorize, captureResult, lookupUnknown, refundUnits, startFromAllocation, submitAttempt, type PayState } from "../workflow.ts";

export function returnUrlFor(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/payme/return/${token}`;
}

export function trackingPath(token: string): string {
  return `/track/${token}`;
}

export function callbackAcknowledgement(): 200 {
  return 200;
}

export function openSaleDecision(existing: PaymeAttempt | null, orderId: string, amount: number): "resume" | "create" | "reconcile" {
  if (!existing || existing.orderId !== orderId) return "create";
  if (existing.amount !== amount) return "reconcile";
  if (existing.status === "voided") return "create";
  if (existing.status === "capture_unknown") return "reconcile";
  return "resume";
}

export async function openHostedSale(input: {
  existing: PaymeAttempt | null;
  orderId: string;
  token: string;
  sellerHandle: string;
  sellerPaymeId: string;
  amount: number;
  allocation: Allocation;
  now: number;
  holdExpiresAt: number;
  config: PaymeConfig;
  transport: PaymeTransport;
}): Promise<{ ok: true; attempt: PaymeAttempt; redirectUrl: string; created: boolean } | { ok: false; code: "HOLD_EXPIRED" | "UNKNOWN" | "DECLINED" | "RECONCILE" | "AMOUNT" }> {
  if (input.now > input.holdExpiresAt) return { ok: false, code: "HOLD_EXPIRED" };
  if (input.allocation.charge !== input.amount) return { ok: false, code: "AMOUNT" };
  const decision = openSaleDecision(input.existing, input.orderId, input.amount);
  if (decision === "reconcile") return { ok: false, code: "RECONCILE" };
  if (decision === "resume" && input.existing) return { ok: true, attempt: input.existing, redirectUrl: input.existing.saleUrl, created: false };
  const opened = await generateSale(input.config, input.transport, {
    orderId: input.orderId,
    amount: input.amount,
    sellerPaymeId: input.sellerPaymeId,
    callbackUrl: input.config.callbackUrl,
    returnUrl: returnUrlFor(input.config.returnOrigin, input.token),
  });
  if (!opened.ok) return { ok: false, code: opened.code === "DECLINED" ? "DECLINED" : "UNKNOWN" };
  const quoted = startFromAllocation({ id: input.orderId, allocation: input.allocation, now: input.now });
  quoted.holdExpiresAt = input.holdExpiresAt;
  const submitted = submitAttempt(quoted, {
    key: `attempt:${input.orderId}`,
    provider: { ref: opened.value.saleId, status: "authorized", amount: input.amount, eventId: "payme-open" },
    now: input.now,
  });
  if (!submitted.ok) return { ok: false, code: "UNKNOWN" };
  const attempt: PaymeAttempt = {
    orderId: input.orderId,
    token: input.token,
    sellerHandle: input.sellerHandle,
    sellerPaymeId: input.sellerPaymeId,
    paymeSaleId: opened.value.saleId,
    saleUrl: opened.value.saleUrl,
    amount: input.amount,
    currency: "ILS",
    status: "open",
    callbacks: [],
    operations: [],
    state: submitted.state,
  };
  return { ok: true, attempt, redirectUrl: opened.value.saleUrl, created: true };
}

export async function settlePaymeCallback(input: {
  attempt: PaymeAttempt;
  fields: Record<string, string>;
  now: number;
  clientKey: string;
  clientPassword: string;
  transport: PaymeTransport;
}): Promise<{ attempt: PaymeAttempt; applied: boolean }> {
  const signature = classifySignature({ clientKey: input.clientKey, clientPassword: input.clientPassword, fields: input.fields });
  const transactionId = input.fields.payme_transaction_id ?? "";
  const saleId = input.fields.payme_sale_id ?? "";
  const attempt = input.attempt;
  attempt.callbacks.push({ at: input.now, saleId, transactionId, signature, applied: false });
  if (saleId !== attempt.paymeSaleId) return { attempt, applied: false };
  if (signature !== "valid") return { attempt, applied: false };
  if (attempt.status === "failed" || attempt.status === "voided") return { attempt, applied: false };
  const duplicate = attempt.callbacks.slice(0, -1).some((row) => row.transactionId === transactionId && transactionId.length > 0 && row.signature === "valid" && row.applied);
  if (duplicate) return { attempt, applied: false };
  const read = await getTransactions(
    { env: "sandbox", base: "https://sandbox.payme.io/api/", clientKey: input.clientKey, clientPassword: input.clientPassword, callbackUrl: "", returnOrigin: "", sellers: {} },
    input.transport,
    { sellerPaymeId: attempt.sellerPaymeId, orderId: attempt.orderId, saleId: attempt.paymeSaleId, amount: attempt.amount, authorization: attempt.state.status !== "captured" && attempt.state.status !== "capture_unknown" },
  );
  if (!read.ok) return { attempt, applied: false };
  const snapshot = read.value;
  if (snapshot.saleId !== attempt.paymeSaleId || snapshot.orderId !== attempt.orderId || snapshot.currency !== "ILS" || snapshot.amount !== attempt.amount || snapshot.merchantId !== attempt.sellerPaymeId) {
    return { attempt, applied: false };
  }
  if (input.now > attempt.state.holdExpiresAt && attempt.state.status !== "captured" && attempt.state.status !== "capture_unknown") {
    return voidExpired(attempt, input.transport, input.clientKey, input.clientPassword, input.now);
  }
  if (attempt.state.status === "capture_unknown") {
    return reconcileCapture(attempt, snapshot.operation, snapshot.transactionId);
  }
  if (attempt.state.status === "captured" || snapshot.operation === "partial-refund") {
    return applyRefund(attempt, snapshot.refunded, snapshot.refundTransactionIds);
  }
  if (snapshot.operation === "failed" || snapshot.operation === "voided") return closeUnpaid(attempt, snapshot.operation);
  if (snapshot.operation !== "authorized" && snapshot.operation !== "completed") return { attempt, applied: false };
  const authKey = `auth:${snapshot.transactionId}`;
  if (!attempt.operations.includes(authKey) && attempt.state.status !== "authorized") {
    const authorized = authorize(attempt.state, {
      key: authKey,
      provider: { ref: attempt.paymeSaleId, status: "authorized", amount: attempt.amount, eventId: snapshot.transactionId },
      now: input.now,
    });
    if (!authorized.ok || authorized.state.status === "voided") {
      attempt.state = authorized.ok ? authorized.state : attempt.state;
      attempt.status = "voided";
      return { attempt, applied: false };
    }
    attempt.state = authorized.state;
    attempt.operations.push(authKey);
    attempt.status = "authorized";
  }
  if (attempt.operations.includes(`capture:${attempt.paymeSaleId}`)) return { attempt, applied: false };
  const captured = await captureSale(
    { env: "sandbox", base: "https://sandbox.payme.io/api/", clientKey: input.clientKey, clientPassword: input.clientPassword, callbackUrl: "", returnOrigin: "", sellers: {} },
    input.transport,
    { sellerPaymeId: attempt.sellerPaymeId, saleId: attempt.paymeSaleId, amount: attempt.amount },
  );
  if (!captured.ok) {
    const unknown = captureResult(attempt.state, {
      key: `capture:${attempt.orderId}`,
      provider: { ref: attempt.paymeSaleId, status: "unknown", amount: attempt.amount, eventId: snapshot.transactionId },
      eventId: snapshot.transactionId,
    });
    if (unknown.ok) attempt.state = unknown.state;
    attempt.status = "capture_unknown";
    return { attempt, applied: false };
  }
  const confirmed = await getTransactions(
    { env: "sandbox", base: "https://sandbox.payme.io/api/", clientKey: input.clientKey, clientPassword: input.clientPassword, callbackUrl: "", returnOrigin: "", sellers: {} },
    input.transport,
    { sellerPaymeId: attempt.sellerPaymeId, orderId: attempt.orderId, saleId: attempt.paymeSaleId, amount: attempt.amount, authorization: false },
  );
  if (!confirmed.ok || (confirmed.value.operation !== "completed" && confirmed.value.operation !== "partial-refund")) {
    const unknown = captureResult(attempt.state, {
      key: `capture:${attempt.orderId}`,
      provider: { ref: attempt.paymeSaleId, status: "unknown", amount: attempt.amount, eventId: snapshot.transactionId },
      eventId: snapshot.transactionId,
    });
    if (unknown.ok) attempt.state = unknown.state;
    attempt.status = "capture_unknown";
    return { attempt, applied: false };
  }
  return postCapture(attempt, confirmed.value.transactionId, confirmed.value.refunded, confirmed.value.refundTransactionIds);
}

export async function reconcileUnknownCapture(input: {
  attempt: PaymeAttempt;
  now: number;
  clientKey: string;
  clientPassword: string;
  transport: PaymeTransport;
}): Promise<PaymeAttempt> {
  if (input.attempt.status !== "capture_unknown") return input.attempt;
  const read = await getTransactions(
    { env: "sandbox", base: "https://sandbox.payme.io/api/", clientKey: input.clientKey, clientPassword: input.clientPassword, callbackUrl: "", returnOrigin: "", sellers: {} },
    input.transport,
    { sellerPaymeId: input.attempt.sellerPaymeId, orderId: input.attempt.orderId, saleId: input.attempt.paymeSaleId, amount: input.attempt.amount, authorization: false },
  );
  if (!read.ok) return input.attempt;
  return reconcileCapture(input.attempt, read.value.operation, read.value.transactionId).attempt;
}

async function voidExpired(attempt: PaymeAttempt, transport: PaymeTransport, clientKey: string, clientPassword: string, now: number): Promise<{ attempt: PaymeAttempt; applied: boolean }> {
  const key = `void:${attempt.paymeSaleId}`;
  if (attempt.operations.includes(key)) {
    attempt.status = "voided";
    return { attempt, applied: false };
  }
  const voidedCall = await refundSale(
    { env: "sandbox", base: "https://sandbox.payme.io/api/", clientKey, clientPassword, callbackUrl: "", returnOrigin: "", sellers: {} },
    transport,
    { sellerPaymeId: attempt.sellerPaymeId, saleId: attempt.paymeSaleId },
  );
  if (!voidedCall.ok) return { attempt, applied: false };
  const voided = authorize(attempt.state, {
    key,
    provider: { ref: attempt.paymeSaleId, status: "authorized", amount: attempt.amount, eventId: key },
    now,
  });
  if (voided.ok) attempt.state = voided.state;
  attempt.operations.push(key);
  attempt.status = "voided";
  return { attempt, applied: attempt.state.status === "voided" };
}

function closeUnpaid(attempt: PaymeAttempt, operation: "failed" | "voided"): { attempt: PaymeAttempt; applied: boolean } {
  if (attempt.status === "captured" || attempt.state.status === "captured") return { attempt, applied: false };
  const key = `${operation}:${attempt.paymeSaleId}`;
  if (attempt.operations.includes(key)) return { attempt, applied: false };
  attempt.operations.push(key);
  attempt.status = operation;
  const last = attempt.callbacks.at(-1);
  if (last) last.applied = true;
  return { attempt, applied: true };
}

function reconcileCapture(attempt: PaymeAttempt, operation: string, transactionId: string): { attempt: PaymeAttempt; applied: boolean } {
  if (operation !== "completed" && operation !== "partial-refund") return { attempt, applied: false };
  if (attempt.operations.includes(`capture:${attempt.paymeSaleId}`)) return { attempt, applied: false };
  const found = lookupUnknown(attempt.state, {
    key: `lookup:${attempt.paymeSaleId}`,
    provider: { ref: attempt.paymeSaleId, status: "captured", amount: attempt.amount, eventId: transactionId },
  });
  if (!found.ok || found.state.status !== "captured") return { attempt, applied: false };
  attempt.state = found.state;
  attempt.status = "captured";
  attempt.operations.push(`capture:${attempt.paymeSaleId}`);
  const last = attempt.callbacks.at(-1);
  if (last) last.applied = true;
  return { attempt, applied: true };
}

function postCapture(attempt: PaymeAttempt, transactionId: string, refunded: number, refundIds: string[]): { attempt: PaymeAttempt; applied: boolean } {
  const posted = captureResult(attempt.state, {
    key: `capture:${attempt.orderId}`,
    provider: { ref: attempt.paymeSaleId, status: "captured", amount: attempt.amount, eventId: transactionId },
    eventId: transactionId,
  });
  if (!posted.ok || posted.state.status !== "captured") return { attempt, applied: false };
  attempt.state = posted.state;
  attempt.status = "captured";
  attempt.operations.push(`capture:${attempt.paymeSaleId}`);
  const last = attempt.callbacks.at(-1);
  if (last) last.applied = true;
  if (refunded > 0) return applyRefund(attempt, refunded, refundIds);
  return { attempt, applied: true };
}

function applyRefund(attempt: PaymeAttempt, refunded: number, refundIds: string[]): { attempt: PaymeAttempt; applied: boolean } {
  const key = `refund:${[...refundIds].sort().join(",")}`;
  if (refunded <= attempt.state.buyerRefunded || attempt.operations.includes(key) || refundIds.length === 0) return { attempt, applied: false };
  const delta = refunded - attempt.state.buyerRefunded;
  const unitIds = unitsForRefund(attempt.state, delta);
  if (!unitIds) return { attempt, applied: false };
  const refundedState = refundUnits(attempt.state, { key, unitIds, reason: "payme" });
  if (!refundedState.ok) return { attempt, applied: false };
  attempt.state = refundedState.state;
  attempt.operations.push(key);
  const last = attempt.callbacks.at(-1);
  if (last) last.applied = true;
  return { attempt, applied: true };
}

function unitsForRefund(state: PayState, amount: number): string[] | null {
  const open = state.units.filter((unit) => !unit.refunded);
  const singles = open.map((unit) => [unit.id]);
  const pairs = open.flatMap((left, index) => open.slice(index + 1).map((right) => [left.id, right.id]));
  for (const unitIds of [...singles, ...pairs, open.map((unit) => unit.id)]) {
    const trial = refundUnits(state, { key: `match:${unitIds.join("+")}`, unitIds, reason: "payme" });
    if (trial.ok && trial.state.buyerRefunded - state.buyerRefunded === amount) return unitIds;
  }
  return null;
}
