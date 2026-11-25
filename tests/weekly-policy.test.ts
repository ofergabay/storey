import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import pg from "pg";
import { capture, emptyLedger, zeroTaxCapture } from "../lib/commerce/ledger.ts";
import { priceQuote, testRates } from "../lib/commerce/payment/calculate.ts";
import { emptyCommissionBook, percentToBasisPoints, publishRates, rateAt } from "../lib/commerce/payment/commissions.ts";
import { PAYMENT_POLICY } from "../lib/commerce/payment/flag.ts";
import { quoteShipments, type CheckoutItem } from "../lib/commerce/payment/shipping-quote.ts";
import { previewTariff, publishTariff, resolveTariff, type TariffRule } from "../lib/commerce/payment/tariffs.ts";
import { confirmWeeklyBank, freightReleased, freightWithinEntitlement, runWeeklyBatch } from "../lib/commerce/payment/weekly.ts";
import {
  authorize,
  captureResult,
  deliverParcel,
  handoffUnit,
  recordLocalEvidence,
  refundUnits,
  rejectBeforeHandoff,
  splitParcel,
  startFromAllocation,
  submitAttempt,
  type PayState,
} from "../lib/commerce/payment/workflow.ts";
import { creatorView, supplierView } from "../lib/commerce/payment/views.ts";

const NOW = Date.UTC(2026, 10, 23, 10, 0, 0);
const root = path.resolve(import.meta.dirname, "..");

function rule(patch: Partial<TariffRule> & Pick<TariffRule, "id" | "service">): TariffRule {
  return {
    supplierId: "party",
    warehouseCode: "PILOT-01",
    coverage: { kind: "nationwide", value: "" },
    priceAgorot: 2500,
    windowMinDays: 2,
    windowMaxDays: 5,
    cutoffHour: 14,
    effectiveFrom: 0,
    effectiveTo: null,
    status: "published",
    version: 1,
    ...patch,
  };
}

function item(patch: Partial<CheckoutItem> = {}): CheckoutItem {
  return {
    id: "item",
    supplierId: "party",
    warehouseCode: "PILOT-01",
    sku: "PARTY-01",
    quantity: 1,
    unitRetailAgorot: 10_000,
    unitWholesaleAgorot: 6_000,
    prepaidQuantity: 0,
    taxAgorot: 0,
    grams: 100,
    longestCm: 10,
    ...patch,
  };
}

const destination = { postcode: "6100001", city: "תל אביב", zone: "מרכז" };
const testRate = { id: "rate-test", supplierBps: 500, creatorBps: 1000 };

function acceptance(patch: Parameters<typeof quoteShipments>[0] = {
  items: [item()],
  destination,
  rules: [rule({ id: "std", service: "standard" })],
  rate: testRate,
  at: NOW,
  pspFeeAgorot: 200,
}) {
  return quoteShipments(patch);
}

function provider(amount: number) {
  return { ref: "test-ref", status: "captured" as const, amount, eventId: "evt-1" };
}

function captureQuote(quoted: ReturnType<typeof quoteShipments>, id = "weekly-1"): PayState {
  assert.equal(quoted.ok, true);
  if (!quoted.snapshot) throw new Error("missing snapshot");
  const quotedState = startFromAllocation({ id, allocation: quoted.snapshot.allocation, now: NOW });
  const submitted = submitAttempt(quotedState, { key: "attempt", provider: { ...provider(quotedState.charge), status: "authorized" }, now: NOW });
  if (!submitted.ok) throw new Error(submitted.code);
  const authorized = authorize(submitted.state, { key: "auth", provider: { ...provider(quotedState.charge), status: "authorized" }, now: NOW });
  if (!authorized.ok) throw new Error(authorized.code);
  const captured = captureResult(authorized.state, { key: "capture", provider: provider(quotedState.charge), eventId: "evt-1" });
  if (!captured.ok) throw new Error(captured.code);
  return captured.state;
}

function deliver(state: PayState, at = NOW + 60_000): PayState {
  let current = state;
  for (const unit of current.units) {
    const handed = handoffUnit(current, { key: `hand:${unit.id}`, unitId: unit.id, parcelId: "parcel" });
    if (!handed.ok) throw new Error(handed.code);
    current = handed.state;
  }
  const delivered = deliverParcel(current, { key: "deliver", parcelId: "parcel", at });
  if (!delivered.ok) throw new Error(delivered.code);
  return delivered.state;
}

test("the zero-tax weekly fixture charges 125 once and releases 82 and 36 only after delivery", () => {
  const quoted = acceptance();
  assert.equal(quoted.ok, true);
  if (!quoted.snapshot) return;
  const allocation = quoted.snapshot.allocation;
  assert.equal(allocation.policyVersion, "weekly-2026-11");
  assert.equal(allocation.charge, 12_500);
  assert.equal(allocation.supplierPayable, 8_200);
  assert.equal(allocation.creatorPayable, 3_600);
  assert.equal(allocation.storeyGross, 700);
  assert.equal(allocation.pspFee, 200);
  assert.equal(allocation.storeyNet, 500);
  assert.equal(allocation.supplierCommission, 300);
  assert.equal(allocation.creatorCommission, 400);
  assert.equal(allocation.buyerFreight, 2_500);
  const captured = captureQuote(quoted);
  assert.equal(supplierView(captured, "party", NOW).eligible, 0);
  assert.equal(creatorView(captured, NOW).eligible, 0);
  const labeled = recordLocalEvidence(captured, { key: "label", parcelId: "parcel" });
  assert.equal(labeled.ok, true);
  if (!labeled.ok) return;
  assert.equal(supplierView(labeled.state, "party", NOW).eligible, 0);
  const delivered = deliver(captured);
  assert.equal(supplierView(delivered, "party", delivered.units[0]?.eligibleAt ?? 0).eligible, 8_200);
  assert.equal(creatorView(delivered, delivered.units[0]?.eligibleAt ?? 0).eligible, 3_600);
  assert.equal(creatorView(delivered, NOW).commission, 400);
  assert.equal(supplierView(delivered, "party", NOW).expected, 8_200);
  const again = deliverParcel(delivered, { key: "deliver", parcelId: "parcel", at: NOW + 60_000 });
  assert.equal(again.ok && again.replayed, true);
  if (!again.ok) return;
  assert.equal(supplierView(again.state, "party", NOW + 60_000).eligible, 8_200);
  assert.equal(creatorView(again.state, NOW + 60_000).eligible, 3_600);
  const duplicate = deliverParcel(again.state, { key: "deliver-again", parcelId: "parcel", at: NOW + 120_000 });
  assert.equal(duplicate.ok, false);
  assert.equal(accountNet(delivered, "processing-expense"), -200);
});

test("pay-2026-11 still waits seven days and the legacy capture stays 70/35/5", () => {
  const priced = priceQuote({
    ...testRates(),
    lines: [item({ id: "a", supplierId: "a", unitRetailAgorot: 5_900, unitWholesaleAgorot: 2_400, grams: 0, longestCm: 0, taxAgorot: 0 })],
    services: [],
    buyerFeeAgorot: 0,
    discountAgorot: 0,
    pspFeeAgorot: 0,
  });
  assert.equal(priced.ok, true);
  if (!priced.ok) return;
  assert.equal(priced.allocation.policyVersion, PAYMENT_POLICY);
  const captured = captureQuote({ ok: true, reason: "ok", blockedItemIds: [], groups: [], shippingAgorot: 0, chargeAgorot: priced.allocation.charge, hash: "legacy", snapshot: {
    hash: "legacy",
    shippingAgorot: 0,
    groups: [],
    supplierBps: 500,
    creatorBps: 1000,
    rateId: "old",
    allocation: priced.allocation,
  } }, "pay-old");
  const handed = handoffUnit(captured, { key: "hand", unitId: "a#1", parcelId: "p" });
  assert.equal(handed.ok, true);
  if (!handed.ok) return;
  const delivered = deliverParcel(handed.state, { key: "deliver", parcelId: "p", at: NOW });
  assert.equal(delivered.ok, true);
  if (!delivered.ok) return;
  assert.ok((delivered.state.units[0]?.eligibleAt ?? 0) > NOW);
  assert.equal(creatorView(delivered.state, NOW).eligible, 0);
  const legacy = capture(emptyLedger(), zeroTaxCapture("weekly-legacy"));
  assert.equal(legacy.ok, true);
  if (!legacy.ok) return;
  assert.equal(legacy.order.lines.find((row) => row.account === "supplier-payable")?.credit, 70);
  assert.equal(legacy.order.lines.find((row) => row.account === "seller-payable")?.credit, 35);
  assert.equal(legacy.order.lines.find((row) => row.account === "platform-revenue")?.credit, 5);
});

test("rates are independent basis points and only an admin can publish them", () => {
  assert.equal(percentToBasisPoints("5"), 500);
  assert.equal(percentToBasisPoints("10"), 1000);
  assert.equal(percentToBasisPoints("100.01"), null);
  const denied = publishRates(emptyCommissionBook(), { actorRole: "supplier", actorId: "s", supplierBps: 500, creatorBps: 500, effectiveAt: NOW, now: NOW });
  assert.equal(denied.ok, false);
  const same = publishRates(emptyCommissionBook(), { actorRole: "admin", actorId: "admin", supplierBps: 800, creatorBps: 800, effectiveAt: NOW, now: NOW });
  assert.equal(same.ok, true);
  if (!same.ok) return;
  const different = publishRates(same.book, { actorRole: "admin", actorId: "admin", supplierBps: 0, creatorBps: 2000, effectiveAt: NOW + 1, now: NOW + 1 });
  assert.equal(different.ok, true);
  if (!different.ok) return;
  assert.equal(rateAt(different.book.cards, NOW)?.supplierBps, 800);
  assert.equal(rateAt(different.book.cards, NOW + 1)?.creatorBps, 2000);
  assert.equal(different.book.audit.length, 2);
});

test("postcode beats city, overlap is rejected, and a missing destination blocks payment", () => {
  const published = publishTariff([], rule({ id: "nation", service: "standard", priceAgorot: 1000 }));
  assert.equal(published.ok, true);
  if (!published.ok) return;
  const city = publishTariff(published.rules, rule({ id: "city", service: "standard", priceAgorot: 1800, coverage: { kind: "city", value: "תל אביב" } }));
  assert.equal(city.ok, true);
  if (!city.ok) return;
  const postcode = publishTariff(city.rules, rule({ id: "code", service: "standard", priceAgorot: 2500, coverage: { kind: "postcode", value: "6100001" } }));
  assert.equal(postcode.ok, true);
  if (!postcode.ok) return;
  const express = publishTariff(postcode.rules, rule({ id: "fast", service: "express", priceAgorot: 4000, windowMinDays: 1, windowMaxDays: 2 }));
  assert.equal(express.ok, true);
  if (!express.ok) return;
  const resolved = resolveTariff({ rules: express.rules, supplierId: "party", warehouseCode: "PILOT-01", service: "standard", destination, grams: 100, longestCm: 10, merchandiseAgorot: 10_000, at: NOW });
  assert.equal(resolved.ok && resolved.price.rule.id, "code");
  const overlap = publishTariff(express.rules, rule({ id: "other-nation", service: "standard", priceAgorot: 900 }));
  assert.equal(overlap.ok, false);
  const quoted = quoteShipments({ items: [item()], destination, rules: express.rules, rate: testRate, at: NOW });
  assert.equal(quoted.groups[0]?.selected, "standard");
  assert.equal(quoted.shippingAgorot, 2_500);
  const fast = quoteShipments({ items: [item()], destination, rules: express.rules, rate: testRate, at: NOW, selections: [{ groupId: "party:PILOT-01:parcel", service: "express" }] });
  assert.equal(fast.shippingAgorot, 4_000);
  const blocked = quoteShipments({
    items: [item()],
    destination: { postcode: "1", city: "חיפה", zone: "צפון" },
    rules: [rule({ id: "only-city", service: "standard", coverage: { kind: "city", value: "תל אביב" } })],
    rate: testRate,
    at: NOW,
  });
  assert.equal(blocked.ok, false);
  assert.deepEqual(blocked.blockedItemIds, ["item"]);
  const preview = previewTariff({ rules: express.rules, supplierId: "party", warehouseCode: "PILOT-01", destination, grams: 100, longestCm: 10, merchandiseAgorot: 10_000, at: NOW });
  assert.equal(preview.find((price) => price.rule.service === "standard")?.buyerAgorot, 2_500);
});

test("free-shipping sponsors, two suppliers, and a prepaid lot keep the original bases", () => {
  const supplierFree = acceptance({
    items: [item()],
    destination,
    rules: [rule({ id: "free", service: "standard", freeThresholdAgorot: 10_000 })],
    rate: testRate,
    at: NOW,
  });
  assert.equal(supplierFree.snapshot?.allocation.charge, 10_000);
  assert.equal(supplierFree.snapshot?.groups[0]?.sponsor, "supplier");
  assert.equal(supplierFree.snapshot?.groups[0]?.absorbedAgorot, 2_500);
  assert.equal(supplierFree.snapshot?.allocation.supplierPayable, 5_700);
  const creatorFree = acceptance({
    items: [item()],
    destination,
    rules: [rule({ id: "std", service: "standard" })],
    rate: testRate,
    at: NOW,
    creatorFundsShipping: true,
  });
  assert.equal(creatorFree.snapshot?.allocation.charge, 10_000);
  assert.equal(creatorFree.snapshot?.allocation.supplierPayable, 8_200);
  assert.equal(creatorFree.snapshot?.allocation.creatorPayable, 1_100);
  const tooMuch = acceptance({
    items: [item()],
    destination,
    rules: [rule({ id: "std", service: "standard", priceAgorot: 9_000 })],
    rate: testRate,
    at: NOW,
    creatorFundsShipping: true,
  });
  assert.equal(tooMuch.reason, "negative");
  const two = quoteShipments({
    items: [
      item({ id: "a", supplierId: "a", warehouseCode: "A" }),
      item({ id: "b", supplierId: "b", warehouseCode: "B", unitRetailAgorot: 8_000, unitWholesaleAgorot: 4_000 }),
    ],
    destination,
    rules: [
      rule({ id: "a", service: "standard", supplierId: "a", warehouseCode: "A", priceAgorot: 2_500 }),
      rule({ id: "b", service: "standard", supplierId: "b", warehouseCode: "B", priceAgorot: 1_800 }),
    ],
    rate: testRate,
    at: NOW,
  });
  assert.equal(two.shippingAgorot, 4_300);
  assert.equal(two.chargeAgorot, 10_000 + 8_000 + 4_300);
  const prepaid = acceptance({
    items: [item({ prepaidQuantity: 1 })],
    destination,
    rules: [rule({ id: "std", service: "standard" })],
    rate: testRate,
    at: NOW,
  });
  assert.equal(prepaid.snapshot?.allocation.supplierCommission, 0);
  assert.equal(prepaid.snapshot?.allocation.supplierPayable, 2_500);
  assert.equal(prepaid.snapshot?.allocation.creatorEconomic, 3_600);
});

test("a later tariff or commission does not change an accepted capture or its refund", () => {
  const accepted = acceptance();
  assert.equal(accepted.snapshot?.allocation.charge, 12_500);
  const later = acceptance({
    items: [item()],
    destination,
    rules: [rule({ id: "std", service: "standard", priceAgorot: 9_900, version: 2 })],
    rate: { id: "rate-next", supplierBps: 2_000, creatorBps: 2_000 },
    at: NOW,
  });
  assert.notEqual(later.hash, accepted.hash);
  const captured = captureQuote(accepted);
  const refunded = refundUnits(captured, { key: "refund", unitIds: captured.units.map((unit) => unit.id), reason: "cancel" });
  assert.equal(refunded.ok, true);
  if (!refunded.ok) return;
  assert.equal(refunded.state.buyerRefunded, 12_500);
  assert.equal(refunded.state.charge, 12_500);
});

test("partial delivery and a parcel split never release more freight than the snapshot", () => {
  const quoted = acceptance({
    items: [item({ quantity: 2 })],
    destination,
    rules: [rule({ id: "std", service: "standard" })],
    rate: testRate,
    at: NOW,
  });
  const captured = captureQuote(quoted, "partial");
  const first = handoffUnit(captured, { key: "hand-1", unitId: "item#1", parcelId: "p1" });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const second = handoffUnit(first.state, { key: "hand-2", unitId: "item#2", parcelId: "p2" });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  const split = splitParcel(second.state, { key: "split", unitId: "item#2", parcelId: "p3" });
  assert.equal(split.ok, true);
  if (!split.ok) return;
  assert.equal(split.state.charge, captured.charge);
  const one = deliverParcel(split.state, { key: "one", parcelId: "p1", at: NOW });
  assert.equal(one.ok, true);
  if (!one.ok) return;
  assert.equal(freightWithinEntitlement(one.state), true);
  assert.ok(freightReleased(one.state) < 2_500);
  const rest = deliverParcel(one.state, { key: "rest", parcelId: "p3", at: NOW });
  assert.equal(rest.ok, true);
  if (!rest.ok) return;
  assert.equal(freightReleased(rest.state), 2_500);
  const cancelled = captureQuote(quoted, "cancel");
  const stopped = rejectBeforeHandoff(cancelled, { key: "stop", unitIds: cancelled.units.map((unit) => unit.id) });
  assert.equal(stopped.ok, true);
  if (!stopped.ok) return;
  assert.equal(stopped.state.buyerRefunded, cancelled.charge);
});

test("one weekly payout covers two creators and a second worker is a replay", () => {
  const quoted = acceptance();
  const maya = deliver(captureQuote(quoted, "maya-order"));
  const noa = deliver(captureQuote(acceptance({
    items: [item({ id: "other" })],
    destination,
    rules: [rule({ id: "std", service: "standard" })],
    rate: testRate,
    at: NOW,
  }), "noa-order"));
  const orders = [
    { id: "maya-order", creatorId: "maya", state: maya },
    { id: "noa-order", creatorId: "noa", state: noa },
  ];
  const lock = new Set<string>();
  const first = runWeeklyBatch({ orders, now: NOW + 120_000, lock });
  const supplier = first.created.find((item) => item.party === "supplier" && item.beneficiaryId === "party");
  assert.ok(supplier);
  assert.equal(supplier?.amount, 16_400);
  assert.equal(new Set(supplier?.lines.map((line) => line.creatorId)).size, 2);
  assert.notEqual(supplier?.instructionRef, supplier?.bankRef);
  const sameActor = confirmWeeklyBank([{ ...supplier, makerId: "maker" }], supplier.key, "BANK-SAME", "maker");
  assert.equal(sameActor[0]?.status, "instructed");
  assert.equal(sameActor[0]?.bankRef, null);
  const paid = confirmWeeklyBank(first.instructions, supplier?.key ?? "", `BANK-${supplier?.key}`);
  assert.equal(paid.find((item) => item.key === supplier?.key)?.bankRef?.startsWith("BANK-"), true);
  assert.notEqual(paid.find((item) => item.key === supplier?.key)?.bankRef, supplier?.instructionRef);
  const second = runWeeklyBatch({ orders, now: NOW + 120_000, existing: first.instructions, lock });
  assert.equal(second.created.length, 0);
  assert.ok(second.replayed.includes(supplier?.key ?? ""));
});

function accountNet(state: PayState, account: string): number {
  return state.journal.filter((line) => line.account === account).reduce((sum, line) => sum + line.credit - line.debit, 0);
}

test("weekly database workers pay one beneficiary once and a refund cannot spend the same balance", async () => {
  const db = new PGlite();
  const server = new PGLiteSocketServer({ db, port: 55436, host: "127.0.0.1", maxConnections: 8 });
  await server.start();
  const left = new pg.Client({ host: "127.0.0.1", port: 55436, user: "postgres", database: "postgres" });
  const right = new pg.Client({ host: "127.0.0.1", port: 55436, user: "postgres", database: "postgres" });
  await left.connect();
  await right.connect();
  try {
    await left.query("create role anon; create role authenticated;");
    await left.query(fs.readFileSync(path.join(root, "supabase/migrations/20261123010000_payment_policy.sql"), "utf8"));
    await left.query(fs.readFileSync(path.join(root, "supabase/migrations/20261123180000_weekly_payout.sql"), "utf8"));
    await left.query("insert into public.payment_weekly_open (balance_key, beneficiary, order_ref, creator_id, amount_agorot, freight_agorot, status) values ('maya', 'party-concept', 'ord-maya', 'maya', 8200, 2500, 'open'), ('noa', 'party-concept', 'ord-noa', 'noa', 8200, 2500, 'open')");
    await left.query("begin");
    await left.query("select pg_advisory_xact_lock(hashtext('weekly:party-concept'))");
    let secondFinished = false;
    const second = right.query("select public.payment_weekly_payout('party-concept', '2026-11-22', 'INST-party') as result").then((result) => {
      secondFinished = true;
      return result;
    });
    await new Promise((resolve) => setTimeout(resolve, 250));
    assert.equal(secondFinished, false);
    const first = await left.query("select public.payment_weekly_payout('party-concept', '2026-11-22', 'INST-party') as result");
    assert.equal(first.rows[0].result, "paid");
    await left.query("commit");
    assert.equal((await second).rows[0].result, "replay");
    const payouts = await left.query("select count(*)::int as count, coalesce(sum(amount_agorot), 0)::int as amount from public.payment_weekly_payouts where beneficiary = 'party-concept'");
    assert.equal(payouts.rows[0].count, 1);
    assert.equal(payouts.rows[0].amount, 16_400);
    const lines = await left.query("select lines from public.payment_weekly_payouts where beneficiary = 'party-concept'");
    assert.equal(lines.rows[0].lines.length, 2);
    const replay = await left.query("select public.payment_mark_delivered('ord-maya', 'parcel', 'evt') as first, public.payment_mark_delivered('ord-maya', 'parcel', 'evt-2') as second");
    assert.equal(replay.rows[0].first, "delivered");
    assert.equal(replay.rows[0].second, "replay");
    await left.query("insert into public.payment_weekly_open (balance_key, beneficiary, order_ref, creator_id, amount_agorot, freight_agorot, status) values ('held', 'party-concept', 'ord-held', 'maya', 8200, 2500, 'open')");
    const reserved = await left.query("select public.payment_weekly_refund('party-concept', 'held', 'refund-held') as path");
    assert.equal(reserved.rows[0].path, "payable");
    const skipped = await left.query("select public.payment_weekly_payout('party-concept', '2026-11-29', 'INST-next') as result");
    assert.equal(skipped.rows[0].result, "empty");
    const recovered = await left.query("select public.payment_weekly_refund('party-concept', 'maya', 'refund-paid') as path");
    assert.equal(recovered.rows[0].path, "recovery");
  } finally {
    await left.end();
    await right.end();
    await server.stop();
    await db.close();
  }
});
