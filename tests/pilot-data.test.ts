import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readCatalog } from "../lib/catalog/store.ts";
import { readWorkspace } from "../lib/workspace/store.ts";

test("a missing development file shows the admin pilot instead of empty tabs", () => {
  const missing = path.join(os.tmpdir(), `storey-missing-${process.pid}.json`);
  const workspace = readWorkspace(missing);
  const catalog = readCatalog(missing);
  assert.ok(workspace.staged.some((row) => row.state === "unreviewed" && row.sku === "LILAC-24"));
  assert.ok(workspace.applications.some((row) => row.status === "pending" && row.role === "creator"));
  assert.ok(workspace.applications.some((row) => row.status === "pending" && row.role === "supplier"));
  assert.ok(workspace.orders.some((row) => row.status === "dispatched"));
  assert.equal(workspace.returns.length > 0, true);
  assert.ok(catalog.products.some((row) => row.sku === "PARTY-01"));
  assert.equal(workspace.applications.some((row) => row.email === "ofergabay@gmail.com"), false);
});

test("an existing development file keeps its own rows, including an empty queue", () => {
  const file = path.join(os.tmpdir(), `storey-empty-${process.pid}.json`);
  fs.writeFileSync(file, JSON.stringify({ staged: [], orders: [], returns: [], applications: [] }));
  try {
    const workspace = readWorkspace(file);
    assert.deepEqual(workspace.staged, []);
    assert.deepEqual(workspace.applications, []);
    const catalog = readCatalog(file);
    assert.deepEqual(catalog.products, []);
  } finally {
    fs.unlinkSync(file);
  }
});
