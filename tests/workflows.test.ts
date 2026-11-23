import assert from "node:assert/strict";
import test from "node:test";
import { allow, secondApproval } from "../lib/commerce/access.ts";
import { emptyCatalog, publishStaged, stageBatch, type SourceRow } from "../lib/commerce/catalog.ts";
import { handoff, rejectOutstanding, routeOrder } from "../lib/commerce/fulfillment.ts";
import {
  activatePlan,
  applyScheduledPlan,
  applyUpgrade,
  customerPrice,
  developmentPlans,
  featureAllowed,
  PAST_DUE_BLOCK_MS,
  quoteUpgrade,
  scheduleDowngrade,
} from "../lib/commerce/plans.ts";
import { inspectReturn, requestReturn } from "../lib/commerce/returns.ts";
import { PAYOUT_HOLD_MS, reviewPayout } from "../lib/commerce/settlement.ts";
import { activateLivePool, sandboxPool, warehouseCheckout, HEARTBEAT_LIMIT_MS } from "../lib/commerce/stock-gate.ts";
import { capture, emptyLedger, refundOrder, zeroTaxCapture } from "../lib/commerce/ledger.ts";

const social = developmentPlans[0];
const branded = developmentPlans[1];
const scale = developmentPlans[2];

function row(overrides: Partial<SourceRow> = {}): SourceRow {
  return {
    row: 1,
    supplierId: "supplier-a",
    sku: "CLOUD-NINE-12",
    titleHe: "קלאוד ניין",
    titleEn: "Cloud Nine",
    packSize: 12,
    unit: "balloon",
    priceAgorot: 2400,
    currency: "ILS",
    taxClass: "standard",
    active: true,
    rights: true,
    primaryImage: true,
    ...overrides,
  };
}

test("a zero-price social plan can publish and a seller without it cannot", () => {
  const entitled = activatePlan("maya", social, null);
  assert.equal(entitled.ok, true);
  if (!entitled.ok) return;
  assert.equal(entitled.chargedAgorot, 0);
  assert.equal(featureAllowed(entitled.subscription, "publish", 0).ok, true);
  assert.equal(featureAllowed(null, "publish", 0).code, "PLAN_REQUIRED");
  assert.equal(featureAllowed(entitled.subscription, "campaign", 0).code, "FEATURE_UNAVAILABLE");
  assert.equal(featureAllowed(entitled.subscription, "dedicate", 0).code, "FEATURE_UNAVAILABLE");

  const unpriced = activatePlan("other", branded, null);
  assert.equal(unpriced.ok, false);
  if (unpriced.ok) return;
  assert.equal(unpriced.code, "RATE_UNCONFIGURED");
  assert.equal(unpriced.subscription, null);

  const priced = { ...scale, priceAgorot: 10_000 };
  const charged = activatePlan("scale-seller", priced, null);
  assert.equal(charged.ok, false);
  if (charged.ok) return;
  assert.equal(charged.code, "BLOCKED_NO_PSP");
});

test("an abandoned upgrade keeps the social plan and a signed-out customer sees the published price", () => {
  const current = activatePlan("maya", social, null);
  assert.equal(current.ok, true);
  if (!current.ok) return;
  const quoted = quoteUpgrade(social, { ...branded, priceAgorot: 9_000 }, 15, 30);
  assert.equal(quoted.ok, true);
  if (!quoted.ok) return;
  assert.equal(quoted.amountAgorot, 4_500);
  const kept = applyUpgrade(current.subscription, { ...branded, priceAgorot: 9_000 }, "abandoned");
  assert.equal(kept.plan.code, "social");
  const blocked = applyUpgrade(current.subscription, { ...branded, priceAgorot: 9_000 }, "confirmed");
  assert.equal(blocked.plan.code, "social");

  const card = { sellingPrice: customerPrice({ publishedAgorot: 6_500, draftAgorot: 6_900 }) };
  assert.equal(card.sellingPrice, 6_500);
  assert.equal("draftAgorot" in card, false);
});

test("past-due checkout closes after 72 hours and a downgrade waits for the boundary", () => {
  const current = activatePlan("maya", social, null);
  assert.equal(current.ok, true);
  if (!current.ok) return;
  const pastDue = { ...current.subscription, status: "past_due" as const, pastDueSince: 0 };
  assert.equal(featureAllowed(pastDue, "checkout", PAST_DUE_BLOCK_MS - 1).ok, true);
  assert.equal(featureAllowed(pastDue, "checkout", PAST_DUE_BLOCK_MS).code, "PAST_DUE");
  const change = scheduleDowngrade(100, branded);
  const before = applyScheduledPlan(current.subscription, change.next, 99, change.effectiveAt);
  assert.equal(before.plan.code, "social");
  const after = applyScheduledPlan(current.subscription, change.next, 100, change.effectiveAt);
  assert.equal(after.plan.code, "branded");
});

test("catalog import keeps one identity until approval and blocks missing rights", () => {
  const first = stageBatch(emptyCatalog(), { key: "batch-1", rows: [row({ rights: false })] });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.catalog.live.length, 0);
  const replay = stageBatch(first.catalog, { key: "batch-1", rows: [row({ rights: false })] });
  assert.equal(replay.ok, true);
  if (!replay.ok) return;
  assert.equal(replay.replayed, true);
  const changed = stageBatch(first.catalog, { key: "batch-1", rows: [row({ rights: false, priceAgorot: 2500 })] });
  assert.equal(changed.ok, false);
  if (changed.ok) return;
  assert.equal(changed.code, "CONFLICT");

  const next = stageBatch(first.catalog, { key: "batch-2", rows: [row({ rights: false, priceAgorot: 2500 })] });
  assert.equal(next.ok, true);
  if (!next.ok) return;
  const blocked = publishStaged(next.catalog, { supplierId: "supplier-a", sku: "CLOUD-NINE-12", expectedRevision: 2 });
  assert.equal(blocked.ok, false);
  if (blocked.ok) return;
  assert.equal(blocked.code, "RIGHTS");
  const ready = stageBatch(blocked.catalog, {
    key: "batch-3",
    rows: [row({ priceAgorot: 2500 }), row({ row: 2, supplierId: "supplier-b", sku: "RIBBON", priceAgorot: 800 })],
  });
  assert.equal(ready.ok, true);
  if (!ready.ok) return;
  const published = publishStaged(ready.catalog, { supplierId: "supplier-a", sku: "CLOUD-NINE-12", expectedRevision: 3 });
  assert.equal(published.ok, true);
  if (!published.ok) return;
  assert.equal(published.catalog.live.length, 1);
  const stale = publishStaged(published.catalog, { supplierId: "supplier-a", sku: "CLOUD-NINE-12", expectedRevision: 2 });
  assert.equal(stale.ok, false);
});

test("two suppliers ship independently and a repeated handoff does not move stock twice", () => {
  const routed = routeOrder([
    {
      id: "line-b",
      supplierId: "supplier-b",
      warehouseId: "w2",
      sku: "RIBBON",
      quantity: 2,
      merchandiseAgorot: 1_600,
      freightAgorot: 400,
    },
    {
      id: "line-a",
      supplierId: "supplier-a",
      warehouseId: "w1",
      sku: "CLOUD-NINE-12",
      quantity: 5,
      merchandiseAgorot: 30_000,
      freightAgorot: 1_000,
    },
  ]);
  assert.deepEqual(routed.lines.map((line) => line.supplierId), ["supplier-b", "supplier-a"]);
  const first = handoff(routed, { key: "ship-1", lineId: "line-a", quantity: 3 });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const replay = handoff(first.state, { key: "ship-1", lineId: "line-a", quantity: 3 });
  assert.equal(replay.ok, true);
  if (!replay.ok) return;
  assert.equal(replay.replayed, true);
  assert.equal(replay.state.lines.find((line) => line.id === "line-a")?.shipped, 3);
  const rejected = rejectOutstanding(replay.state, "line-a");
  assert.equal(rejected.ok, true);
  if (!rejected.ok) return;
  assert.equal(rejected.merchandiseAgorot, 12_000);
  assert.equal(rejected.freightAgorot, 0);
  const other = rejectOutstanding(rejected.state, "line-b");
  assert.equal(other.ok, true);
  if (!other.ok) return;
  assert.equal(other.merchandiseAgorot, 1_600);
  assert.equal(other.freightAgorot, 400);
});

test("a return cannot exceed delivered units and settlement cannot mark a bank payout paid", () => {
  assert.equal(requestReturn({ delivered: 3, openOrCompleted: 1, quantity: 3 }).ok, false);
  assert.equal(requestReturn({ delivered: 3, openOrCompleted: 1, quantity: 2 }).ok, true);
  const graded = inspectReturn({ quantity: 2, sellable: 1, damaged: 1 });
  assert.equal(graded.ok, true);
  if (!graded.ok) return;
  assert.equal(graded.restore, 1);
  assert.equal(graded.quarantine, 1);

  const early = reviewPayout({ deliveredAt: 0, now: PAYOUT_HOLD_MS - 1, amountAgorot: 3_500, openCase: false });
  assert.equal(early.code, "NOT_ELIGIBLE");
  assert.equal(early.paid, false);
  const ready = reviewPayout({ deliveredAt: 0, now: PAYOUT_HOLD_MS, amountAgorot: 3_500, openCase: false });
  assert.equal(ready.code, "BLOCKED_NO_PSP");
  assert.equal(ready.paid, false);

  const captured = capture(emptyLedger(), zeroTaxCapture("pay-1"));
  assert.equal(captured.ok, true);
  if (!captured.ok) return;
  const refund = refundOrder(captured.ledger, {
    orderId: captured.order.id,
    key: "refund-1",
    amount: 110,
    lines: [
      { account: "psp-clearing", debit: 0, credit: 110 },
      { account: "supplier-payable", debit: 70, credit: 0 },
      { account: "seller-payable", debit: 35, credit: 0 },
      { account: "platform-revenue", debit: 5, credit: 0 },
    ],
  });
  assert.equal(refund.ok, true);
  if (!refund.ok) return;
  const extra = refundOrder(refund.ledger, {
    orderId: captured.order.id,
    key: "refund-2",
    amount: 1,
    lines: [
      { account: "psp-clearing", debit: 0, credit: 1 },
      { account: "seller-payable", debit: 1, credit: 0 },
    ],
  });
  assert.equal(extra.ok, false);
});

test("live stock stays closed without an attestation and a stale heartbeat closes checkout", () => {
  const live = activateLivePool(false, 24);
  assert.equal(live.ok, false);
  if (live.ok) return;
  assert.equal(live.operation, "live stock activation");
  const fixture = sandboxPool(24);
  assert.equal(fixture.mode, "sandbox");
  assert.equal(fixture.attested, false);
  const open = warehouseCheckout(0, HEARTBEAT_LIMIT_MS);
  assert.equal(open.ok, true);
  const closed = warehouseCheckout(0, HEARTBEAT_LIMIT_MS + 1);
  assert.equal(closed.ok, false);
  if (closed.ok) return;
  assert.equal(closed.operation, "new checkout holds");
});

test("seller publish, supplier pick, and a second approver stay separate", () => {
  assert.equal(allow("seller", "publish"), true);
  assert.equal(allow("consumer", "publish"), false);
  assert.equal(allow("supplier", "pick"), true);
  assert.equal(allow("seller", "pick"), false);
  assert.equal(allow("admin", "payout"), true);
  assert.equal(allow("seller", "payout"), false);
  const same = secondApproval("ada", "ada");
  assert.equal(same.ok, false);
  if (same.ok) return;
  assert.equal(same.operation, "manual payout destination override");
  assert.equal(secondApproval("ada", "bo").ok, true);
});
