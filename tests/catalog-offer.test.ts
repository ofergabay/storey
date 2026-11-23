import assert from "node:assert/strict";
import test from "node:test";
import { ORIGINAL_POLICY, PAYMENT_POLICY } from "../lib/commerce/payment/flag.ts";
import { offerActionLabel, offerControls, packEarnings } from "../lib/catalog/offer.ts";

const live = {
  publishedAgorot: 4700,
  currentAgorot: 4700,
  copyChanged: false,
  synced: true,
  paused: false,
  justUpdated: false,
};

test("a new draft asks to publish and receive the link", () => {
  const result = offerControls({ ...live, publishedAgorot: 0, currentAgorot: 4700, synced: false });
  assert.equal(result.action, "publish");
  assert.equal(result.status, "טיוטה · טרם פורסמה");
  assert.equal(result.share, false);
  assert.equal(offerActionLabel(result.action), "פרסום וקבלת קישור");
});

test("a live offer with no pending edit offers the sale link", () => {
  const result = offerControls(live);
  assert.equal(result.action, "copy");
  assert.equal(result.status, "עמוד המכירה פעיל");
  assert.equal(result.share, true);
  assert.equal(offerActionLabel(result.action), "העתקת קישור המכירה");
});

test("a saved price change names the price buyers still see", () => {
  const result = offerControls({ ...live, currentAgorot: 5200, synced: true });
  assert.equal(result.action, "publish-changes");
  assert.equal(result.status, "המחיר החדש נשמר בטיוטה. בעמוד המכירה עדיין מוצג ₪47.");
  assert.equal(offerActionLabel(result.action), "פרסום השינויים");
});

test("an unsaved price change does not claim the draft was saved", () => {
  const result = offerControls({ ...live, currentAgorot: 5200, synced: false });
  assert.equal(result.status, "בעמוד המכירה עדיין מוצג ₪47.");
  assert.equal(result.action, "publish-changes");
});

test("publishing a change keeps the same link", () => {
  const result = offerControls({ ...live, justUpdated: true });
  assert.equal(result.action, "copy");
  assert.equal(result.status, "המחיר עודכן. קישור המכירה נשאר זהה.");
});

test("a saved draft of 49 keeps the buyer price at 47", () => {
  const result = offerControls({ ...live, currentAgorot: 4900, synced: true });
  assert.equal(result.action, "publish-changes");
  assert.equal(result.status, "המחיר החדש נשמר בטיוטה. בעמוד המכירה עדיין מוצג ₪47.");
});

test("47 over a 32 cost is margin before fees until a creator fee applies", () => {
  const beforeFees = packEarnings(4700, 3200, ORIGINAL_POLICY);
  assert.equal(beforeFees?.label, "מרווח לפני עמלות");
  assert.equal(beforeFees?.amount, "15 ₪ (31.9%)");
  const expected = packEarnings(4700, 3200, PAYMENT_POLICY);
  assert.equal(expected?.label, "הרווח הצפוי שלך למארז");
  assert.equal(expected?.amount, "13.50 ₪");
});

test("a paused sale can resume and does not offer sharing", () => {
  const result = offerControls({ ...live, paused: true });
  assert.equal(result.action, "resume");
  assert.equal(result.share, false);
  assert.equal(result.status, "המכירה מושהית. הקישור לא מציג את המוצר.");
});
