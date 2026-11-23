import assert from "node:assert/strict";
import test from "node:test";
import type { StockState } from "../lib/catalog/model.ts";
import { dispatchUnits, nextFulfillment, openReturn, reserveHold, sellable, type WorkOrder } from "../lib/workspace/engine.ts";

const stock: StockState[] = [
  { sku: "PARTY-01", warehouseCode: "PILOT-01", onHand: 6, held: 0, sequence: 1, countedAt: "2026-11-23T00:00:00Z", watermark: "0", halted: false },
];

test("opening a listing does not reserve stock, and checkout does", () => {
  assert.equal(sellable(stock[0]), 6);
  const held = reserveHold(stock, { sku: "PARTY-01", warehouseCode: "PILOT-01", quantity: 1, now: Date.now() });
  assert.equal(held.ok, true);
  if (!held.ok) return;
  assert.equal(held.stock[0]?.held, 1);
  assert.equal(held.stock[0]?.onHand, 6);
  assert.equal(stock[0]?.held, 0);
});

test("dispatch and a return follow the warehouse steps once", () => {
  const held = reserveHold(stock, { sku: "PARTY-01", warehouseCode: "PILOT-01", quantity: 1, now: Date.now() });
  assert.equal(held.ok, true);
  if (!held.ok) return;
  const order: WorkOrder = {
    id: "ord-1",
    token: "tok-1",
    sku: "PARTY-01",
    sellerHandle: "creator",
    quantity: 1,
    unitAgorot: 5000,
    warehouseCode: "PILOT-01",
    status: "sandbox_paid",
    holdExpiresAt: new Date().toISOString(),
    tracking: null,
  };
  assert.equal(openReturn(order, 0, 1).ok, false);
  order.status = nextFulfillment(order.status) ?? order.status;
  order.status = nextFulfillment(order.status) ?? order.status;
  order.status = nextFulfillment(order.status) ?? order.status;
  order.status = nextFulfillment(order.status) ?? order.status;
  assert.equal(order.status, "dispatched");
  const moved = dispatchUnits(held.stock, { sku: "PARTY-01", warehouseCode: "PILOT-01", quantity: 1 });
  assert.equal(moved.ok, true);
  if (!moved.ok) return;
  assert.equal(moved.stock[0]?.onHand, 5);
  assert.equal(moved.stock[0]?.held, 0);
  assert.equal(openReturn(order, 0, 1).ok, true);
  assert.equal(openReturn(order, 1, 1).ok, false);
});
