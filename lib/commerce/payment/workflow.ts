import { acquireHold, emptyBook, releaseExpired, type Book } from "../inventory.ts";
import { warehouseCheckout } from "../stock-gate.ts";
import { recompute, type Allocation, type UnitSlice } from "./calculate.ts";
import { allocateLargestRemainder } from "./round.ts";
import { addLocalDays } from "./time.ts";

export type JournalLine = { entry: string; account: string; debit: number; credit: number };

export type TransferState = "none" | "claimed" | "transferred" | "bank_paid" | "bank_failed" | "returned";

export type PayUnit = UnitSlice & {
  stage: "held" | "committed" | "handed" | "delivered" | "canceled" | "returned";
  parcelId: string | null;
  deliveredAt: number | null;
  eligibleAt: number | null;
  supplierTransfer: TransferState;
  supplierTransferKey: string | null;
  creatorTransfer: TransferState;
  creatorTransferKey: string | null;
  refunded: boolean;
  dispute: "none" | "open" | "won" | "lost";
  foReleased: boolean;
};

export type PayState = {
  id: string;
  status: "quoted" | "checking" | "authorized" | "capture_unknown" | "captured" | "declined" | "voided";
  holdExpiresAt: number;
  attemptKey: string | null;
  providerRef: string | null;
  hashes: Record<string, string>;
  eventIds: string[];
  operationIds: string[];
  journal: JournalLine[];
  units: PayUnit[];
  pspFee: number;
  feePosted: boolean;
  events: string[];
  exceptions: string[];
  cancelIntent: boolean;
  recovery: { key: string; supplierId: string; amount: number; open: boolean }[];
  buyerRefunded: number;
  charge: number;
  backorders?: Backorder[];
  inspections?: Inspection[];
  evidence?: LocalEvidence[];
};

export type Backorder = { unitId: string; deadline: number; decision: "offered" | "accepted" | "rejected" | "timed_out" };

export type Inspection = { unitId: string; disposition: "sellable" | "quarantine" | "loss"; stockSource: string; refunded: boolean };

export type LocalEvidence = { kind: "label" | "manifest" | "courier-charge"; simulated: true; externalRequired: true; detail: string };

export type CommandResult = { ok: true; state: PayState; replayed: boolean } | { ok: false; code: string; state: PayState };

type Provider = {
  ref: string;
  status: "authorized" | "captured" | "declined" | "unknown" | "voided";
  amount: number;
  eventId: string;
};

export function startFromAllocation(input: { id: string; allocation: Allocation; now: number }): PayState {
  return {
    id: input.id,
    status: "quoted",
    holdExpiresAt: input.now + 10 * 60 * 1000,
    attemptKey: null,
    providerRef: null,
    hashes: {},
    eventIds: [],
    operationIds: [],
    journal: [],
    units: input.allocation.units.map((unit) => ({
      ...unit,
      stage: "held",
      parcelId: null,
      deliveredAt: null,
      eligibleAt: null,
      supplierTransfer: "none",
      supplierTransferKey: null,
      creatorTransfer: "none",
      creatorTransferKey: null,
      refunded: false,
      dispute: "none",
      foReleased: false,
    })),
    pspFee: input.allocation.pspFee,
    feePosted: false,
    events: ["quote"],
    exceptions: [],
    cancelIntent: false,
    recovery: [],
    buyerRefunded: 0,
    charge: input.allocation.charge,
  };
}

export function openHeldQuote(input: {
  id: string;
  allocation: Allocation;
  now: number;
  heartbeatAt: number;
  attested: boolean;
  free: number;
  book?: Book;
}): { ok: true; state: PayState; book: Book } | { ok: false; code: string; remaining?: number } {
  if (!input.attested) return { ok: false, code: "BLOCKED_NO_ATTESTATION" };
  const heartbeat = warehouseCheckout(input.heartbeatAt, input.now);
  if (!heartbeat.ok) return heartbeat;
  const book = input.book ?? emptyBook(input.free);
  const held = acquireHold(book, {
    quoteId: input.id,
    quantity: input.allocation.units.length,
    now: input.now,
    tier: "social",
    sellerId: "seller",
  });
  if (!held.ok || !("hold" in held) || !held.hold) {
    return { ok: false, code: "STOCK_CHANGED", remaining: input.free };
  }
  return {
    ok: true,
    book: held.book,
    state: {
      id: input.id,
      status: "quoted",
      holdExpiresAt: held.hold.expiresAt,
      attemptKey: null,
      providerRef: null,
      hashes: {},
      eventIds: [],
      operationIds: [],
      journal: [],
      units: input.allocation.units.map((unit) => ({
        ...unit,
        stage: "held",
        parcelId: null,
        deliveredAt: null,
        eligibleAt: null,
        supplierTransfer: "none",
        supplierTransferKey: null,
        creatorTransfer: "none",
        creatorTransferKey: null,
        refunded: false,
        dispute: "none",
        foReleased: false,
      })),
      pspFee: input.allocation.pspFee,
      feePosted: false,
      events: ["hold"],
      exceptions: [],
      cancelIntent: false,
      recovery: [],
      buyerRefunded: 0,
      charge: input.allocation.charge,
    },
  };
}

export function submitAttempt(state: PayState, input: { key: string; provider: Provider; now: number }): CommandResult {
  const hash = stable({ key: input.key, amount: input.provider.amount, ref: input.provider.ref });
  const gate = gateKey(state, input.key, hash);
  if (gate === "replay") return { ok: true, state, replayed: true };
  if (gate === "conflict") return { ok: false, code: "CONFLICT", state };
  if (state.attemptKey && state.attemptKey !== input.key) return { ok: false, code: "ATTEMPT_OPEN", state };
  if (input.provider.amount !== state.charge) return { ok: false, code: "AMOUNT", state };
  if (input.now > state.holdExpiresAt) return { ok: false, code: "HOLD_EXPIRED", state };
  if (input.provider.status === "declined") {
    return { ok: true, replayed: false, state: stamp(state, input.key, hash, { status: "declined", attemptKey: input.key, providerRef: input.provider.ref, events: [...state.events, "decline"] }) };
  }
  return {
    ok: true,
    replayed: false,
    state: stamp(state, input.key, hash, {
      status: "checking",
      attemptKey: input.key,
      providerRef: input.provider.ref,
      events: [...state.events, "authorize-request"],
    }),
  };
}

export function authorize(state: PayState, input: { key: string; provider: Provider; now: number }): CommandResult {
  const hash = stable({ key: input.key, ref: input.provider.ref, amount: input.provider.amount });
  const gate = gateKey(state, input.key, hash);
  if (gate === "replay") return { ok: true, state, replayed: true };
  if (gate === "conflict") return { ok: false, code: "CONFLICT", state };
  if (input.provider.status !== "authorized" && input.provider.status !== "captured") {
    return { ok: false, code: "NOT_AUTHORIZED", state };
  }
  if (input.now > state.holdExpiresAt || state.status === "voided") {
    return {
      ok: true,
      replayed: false,
      state: stamp(state, input.key, hash, { status: "voided", events: [...state.events, "void-late-auth"] }),
    };
  }
  if (state.status === "captured" || state.status === "authorized") return { ok: true, state, replayed: true };
  return {
    ok: true,
    replayed: false,
    state: stamp(state, input.key, hash, {
      status: "authorized",
      providerRef: input.provider.ref,
      units: state.units.map((unit) => (unit.stage === "held" ? { ...unit, stage: "committed" } : unit)),
      events: [...state.events, "commit"],
    }),
  };
}

export function captureResult(state: PayState, input: { key: string; provider: Provider; eventId: string }): CommandResult {
  const operationId = `capture:${state.id}`;
  if (state.operationIds.includes(operationId) && state.status === "captured") {
    if (!state.eventIds.includes(input.eventId)) {
      return { ok: true, replayed: true, state: { ...state, eventIds: [...state.eventIds, input.eventId], events: [...state.events, "duplicate-event"] } };
    }
    return { ok: true, state, replayed: true };
  }
  const hash = stable({ key: input.key, ref: input.provider.ref, amount: input.provider.amount, status: input.provider.status });
  const gate = gateKey(state, input.key, hash);
  if (gate === "replay") return { ok: true, state, replayed: true };
  if (gate === "conflict") return { ok: false, code: "CONFLICT", state };
  if (input.provider.amount !== state.charge) return { ok: false, code: "AMOUNT", state };
  if (input.provider.status === "unknown") {
    return {
      ok: true,
      replayed: false,
      state: stamp(state, input.key, hash, {
        status: "capture_unknown",
        providerRef: input.provider.ref,
        events: [...state.events, "capture-unknown"],
      }),
    };
  }
  if (input.provider.status === "declined" || input.provider.status === "voided") {
    return {
      ok: true,
      replayed: false,
      state: stamp(state, input.key, hash, {
        status: "declined",
        units: state.units.map((unit) => (unit.stage === "committed" || unit.stage === "held" ? { ...unit, stage: "canceled" } : unit)),
        events: [...state.events, "capture-failed"],
      }),
    };
  }
  if (input.provider.status !== "captured") return { ok: false, code: "NOT_CAPTURED", state };
  const entry = `capture:${input.eventId}`;
  const journal = [...state.journal, ...captureLines(state, entry), ...feeLines(state, entry)];
  const suppliers = [...new Set(state.units.map((unit) => unit.supplierId))];
  const next = stamp(state, input.key, hash, {
    status: "captured",
    providerRef: input.provider.ref,
    feePosted: true,
    journal,
    eventIds: [...state.eventIds, input.eventId],
    operationIds: [...state.operationIds, operationId],
    units: state.units.map((unit) => ({ ...unit, foReleased: state.cancelIntent ? false : true })),
    events: [...state.events, "capture", ...(state.cancelIntent ? ["fo-suppressed"] : suppliers.map((supplier) => `fo-release:${supplier}`))],
  });
  return { ok: true, replayed: false, state: next };
}

export function lookupUnknown(state: PayState, input: { key: string; provider: Provider }): CommandResult {
  if (state.status !== "capture_unknown") return { ok: false, code: "NOT_UNKNOWN", state };
  if (input.provider.ref !== state.providerRef) return { ok: false, code: "REFERENCE", state };
  return captureResult({ ...state, status: "authorized" }, { key: input.key, provider: input.provider, eventId: input.provider.eventId });
}

export function cancelPending(state: PayState, input: { key: string; provider: Provider | null }): CommandResult {
  const hash = stable({ key: input.key, ref: input.provider?.ref ?? null, status: input.provider?.status ?? "none" });
  const gate = gateKey(state, input.key, hash);
  if (gate === "replay") return { ok: true, state, replayed: true };
  if (gate === "conflict") return { ok: false, code: "CONFLICT", state };
  if (state.status === "captured" || input.provider?.status === "captured") {
    const withIntent = { ...state, cancelIntent: true };
    const captured = withIntent.status === "captured" ? { ok: true as const, state: withIntent, replayed: false } : captureResult(withIntent, { key: `${input.key}:capture`, provider: input.provider as Provider, eventId: input.provider?.eventId ?? "late-capture" });
    if (!captured.ok) return captured;
    return refundUnits(captured.state, { key: `${input.key}:refund`, unitIds: captured.state.units.map((unit) => unit.id), reason: "cancel-after-capture" });
  }
  return {
    ok: true,
    replayed: false,
    state: stamp(state, input.key, hash, {
      status: "voided",
      units: state.units.map((unit) => ({ ...unit, stage: "canceled", foReleased: false })),
      events: [...state.events, "void"],
    }),
  };
}

export function rejectBeforeHandoff(state: PayState, input: { key: string; unitIds: string[] }): CommandResult {
  return cancelUnits(state, input.key, input.unitIds, "reject");
}

export function requestStop(state: PayState, input: { key: string; unitId: string }): CommandResult {
  return cancelUnits(state, input.key, [input.unitId], "stop");
}

export function handoffUnit(state: PayState, input: { key: string; unitId: string; parcelId: string }): CommandResult {
  const hash = stable(input);
  const gate = gateKey(state, input.key, hash);
  if (gate === "replay") return { ok: true, state, replayed: true };
  if (gate === "conflict") return { ok: false, code: "CONFLICT", state };
  const unit = state.units.find((row) => row.id === input.unitId);
  if (!unit) return { ok: false, code: "MISSING", state };
  if (unit.stage === "handed" || unit.stage === "delivered") return { ok: true, state, replayed: true };
  if (unit.stage === "canceled" || unit.stage === "returned") return { ok: false, code: "STOPPED", state };
  if (!unit.foReleased || state.status !== "captured") return { ok: false, code: "NOT_RELEASED", state };
  return {
    ok: true,
    replayed: false,
    state: stamp(state, input.key, hash, {
      units: state.units.map((row) => (row.id === unit.id ? { ...row, stage: "handed", parcelId: input.parcelId } : row)),
      events: [...state.events, `handoff:${unit.id}`],
    }),
  };
}

export function markTransit(state: PayState, input: { key: string; parcelId: string }): CommandResult {
  const delivered = state.units.some((unit) => unit.parcelId === input.parcelId && (unit.stage === "delivered" || unit.stage === "returned"));
  if (delivered) return { ok: true, state, replayed: true };
  return { ok: true, replayed: false, state: { ...state, events: [...state.events, `transit:${input.parcelId}`] } };
}

export function deliverParcel(state: PayState, input: { key: string; parcelId: string; at: number }): CommandResult {
  const hash = stable(input);
  const gate = gateKey(state, input.key, hash);
  if (gate === "replay") return { ok: true, state, replayed: true };
  if (gate === "conflict") return { ok: false, code: "CONFLICT", state };
  const eligibleAt = addLocalDays(input.at, 7, "Asia/Jerusalem");
  let changed = false;
  const units = state.units.map((unit) => {
    if (unit.parcelId !== input.parcelId || unit.stage !== "handed") return unit;
    changed = true;
    return { ...unit, stage: "delivered" as const, deliveredAt: input.at, eligibleAt };
  });
  if (!changed) return { ok: false, code: "NOTHING", state };
  const suppliers = [...new Set(units.filter((unit) => unit.parcelId === input.parcelId && unit.deliveredAt === input.at).map((unit) => unit.supplierId))];
  return {
    ok: true,
    replayed: false,
    state: stamp(state, input.key, hash, {
      units,
      events: [...state.events, ...suppliers.map((supplier) => `clock:${supplier}`)],
    }),
  };
}

export function claimTransfer(state: PayState, input: { key: string; now: number; party: "supplier" | "creator"; supplierId?: string }): CommandResult {
  const hash = stable(input);
  const gate = gateKey(state, input.key, hash);
  if (gate === "replay") return { ok: true, state, replayed: true };
  if (gate === "conflict") return { ok: false, code: "CONFLICT", state };
  const units = state.units.filter((unit) => transferable(unit, input.now, input.party, input.supplierId));
  const amount = units.reduce((sum, unit) => sum + (input.party === "supplier" ? unit.supplierPayable : unit.creatorPayable), 0);
  if (amount < 1) return { ok: false, code: "NOT_ELIGIBLE", state };
  const claimed = new Set(units.map((unit) => unit.id));
  const entry = `transfer:${input.key}`;
  const account = input.party === "supplier" ? `supplier-payable:${input.supplierId}` : "creator-payable";
  return {
    ok: true,
    replayed: false,
    state: stamp(state, input.key, hash, {
      units: state.units.map((unit) => (claimed.has(unit.id) ? setTransfer(unit, input.party, "claimed", input.key) : unit)),
      journal: [...state.journal, { entry, account, debit: amount, credit: 0 }, { entry, account: "psp-clearing", debit: 0, credit: amount }],
      operationIds: [...state.operationIds, entry],
      events: [...state.events, `transfer:${input.party}:${input.supplierId ?? "creator"}`],
    }),
  };
}

export function markTransferred(state: PayState, transferKey: string): PayState {
  return {
    ...state,
    units: state.units.map((unit) => ({
      ...unit,
      supplierTransfer: unit.supplierTransfer === "claimed" && transferKeyOf(unit, "supplier") === transferKey ? "transferred" : unit.supplierTransfer,
      creatorTransfer: unit.creatorTransfer === "claimed" && transferKeyOf(unit, "creator") === transferKey ? "transferred" : unit.creatorTransfer,
    })),
  };
}

export function confirmBank(state: PayState, input: { key: string; transferKey: string; party: "supplier" | "creator"; outcome: "paid" | "failed" }): CommandResult {
  const hash = stable(input);
  const gate = gateKey(state, input.key, hash);
  if (gate === "replay") return { ok: true, state, replayed: true };
  if (gate === "conflict") return { ok: false, code: "CONFLICT", state };
  const status: TransferState = input.outcome === "paid" ? "bank_paid" : "bank_failed";
  return {
    ok: true,
    replayed: false,
    state: stamp(state, input.key, hash, {
      units: state.units.map((unit) => (transferKeyOf(unit, input.party) === input.transferKey ? setTransfer(unit, input.party, status, input.transferKey) : unit)),
      events: [...state.events, `bank:${input.outcome}`],
    }),
  };
}

export function returnToBalance(state: PayState, input: { key: string; transferKey: string; party: "supplier" | "creator"; supplierId?: string }): CommandResult {
  const hash = stable(input);
  const gate = gateKey(state, input.key, hash);
  if (gate === "replay") return { ok: true, state, replayed: true };
  if (gate === "conflict") return { ok: false, code: "CONFLICT", state };
  const units = state.units.filter((unit) => transferKeyOf(unit, input.party) === input.transferKey && transferOf(unit, input.party) === "bank_failed");
  const amount = units.reduce((sum, unit) => sum + (input.party === "supplier" ? unit.supplierPayable : unit.creatorPayable), 0);
  if (amount < 1) return { ok: false, code: "NOTHING", state };
  const entry = `return-balance:${input.key}`;
  const account = input.party === "supplier" ? `supplier-payable:${input.supplierId ?? units[0]?.supplierId}` : "creator-payable";
  return {
    ok: true,
    replayed: false,
    state: stamp(state, input.key, hash, {
      units: state.units.map((unit) => (transferKeyOf(unit, input.party) === input.transferKey ? setTransfer(unit, input.party, "returned", null) : unit)),
      journal: [...state.journal, { entry, account: "psp-clearing", debit: amount, credit: 0 }, { entry, account, debit: 0, credit: amount }],
      events: [...state.events, "return-to-balance"],
    }),
  };
}

export function refundUnits(state: PayState, input: { key: string; unitIds: string[]; reason: string }): CommandResult {
  const hash = stable(input);
  const gate = gateKey(state, input.key, hash);
  if (gate === "replay") return { ok: true, state, replayed: true };
  if (gate === "conflict") return { ok: false, code: "CONFLICT", state };
  if (state.status !== "captured") return { ok: false, code: "NOT_CAPTURED", state };
  const selected = state.units.filter((unit) => input.unitIds.includes(unit.id));
  if (selected.some((unit) => unit.refunded)) return { ok: false, code: "ALREADY", state };
  if (selected.some((unit) => unit.dispute === "open")) return { ok: false, code: "DISPUTE_OPEN", state };
  const parts = selected.map((unit) => refundPart(unit, input.reason));
  const buyer = parts.reduce((sum, part) => sum + part.buyer, 0);
  if (buyer < 1) return { ok: false, code: "NOTHING", state };
  if (state.buyerRefunded + buyer > state.charge) return { ok: false, code: "EXCEEDS", state };
  const entry = `refund:${input.key}`;
  const journal = [...state.journal];
  const recovery = [...state.recovery];
  for (const part of parts) {
    journal.push({ entry, account: "psp-clearing", debit: 0, credit: part.buyer });
    if (part.supplier > 0) {
      const transferred = sent(part.unit.supplierTransfer);
      if (transferred) {
        recovery.push({ key: input.key, supplierId: part.unit.supplierId, amount: part.supplier, open: true });
        journal.push({ entry, account: `recovery-receivable:${part.unit.supplierId}`, debit: part.supplier, credit: 0 });
      } else {
        journal.push({ entry, account: `supplier-payable:${part.unit.supplierId}`, debit: part.supplier, credit: 0 });
      }
    }
    if (part.creator > 0) {
      if (sent(part.unit.creatorTransfer)) {
        recovery.push({ key: input.key, supplierId: "creator", amount: part.creator, open: true });
        journal.push({ entry, account: "recovery-receivable:creator", debit: part.creator, credit: 0 });
      } else {
        journal.push({ entry, account: "creator-payable", debit: part.creator, credit: 0 });
      }
    }
    if (part.fee > 0) journal.push({ entry, account: "platform-revenue", debit: part.fee, credit: 0 });
    if (part.tax > 0) journal.push({ entry, account: "tax-payable", debit: part.tax, credit: 0 });
  }
  const ids = new Set(input.unitIds);
  return {
    ok: true,
    replayed: false,
    state: stamp(state, input.key, hash, {
      journal,
      recovery,
      buyerRefunded: state.buyerRefunded + buyer,
      operationIds: [...state.operationIds, entry],
      units: state.units.map((unit) => (ids.has(unit.id) ? { ...unit, refunded: true, stage: unit.stage === "delivered" || unit.stage === "handed" ? "returned" : "canceled" } : unit)),
      events: [...state.events, `refund:${buyer}`],
    }),
  };
}

export function openDispute(state: PayState, input: { key: string; unitIds: string[] }): CommandResult {
  const hash = stable(input);
  const gate = gateKey(state, input.key, hash);
  if (gate === "replay") return { ok: true, state, replayed: true };
  if (gate === "conflict") return { ok: false, code: "CONFLICT", state };
  const ids = new Set(input.unitIds);
  return {
    ok: true,
    replayed: false,
    state: stamp(state, input.key, hash, {
      units: state.units.map((unit) => (ids.has(unit.id) ? { ...unit, dispute: "open" } : unit)),
      events: [...state.events, "dispute"],
    }),
  };
}

export function recordDuplicateDebit(state: PayState, input: { key: string; amount: number; eventId: string }): CommandResult {
  if (state.eventIds.includes(input.eventId) || state.operationIds.includes(`capture:${state.id}`)) {
    const entry = `exception:${input.eventId}`;
    if (state.journal.some((line) => line.entry === entry)) return { ok: true, state, replayed: true };
    return {
      ok: true,
      replayed: false,
      state: {
        ...state,
        eventIds: [...state.eventIds, input.eventId],
        exceptions: [...state.exceptions, entry],
        journal: [
          ...state.journal,
          { entry, account: "psp-exception", debit: input.amount, credit: 0 },
          { entry, account: "psp-clearing", debit: 0, credit: input.amount },
        ],
        events: [...state.events, "exception"],
      },
    };
  }
  return { ok: false, code: "NOT_DUPLICATE", state };
}

export function journalTotals(state: PayState): { debit: number; credit: number } {
  return {
    debit: state.journal.reduce((sum, line) => sum + line.debit, 0),
    credit: state.journal.reduce((sum, line) => sum + line.credit, 0),
  };
}

export function accountNet(state: PayState, account: string): number {
  return state.journal.filter((line) => line.account === account).reduce((sum, line) => sum + line.credit - line.debit, 0);
}

export function eventCount(state: PayState, prefix: string): number {
  return state.events.filter((event) => event === prefix || event.startsWith(`${prefix}:`)).length;
}

export function releaseExpiredHold(book: Book, now: number): Book {
  return releaseExpired(book, now).book;
}

function cancelUnits(state: PayState, key: string, unitIds: string[], reason: string): CommandResult {
  const hash = stable({ key, unitIds, reason });
  const gate = gateKey(state, key, hash);
  if (gate === "replay") return { ok: true, state, replayed: true };
  if (gate === "conflict") return { ok: false, code: "CONFLICT", state };
  const units = state.units.map((unit) => ({ ...unit }));
  const cancelable: string[] = [];
  for (const unitId of unitIds) {
    const unit = units.find((row) => row.id === unitId);
    if (!unit || unit.stage === "handed" || unit.stage === "delivered" || unit.stage === "canceled" || unit.stage === "returned") continue;
    cancelable.push(unitId);
    const peers = units.filter((row) => row.serviceGroup === unit.serviceGroup && row.id !== unit.id && row.stage !== "canceled" && row.stage !== "returned" && !unitIds.includes(row.id));
    if (peers.length > 0) moveService(unit, peers);
  }
  if (cancelable.length === 0) return { ok: false, code: "STOPPED", state };
  const next = { ...state, units };
  if (next.status !== "captured") {
    return {
      ok: true,
      replayed: false,
      state: stamp(next, key, hash, {
        units: next.units.map((unit) => (cancelable.includes(unit.id) ? { ...unit, stage: "canceled" } : unit)),
        events: [...next.events, reason],
      }),
    };
  }
  const refunded = refundUnits(next, { key: `${key}:refund`, unitIds: cancelable, reason });
  if (!refunded.ok) return refunded;
  return { ok: true, replayed: false, state: { ...refunded.state, hashes: { ...refunded.state.hashes, [key]: hash } } };
}

function moveService(unit: PayUnit, peers: PayUnit[]): void {
  const freight = allocateLargestRemainder(unit.buyerFreight, peers.map((peer) => ({ id: peer.id, weight: Math.max(peer.retail, 1) })));
  const supplierFreight = allocateLargestRemainder(unit.supplierFreight, peers.map((peer) => ({ id: peer.id, weight: Math.max(peer.retail, 1) })));
  const packing = allocateLargestRemainder(unit.packing, peers.map((peer) => ({ id: peer.id, weight: Math.max(peer.retail, 1) })));
  for (const peer of peers) {
    peer.buyerFreight += freight.get(peer.id) ?? 0;
    peer.supplierFreight += supplierFreight.get(peer.id) ?? 0;
    peer.packing += packing.get(peer.id) ?? 0;
    recompute(peer);
  }
  unit.buyerFreight = 0;
  unit.supplierFreight = 0;
  unit.packing = 0;
  recompute(unit);
}

function refundPart(unit: PayUnit, reason: string): { unit: PayUnit; buyer: number; supplier: number; creator: number; fee: number; tax: number } {
  const delivered = reason === "return" || unit.stage === "delivered" || unit.stage === "returned";
  const keepService = delivered || unit.buyerFreight === 0;
  const supplier = unit.payableWholesale - unit.supplierCommission + (keepService ? 0 : unit.supplierFreight + unit.packing);
  const creator = unit.retail - unit.payableWholesale - unit.creatorCommission + (keepService ? 0 : unit.buyerFreight - unit.supplierFreight - unit.packing);
  const fee = unit.supplierCommission + unit.creatorCommission + (delivered ? 0 : unit.buyerFee);
  const tax = unit.tax;
  const buyer = supplier + creator + fee + tax;
  return { unit, buyer, supplier, creator, fee, tax };
}

function captureLines(state: PayState, entry: string): JournalLine[] {
  const lines: JournalLine[] = [{ entry, account: "psp-clearing", debit: state.charge, credit: 0 }];
  const suppliers = [...new Set(state.units.map((unit) => unit.supplierId))];
  for (const supplierId of suppliers) {
    const amount = state.units.filter((unit) => unit.supplierId === supplierId).reduce((sum, unit) => sum + unit.supplierPayable, 0);
    if (amount !== 0) lines.push({ entry, account: `supplier-payable:${supplierId}`, debit: 0, credit: amount });
  }
  const creator = state.units.reduce((sum, unit) => sum + unit.creatorPayable, 0);
  const revenue = state.units.reduce((sum, unit) => sum + unit.storeyGross, 0);
  const tax = state.units.reduce((sum, unit) => sum + unit.tax, 0);
  if (creator !== 0) lines.push({ entry, account: "creator-payable", debit: 0, credit: creator });
  if (revenue !== 0) lines.push({ entry, account: "platform-revenue", debit: 0, credit: revenue });
  if (tax !== 0) lines.push({ entry, account: "tax-payable", debit: 0, credit: tax });
  return lines;
}

function feeLines(state: PayState, entry: string): JournalLine[] {
  if (state.pspFee < 1 || state.feePosted) return [];
  return [
    { entry: `${entry}:fee`, account: "processing-expense", debit: state.pspFee, credit: 0 },
    { entry: `${entry}:fee`, account: "psp-clearing", debit: 0, credit: state.pspFee },
  ];
}

function transferable(unit: PayUnit, now: number, party: "supplier" | "creator", supplierId?: string): boolean {
  const status = transferOf(unit, party);
  if (unit.refunded || unit.dispute === "open" || (status !== "none" && status !== "returned")) return false;
  if (unit.stage !== "delivered" || unit.eligibleAt === null || now < unit.eligibleAt) return false;
  if (party === "supplier" && supplierId && unit.supplierId !== supplierId) return false;
  const amount = party === "supplier" ? unit.supplierPayable : unit.creatorPayable;
  return amount > 0;
}

function transferOf(unit: PayUnit, party: "supplier" | "creator"): TransferState {
  return party === "supplier" ? unit.supplierTransfer : unit.creatorTransfer;
}

function transferKeyOf(unit: PayUnit, party: "supplier" | "creator"): string | null {
  return party === "supplier" ? unit.supplierTransferKey : unit.creatorTransferKey;
}

function setTransfer(unit: PayUnit, party: "supplier" | "creator", status: TransferState, key: string | null): PayUnit {
  return party === "supplier"
    ? { ...unit, supplierTransfer: status, supplierTransferKey: key }
    : { ...unit, creatorTransfer: status, creatorTransferKey: key };
}

function sent(status: TransferState): boolean {
  return status === "claimed" || status === "transferred" || status === "bank_paid" || status === "bank_failed";
}

function gateKey(state: PayState, key: string, hash: string): "new" | "replay" | "conflict" {
  const prior = state.hashes[key];
  if (!prior) return "new";
  return prior === hash ? "replay" : "conflict";
}

function stamp(state: PayState, key: string, hash: string, patch: Partial<PayState>): PayState {
  return { ...state, ...patch, hashes: { ...state.hashes, [key]: hash } };
}

function stable(value: unknown): string {
  return JSON.stringify(value);
}

export function offerBackorder(state: PayState, input: { key: string; unitIds: string[]; deadline: number }): CommandResult {
  const hash = stable(input);
  const gate = gateKey(state, input.key, hash);
  if (gate === "replay") return { ok: true, state, replayed: true };
  if (gate === "conflict") return { ok: false, code: "CONFLICT", state };
  const offered = input.unitIds.filter((unitId) => state.units.some((unit) => unit.id === unitId && (unit.stage === "committed" || unit.stage === "held")));
  if (offered.length === 0) return { ok: false, code: "NOTHING", state };
  const prior = state.backorders ?? [];
  return {
    ok: true,
    replayed: false,
    state: stamp(state, input.key, hash, {
      backorders: [...prior.filter((row) => !offered.includes(row.unitId)), ...offered.map((unitId) => ({ unitId, deadline: input.deadline, decision: "offered" as const }))],
      events: [...state.events, "backorder-offered"],
    }),
  };
}

export function acceptBackorder(state: PayState, input: { key: string; unitId: string; now: number }): CommandResult {
  const hash = stable(input);
  const gate = gateKey(state, input.key, hash);
  if (gate === "replay") return { ok: true, state, replayed: true };
  if (gate === "conflict") return { ok: false, code: "CONFLICT", state };
  const row = (state.backorders ?? []).find((item) => item.unitId === input.unitId && item.decision === "offered");
  if (!row || input.now > row.deadline) return { ok: false, code: "DEADLINE", state };
  return {
    ok: true,
    replayed: false,
    state: stamp(state, input.key, hash, {
      backorders: (state.backorders ?? []).map((item) => (item.unitId === input.unitId ? { ...item, decision: "accepted" as const } : item)),
      events: [...state.events, "backorder-accepted"],
    }),
  };
}

export function resolveBackorder(state: PayState, input: { key: string; unitId: string; now: number; decision: "rejected" | "timed_out" }): CommandResult {
  const row = (state.backorders ?? []).find((item) => item.unitId === input.unitId);
  if (!row || row.decision !== "offered") return { ok: false, code: "NOTHING", state };
  if (input.decision === "timed_out" && input.now <= row.deadline) return { ok: false, code: "OPEN", state };
  const marked = {
    ...state,
    backorders: (state.backorders ?? []).map((item) => (item.unitId === input.unitId ? { ...item, decision: input.decision } : item)),
  };
  return rejectBeforeHandoff(marked, { key: input.key, unitIds: [input.unitId] });
}

export function inspectUnit(state: PayState, input: { key: string; unitId: string; disposition: Inspection["disposition"]; refund: boolean }): CommandResult {
  const hash = stable(input);
  const gate = gateKey(state, input.key, hash);
  if (gate === "replay") return { ok: true, state, replayed: true };
  if (gate === "conflict") return { ok: false, code: "CONFLICT", state };
  const unit = state.units.find((row) => row.id === input.unitId);
  if (!unit) return { ok: false, code: "MISSING", state };
  const inspection: Inspection = { unitId: unit.id, disposition: input.disposition, stockSource: unit.supplierId, refunded: input.refund };
  const noted = stamp(state, input.key, hash, { inspections: [...(state.inspections ?? []), inspection], events: [...state.events, `inspect:${input.disposition}`] });
  if (!input.refund || unit.refunded) return { ok: true, replayed: false, state: noted };
  return refundUnits(noted, { key: `${input.key}:refund`, unitIds: [unit.id], reason: "return" });
}

export function localFulfillmentEvidence(): LocalEvidence[] {
  return [
    { kind: "label", simulated: true, externalRequired: true, detail: "A local label id can be stored. Buying the label from a carrier is an external integration." },
    { kind: "manifest", simulated: true, externalRequired: true, detail: "The parcel id and unit list are stored locally. Carrier acceptance of the manifest is external." },
    { kind: "courier-charge", simulated: true, externalRequired: true, detail: "A simulated courier amount is a separate cost note. A real courier invoice is external and is not charged to the buyer." },
  ];
}

export function recordLocalEvidence(state: PayState, input: { key: string; parcelId: string }): CommandResult {
  const hash = stable(input);
  const gate = gateKey(state, input.key, hash);
  if (gate === "replay") return { ok: true, state, replayed: true };
  if (gate === "conflict") return { ok: false, code: "CONFLICT", state };
  return {
    ok: true,
    replayed: false,
    state: stamp(state, input.key, hash, {
      evidence: localFulfillmentEvidence(),
      events: [...state.events, `label:${input.parcelId}`],
    }),
  };
}
