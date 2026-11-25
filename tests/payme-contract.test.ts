import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import pg from "pg";
import { priceQuote, testRates } from "../lib/commerce/payment/calculate.ts";
import { WEEKLY_POLICY } from "../lib/commerce/payment/flag.ts";
import { captureEvidence } from "../lib/commerce/payment/recover.ts";
import { captureTwoSupplier } from "../lib/commerce/payment/sandbox.ts";
import { deliverParcel, handoffUnit, journalTotals } from "../lib/commerce/payment/workflow.ts";
import { creatorView, supplierView } from "../lib/commerce/payment/views.ts";
import { runWeeklyBatch, completeWeeklySimulation } from "../lib/commerce/payment/weekly.ts";
import { isPublicHttps, paymePayoutsEnabled, readPaymeConfig, sandboxBase } from "../lib/commerce/payment/payme/config.ts";
import { generateSale, generateSaleBody, type PaymeTransport } from "../lib/commerce/payment/payme/client.ts";
import { callbackAcknowledgement, openHostedSale, reconcileUnknownCapture, settlePaymeCallback, trackingPath } from "../lib/commerce/payment/payme/checkout.ts";
import { draftBalanceTransfer, draftWithdrawal, submitWithdrawal } from "../lib/commerce/payment/payme/payout.ts";
import { partnerSignature, signaturesMatch } from "../lib/commerce/payment/payme/signature.ts";
import { testPaymentPort } from "../lib/commerce/payment/port.ts";
import type { PaymeAttempt } from "../lib/commerce/payment/payme/attempts.ts";
import type { PaymeConfig } from "../lib/commerce/payment/payme/config.ts";
import type { PayState } from "../lib/commerce/payment/workflow.ts";
const root = path.resolve(import.meta.dirname, "..");
const NOW = Date.parse("2026-11-23T10:00:00.000Z");

const config: PaymeConfig = {
  env: "sandbox",
  base: "https://sandbox.payme.io/api/",
  clientKey: "key",
  clientPassword: "secret",
  callbackUrl: "https://callbacks.example/payme/callback",
  returnOrigin: "https://shop.example",
  sellers: { creator: "MPL-CREATOR" },
};

test("the sandbox adapter refuses another host and keeps the simulator offline", () => {
  assert.equal(sandboxBase("https://sandbox.payme.io/api/"), "https://sandbox.payme.io/api/");
  assert.equal(sandboxBase("https://live.payme.io/api/"), null);
  assert.equal(isPublicHttps("http://localhost:3000/payme/callback"), false);
  assert.equal(isPublicHttps("https://callbacks.example/payme/callback"), true);
  assert.equal(paymePayoutsEnabled({}), false);
  assert.equal(testPaymentPort().live, false);
  assert.equal(testPaymentPort().adapter, "test");
  const missing = readPaymeConfig({});
  assert.equal(missing.ok, false);
  const body = generateSaleBody(config, {
    orderId: "ord-1",
    amount: 12500,
    sellerPaymeId: "MPL-CREATOR",
    callbackUrl: config.callbackUrl,
    returnUrl: "https://shop.example/payme/return/tok-1",
  });
  assert.equal(body.market_fee, 0);
  assert.equal(body.sale_type, "authorize");
  assert.equal(body.currency, "ILS");
  assert.equal(body.sale_price, 12500);
  assert.equal("market_fee_fixed" in body, false);
  assert.equal("card_number" in body, false);
  const signature = partnerSignature("key", "secret", "tx", "sale");
  assert.equal(signaturesMatch(signature, signature), true);
  assert.equal(signaturesMatch(signature, "forged"), false);
});

test("a refresh resumes the same hosted sale", async () => {
  const quote = quote125();
  const calls: string[] = [];
  const transport = script((path) => {
    calls.push(path);
    return { httpStatus: 200, json: { status_code: 0, payme_sale_id: "SALE-125", sale_url: "https://sandbox.payme.io/sale/125" } };
  });
  const opened = await openHostedSale({
    existing: null,
    orderId: "ord-125",
    token: "tok-125",
    sellerHandle: "creator",
    sellerPaymeId: "MPL-CREATOR",
    amount: quote.charge,
    allocation: quote,
    now: NOW,
    holdExpiresAt: NOW + 60_000,
    config,
    transport,
  });
  assert.equal(opened.ok, true);
  if (!opened.ok) return;
  assert.equal(opened.created, true);
  assert.equal(opened.attempt.paymeSaleId, "SALE-125");
  const again = await openHostedSale({
    existing: opened.attempt,
    orderId: "ord-125",
    token: "tok-125",
    sellerHandle: "creator",
    sellerPaymeId: "MPL-CREATOR",
    amount: quote.charge,
    allocation: quote,
    now: NOW + 1000,
    holdExpiresAt: NOW + 60_000,
    config,
    transport,
  });
  assert.equal(again.ok, true);
  if (!again.ok) return;
  assert.equal(again.created, false);
  assert.equal(again.redirectUrl, opened.redirectUrl);
  assert.deepEqual(calls, ["generate-sale"]);
});

test("authorization after the hold expires voids and does not capture", async () => {
  const attempt = hostedAttempt(quote125(), "ord-hold");
  const calls: string[] = [];
  const settled = await settlePaymeCallback({
    attempt,
    fields: signed("SALE-ord-hold", "tx-hold"),
    now: attempt.state.holdExpiresAt + 1,
    clientKey: "key",
    clientPassword: "secret",
    transport: script((path, body) => {
      calls.push(path);
      if (path === "refund-sale") assert.equal("sale_refund_amount" in body, false);
      if (path === "get-transactions") return transactions("SALE-ord-hold", "ord-hold", attempt.amount, "authorized", "tx-hold");
      return { httpStatus: 200, json: { status_code: 0 } };
    }),
  });
  assert.equal(calls.includes("capture-sale"), false);
  assert.equal(calls.includes("refund-sale"), true);
  assert.equal(settled.attempt.state.status, "voided");
  assert.equal(settled.attempt.state.journal.length, 0);
});

test("a failed or cancelled PayMe sale does not capture and does not post twice", async () => {
  const quote = quote125();
  const calls: string[] = [];
  const transport = script((path) => {
    calls.push(path);
    if (path === "get-transactions") return transactions("SALE-ord-fail", "ord-fail", quote.charge, "failed", "tx-fail");
    return { httpStatus: 200, json: { status_code: 0 } };
  });
  const attempt = hostedAttempt(quote, "ord-fail");
  const first = await settlePaymeCallback({
    attempt,
    fields: signed("SALE-ord-fail", "tx-fail"),
    now: NOW,
    clientKey: "key",
    clientPassword: "secret",
    transport,
  });
  assert.equal(first.applied, true);
  assert.equal(first.attempt.status, "failed");
  assert.equal(first.attempt.state.journal.length, 0);
  assert.equal(calls.includes("capture-sale"), false);
  const before = calls.length;
  const second = await settlePaymeCallback({
    attempt: first.attempt,
    fields: signed("SALE-ord-fail", "tx-fail"),
    now: NOW + 1,
    clientKey: "key",
    clientPassword: "secret",
    transport,
  });
  assert.equal(second.applied, false);
  assert.equal(second.attempt.state.journal.length, 0);
  assert.equal(calls.length, before);
});

test("generate-sale refuses a non-integer amount before calling PayMe", async () => {
  let calls = 0;
  const result = await generateSale(config, {
    async post() {
      calls += 1;
      return { httpStatus: 200, json: { status_code: 0 } };
    },
  }, {
    orderId: "ord-bad",
    amount: 10.5,
    sellerPaymeId: "MPL-CREATOR",
    callbackUrl: config.callbackUrl,
    returnUrl: "https://shop.example/payme/return/tok-bad",
  });
  assert.equal(result.ok, false);
  assert.equal(calls, 0);
});

test("a duplicate callback and a forged signature do not post a second journal", async () => {
  const quote = quote125();
  const attempt = hostedAttempt(quote, "ord-dup");
  const transport = successTransport("SALE-ord-dup", "ord-dup", quote.charge, "tx-dup");
  const fields = signed("SALE-ord-dup", "tx-dup");
  const first = await settlePaymeCallback({ attempt, fields, now: NOW, clientKey: "key", clientPassword: "secret", transport: transport.transport });
  assert.equal(first.attempt.state.status, "captured");
  const entries = captureEvidence(first.attempt.state).entries;
  const forged = await settlePaymeCallback({
    attempt: first.attempt,
    fields: { ...fields, payme_signature: "forged" },
    now: NOW + 1,
    clientKey: "key",
    clientPassword: "secret",
    transport: transport.transport,
  });
  assert.equal(forged.applied, false);
  assert.equal(captureEvidence(forged.attempt.state).entries, entries);
  const callsBefore = transport.calls.length;
  const duplicate = await settlePaymeCallback({
    attempt: first.attempt,
    fields,
    now: NOW + 2,
    clientKey: "key",
    clientPassword: "secret",
    transport: transport.transport,
  });
  assert.equal(duplicate.applied, false);
  assert.equal(transport.calls.length, callsBefore);
  assert.equal(captureEvidence(duplicate.attempt.state).entries, 1);
});

test("a lost capture response is reconciled on the original sale", async () => {
  const quote = quote125();
  const attempt = hostedAttempt(quote, "ord-lost");
  let captures = 0;
  const transport = script((path, body) => {
    if (path === "capture-sale") {
      captures += 1;
      return { httpStatus: 500, json: { status_code: 999 } };
    }
    if (body.transaction_type === 40) return transactions("SALE-ord-lost", "ord-lost", quote.charge, "authorized", "tx-lost");
    return transactions("SALE-ord-lost", "ord-lost", quote.charge, "completed", "tx-lost");
  });
  const lost = await settlePaymeCallback({
    attempt,
    fields: signed("SALE-ord-lost", "tx-lost"),
    now: NOW,
    clientKey: "key",
    clientPassword: "secret",
    transport,
  });
  assert.equal(lost.attempt.status, "capture_unknown");
  assert.equal(lost.attempt.state.journal.length, 0);
  assert.equal(captures, 1);
  const reconciled = await reconcileUnknownCapture({
    attempt: lost.attempt,
    now: NOW + 1,
    clientKey: "key",
    clientPassword: "secret",
    transport: script((path) => {
      assert.notEqual(path, "capture-sale");
      assert.notEqual(path, "generate-sale");
      return transactions("SALE-ord-lost", "ord-lost", quote.charge, "completed", "tx-lost");
    }),
  });
  assert.equal(reconciled.status, "captured");
  const evidence = captureEvidence(reconciled.state);
  const totals = journalTotals(reconciled.state);
  assert.equal(evidence.entries, 1);
  assert.equal(evidence.releases, 1);
  assert.equal(totals.debit, totals.credit);
  assert.equal(captures, 1);
});

test("the 125 shekel fixture stays split and eligible only after delivery", async () => {
  const quote = quote125();
  assert.equal(quote.charge, 12_500);
  assert.equal(quote.supplierPayable, 8_200);
  assert.equal(quote.creatorPayable, 3_600);
  assert.equal(quote.storeyGross, 700);
  const attempt = hostedAttempt(quote, "ord-125");
  const settled = await settlePaymeCallback({
    attempt,
    fields: signed("SALE-ord-125", "tx-125"),
    now: NOW,
    clientKey: "key",
    clientPassword: "secret",
    transport: successTransport("SALE-ord-125", "ord-125", quote.charge, "tx-125").transport,
  });
  assert.equal(settled.attempt.state.status, "captured");
  assert.equal(supplierView(settled.attempt.state, "party", NOW).eligible, 0);
  assert.equal(creatorView(settled.attempt.state, NOW).eligible, 0);
  const handed = handoffUnit(settled.attempt.state, { key: "hand", unitId: "item#1", parcelId: "parcel-1" });
  assert.equal(handed.ok, true);
  if (!handed.ok) return;
  const delivered = deliverParcel(handed.state, { key: "deliver", parcelId: "parcel-1", at: NOW + 1000 });
  assert.equal(delivered.ok, true);
  if (!delivered.ok) return;
  assert.equal(supplierView(delivered.state, "party", NOW + 1000).eligible, 8_200);
  assert.equal(creatorView(delivered.state, NOW + 1000).eligible, 3_600);
  const replay = deliverParcel(delivered.state, { key: "deliver", parcelId: "parcel-1", at: NOW + 1000 });
  assert.equal(replay.ok, true);
  if (!replay.ok) return;
  assert.equal(replay.replayed, true);
  assert.equal(supplierView(replay.state, "party", NOW + 1000).eligible, 8_200);
  assert.equal(creatorView(replay.state, NOW + 1000).eligible, 3_600);
});

test("one 82 shekel refund leaves 59 and a repeat callback adds no credit", async () => {
  const captured = captureTwoSupplier(NOW);
  assert.equal(captured.ok, true);
  if (!captured.ok) return;
  assert.equal(captured.state.charge, 14_100);
  const attempt = attemptFrom(captured.state, "SALE-141", "MPL-CREATOR");
  const fields = signed("SALE-141", "refund-1");
  const transport = script(() => ({
    httpStatus: 200,
    json: {
      status_code: 0,
      items: [
        saleRow("SALE-141", captured.state.id, 14_100, "completed", "tx-sale"),
        saleRow("SALE-141", captured.state.id, 100, "refunded", "tx-chargeback", "Chargeback Refund"),
        saleRow("SALE-141", captured.state.id, 8_200, "p-refund", "refund-1", "Partial Refund"),
      ],
    },
  }));
  const refunded = await settlePaymeCallback({ attempt, fields, now: NOW, clientKey: "key", clientPassword: "secret", transport });
  assert.equal(refunded.attempt.state.buyerRefunded, 8_200);
  assert.equal(refunded.attempt.state.charge - refunded.attempt.state.buyerRefunded, 5_900);
  const calls = { count: 0 };
  const repeat = await settlePaymeCallback({
    attempt: refunded.attempt,
    fields,
    now: NOW + 1,
    clientKey: "key",
    clientPassword: "secret",
    transport: script(() => {
      calls.count += 1;
      return { httpStatus: 200, json: { status_code: 0, items: [] } };
    }),
  });
  assert.equal(calls.count, 0);
  assert.equal(repeat.attempt.state.buyerRefunded, 8_200);
  const handed = handoffUnit(repeat.attempt.state, { key: "hand-a", unitId: "a#1", parcelId: "parcel-a" });
  assert.equal(handed.ok, true);
  if (!handed.ok) return;
  const delivered = deliverParcel(handed.state, { key: "deliver-a", parcelId: "parcel-a", at: NOW });
  assert.equal(delivered.ok, true);
  if (!delivered.ok) return;
  assert.equal(delivered.state.units.find((unit) => unit.id === "a#1")?.eligibleAt !== null, true);
  assert.equal(delivered.state.units.find((unit) => unit.id === "b#1")?.refunded, true);
  assert.equal(delivered.state.units.find((unit) => unit.id === "b#1")?.eligibleAt ?? null, null);
});

test("two creators make one supplier payout and a larger wallet does not raise the withdrawal", () => {
  const first = deliverQuote("maya-order");
  const second = deliverQuote("noa-order");
  const batch = runWeeklyBatch({
    orders: [
      { id: "maya-order", creatorId: "maya", state: first },
      { id: "noa-order", creatorId: "noa", state: second },
    ],
    now: NOW + 120_000,
  });
  const supplier = batch.created.find((item) => item.party === "supplier" && item.beneficiaryId === "party");
  assert.ok(supplier);
  if (!supplier) return;
  assert.equal(supplier.amount, 16_400);
  assert.equal(new Set(supplier.lines.map((line) => line.creatorId)).size, 2);
  const withdrawal = draftWithdrawal({ sellerPaymeId: "MPL-SUPPLIER", batch: supplier, walletBalance: 1_000_000 });
  assert.equal(withdrawal.withdrawal_amount, 16_400);
  assert.equal(withdrawal.withdrawal_currency, "ILS");
  const transfer = draftBalanceTransfer({ fromSellerPaymeId: "MPL-PLATFORM", toSellerPaymeId: "MPL-SUPPLIER", amount: supplier.amount });
  assert.equal(transfer.kind, "transfer");
  assert.notEqual(transfer.kind, withdrawal.kind);
  const submitted = submitWithdrawal(withdrawal, true);
  assert.equal(submitted.submitted, false);
  assert.equal(submitted.withdrawal_amount, 16_400);
  const simulated = completeWeeklySimulation(batch.instructions, supplier.key);
  assert.equal(simulated.find((item) => item.key === supplier.key)?.status, "simulated");
  assert.equal(simulated.find((item) => item.key === supplier.key)?.bankConfirmation, "waiting");
  const replay = runWeeklyBatch({
    orders: [
      { id: "maya-order", creatorId: "maya", state: first },
      { id: "noa-order", creatorId: "noa", state: second },
    ],
    now: NOW + 120_000,
    existing: batch.instructions,
  });
  assert.equal(replay.created.length, 0);
});

test("the return path only names tracking and a callback acknowledgement stays below 400", () => {
  assert.equal(trackingPath("tok-1"), "/track/tok-1");
  assert.equal(callbackAcknowledgement(), 200);
});

test("two payout workers claim one PayMe operation", async () => {
  const db = new PGlite();
  const server = new PGLiteSocketServer({ db, port: 55437, host: "127.0.0.1", maxConnections: 8 });
  await server.start();
  const left = new pg.Client({ host: "127.0.0.1", port: 55437, user: "postgres", database: "postgres" });
  const right = new pg.Client({ host: "127.0.0.1", port: 55437, user: "postgres", database: "postgres" });
  await left.connect();
  await right.connect();
  try {
    await left.query("create role anon; create role authenticated;");
    await left.query(fs.readFileSync(path.join(root, "supabase/migrations/20261123200000_payme_callback.sql"), "utf8"));
    const firstCallback = await left.query("select public.payment_payme_callback('cb-1', 'SALE-1', 'ord-1') as result");
    const secondCallback = await left.query("select public.payment_payme_callback('cb-1', 'SALE-1', 'ord-1') as result");
    assert.equal(firstCallback.rows[0].result, "recorded");
    assert.equal(secondCallback.rows[0].result, "replay");
    await left.query("begin");
    await left.query("select pg_advisory_xact_lock(hashtext('payme:op-1'))");
    let secondFinished = false;
    const second = right.query("select public.payment_payme_claim('op-1', 'SALE-1', 'ord-1', 8200) as result").then((result) => {
      secondFinished = true;
      return result;
    });
    await new Promise((resolve) => setTimeout(resolve, 250));
    assert.equal(secondFinished, false);
    const first = await left.query("select public.payment_payme_claim('op-1', 'SALE-1', 'ord-1', 8200) as result");
    assert.equal(first.rows[0].result, "claimed");
    await left.query("commit");
    assert.equal((await second).rows[0].result, "replay");
    const rows = await left.query("select count(*)::int as count, coalesce(sum(amount_agorot), 0)::int as amount from public.payment_payme_operations");
    assert.equal(rows.rows[0].count, 1);
    assert.equal(rows.rows[0].amount, 8200);
  } finally {
    await left.end();
    await right.end();
    await server.stop();
    await db.close();
  }
});

function quote125() {
  const priced = priceQuote({
    ...testRates(),
    policyVersion: WEEKLY_POLICY,
    lines: [
      {
        id: "item",
        supplierId: "party",
        sku: "PARTY-01",
        quantity: 1,
        unitRetailAgorot: 10_000,
        unitWholesaleAgorot: 6_000,
        prepaidQuantity: 0,
        serviceGroup: "ship",
        taxAgorot: 0,
      },
    ],
    services: [{ id: "ship", buyerFreightAgorot: 2_500, supplierFreightAgorot: 2_500, packingAgorot: 0 }],
    buyerFeeAgorot: 0,
    discountAgorot: 0,
    pspFeeAgorot: 200,
  });
  if (!priced.ok) throw new Error(priced.code);
  return priced.allocation;
}

function deliverQuote(orderId: string): PayState {
  const quote = quote125();
  const attempt = hostedAttempt(quote, orderId);
  const captured = attempt.state;
  const posted = {
    ...captured,
    status: "captured" as const,
    feePosted: true,
    units: captured.units.map((unit) => ({ ...unit, stage: "committed" as const, foReleased: true })),
  };
  const handed = handoffUnit(posted, { key: `hand-${orderId}`, unitId: "item#1", parcelId: `parcel-${orderId}` });
  if (!handed.ok) throw new Error(handed.code);
  const delivered = deliverParcel(handed.state, { key: `deliver-${orderId}`, parcelId: `parcel-${orderId}`, at: NOW + 1000 });
  if (!delivered.ok) throw new Error(delivered.code);
  return delivered.state;
}

function hostedAttempt(allocation: ReturnType<typeof quote125>, orderId: string): PaymeAttempt {
  const opened = {
    orderId,
    token: `tok-${orderId}`,
    sellerHandle: "creator",
    sellerPaymeId: "MPL-CREATOR",
    paymeSaleId: `SALE-${orderId}`,
    saleUrl: "https://sandbox.payme.io/sale/open",
    amount: allocation.charge,
    currency: "ILS" as const,
    status: "open" as const,
    callbacks: [],
    operations: [],
    state: {
      id: orderId,
      policyVersion: allocation.policyVersion,
      status: "checking" as const,
      holdExpiresAt: NOW + 60_000,
      attemptKey: `attempt:${orderId}`,
      providerRef: `SALE-${orderId}`,
      hashes: {},
      eventIds: [],
      operationIds: [],
      journal: [],
      units: allocation.units.map((unit) => ({
        ...unit,
        stage: "held" as const,
        parcelId: null,
        deliveredAt: null,
        eligibleAt: null,
        supplierTransfer: "none" as const,
        supplierTransferKey: null,
        creatorTransfer: "none" as const,
        creatorTransferKey: null,
        refunded: false,
        dispute: "none" as const,
        foReleased: false,
      })),
      pspFee: allocation.pspFee,
      feePosted: false,
      events: ["authorize-request"],
      exceptions: [],
      cancelIntent: false,
      recovery: [],
      buyerRefunded: 0,
      charge: allocation.charge,
    },
  };
  return opened;
}

function attemptFrom(state: PayState, saleId: string, merchantId: string): PaymeAttempt {
  return {
    orderId: state.id,
    token: `tok-${state.id}`,
    sellerHandle: "creator",
    sellerPaymeId: merchantId,
    paymeSaleId: saleId,
    saleUrl: "https://sandbox.payme.io/sale/open",
    amount: state.charge,
    currency: "ILS",
    status: "captured",
    callbacks: [],
    operations: [`capture:${saleId}`],
    state: { ...state, providerRef: saleId },
  };
}

function signed(saleId: string, transactionId: string): Record<string, string> {
  return {
    payme_sale_id: saleId,
    payme_transaction_id: transactionId,
    payme_signature: partnerSignature("key", "secret", transactionId, saleId),
  };
}

function transactions(saleId: string, orderId: string, amount: number, status: string, transactionId: string) {
  return { httpStatus: 200, json: { status_code: 0, items: [saleRow(saleId, orderId, amount, status, transactionId)] } };
}

function saleRow(saleId: string, orderId: string, amount: number, status: string, transactionId: string, action = "Charge") {
  return {
    payme_sale_id: saleId,
    payme_transaction_id: transactionId,
    transaction_id: orderId,
    seller_payme_id: "MPL-CREATOR",
    sale_currency: "ILS",
    transaction_price: amount,
    transaction_status: status,
    transaction_action: action,
    transaction_created_at: "2026-11-23T10:00:00.000Z",
  };
}

function successTransport(saleId: string, orderId: string, amount: number, transactionId: string) {
  const calls: string[] = [];
  const transport = script((path, body) => {
    calls.push(path);
    if (path === "capture-sale") return { httpStatus: 200, json: { status_code: 0 } };
    if (body.transaction_type === 40) return transactions(saleId, orderId, amount, "authorized", transactionId);
    return transactions(saleId, orderId, amount, "completed", transactionId);
  });
  return { transport, calls };
}

function script(handler: (path: string, body: Record<string, unknown>) => { httpStatus: number; json: unknown | null }): PaymeTransport {
  return { post: (path, body) => Promise.resolve(handler(path, body)) };
}
