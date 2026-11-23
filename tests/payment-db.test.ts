import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import pg from "pg";
import { twoSupplierFixture } from "../lib/commerce/payment/sandbox.ts";
import { accountNet } from "../lib/commerce/payment/workflow.ts";

const root = path.resolve(import.meta.dirname, "..");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20261123010000_payment_policy.sql"), "utf8");
const lines = JSON.stringify([
  { account: "psp-clearing", debit: 5900, credit: 0 },
  { account: "creator-payable", debit: 0, credit: 5900 },
]);

test("payment migration does not touch warehouse stock or checkout functions", () => {
  assert.doesNotMatch(migration, /insert\s+into\s+public\.inventory_pools/i);
  assert.doesNotMatch(migration, /create\s+(or\s+replace\s+)?function\s+public\.begin_cloud_nine_checkout/i);
  assert.doesNotMatch(migration, /create\s+(or\s+replace\s+)?function\s+public\.publish_listing/i);
  assert.match(migration, /payment_commands/);
  assert.match(migration, /payment_outbox/);
});

test("competing database transactions keep one capture, one claim and one unit", async () => {
  const db = new PGlite();
  const server = new PGLiteSocketServer({ db, port: 55433, host: "127.0.0.1", maxConnections: 24 });
  await server.start();
  const clients = await Promise.all(Array.from({ length: 12 }, async () => {
    const client = new pg.Client({ host: "127.0.0.1", port: 55433, user: "postgres", database: "postgres" });
    await client.connect();
    return client;
  }));
  const [left, right] = clients;
  try {
    await left.query("create role anon; create role authenticated;");
    await left.query(migration);
    await left.query("insert into public.payment_stock (sku, free_qty, committed_qty) values ('PARTY-01', 1, 0)");
    const holds = [];
    for (let offset = 0; offset < 100; offset += clients.length) {
      const wave = await Promise.all(Array.from({ length: Math.min(clients.length, 100 - offset) }, (_, index) =>
        clients[index].query("select public.payment_hold_one($1, 'PARTY-01') as ok", [`buyer-${offset + index}`]),
      ));
      holds.push(...wave);
    }
    const wins = holds.filter((result) => result.rows[0].ok === true).length;
    const stock = await left.query("select free_qty, committed_qty from public.payment_stock where sku = 'PARTY-01'");
    assert.equal(wins, 1, "100 buyers leave one committed unit");
    assert.equal(Number(stock.rows[0].free_qty), 0);
    assert.equal(Number(stock.rows[0].committed_qty), 1);

    await left.query("select public.payment_accept_quote('race-order', 'creator', 'pay-2026-11', 3150, '{\"seller\":\"creator\"}'::jsonb)");
    await left.query("begin");
    await left.query("select pg_advisory_xact_lock(hashtext('exposure:race-order'))");
    let secondFinished = false;
    const secondClaim = right.query("select public.payment_claim_transfer('race-order', 'creator', 'claim-b', 3150) as result").then((result) => {
      secondFinished = true;
      return result;
    });
    await new Promise((resolve) => setTimeout(resolve, 250));
    assert.equal(secondFinished, false, "second payout worker is blocked before the first transaction commits");
    await left.query("select public.payment_claim_transfer('race-order', 'creator', 'claim-a', 3150)");
    await left.query("commit");
    const claims = await left.query("select count(*)::int as count, coalesce(sum(amount_agorot), 0)::int as amount from public.payment_payout_claims where order_ref = 'race-order'");
    assert.equal(claims.rows[0].count, 1, "one payout claim row");
    assert.equal(claims.rows[0].amount, 3150);
    const secondResult = await secondClaim;
    assert.equal(secondResult.rows[0].result, "replay");

    await left.query("select public.payment_accept_quote('unit-order', 'creator', 'pay-2026-11', 5900, '{}'::jsonb)");
    await left.query("insert into public.payment_units (order_ref, unit_id, supplier_id, stage, allocation) values ('unit-order', 'u1', 'a', 'committed', '{}'::jsonb)");
    const [stopped, handed] = await Promise.all([
      left.query("select public.payment_decide_unit('u1', 'stop') as stage"),
      right.query("select public.payment_decide_unit('u1', 'handoff') as stage"),
    ]);
    const stage = await left.query("select stage from public.payment_units where unit_id = 'u1'");
    assert.equal(stage.rows.length, 1);
    assert.equal(stopped.rows[0].stage, stage.rows[0].stage);
    assert.equal(handed.rows[0].stage, stage.rows[0].stage);
    assert.ok(stage.rows[0].stage === "canceled" || stage.rows[0].stage === "handed");

    await left.query("select public.payment_accept_quote('refund-order', 'creator', 'pay-2026-11', 5900, '{}'::jsonb)");
    const [refundPath, claimPath] = await Promise.all([
      left.query("select public.payment_reserve_refund('refund-order', 'refund-1', 5900) as path"),
      right.query("select public.payment_claim_transfer('refund-order', 'creator', 'claim-refund', 5900) as result"),
    ]);
    const refunds = await left.query("select count(*)::int as count, coalesce(sum(amount_agorot), 0)::int as amount from public.payment_refund_reservations where order_ref = 'refund-order'");
    const refundClaims = await right.query("select count(*)::int as count, coalesce(sum(amount_agorot), 0)::int as amount from public.payment_payout_claims where order_ref = 'refund-order'");
    assert.equal(refunds.rows[0].count, 1, "one refund reservation");
    assert.equal(refunds.rows[0].amount, 5900);
    const payable = refundPath.rows[0].path === "payable" ? 5900 : 0;
    const claimed = claimPath.rows[0].result === "claimed" ? 5900 : 0;
    assert.ok(payable + claimed <= 5900, "refund and payout do not both spend the same entitlement");
    assert.equal(refundClaims.rows[0].count, claimed === 5900 ? 1 : 0);

    await left.query("select public.payment_accept_quote('crash-order', 'creator', 'pay-2026-11', 5900, '{\"policy\":\"pay-2026-11\"}'::jsonb)");
    await left.query("select public.payment_record_unknown('crash-order', 'psp-crash', 5900, $1::jsonb)", [lines]);
    const before = await left.query("select count(*)::int as count from public.payment_journals where order_ref = 'crash-order'");
    assert.equal(before.rows[0].count, 0, "crash leaves the provider charge unconfirmed");
    const recovered = await right.query("select public.payment_recover_capture('psp-crash') as result");
    const replayed = await left.query("select public.payment_recover_capture('psp-crash') as result");
    const journal = await left.query("select count(distinct entry_key)::int as entries, coalesce(sum(debit_agorot), 0)::int as debit, coalesce(sum(credit_agorot), 0)::int as credit from public.payment_journals where order_ref = 'crash-order'");
    const outbox = await right.query("select count(*)::int as count from public.payment_outbox where order_ref = 'crash-order' and kind = 'fo-release'");
    assert.equal(recovered.rows[0].result, "captured");
    assert.equal(replayed.rows[0].result, "replay");
    assert.equal(journal.rows[0].entries, 1, "one capture journal");
    assert.equal(journal.rows[0].debit, journal.rows[0].credit);
    assert.equal(outbox.rows[0].count, 1, "one fulfillment release");

    const fixture = twoSupplierFixture(Date.parse("2026-01-15T10:00:00.000Z"));
    assert.equal(fixture.ok, true);
    if (!fixture.ok) return;
    await left.query("select public.payment_accept_quote('qa-02-local', 'creator', 'pay-2026-11', $1, $2::jsonb)", [fixture.state.charge, JSON.stringify({ policy: "pay-2026-11" })]);
    await left.query("select public.payment_record_unknown('qa-02-local', 'psp-qa-02', $1, $2::jsonb)", [fixture.state.charge, JSON.stringify(fixture.state.journal.map((line) => ({ account: line.account, debit: line.debit, credit: line.credit })))]);
    await left.query("select public.payment_recover_capture('psp-qa-02')");
    const stored = await right.query("select account, sum(credit_agorot - debit_agorot)::int as net from public.payment_journals where order_ref = 'qa-02-local' group by account");
    const net = (account: string) => Number(stored.rows.find((row) => row.account === account)?.net ?? 0);
    assert.equal(fixture.state.buyerRefunded, 8200);
    assert.equal(accountNet(fixture.state, "supplier-payable:a"), 2280);
    assert.equal(net("supplier-payable:a"), 2280);
    assert.equal(net("creator-payable"), 3150);
    assert.equal(net("platform-revenue") + net("processing-expense"), 170);
    assert.equal(Math.abs(net("processing-expense")), 300);
    const releases = await left.query("select count(*)::int as count from public.payment_outbox where order_ref = 'qa-02-local'");
    assert.equal(releases.rows[0].count, 1);
  } finally {
    await Promise.all(clients.map((client) => client.end()));
    await server.stop();
  }
});
