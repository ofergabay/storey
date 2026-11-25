import assert from "node:assert/strict";
import test from "node:test";
import { appendAudit } from "../lib/auth/audit.ts";
import { can, commitIfAllowed, denialCode, developmentRole } from "../lib/auth/can.ts";
import { approveCorrection, requestCorrection } from "../lib/auth/corrections.ts";
import { creatorAccess, navLocked, planNames, showNavItem } from "../lib/auth/permissions.ts";
import { routeRedirect } from "../lib/auth/route-policy.ts";
import { adminLedgerView, blindShippingSlip, creatorOrderView, supplierCatalogView, supplierFulfillmentView, supplierQueue } from "../lib/auth/views.ts";
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
  assert.equal(creatorAccess("scale", "creator.orders"), "MASKED_PII");
  assert.equal(creatorAccess("branded", "creator.orders"), "MASKED_PII");
  assert.equal(creatorAccess("social", "supplier.retail"), "NO_ACCESS");
});

const social = { role: "creator" as const, userId: "creator-a", tenantId: "creator-a", plan: "social" as const };
const branded = { role: "creator" as const, userId: "creator-a", tenantId: "creator-a", plan: "branded" as const };
const partnership = { role: "creator" as const, userId: "creator-a", tenantId: "creator-a", plan: "scale" as const };
const supplierA = { role: "supplier" as const, userId: "supplier-a", tenantId: "PILOT-01", plan: null };
const supplierB = { role: "supplier" as const, userId: "supplier-b", tenantId: "PILOT-02", plan: null };
const admin = { role: "admin" as const, userId: "admin-a", tenantId: "admin", plan: null };

test("a social creator cannot write a storefront or a campaign", () => {
  const storefront = can(social, "creator.storefront");
  const campaign = can(social, "creator.campaign");
  assert.equal(denialCode(storefront), "UPGRADE_REQUIRED");
  assert.equal(denialCode(campaign), "UPGRADE_REQUIRED");
  const current = [{ sellerId: "creator-a" }];
  assert.equal(commitIfAllowed(storefront, current, []), current);
  assert.equal(commitIfAllowed(campaign, current, []), current);
});

test("a branded creator can save a storefront and still receives no street or phone", () => {
  assert.equal(can(branded, "creator.storefront"), "FULL_ACCESS");
  assert.equal(can(branded, "creator.orders"), "MASKED_PII");
  const view = creatorOrderView({
    id: "order-1",
    status: "sandbox_paid",
    sellerHandle: "creator",
    buyerName: "נועה",
    phone: "0500000000",
    street: "הרצל 1",
    email: "noa@example.com",
  });
  assert.equal(view.buyerName, "נועה");
  assert.equal(view.phone, null);
  assert.equal(view.street, null);
  assert.equal(view.email, null);
});

test("a partnership creator can address their own bin and not another creator's orders", () => {
  assert.equal(can(partnership, "creator.bin", { ownerId: "creator-a", tenantId: "creator-a" }), "FULL_ACCESS");
  assert.equal(can(partnership, "creator.orders", { ownerId: "creator-b", tenantId: "creator-b" }), "NO_ACCESS");
  assert.equal(can(social, "creator.bin"), "NO_ACCESS");
});

test("a supplier cannot read another supplier's catalog, queue, or wholesale price", () => {
  assert.equal(can(supplierA, "supplier.catalog", { tenantId: "PILOT-02" }), "NO_ACCESS");
  assert.equal(can(supplierA, "supplier.queue", { tenantId: "PILOT-02" }), "NO_ACCESS");
  assert.equal(can(supplierB, "supplier.catalog", { tenantId: "PILOT-01" }), "NO_ACCESS");
  assert.equal(can(supplierB, "supplier.queue", { tenantId: "PILOT-01" }), "NO_ACCESS");
  const catalog = supplierCatalogView(
    [
      { sku: "A", warehouseCode: "PILOT-01", costAgorot: 1000 },
      { sku: "B", warehouseCode: "PILOT-02", costAgorot: 2000 },
    ],
    "PILOT-01",
  );
  assert.deepEqual(catalog.map((item) => item.sku), ["A"]);
  assert.deepEqual(supplierQueue([{ id: "1", warehouseCode: "PILOT-02" }], "PILOT-01", false), []);
  assert.deepEqual(supplierQueue([{ id: "1", warehouseCode: "PILOT-02" }], null, false), []);
  const fulfillment = supplierFulfillmentView({
    id: "1",
    sku: "A",
    quantity: 1,
    warehouseCode: "PILOT-01",
    sellerHandle: "creator",
    status: "picking",
    unitAgorot: 5900,
    phone: "0500000000",
    street: "הרצל 1",
    recipient: "נועה",
  });
  assert.equal(fulfillment.retailAgorot, null);
  assert.equal(fulfillment.phone, "0500000000");
  const slip = blindShippingSlip({ brand: "creator", recipient: "נועה", lines: ["A × 1"] });
  assert.equal(slip.supplierName, null);
  assert.equal(slip.supplierLogo, null);
});

test("a creator session cannot pick, pack, or settle", () => {
  assert.equal(can(social, "supplier.fulfill", { tenantId: "PILOT-01" }), "NO_ACCESS");
  assert.equal(can(social, "supplier.queue", { tenantId: "PILOT-01" }), "NO_ACCESS");
  assert.equal(can(social, "supplier.settlements"), "NO_ACCESS");
  assert.equal(commitIfAllowed(can(supplierA, "supplier.settlements"), "keep", "write"), "keep");
});

test("an admin session cannot call supplier mutations or update a posted ledger row", () => {
  assert.equal(can(admin, "supplier.fulfill", { tenantId: "PILOT-01" }), "NO_ACCESS");
  assert.equal(can(admin, "creator.storefront"), "NO_ACCESS");
  assert.equal(adminLedgerView({ id: "journal-1", debit: 0, credit: 100 }).mutable, false);
  assert.equal(commitIfAllowed("VIEW_ONLY", "posted", "edited"), "posted");
});

test("two admins are required for a refund and one admin is refused", () => {
  const request = requestCorrection({ id: "refund-1", kind: "refund", initiatorId: "admin-a", reason: "dispute" });
  const alone = approveCorrection(request, "admin-a");
  assert.equal(alone.ok, false);
  if (!alone.ok) assert.equal(alone.code, "SECOND_ACTOR_REQUIRED");
  assert.equal(alone.request.posted, false);
  const pair = approveCorrection(request, "admin-b");
  assert.equal(pair.ok, true);
  assert.equal(pair.request.posted, false);
  assert.equal(pair.request.status, "pending");
});

test("a development role cookie is ignored outside development", () => {
  assert.equal(developmentRole("production", "admin"), null);
  assert.equal(developmentRole("test", "creator"), null);
  assert.equal(developmentRole("development", "supplier"), "supplier");
  assert.equal(developmentRole("development", "warehouse"), null);
});

test("a signed-in creator, supplier, or admin opening the landing is sent home", () => {
  assert.equal(routeRedirect({ pathname: "/", role: "creator", inspect: false, development: false }), "/earnings");
  assert.equal(routeRedirect({ pathname: "/", role: "supplier", inspect: false, development: false }), "/supplier");
  assert.equal(routeRedirect({ pathname: "/", role: "admin", inspect: false, development: false }), "/admin/staging");
  assert.equal(routeRedirect({ pathname: "/", role: "admin", inspect: false, development: false, preview: true }), null);
});

test("tier-gated navigation stays visible and locked", () => {
  const item = { href: "/storefront", label: "חנות ממותגת", capability: "creator.storefront" as const };
  const dedicated = { href: "/campaigns", label: "מלאי ייעודי", capability: "creator.dedicated" as const };
  assert.equal(showNavItem("creator", "social", item), true);
  assert.equal(navLocked("creator", "social", item), true);
  assert.equal(showNavItem("creator", "social", dedicated), false);
});

test("an audit row is appended and the earlier row stays unchanged", () => {
  const prior = [{ detail: "posted" }];
  const next = appendAudit(prior, { detail: "approved" });
  assert.equal(prior[0].detail, "posted");
  assert.deepEqual(next.map((entry) => entry.detail), ["approved", "posted"]);
});
