import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { parseProductCsv, parseStockCsv } from "../lib/catalog/csv.ts";
import { approveProducts, previewProducts, previewStock, sellableQuantity } from "../lib/catalog/model.ts";

const root = path.resolve(import.meta.dirname, "..");

test("the sample product file approves one row and rejects a bad pack", () => {
  const sample = fs.readFileSync(path.join(root, "public/samples/products.csv"), "utf8");
  const parsed = parseProductCsv(`${sample}\nBAD,כותרת,0,יחידות,100,PILOT-01`);
  const approved = approveProducts([], parsed.rows);
  assert.equal(approved.approved, 1);
  assert.equal(approved.products[0]?.sku, "LILAC-24");
  const preview = previewProducts([], parsed.rows);
  assert.equal(preview.find((row) => row.sku === "BAD")?.status, "invalid");
});

test("stock counts follow sequence, replay, gap and open holds", () => {
  const sample = fs.readFileSync(path.join(root, "public/samples/stock.csv"), "utf8");
  const products = [{ sku: "LILAC-24", titleHe: "סרט לילך", packSize: 24, unit: "יחידות", costAgorot: 1800, warehouseCode: "PILOT-01" }];
  const parsed = parseStockCsv(sample);
  const first = previewStock(products, [], parsed.rows);
  assert.equal(first.previews[0]?.status, "apply");
  assert.equal(sellableQuantity(first.stock[0]), 12);

  const replay = previewStock(products, first.stock, parsed.rows);
  assert.equal(replay.previews[0]?.status, "replay");
  assert.equal(replay.stock[0]?.onHand, 12);

  const gap = parseStockCsv(
    "supplier_sku,warehouse_code,counted_quantity,counted_at,sequence,movement_watermark\nLILAC-24,PILOT-01,9,2026-11-23T01:00:00Z,3,1",
  );
  const halted = previewStock(products, first.stock, gap.rows);
  assert.equal(halted.previews[0]?.status, "gap");
  assert.equal(halted.stock[0]?.onHand, 12);
  assert.equal(halted.stock[0]?.halted, true);

  const held = first.stock.map((state) => ({ ...state, held: 4 }));
  const deficit = parseStockCsv(
    "supplier_sku,warehouse_code,counted_quantity,counted_at,sequence,movement_watermark\nLILAC-24,PILOT-01,3,2026-11-23T01:00:00Z,2,1",
  );
  const blocked = previewStock(products, held, deficit.rows);
  assert.equal(blocked.previews[0]?.status, "deficit");
  assert.equal(blocked.stock[0]?.onHand, 12);
});
