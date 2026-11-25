import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const root = path.resolve(import.meta.dirname, "..");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20261124100000_rbac_sod.sql"), "utf8");

test("the blueprint keeps the current Hebrew channel names and does not set a paid price", () => {
  assert.match(migration, /מכירה חברתית/);
  assert.match(migration, /שותפות/);
  assert.doesNotMatch(migration, /price_agorot\s*=/);
  assert.match(migration, /Do not apply this file to storey-dev/);
});

test("ledger and audit rows cannot be updated or deleted", async () => {
  const db = new PGlite();
  await db.exec(migration);
  await db.exec("insert into public.ledger_entries (account, debit_agorot, credit_agorot) values ('creator-payable', 0, 100)");
  await assert.rejects(() => db.exec("update public.ledger_entries set debit_agorot = 1"));
  await assert.rejects(() => db.exec("delete from public.ledger_entries"));
  await db.exec("insert into public.audit_logs (role, action, before_state, after_state, reason) values ('admin', 'approve', '{}', '{}', 'application complete')");
  await assert.rejects(() => db.exec("update public.audit_logs set action = 'changed'"));
  await assert.rejects(() => db.exec("delete from public.audit_logs"));
  const policies = await db.query<{ polname: string }>("select polname from pg_policy where polrelid = 'public.role_assignments'::regclass");
  assert.ok(policies.rows.some((row) => row.polname === "role_assignments_own"));
  const creatorColumns = await db.query<{ column_name: string }>(
    "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'creator_order_view'",
  );
  const creatorNames = creatorColumns.rows.map((row) => row.column_name);
  assert.deepEqual(creatorNames.includes("street"), false);
  assert.deepEqual(creatorNames.includes("phone"), false);
  assert.deepEqual(creatorNames.includes("email"), false);
  const supplierColumns = await db.query<{ column_name: string }>(
    "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'supplier_fulfillment_view'",
  );
  assert.deepEqual(supplierColumns.rows.map((row) => row.column_name).includes("retail_agorot"), false);
  assert.equal(await db.query("select public.bin_visible('PILOT-01', 'creator-a') as visible").then((result) => result.rows[0].visible), false);
});
