import type { Allocation } from "./calculate.ts";
import { authorize, captureResult, eventCount, journalTotals, lookupUnknown, startFromAllocation, submitAttempt, type PayState } from "./workflow.ts";

export type ProviderCharge = {
  ref: string;
  orderId: string;
  amount: number;
  eventId: string;
  status: "captured";
  acceptedAt: number;
  allocation: Allocation;
};

export function unknownAfterAcceptance(charge: ProviderCharge): PayState | null {
  const quoted = startFromAllocation({ id: charge.orderId, allocation: charge.allocation, now: charge.acceptedAt });
  const provider = { ref: charge.ref, status: "authorized" as const, amount: charge.amount, eventId: charge.eventId };
  const submitted = submitAttempt(quoted, { key: `attempt:${charge.orderId}`, provider, now: charge.acceptedAt });
  if (!submitted.ok) return null;
  const authorized = authorize(submitted.state, { key: `auth:${charge.orderId}`, provider, now: charge.acceptedAt });
  if (!authorized.ok) return null;
  const unknown = captureResult(authorized.state, {
    key: `capture:${charge.orderId}`,
    provider: { ...provider, status: "unknown" },
    eventId: charge.eventId,
  });
  return unknown.ok ? unknown.state : null;
}

export function recoverAcceptedCharge(charge: ProviderCharge, existing: PayState | null): { state: PayState; replayed: boolean } | null {
  if (existing?.status === "captured" && existing.providerRef === charge.ref) return { state: existing, replayed: true };
  const unknown = existing?.status === "capture_unknown" && existing.providerRef === charge.ref ? existing : unknownAfterAcceptance(charge);
  if (!unknown) return null;
  const found = lookupUnknown(unknown, {
    key: `lookup:${charge.ref}`,
    provider: { ref: charge.ref, status: "captured", amount: charge.amount, eventId: charge.eventId },
  });
  return found.ok ? { state: found.state, replayed: found.replayed } : null;
}

export function captureEvidence(state: PayState): { entries: number; balanced: boolean; releases: number } {
  const entries = new Set(
    state.journal.filter((line) => line.entry.startsWith("capture:") && !line.entry.includes(":fee")).map((line) => line.entry),
  ).size;
  const totals = journalTotals(state);
  return {
    entries,
    balanced: state.status === "captured" && totals.debit === totals.credit && totals.debit === state.charge,
    releases: eventCount(state, "fo-release"),
  };
}
