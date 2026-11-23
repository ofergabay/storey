import assert from "node:assert/strict";
import test from "node:test";
import { creatorAccess, planNames } from "../lib/auth/permissions.ts";
import { developmentPlans } from "../lib/commerce/plans.ts";

test("the three plans use the standard Hebrew names", () => {
  assert.deepEqual(developmentPlans.map((plan) => plan.nameHe), ["מכירה חברתית", "חנות מותג", "שותפות"]);
  assert.equal(planNames.social, "מכירה חברתית");
  assert.equal(planNames.branded, "חנות מותג");
  assert.equal(planNames.partnership, "שותפות");
});

test("creator tiers gate the store, campaigns and dedicated stock", () => {
  assert.equal(creatorAccess("social", "creator.catalog"), "FULL_ACCESS");
  assert.equal(creatorAccess("social", "creator.orders"), "MASKED_PII");
  assert.equal(creatorAccess("social", "creator.storefront"), "TIER_GATED");
  assert.equal(creatorAccess("social", "creator.campaign"), "TIER_GATED");
  assert.equal(creatorAccess("social", "creator.dedicated"), "NO_ACCESS");
  assert.equal(creatorAccess("branded", "creator.storefront"), "FULL_ACCESS");
  assert.equal(creatorAccess("branded", "creator.campaign"), "FULL_ACCESS");
  assert.equal(creatorAccess("branded", "creator.dedicated"), "TIER_GATED");
  assert.equal(creatorAccess("scale", "creator.dedicated"), "FULL_ACCESS");
  assert.equal(creatorAccess("scale", "creator.orders"), "FULL_ACCESS");
  assert.equal(creatorAccess("social", "supplier.retail"), "NO_ACCESS");
});
