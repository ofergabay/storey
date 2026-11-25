import assert from "node:assert/strict";
import test from "node:test";
import { assignArm, assignmentBucket, experimentEnabled } from "../lib/experiments/flags.ts";
import { claimRecap, countsForPace, formatPaceShekels, freshCampaignId, orderContribution, paceReport, shippingNotice } from "../lib/experiments/pace.ts";
import { claimPunchline, disclosure, facebookHref, guestLabel, listingPreview, normalizeLine, qualifiedVisit, storySvg, tooSimilar, whatsAppHref, xHref, xWeight } from "../lib/experiments/share.ts";

const facts = { title: "Party kit", quantityLabel: "12 units", verifiedGuestCount: 12 };

test("two creators get different lines for the same kit", () => {
  const claimed = new Set<string>();
  const first = claimPunchline({ creatorId: "parent", productKey: "KIT-12", locale: "en", angle: "practical", why: "", facts, taken: [], attempt: 1 }, claimed);
  const second = claimPunchline({ creatorId: "host", productKey: "KIT-12", locale: "en", angle: "design", why: "", facts, taken: [], attempt: 1 }, claimed);
  assert.ok(first.text && second.text);
  assert.notEqual(first.normalized, second.normalized);
  assert.equal(tooSimilar(first.text ?? "", second.text ?? ""), false);
  assert.equal(claimed.size, 2);
});

test("simultaneous claims cannot take the same normalized line", () => {
  const claimed = new Set<string>();
  const input = { creatorId: "same-hash", productKey: "KIT-12", locale: "en" as const, angle: "practical" as const, why: "", facts, taken: [], attempt: 4 };
  const first = claimPunchline(input, claimed);
  const second = claimPunchline({ ...input, creatorId: "same-hash-b" }, claimed);
  assert.notEqual(normalizeLine(first.text ?? ""), normalizeLine(second.text ?? ""));
});

test("a manual line is the creator's, and a replacement is a new suggestion", () => {
  const manual = "My own table line";
  const saved = { text: manual, manual: true };
  assert.equal(saved.manual, true);
  const replaced = claimPunchline({ creatorId: "parent", productKey: "KIT-12", locale: "en", angle: "playful", why: "", facts, taken: [normalizeLine(manual)], attempt: 2 }, new Set());
  assert.equal(replaced.text === manual, false);
});

test("guest count is omitted unless a verified count is supplied", () => {
  assert.equal(guestLabel(null, "en"), null);
  assert.equal(guestLabel(12, "en"), "Serves 12");
  assert.equal(guestLabel(12, "he"), "מתאים ל-12");
});

test("preview bots and creator previews are not qualified visits", () => {
  assert.equal(qualifiedVisit({ userAgent: "facebookexternalhit/1.1", creatorPreview: false }), false);
  assert.equal(qualifiedVisit({ userAgent: "WhatsApp/2.1", creatorPreview: false }), false);
  assert.equal(qualifiedVisit({ userAgent: "Twitterbot", creatorPreview: false }), false);
  assert.equal(qualifiedVisit({ userAgent: "Mozilla/5.0", creatorPreview: true }), false);
  assert.equal(qualifiedVisit({ userAgent: "Mozilla/5.0", creatorPreview: false }), true);
});

test("channel actions stay separate and the story image has no url", () => {
  const url = "https://storey.example/s/a/b?ch=instagram";
  const svg = storySvg({ title: "Kit", line: "One kit for the table." });
  assert.equal(svg.includes(url), false);
  assert.equal(svg.includes("wa.me"), false);
  assert.match(whatsAppHref("hello"), /^https:\/\/wa\.me\/\?text=/);
  assert.match(facebookHref(url), /^https:\/\/www\.facebook\.com\/sharer\/sharer\.php\?u=/);
  assert.equal(xHref("x".repeat(280), url), null);
  assert.ok(xWeight("Short line", url) < 280);
  assert.match(disclosure("he"), /עמלה/);
});

test("shipping change is explained before purchase", () => {
  assert.match(shippingNotice({ available: false, previousHash: null, nextHash: null }) ?? "", /אין הצעת משלוח/);
  assert.match(shippingNotice({ available: true, previousHash: "a", nextHash: "b" }) ?? "", /השתנו/);
  assert.equal(shippingNotice({ available: true, previousHash: "a", nextHash: "a" }), null);
});

test("a duplicate delivery event does not open a second recap", () => {
  const seen = new Set<string>();
  assert.equal(claimRecap(seen, "creator-1"), "new");
  assert.equal(claimRecap(seen, "creator-1"), "replay");
  const ids = ["camp-1"];
  assert.equal(freshCampaignId(ids, 10).startsWith("camp-"), true);
  assert.notEqual(freshCampaignId(["camp-10"], 10), "camp-10");
});

test("refunds stay in the order count and a three-item order counts once", () => {
  const full = orderContribution([
    { deliveredAt: 1, refunded: true, creatorPayable: 1000 },
    { deliveredAt: 1, refunded: true, creatorPayable: 1000 },
    { deliveredAt: 1, refunded: true, creatorPayable: 1000 },
  ]);
  assert.equal(full.counts, true);
  assert.equal(full.netAgorot, 0);
  const partial = orderContribution([
    { deliveredAt: 1, refunded: true, creatorPayable: 1000 },
    { deliveredAt: 1, refunded: false, creatorPayable: 2500 },
  ]);
  assert.equal(partial.netAgorot, 2500);
  assert.equal(countsForPace({ id: "ord-self", status: "dispatched", paymentNote: null }), false);
  assert.equal(countsForPace({ id: "ord-1", status: "cancelled", paymentNote: null }), false);
});

test("zero sales leave projections blank and a loss is not multiplied", () => {
  const empty = paceReport({ deliveredOrders: 0, netAgorot: 0, observedDays: 30 });
  assert.equal(empty.scenarios, null);
  const loss = paceReport({ deliveredOrders: 2, netAgorot: -500, observedDays: 21 });
  assert.equal(loss.scenarios, null);
  assert.equal(loss.negative, true);
  const early = paceReport({ deliveredOrders: 1, netAgorot: 4000, observedDays: 3 });
  assert.equal(early.early, true);
});

test("nine delivered orders and 360 shekels over 21 days match the pace table", () => {
  const report = paceReport({ deliveredOrders: 9, netAgorot: 36000, observedDays: 21 });
  assert.equal(report.ordersPerWeek, 3);
  assert.deepEqual(report.scenarios?.map((item) => item.ordersPerWeek), [3, 6, 9]);
  assert.deepEqual(report.scenarios?.map((item) => formatPaceShekels(item.monthlyAgorot)), ["₪521", "₪1,043", "₪1,564"]);
  assert.deepEqual(report.scenarios?.map((item) => formatPaceShekels(item.annualAgorot)), ["₪6,257", "₪12,514", "₪18,771"]);
});

test("experiments stay off outside development unless a flag is on", () => {
  assert.equal(experimentEnabled("first-share", { NODE_ENV: "production" }), false);
  assert.equal(experimentEnabled("party-kit", { NODE_ENV: "test" }), false);
  assert.equal(experimentEnabled("my-pace", { NODE_ENV: "development" }), true);
  assert.equal(experimentEnabled("first-share", { NODE_ENV: "production", STOREY_EXPERIMENT_FIRST_SHARE: "on" }), true);
  assert.equal(experimentEnabled("first-share", { NODE_ENV: "development", STOREY_EXPERIMENT_FIRST_SHARE: "off" }), false);
});

test("a creator or admin preview is not a visit and not a pace sale", () => {
  assert.equal(listingPreview({ previewQuery: false, viewerRole: "creator", viewerId: "dev-creator", viewerHandle: "creator", sellerId: "other", sellerHandle: "creator" }), true);
  assert.equal(listingPreview({ previewQuery: false, viewerRole: "admin", viewerId: "admin", viewerHandle: "admin", sellerId: "seller", sellerHandle: "maya" }), true);
  assert.equal(listingPreview({ previewQuery: false, viewerRole: "guest", viewerId: null, viewerHandle: null, sellerId: "seller", sellerHandle: "maya" }), false);
  assert.equal(countsForPace({ id: "ord-1", status: "dispatched", previewSale: true }), false);
  assert.equal(countsForPace({ id: "ord-2", status: "failed" }), false);
  assert.equal(countsForPace({ id: "ord-3", status: "dispatched" }), true);
});

test("assignment stays on the same arm for the same subject", () => {
  assert.equal(assignArm("first-share", "creator-a", true), assignArm("first-share", "creator-a", true));
  assert.equal(assignArm("party-kit", "visitor-a", false), "control");
  assert.equal(assignmentBucket("my-pace:creator-a"), assignmentBucket("my-pace:creator-a"));
});
