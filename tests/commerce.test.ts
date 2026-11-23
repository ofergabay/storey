import assert from "node:assert/strict";
import test from "node:test";
import {
  acquireHold,
  dedicateStock,
  emptyBook,
  inspectLink,
  onHand,
  releaseExpired,
  reserveCampaign,
  sellableShared,
} from "../lib/commerce/inventory.ts";
import { accountNet, capture, emptyLedger, refundOrder, zeroTaxCapture } from "../lib/commerce/ledger.ts";

const minute = 60 * 1000;

test("one shared pack can be held once, and a repeated submit returns the same hold", () => {
  const start = emptyBook(1);
  const before = onHand(start);
  const first = acquireHold(start, { quoteId: "q1", quantity: 1, now: 0, tier: "social", sellerId: "maya" });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const second = acquireHold(first.book, { quoteId: "q1", quantity: 1, now: 1, tier: "social", sellerId: "maya" });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.replayed, true);
  assert.equal(second.hold.id, first.hold.id);
  const other = acquireHold(first.book, { quoteId: "q2", quantity: 1, now: 1, tier: "social", sellerId: "maya" });
  assert.equal(other.ok, false);
  if (other.ok) return;
  assert.equal(other.code, "STOCK_CHANGED");
  assert.equal(other.remaining, 0);
  assert.equal(onHand(first.book), before);
});

test("opening a product link does not reserve a unit", () => {
  const start = emptyBook(1);
  const viewed = inspectLink(start);
  assert.equal(viewed.sellable, 1);
  assert.deepEqual(viewed.book, start);
  assert.equal(sellableShared(viewed.book), 1);
});

test("an expired hold returns its pack exactly once", () => {
  const held = acquireHold(emptyBook(1), { quoteId: "q1", quantity: 1, now: 0, tier: "social", sellerId: "maya" });
  assert.equal(held.ok, true);
  if (!held.ok) return;
  const first = releaseExpired(held.book, held.hold.expiresAt);
  assert.equal(first.releasedUnits, 1);
  assert.equal(sellableShared(first.book), 1);
  const second = releaseExpired(first.book, held.hold.expiresAt + minute);
  assert.equal(second.releasedUnits, 0);
  assert.equal(sellableShared(second.book), 1);
  assert.equal(onHand(second.book), 1);
});

test("campaign stock is isolated, and expiry restores unused units without releasing a live hold twice", () => {
  const reserved = reserveCampaign(emptyBook(10), {
    tier: "branded",
    campaignId: "birthday",
    sellerId: "maya",
    quantity: 6,
    expiresAt: 5 * minute,
    allowOverflow: false,
  });
  assert.equal(reserved.ok, true);
  if (!reserved.ok) return;
  assert.equal(sellableShared(reserved.book), 4);
  const held = acquireHold(reserved.book, {
    quoteId: "q1",
    quantity: 2,
    now: 0,
    tier: "branded",
    sellerId: "maya",
    campaignId: "birthday",
  });
  assert.equal(held.ok, true);
  if (!held.ok) return;
  assert.equal(sellableShared(held.book), 4);
  const outsider = acquireHold(held.book, { quoteId: "q2", quantity: 5, now: 0, tier: "social", sellerId: "other" });
  assert.equal(outsider.ok, false);
  const expiredCampaign = releaseExpired(held.book, 5 * minute);
  assert.equal(sellableShared(expiredCampaign.book), 8);
  const expiredHold = releaseExpired(expiredCampaign.book, held.hold.expiresAt);
  assert.equal(sellableShared(expiredHold.book), 10);
  assert.equal(onHand(expiredHold.book), 10);
});

test("a social seller cannot dedicate stock", () => {
  const denied = dedicateStock(emptyBook(5), "social", "maya", 5);
  assert.equal(denied.ok, false);
  if (denied.ok) return;
  assert.equal(denied.code, "FEATURE_UNAVAILABLE");
  assert.equal(sellableShared(denied.book), 5);
});

test("the same payment notification posts one balanced capture, and a second payload conflicts", () => {
  const first = capture(emptyLedger(), zeroTaxCapture("pay-1"));
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(accountNet(first.order.lines, "supplier-payable"), 70);
  assert.equal(accountNet(first.order.lines, "seller-payable"), 35);
  assert.equal(accountNet(first.order.lines, "platform-revenue"), 5);
  const replay = capture(first.ledger, zeroTaxCapture("pay-1"));
  assert.equal(replay.ok, true);
  if (!replay.ok) return;
  assert.equal(replay.replayed, true);
  assert.equal(replay.ledger.orders.length, 1);
  const changed = capture(first.ledger, { ...zeroTaxCapture("pay-1"), gross: 111, lines: zeroTaxCapture("pay-1").lines });
  assert.equal(changed.ok, false);
});

test("a full refund cannot exceed the capture and a repeated refund key posts once", () => {
  const captured = capture(emptyLedger(), zeroTaxCapture("pay-1"));
  assert.equal(captured.ok, true);
  if (!captured.ok) return;
  const lines = [
    { account: "psp-clearing", debit: 0, credit: 110 },
    { account: "supplier-payable", debit: 70, credit: 0 },
    { account: "seller-payable", debit: 35, credit: 0 },
    { account: "platform-revenue", debit: 5, credit: 0 },
  ];
  const refund = refundOrder(captured.ledger, { orderId: captured.order.id, key: "refund-1", amount: 110, lines });
  assert.equal(refund.ok, true);
  if (!refund.ok) return;
  const replay = refundOrder(refund.ledger, { orderId: captured.order.id, key: "refund-1", amount: 110, lines });
  assert.equal(replay.ok, true);
  if (!replay.ok) return;
  assert.equal(replay.replayed, true);
  const extra = refundOrder(refund.ledger, { orderId: captured.order.id, key: "refund-2", amount: 1, lines: lines });
  assert.equal(extra.ok, false);
});
