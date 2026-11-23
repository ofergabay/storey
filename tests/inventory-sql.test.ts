import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import pg from "pg";

const root = path.resolve(import.meta.dirname, "..");
const schema = fs.readFileSync(path.join(root, "supabase/migrations/20261122230000_inventory_holds.sql"), "utf8");
const hold = fs.readFileSync(path.join(root, "supabase/migrations/20261122230100_begin_checkout.sql"), "utf8");
const plan = fs.readFileSync(path.join(root, "supabase/migrations/20261122240000_seller_plan.sql"), "utf8");
const seed = fs.readFileSync(path.join(root, "supabase/seed/dev_pilot_stock.sql"), "utf8");

test("schema migrations do not insert warehouse stock", () => {
  assert.doesNotMatch(schema, /insert\s+into\s+public\.inventory_pools/i);
  assert.doesNotMatch(hold, /insert\s+into\s+public\.inventory_pools/i);
  assert.doesNotMatch(plan, /inventory_pools/i);
  assert.match(seed, /24/);
  assert.match(seed, /where not exists/i);
  assert.match(hold, /begin_cloud_nine_checkout/);
  assert.match(hold, /drop function if exists public\.create_cloud_nine_quote_with_hold/i);
});

test("two database connections compete for one pack", async () => {
  const db = new PGlite();
  const server = new PGLiteSocketServer({ db, port: 55432, host: "127.0.0.1", maxConnections: 4 });
  await server.start();
  const left = new pg.Client({ host: "127.0.0.1", port: 55432, user: "postgres", database: "postgres" });
  const right = new pg.Client({ host: "127.0.0.1", port: 55432, user: "postgres", database: "postgres" });
  await left.connect();
  await right.connect();

  try {
    await left.query(`
      create role anon;
      create role authenticated;
      create schema if not exists auth;
      create or replace function auth.uid() returns uuid language sql stable as $$
        select '55b0ca06-95a9-4029-a856-17d28e5441fb'::uuid
      $$;
      create table public.sellers (id uuid primary key, owner_id uuid, slug text);
      create table public.supplier_offers (id uuid primary key, net_wholesale_agorot integer);
      create table public.seller_listings (
        id uuid primary key,
        seller_id uuid references public.sellers (id),
        offer_id uuid references public.supplier_offers (id),
        slug text,
        draft_retail_agorot integer,
        published_retail_agorot integer,
        published_at timestamptz
      );
      create table public.checkout_quotes (
        id uuid primary key,
        listing_id uuid references public.seller_listings (id),
        quantity integer,
        unit_retail_agorot integer,
        merchandise_agorot integer,
        recipient_name text,
        phone text,
        city text,
        street text
      );
      insert into public.sellers values
        ('11111111-1111-4111-8111-111111111111', '55b0ca06-95a9-4029-a856-17d28e5441fb', 'maya');
      insert into public.supplier_offers values ('22222222-2222-4222-8222-222222222222', 2400);
      insert into public.seller_listings values (
        '33333333-3333-4333-8333-333333333333',
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
        'cloud-nine', 6900, 6500, now()
      );
    `);
    await left.query(schema);
    await left.query(seed);
    await left.query(hold);
    const seeded = await left.query(
      "select bucket, quantity from public.inventory_pools where warehouse_code = 'PILOT-01' order by bucket",
    );
    assert.deepEqual(seeded.rows, [
      { bucket: "safety_buffer", quantity: 0 },
      { bucket: "shared_free", quantity: 24 },
    ]);
    await left.query("update public.inventory_pools set quantity = 1 where bucket = 'shared_free'");
    await left.query(`
      insert into public.checkout_quotes values
        ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 1, 6500, 6500, 'אחת', '0500000001', 'עיר', 'רחוב 1'),
        ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '33333333-3333-4333-8333-333333333333', 1, 6500, 6500, 'שתיים', '0500000002', 'עיר', 'רחוב 2');
    `);

    const [first, second] = await Promise.all([
      callHold(left, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
      callHold(right, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
    ]);
    const results = [first, second];
    assert.equal(results.filter((result) => result.ok).length, 1);
    assert.equal(results.filter((result) => !result.ok && /stock changed/i.test(result.message)).length, 1);
    const winner = results.find((result) => result.ok);
    assert.ok(winner?.ok);
    const retry = await callHold(right, winner.quote.id);
    assert.equal(retry.ok, true);
    if (!retry.ok || !winner.ok) return;
    assert.equal(retry.quote.hold_expires_at, winner.quote.hold_expires_at);
    const during = await left.query("select quantity from public.inventory_pools where bucket = 'shared_free'");
    assert.equal(during.rows[0].quantity, 0);

    await left.query("update public.checkout_holds set expires_at = now() - interval '1 minute' where released_at is null");
    const released = await left.query("select public.release_expired_checkout_holds() as units");
    const again = await right.query("select public.release_expired_checkout_holds() as units");
    assert.equal(Number(released.rows[0].units), 1);
    assert.equal(Number(again.rows[0].units), 0);
    const after = await left.query("select quantity from public.inventory_pools where bucket = 'shared_free'");
    assert.equal(after.rows[0].quantity, 1);
    const ended = await callHold(left, winner.quote.id);
    assert.equal(ended.ok, false);
    if (ended.ok) return;
    assert.match(ended.message, /hold ended/i);
    const finalQty = await right.query("select quantity from public.inventory_pools where bucket = 'shared_free'");
    assert.equal(finalQty.rows[0].quantity, 1);

    await left.query(plan);
    const published = await left.query("select public.publish_listing(6500) as price");
    assert.equal(published.rows[0].price, 6500);
    const draft = await left.query("select draft_retail_agorot, published_retail_agorot from public.seller_listings");
    assert.equal(draft.rows[0].published_retail_agorot, 6500);
    await left.query("delete from public.seller_subscriptions");
    await assert.rejects(left.query("select public.publish_listing(6600)"), /plan required/i);
    const unchanged = await left.query("select published_retail_agorot from public.seller_listings");
    assert.equal(unchanged.rows[0].published_retail_agorot, 6500);
  } finally {
    await left.end().catch(() => undefined);
    await right.end().catch(() => undefined);
    await server.stop();
    await db.close();
  }
});

async function callHold(
  client: pg.Client,
  quoteId: string,
): Promise<{ ok: true; quote: { id: string; hold_expires_at: string } } | { ok: false; message: string }> {
  try {
    const result = await client.query("select public.begin_cloud_nine_checkout($1::uuid) as quote", [quoteId]);
    const quote = result.rows[0].quote;
    const parsed = typeof quote === "string" ? JSON.parse(quote) : quote;
    return { ok: true, quote: parsed };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
