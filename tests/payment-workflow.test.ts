import assert from "node:assert/strict";
import test from "node:test";
import { capture, emptyLedger, zeroTaxCapture } from "../lib/commerce/ledger.ts";
import { HOLD_MS, emptyBook } from "../lib/commerce/inventory.ts";
import { priceQuote, testRates, type QuoteInput, type QuoteLine } from "../lib/commerce/payment/calculate.ts";
import { captureTestAdapter } from "../lib/commerce/payment/sandbox.ts";
import { captureEvidence, recoverAcceptedCharge, unknownAfterAcceptance } from "../lib/commerce/payment/recover.ts";
import { ORIGINAL_POLICY, PAYMENT_POLICY, paymentPolicyForNewQuotes, paymentPolicyForSeller } from "../lib/commerce/payment/flag.ts";
import { acceptBackorder, inspectUnit, localFulfillmentEvidence, offerBackorder, recordLocalEvidence, resolveBackorder } from "../lib/commerce/payment/workflow.ts";
import { addLocalDays } from "../lib/commerce/payment/time.ts";
import { buyerView, creatorView, supplierView } from "../lib/commerce/payment/views.ts";
import {
  accountNet,
  authorize,
  cancelPending,
  captureResult,
  claimTransfer,
  confirmBank,
  deliverParcel,
  eventCount,
  handoffUnit,
  journalTotals,
  lookupUnknown,
  markTransit,
  openDispute,
  openHeldQuote,
  recordDuplicateDebit,
  refundUnits,
  rejectBeforeHandoff,
  releaseExpiredHold,
  requestStop,
  returnToBalance,
  submitAttempt,
  type PayState,
} from "../lib/commerce/payment/workflow.ts";

const NOW = Date.parse("2026-01-15T10:00:00.000Z");

function line(input: Partial<QuoteLine> & Pick<QuoteLine, "id" | "supplierId">): QuoteLine {
  return {
    sku: input.id,
    quantity: 1,
    unitRetailAgorot: 5900,
    unitWholesaleAgorot: 2400,
    prepaidQuantity: 0,
    serviceGroup: "ship",
    taxAgorot: 0,
    ...input,
  };
}

function quote(input: Partial<QuoteInput> & Pick<QuoteInput, "lines">): QuoteInput {
  return {
    ...testRates(),
    services: [{ id: "ship", buyerFreightAgorot: 0, supplierFreightAgorot: 0, packingAgorot: 0 }],
    buyerFeeAgorot: 0,
    discountAgorot: 0,
    pspFeeAgorot: 0,
    ...input,
  };
}

function allocation(input: QuoteInput) {
  const priced = priceQuote(input);
  if (!priced.ok) throw new Error(priced.code);
  return priced.allocation;
}

function hold(input: QuoteInput, id = "q1"): PayState {
  const opened = openHeldQuote({ id, allocation: allocation(input), now: NOW, heartbeatAt: NOW, attested: true, free: 20 });
  if (!opened.ok) throw new Error(opened.code);
  return opened.state;
}

function provider(amount: number, status: "authorized" | "captured" | "declined" | "unknown" | "voided", ref = "psp-1", eventId = "evt-1") {
  return { ref, status, amount, eventId };
}

function pay(state: PayState): PayState {
  const submitted = submitAttempt(state, { key: "attempt", provider: provider(state.charge, "authorized"), now: NOW });
  if (!submitted.ok) throw new Error(submitted.code);
  const authorized = authorize(submitted.state, { key: "auth", provider: provider(state.charge, "authorized"), now: NOW });
  if (!authorized.ok) throw new Error(authorized.code);
  const captured = captureResult(authorized.state, { key: "capture", provider: provider(state.charge, "captured"), eventId: "evt-1" });
  if (!captured.ok) throw new Error(captured.code);
  return captured.state;
}

function balanced(state: PayState): void {
  const totals = journalTotals(state);
  assert.equal(totals.debit, totals.credit);
}

test("new quotes stay on the original policy until the pilot flag is set", () => {
  const previous = process.env.STOREY_PAYMENT_POLICY;
  delete process.env.STOREY_PAYMENT_POLICY;
  assert.equal(paymentPolicyForNewQuotes(), ORIGINAL_POLICY);
  if (previous === undefined) delete process.env.STOREY_PAYMENT_POLICY;
  else process.env.STOREY_PAYMENT_POLICY = previous;
});

test("the test adapter captures one pack without a live charge", () => {
  const captured = captureTestAdapter({
    id: "sandbox-1",
    quantity: 1,
    retailAgorot: 5900,
    wholesaleAgorot: 2400,
    supplierId: "pilot",
    now: NOW,
  });
  assert.equal(captured.ok, true);
  if (!captured.ok) return;
  assert.equal(captured.adapter, "test");
  assert.equal(captured.live, false);
  assert.equal(captured.state.charge, 5900);
  assert.equal(accountNet(captured.state, "supplier-payable:pilot"), 2280);
  assert.equal(accountNet(captured.state, "creator-payable"), 3150);
});

test("a cohort enrolls one seller in the same process and a stored policy survives the pause", () => {
  const open = { enabled: true, sellers: ["creator"] };
  assert.equal(paymentPolicyForSeller("creator", open), PAYMENT_POLICY);
  assert.equal(paymentPolicyForSeller("maya", open), ORIGINAL_POLICY);
  const paused = { enabled: false, sellers: ["creator"] };
  assert.equal(paymentPolicyForSeller("creator", paused), ORIGINAL_POLICY);
  const stored = pay(hold(quote({ lines: [line({ id: "a", supplierId: "a" })] })));
  assert.equal(stored.status, "captured");
  assert.equal(accountNet(stored, "supplier-payable:a"), 2280);
});

test("an accepted capture recovers one journal when confirmation was not stored", () => {
  const priced = allocation(quote({ lines: [line({ id: "item", supplierId: "PILOT-01", unitRetailAgorot: 5000, unitWholesaleAgorot: 3200 })] }));
  const charge = {
    ref: "test-restart",
    orderId: "ord-restart",
    amount: priced.charge,
    eventId: "test-capture",
    status: "captured" as const,
    acceptedAt: NOW,
    allocation: priced,
  };
  const unknown = unknownAfterAcceptance(charge);
  assert.ok(unknown);
  if (!unknown) return;
  assert.equal(unknown.status, "capture_unknown");
  assert.equal(unknown.journal.length, 0);
  const recovered = recoverAcceptedCharge(charge, unknown);
  assert.ok(recovered);
  if (!recovered) return;
  assert.equal(recovered.replayed, false);
  const evidence = captureEvidence(recovered.state);
  assert.deepEqual(evidence, { entries: 1, balanced: true, releases: 1 });
  assert.equal(recovered.state.charge, 5000);
  const again = recoverAcceptedCharge(charge, recovered.state);
  assert.equal(again?.replayed, true);
  assert.equal(again?.state.journal.length, recovered.state.journal.length);
});

test("backorder acceptance keeps the unit and rejection or timeout refunds it once", () => {
  const captured = pay(hold(quote({ lines: [line({ id: "a", supplierId: "a" })] })));
  const offered = offerBackorder(captured, { key: "offer", unitIds: ["a#1"], deadline: NOW + 1_000 });
  assert.equal(offered.ok, true);
  if (!offered.ok) return;
  const accepted = acceptBackorder(offered.state, { key: "accept", unitId: "a#1", now: NOW });
  assert.equal(accepted.ok, true);
  if (!accepted.ok) return;
  assert.equal(accepted.state.buyerRefunded, 0);
  assert.equal(accepted.state.backorders?.[0]?.decision, "accepted");
  const late = pay(hold(quote({ lines: [line({ id: "a", supplierId: "a" })] }), "backorder-timeout"));
  const second = offerBackorder(late, { key: "offer-2", unitIds: ["a#1"], deadline: NOW + 1_000 });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  const tooSoon = resolveBackorder(second.state, { key: "early", unitId: "a#1", now: NOW, decision: "timed_out" });
  assert.equal(tooSoon.ok, false);
  const timed = resolveBackorder(second.state, { key: "timeout", unitId: "a#1", now: NOW + 1_001, decision: "timed_out" });
  assert.equal(timed.ok, true);
  if (!timed.ok) return;
  assert.equal(timed.state.buyerRefunded, 5900);
  const rejectedOffer = offerBackorder(pay(hold(quote({ lines: [line({ id: "a", supplierId: "a" })] }), "backorder-reject")), { key: "offer-3", unitIds: ["a#1"], deadline: NOW + 5_000 });
  assert.equal(rejectedOffer.ok, true);
  if (!rejectedOffer.ok) return;
  const rejected = resolveBackorder(rejectedOffer.state, { key: "reject", unitId: "a#1", now: NOW, decision: "rejected" });
  assert.equal(rejected.ok, true);
  if (!rejected.ok) return;
  assert.equal(rejected.state.buyerRefunded, 5900);
  assert.equal(eventCount(rejected.state, "refund"), 1);
});

test("inspection records the stock source and local evidence stays short of a carrier", () => {
  let state = pay(hold(quote({ lines: [line({ id: "a", supplierId: "pilot" })] })));
  const handed = handoffUnit(state, { key: "hand", unitId: "a#1", parcelId: "p" });
  assert.equal(handed.ok, true);
  if (!handed.ok) return;
  const delivered = deliverParcel(handed.state, { key: "deliver", parcelId: "p", at: NOW });
  assert.equal(delivered.ok, true);
  if (!delivered.ok) return;
  const inspected = inspectUnit(delivered.state, { key: "inspect", unitId: "a#1", disposition: "quarantine", refund: true });
  assert.equal(inspected.ok, true);
  if (!inspected.ok) return;
  assert.equal(inspected.state.inspections?.[0]?.stockSource, "pilot");
  assert.equal(inspected.state.inspections?.[0]?.disposition, "quarantine");
  assert.equal(inspected.state.buyerRefunded, 5900);
  const noted = recordLocalEvidence(inspected.state, { key: "evidence", parcelId: "p" });
  assert.equal(noted.ok, true);
  if (!noted.ok) return;
  assert.equal(noted.state.evidence?.every((item) => item.simulated && item.externalRequired), true);
  assert.equal(localFulfillmentEvidence().map((item) => item.kind).join(","), "label,manifest,courier-charge");
  state = noted.state;
  assert.equal(eventCount(state, "label"), 1);
});

test("QA-01 pickup capture is replay-safe and balances to the agora", () => {
  const state = pay(hold(quote({ lines: [line({ id: "a", supplierId: "a" })], pspFeeAgorot: 160 })));
  assert.equal(state.charge, 5900);
  assert.equal(accountNet(state, "supplier-payable:a"), 2280);
  assert.equal(accountNet(state, "creator-payable"), 3150);
  assert.equal(accountNet(state, "platform-revenue"), 470);
  assert.equal(accountNet(state, "processing-expense"), -160);
  assert.equal(2280 + 3150 + 470, 5900);
  assert.equal(2280 + 3150 + 310 + 160, 5900);
  balanced(state);
  const replay = captureResult(state, { key: "capture-other", provider: provider(state.charge, "captured", "psp-1", "evt-2"), eventId: "evt-2" });
  assert.equal(replay.ok && replay.replayed, true);
  if (replay.ok) {
    assert.equal(replay.state.journal.length, state.journal.length);
    assert.equal(eventCount(replay.state, "fo-release"), 1);
    assert.equal(eventCount(replay.state, "capture"), 1);
  }
});

test("QA-02 cancels one supplier once and keeps the delivered split", () => {
  const captured = pay(hold(quote({
    lines: [
      line({ id: "a", supplierId: "a" }),
      line({ id: "b", supplierId: "b", unitRetailAgorot: 8200, unitWholesaleAgorot: 4200 }),
    ],
    pspFeeAgorot: 300,
  })));
  assert.equal(captured.charge, 14100);
  assert.equal(accountNet(captured, "supplier-payable:a"), 2280);
  assert.equal(accountNet(captured, "supplier-payable:b"), 3990);
  assert.equal(accountNet(captured, "creator-payable"), 6750);
  assert.equal(accountNet(captured, "platform-revenue"), 1080);
  const rejected = rejectBeforeHandoff(captured, { key: "reject-b", unitIds: ["b#1"] });
  assert.equal(rejected.ok, true);
  if (!rejected.ok) return;
  assert.equal(rejected.state.buyerRefunded, 8200);
  assert.equal(eventCount(rejected.state, "refund"), 1);
  const again = rejectBeforeHandoff(rejected.state, { key: "reject-b", unitIds: ["b#1"] });
  assert.equal(again.ok && again.replayed, true);
  if (again.ok) assert.equal(again.state.buyerRefunded, 8200);
  assert.equal(accountNet(rejected.state, "supplier-payable:a"), 2280);
  assert.equal(accountNet(rejected.state, "supplier-payable:b"), 0);
  assert.equal(accountNet(rejected.state, "creator-payable"), 3150);
  assert.equal(accountNet(rejected.state, "platform-revenue"), 470);
  assert.equal(accountNet(rejected.state, "processing-expense"), -300);
  assert.equal(2280 + 3150 + 170 + 300, 5900);
  const handed = handoffUnit(rejected.state, { key: "hand-a", unitId: "a#1", parcelId: "parcel-a" });
  assert.equal(handed.ok, true);
  if (!handed.ok) return;
  const delivered = deliverParcel(handed.state, { key: "deliver-a", parcelId: "parcel-a", at: NOW });
  assert.equal(delivered.ok, true);
  if (!delivered.ok) return;
  assert.equal(delivered.state.units.find((unit) => unit.id === "a#1")?.eligibleAt, addLocalDays(NOW, 7, "Asia/Jerusalem"));
  assert.equal(delivered.state.units.find((unit) => unit.id === "b#1")?.eligibleAt, null);
  assert.equal(eventCount(delivered.state, "clock"), 1);
  const buyer = buyerView(delivered.state);
  assert.equal(buyer.refundConfirmed, 8200);
  assert.equal(buyer.refundPending, 0);
  const creator = creatorView(delivered.state, NOW);
  assert.equal(creator.pending, 3150);
  assert.equal(creator.eligible, 0);
  assert.equal(supplierView(delivered.state, "b", NOW).pending, 0);
  balanced(delivered.state);
});

test("QA-03 free delivery keeps the contracted freight through dispatch replay", () => {
  const captured = pay(hold(quote({
    lines: [line({ id: "a", supplierId: "a", quantity: 2 })],
    services: [{ id: "ship", buyerFreightAgorot: 0, supplierFreightAgorot: 2000, packingAgorot: 0 }],
    pspFeeAgorot: 260,
  })));
  assert.equal(captured.charge, 11800);
  assert.equal(accountNet(captured, "supplier-payable:a"), 6560);
  assert.equal(accountNet(captured, "creator-payable"), 4300);
  assert.equal(accountNet(captured, "platform-revenue") + accountNet(captured, "processing-expense"), 680);
  const before = captured.journal.length;
  const handed = handoffUnit(captured, { key: "hand", unitId: "a#1", parcelId: "p" });
  assert.equal(handed.ok, true);
  if (!handed.ok) return;
  const replay = handoffUnit(handed.state, { key: "hand", unitId: "a#1", parcelId: "p" });
  assert.equal(replay.ok && replay.replayed, true);
  if (replay.ok) assert.equal(replay.state.journal.length, before);
});

test("QA-04 keeps service fee and freight and refunds the snapshotted tax", () => {
  const priced = allocation(quote({
    lines: [
      line({ id: "pack", supplierId: "a", quantity: 2, taxAgorot: 600 }),
      line({ id: "item", supplierId: "a", unitRetailAgorot: 8200, unitWholesaleAgorot: 4200, taxAgorot: 600 }),
    ],
    services: [{ id: "ship", buyerFreightAgorot: 2500, supplierFreightAgorot: 2200, packingAgorot: 300 }],
    buyerFeeAgorot: 200,
    pspFeeAgorot: 480,
  }));
  assert.equal(priced.charge, 23900);
  assert.equal(priced.supplierPayable, 11050);
  assert.equal(priced.creatorPayable, 9900);
  assert.equal(priced.storeyGross, 1750);
  assert.equal(priced.storeyNet, 1270);
  assert.equal(priced.tax, 1200);
  const pack = priced.units.filter((unit) => unit.lineId === "pack");
  assert.deepEqual(pack.map((unit) => unit.supplierCommission), [120, 120]);
  assert.deepEqual(pack.map((unit) => unit.creatorCommission), [350, 350]);
  assert.deepEqual(pack.map((unit) => unit.tax), [300, 300]);
  const item = priced.units.find((unit) => unit.lineId === "item");
  assert.equal(item?.supplierCommission, 210);
  assert.equal(item?.creatorCommission, 400);
  assert.equal(item?.tax, 600);
  const captured = pay(hold(quote({
    lines: [
      line({ id: "pack", supplierId: "a", quantity: 2, taxAgorot: 600 }),
      line({ id: "item", supplierId: "a", unitRetailAgorot: 8200, unitWholesaleAgorot: 4200, taxAgorot: 600 }),
    ],
    services: [{ id: "ship", buyerFreightAgorot: 2500, supplierFreightAgorot: 2200, packingAgorot: 300 }],
    buyerFeeAgorot: 200,
    pspFeeAgorot: 480,
  })));
  const handed = handoffUnit(captured, { key: "hand", unitId: "pack#1", parcelId: "p1" });
  assert.equal(handed.ok, true);
  if (!handed.ok) return;
  const delivered = deliverParcel(handed.state, { key: "deliver", parcelId: "p1", at: NOW });
  assert.equal(delivered.ok, true);
  if (!delivered.ok) return;
  const returned = refundUnits(delivered.state, { key: "return-pack", unitIds: ["pack#1"], reason: "return" });
  assert.equal(returned.ok, true);
  if (!returned.ok) return;
  assert.equal(returned.state.buyerRefunded, 6200);
  assert.equal(accountNet(returned.state, "tax-payable"), 900);
  assert.equal(returned.state.charge - returned.state.buyerRefunded, 17700);
  balanced(returned.state);
});

test("QA-05 prepaid inventory is not commissioned again at retail", () => {
  const priced = allocation(quote({
    lines: [line({ id: "a", supplierId: "a", quantity: 2, prepaidQuantity: 1 })],
    pspFeeAgorot: 0,
  }));
  assert.equal(priced.charge, 11800);
  assert.equal(priced.payableWholesale, 2400);
  assert.equal(priced.wholesale, 4800);
  assert.equal(priced.supplierCommission, 120);
  assert.equal(priced.creatorCommission, 700);
  assert.equal(priced.supplierPayable, 2280);
  assert.equal(priced.creatorPayable, 8700);
  assert.equal(priced.storeyGross, 820);
  assert.equal(priced.creatorEconomic, 6300);
  assert.equal(priced.prepaidCost, 2400);
});

test("QA-06 half-up commissions and the one-agora coupon reverse exactly", () => {
  const input = quote({
    lines: [
      line({ id: "a", supplierId: "a", unitRetailAgorot: 1000, unitWholesaleAgorot: 333 }),
      line({ id: "b", supplierId: "a", unitRetailAgorot: 1000, unitWholesaleAgorot: 333 }),
    ],
    discountAgorot: 1,
  });
  const priced = allocation(input);
  assert.equal(priced.charge, 1999);
  assert.equal(priced.units.find((unit) => unit.id === "a#1")?.retail, 999);
  assert.equal(priced.units.find((unit) => unit.id === "b#1")?.retail, 1000);
  assert.deepEqual(priced.units.map((unit) => unit.supplierCommission), [17, 17]);
  assert.deepEqual(priced.units.map((unit) => unit.creatorCommission), [67, 67]);
  assert.equal(priced.supplierPayable, 632);
  assert.equal(priced.creatorPayable, 1199);
  assert.equal(priced.storeyGross, 168);
  for (const order of [["a#1", "b#1"], ["b#1", "a#1"]] as const) {
    let state = pay(hold(input, `coupon-${order.join("")}`));
    for (const unitId of order) {
      const refunded = refundUnits(state, { key: `refund-${unitId}`, unitIds: [unitId], reason: "cancel" });
      assert.equal(refunded.ok, true);
      if (refunded.ok) state = refunded.state;
    }
    assert.equal(state.buyerRefunded, 1999);
    assert.equal(accountNet(state, "supplier-payable:a"), 0);
    assert.equal(accountNet(state, "creator-payable"), 0);
    assert.equal(accountNet(state, "platform-revenue"), 0);
    balanced(state);
  }
});

test("QA-07 refunds retained freight once when the last unit is canceled", () => {
  const captured = pay(hold(quote({
    lines: [line({ id: "a", supplierId: "a", quantity: 2 })],
    services: [{ id: "ship", buyerFreightAgorot: 1200, supplierFreightAgorot: 1000, packingAgorot: 0 }],
  })));
  const first = rejectBeforeHandoff(captured, { key: "cancel-1", unitIds: ["a#1"] });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.state.buyerRefunded, 5900);
  const second = rejectBeforeHandoff(first.state, { key: "cancel-2", unitIds: ["a#2"] });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.state.buyerRefunded, 13000);
  assert.equal(accountNet(second.state, "supplier-payable:a"), 0);
  assert.equal(accountNet(second.state, "creator-payable"), 0);
  assert.equal(eventCount(second.state, "refund"), 2);
  balanced(second.state);
});

test("QA-08 one pack survives a hundred checkout races and a late authorization", () => {
  const priced = allocation(quote({ lines: [line({ id: "a", supplierId: "a" })] }));
  let book = emptyBook(1);
  let wins = 0;
  for (let index = 0; index < 100; index += 1) {
    const opened = openHeldQuote({ id: `race-${index}`, allocation: priced, now: NOW, heartbeatAt: NOW, attested: true, free: 1, book });
    if (opened.ok) {
      wins += 1;
      book = opened.book;
    }
  }
  assert.equal(wins, 1);
  const opened = openHeldQuote({ id: "expiry", allocation: priced, now: NOW, heartbeatAt: NOW, attested: true, free: 1 });
  assert.equal(opened.ok, true);
  if (!opened.ok) return;
  const expiredBook = releaseExpiredHold(opened.book, NOW + HOLD_MS + 1);
  assert.equal(expiredBook.free, 1);
  const late = authorize(opened.state, { key: "late", provider: provider(opened.state.charge, "authorized"), now: NOW + HOLD_MS + 1 });
  assert.equal(late.ok, true);
  if (!late.ok) return;
  assert.equal(late.state.status, "voided");
  assert.equal(late.state.journal.length, 0);
  assert.equal(late.state.units.every((unit) => unit.stage !== "committed"), true);
});

test("QA-09 an unknown capture is looked up once and a failed capture is not refunded", () => {
  const held = hold(quote({ lines: [line({ id: "a", supplierId: "a" })] }));
  const submitted = submitAttempt(held, { key: "attempt", provider: provider(held.charge, "authorized"), now: NOW });
  assert.equal(submitted.ok && submitted.replayed, false);
  if (!submitted.ok) return;
  const duplicate = submitAttempt(submitted.state, { key: "attempt", provider: provider(held.charge, "authorized"), now: NOW });
  assert.equal(duplicate.ok && duplicate.replayed, true);
  const authorized = authorize(submitted.state, { key: "auth", provider: provider(held.charge, "authorized"), now: NOW });
  assert.equal(authorized.ok, true);
  if (!authorized.ok) return;
  const unknown = captureResult(authorized.state, { key: "capture", provider: provider(held.charge, "unknown"), eventId: "evt-unknown" });
  assert.equal(unknown.ok, true);
  if (!unknown.ok) return;
  assert.equal(unknown.state.status, "capture_unknown");
  assert.equal(unknown.state.units.every((unit) => unit.stage === "committed"), true);
  const found = lookupUnknown(unknown.state, { key: "lookup", provider: provider(held.charge, "captured", "psp-1", "evt-real") });
  assert.equal(found.ok, true);
  if (!found.ok) return;
  assert.equal(found.state.status, "captured");
  assert.equal(eventCount(found.state, "capture"), 1);
  const canceled = cancelPending(authorized.state, { key: "cancel", provider: provider(held.charge, "captured", "psp-1", "evt-late") });
  assert.equal(canceled.ok, true);
  if (!canceled.ok) return;
  assert.equal(canceled.state.buyerRefunded, held.charge);
  assert.equal(canceled.state.units.every((unit) => unit.foReleased === false), true);
  assert.equal(eventCount(canceled.state, "refund"), 1);
  const failed = captureResult(authorized.state, { key: "capture-fail", provider: provider(held.charge, "declined"), eventId: "evt-fail" });
  assert.equal(failed.ok, true);
  if (!failed.ok) return;
  assert.equal(failed.state.buyerRefunded, 0);
  assert.equal(failed.state.journal.length, 0);
  assert.equal(failed.state.units.every((unit) => unit.stage === "canceled"), true);
});

test("QA-10 stop and handoff produce one outcome per unit", () => {
  const captured = pay(hold(quote({ lines: [line({ id: "a", supplierId: "a", quantity: 2 })] })));
  const stopped = requestStop(captured, { key: "stop-1", unitId: "a#1" });
  assert.equal(stopped.ok, true);
  if (!stopped.ok) return;
  const afterStop = handoffUnit(stopped.state, { key: "hand-stopped", unitId: "a#1", parcelId: "p1" });
  assert.equal(afterStop.ok, false);
  const shipped = handoffUnit(captured, { key: "hand-2", unitId: "a#2", parcelId: "p2" });
  assert.equal(shipped.ok, true);
  if (!shipped.ok) return;
  const afterShip = requestStop(shipped.state, { key: "stop-2", unitId: "a#2" });
  assert.equal(afterShip.ok, false);
  assert.equal(shipped.state.units.find((unit) => unit.id === "a#2")?.stage, "handed");
  const first = deliverParcel(shipped.state, { key: "deliver-2", parcelId: "p2", at: NOW });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const other = handoffUnit(first.state, { key: "hand-1", unitId: "a#1", parcelId: "p1" });
  assert.equal(other.ok, true);
  if (!other.ok) return;
  const later = deliverParcel(other.state, { key: "deliver-1", parcelId: "p1", at: NOW + 86_400_000 });
  assert.equal(later.ok, true);
  if (!later.ok) return;
  assert.equal(later.state.units.find((unit) => unit.id === "a#2")?.eligibleAt, addLocalDays(NOW, 7, "Asia/Jerusalem"));
  assert.notEqual(later.state.units.find((unit) => unit.id === "a#1")?.eligibleAt, later.state.units.find((unit) => unit.id === "a#2")?.eligibleAt);
  const late = markTransit(later.state, { key: "transit", parcelId: "p2" });
  assert.equal(late.ok && late.replayed, true);
  assert.equal(later.state.units.find((unit) => unit.id === "a#2")?.stage, "delivered");
});

test("QA-11 one transfer claim survives a second worker and a failed bank payout", () => {
  const captured = pay(hold(quote({ lines: [line({ id: "a", supplierId: "a" })] })));
  const handed = handoffUnit(captured, { key: "hand", unitId: "a#1", parcelId: "p" });
  assert.equal(handed.ok, true);
  if (!handed.ok) return;
  const delivered = deliverParcel(handed.state, { key: "deliver", parcelId: "p", at: NOW });
  assert.equal(delivered.ok, true);
  if (!delivered.ok) return;
  const due = addLocalDays(NOW, 7, "Asia/Jerusalem");
  const first = claimTransfer(delivered.state, { key: "transfer-1", now: due, party: "creator" });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const second = claimTransfer(first.state, { key: "transfer-2", now: due, party: "creator" });
  assert.equal(second.ok, false);
  const same = claimTransfer(first.state, { key: "transfer-1", now: due, party: "creator" });
  assert.equal(same.ok && same.replayed, true);
  const failed = confirmBank(first.state, { key: "bank", transferKey: "transfer-1", party: "creator", outcome: "failed" });
  assert.equal(failed.ok, true);
  if (!failed.ok) return;
  const early = claimTransfer(failed.state, { key: "transfer-3", now: due, party: "creator" });
  assert.equal(early.ok, false);
  const restored = returnToBalance(failed.state, { key: "restore", transferKey: "transfer-1", party: "creator" });
  assert.equal(restored.ok, true);
  if (!restored.ok) return;
  const reissued = claimTransfer(restored.state, { key: "transfer-4", now: due, party: "creator" });
  assert.equal(reissued.ok, true);
  if (!reissued.ok) return;
  assert.equal(eventCount(reissued.state, "transfer"), 2);
  const reserved = claimTransfer(delivered.state, { key: "supplier-transfer", now: due, party: "supplier", supplierId: "a" });
  assert.equal(reserved.ok, true);
  if (!reserved.ok) return;
  const clawback = refundUnits(reserved.state, { key: "return-after-claim", unitIds: ["a#1"], reason: "return" });
  assert.equal(clawback.ok, true);
  if (!clawback.ok) return;
  assert.equal(clawback.state.recovery.some((row) => row.open && row.supplierId === "a"), true);
  assert.equal(accountNet(clawback.state, "supplier-payable:a"), 0);
  balanced(clawback.state);
});

test("QA-12 a payout return is refunded once and a dispute blocks a second credit", () => {
  const captured = pay(hold(quote({ lines: [line({ id: "a", supplierId: "a" })], pspFeeAgorot: 160 })));
  const handed = handoffUnit(captured, { key: "hand", unitId: "a#1", parcelId: "p" });
  assert.equal(handed.ok, true);
  if (!handed.ok) return;
  const delivered = deliverParcel(handed.state, { key: "deliver", parcelId: "p", at: NOW });
  assert.equal(delivered.ok, true);
  if (!delivered.ok) return;
  const due = addLocalDays(NOW, 7, "Asia/Jerusalem");
  const claimed = claimTransfer(delivered.state, { key: "pay-supplier", now: due, party: "supplier", supplierId: "a" });
  assert.equal(claimed.ok, true);
  if (!claimed.ok) return;
  const transferred = confirmBank(claimed.state, { key: "bank", transferKey: "pay-supplier", party: "supplier", outcome: "paid" });
  assert.equal(transferred.ok, true);
  if (!transferred.ok) return;
  const blocked = openDispute(transferred.state, { key: "dispute-first", unitIds: ["a#1"] });
  assert.equal(blocked.ok, true);
  if (!blocked.ok) return;
  const denied = refundUnits(blocked.state, { key: "refund-denied", unitIds: ["a#1"], reason: "return" });
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.code, "DISPUTE_OPEN");
  const returned = refundUnits(transferred.state, { key: "refund", unitIds: ["a#1"], reason: "return" });
  assert.equal(returned.ok, true);
  if (!returned.ok) return;
  assert.equal(returned.state.buyerRefunded, 5900);
  assert.equal(returned.state.recovery.filter((row) => row.supplierId === "a" && row.open).length, 1);
  assert.equal(accountNet(returned.state, "processing-expense"), -160);
  const duplicate = refundUnits(returned.state, { key: "refund-again", unitIds: ["a#1"], reason: "return" });
  assert.equal(duplicate.ok, false);
  const disputed = openDispute(returned.state, { key: "dispute", unitIds: ["a#1"] });
  assert.equal(disputed.ok, true);
  if (!disputed.ok) return;
  const overlapped = refundUnits(disputed.state, { key: "refund-overlap", unitIds: ["a#1"], reason: "return" });
  assert.equal(overlapped.ok, false);
  if (!overlapped.ok) assert.equal(overlapped.code, "ALREADY");
  assert.equal(eventCount(returned.state, "refund"), 1);
});

test("QA-13 blocks a quote that is missing tax, stock, currency or approval", () => {
  const base = quote({ lines: [line({ id: "a", supplierId: "a" })] });
  assert.equal(priceQuote({ ...base, taxDetermined: false }).ok, false);
  assert.equal(priceQuote({ ...base, currency: "USD" as "ILS" }).ok, false);
  assert.equal(priceQuote({ ...base, stockFresh: false }).ok, false);
  assert.equal(priceQuote({ ...base, setupApproved: false }).ok, false);
  assert.equal(priceQuote({ ...base, lines: [line({ id: "a", supplierId: "a", unitRetailAgorot: 1000, unitWholesaleAgorot: 2400 })] }).ok, false);
  const blocked = priceQuote({ ...base, taxDetermined: false });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.code, "MISSING_TAX");
});

test("QA-14 keeps the original capture policy and isolates a duplicate provider debit", () => {
  const legacy = capture(emptyLedger(), zeroTaxCapture("at-06"));
  assert.equal(legacy.ok, true);
  if (!legacy.ok) return;
  assert.equal(legacy.order.lines.find((row) => row.account === "supplier-payable")?.credit, 70);
  assert.equal(legacy.order.lines.find((row) => row.account === "seller-payable")?.credit, 35);
  assert.equal(legacy.order.lines.find((row) => row.account === "platform-revenue")?.credit, 5);
  const replay = capture(legacy.ledger, zeroTaxCapture("at-06"));
  assert.equal(replay.ok && replay.replayed, true);
  const priced = allocation(quote({ lines: [line({ id: "a", supplierId: "a" })] }));
  const changed = allocation(quote({ lines: [line({ id: "a", supplierId: "a" })], supplierBps: 100, creatorBps: 100 }));
  assert.equal(priced.supplierCommission, 120);
  assert.equal(changed.supplierCommission, 24);
  assert.notEqual(priced.supplierCommission, changed.supplierCommission);
  const captured = pay(hold(quote({ lines: [line({ id: "a", supplierId: "a" })] })));
  const duplicate = recordDuplicateDebit(captured, { key: "dup", amount: captured.charge, eventId: "evt-extra" });
  assert.equal(duplicate.ok, true);
  if (!duplicate.ok) return;
  assert.equal(accountNet(duplicate.state, "psp-exception"), -captured.charge);
  assert.equal(accountNet(duplicate.state, "supplier-payable:a"), 2280);
  assert.equal(duplicate.state.exceptions.length, 1);
  const again = recordDuplicateDebit(duplicate.state, { key: "dup", amount: captured.charge, eventId: "evt-extra" });
  assert.equal(again.ok && again.replayed, true);
});

test("QA-15 random baskets stay balanced and replay to the same balances", () => {
  const random = mulberry32(141);
  const endings: string[] = [];
  for (let index = 0; index < 12; index += 1) {
    endings.push(JSON.stringify(runBasket(random)));
  }
  const again = mulberry32(141);
  for (const ending of endings) assert.equal(JSON.stringify(runBasket(again)), ending);
});

function runBasket(random: () => number): { charge: number; refunded: number; debit: number; creator: number } {
  const count = 1 + Math.floor(random() * 3);
  const lines = Array.from({ length: count }, (_, index) => line({
    id: `l${index}`,
    supplierId: random() > 0.5 ? "a" : "b",
    quantity: 1 + Math.floor(random() * 2),
    unitRetailAgorot: 1000 + Math.floor(random() * 8000),
    unitWholesaleAgorot: 100 + Math.floor(random() * 2000),
    prepaidQuantity: random() > 0.7 ? 1 : 0,
    taxAgorot: Math.floor(random() * 50),
  })).map((row) => ({ ...row, prepaidQuantity: Math.min(row.prepaidQuantity, row.quantity) }));
  const priced = priceQuote(quote({
    lines,
    services: [{ id: "ship", buyerFreightAgorot: Math.floor(random() * 500), supplierFreightAgorot: Math.floor(random() * 400), packingAgorot: Math.floor(random() * 100) }],
    buyerFeeAgorot: Math.floor(random() * 80),
    discountAgorot: Math.floor(random() * 30),
    pspFeeAgorot: Math.floor(random() * 200),
  }));
  if (!priced.ok) return { charge: 0, refunded: 0, debit: 0, creator: 0 };
  const opened = openHeldQuote({ id: `rand-${random()}`, allocation: priced.allocation, now: NOW, heartbeatAt: NOW, attested: true, free: 20 });
  if (!opened.ok) return { charge: 0, refunded: 0, debit: 0, creator: 0 };
  let state = pay(opened.state);
  balanced(state);
  const victim = state.units[0];
  if (victim && random() > 0.4) {
    const refunded = refundUnits(state, { key: `refund-${victim.id}`, unitIds: [victim.id], reason: random() > 0.5 ? "return" : "cancel" });
    if (refunded.ok) state = refunded.state;
  }
  balanced(state);
  assert.ok(state.buyerRefunded <= state.charge);
  return { charge: state.charge, refunded: state.buyerRefunded, debit: journalTotals(state).debit, creator: accountNet(state, "creator-payable") };
}

function mulberry32(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let next = Math.imul(value ^ (value >>> 15), 1 | value);
    next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next;
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}
