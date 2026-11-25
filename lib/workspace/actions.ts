"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readAccess, type AppRole } from "@/lib/auth/access";
import { adminPageDecision } from "@/lib/auth/admin-gate";
import { onboardingDestination } from "@/lib/auth/oauth";
import { appendAudit } from "@/lib/auth/audit";
import { can, commitIfAllowed } from "@/lib/auth/can";
import { supplierWarehouse } from "@/lib/auth/tenant";
import { readCatalog, writeCatalog } from "@/lib/catalog/store";
import { dispatchUnits, nextFulfillment, openReturn, releaseHold, reserveHold, type WorkOrder } from "@/lib/workspace/engine";
import { policyForSeller } from "@/lib/commerce/payment/cohort";
import { PAYMENT_POLICY, WEEKLY_POLICY } from "@/lib/commerce/payment/flag";
import { priceQuote, testRates } from "@/lib/commerce/payment/calculate";
import { rateAt } from "@/lib/commerce/payment/commissions";
import { readCommissions, readTariffs } from "@/lib/commerce/payment/policy-store";
import { quoteListing } from "@/lib/commerce/payment/shipping-quote";
import { crashBeforeConfirm, disarmCrash, readProviderCharges, writeProviderCharge } from "@/lib/commerce/payment/provider-store";
import { readPaymeAttempt } from "@/lib/commerce/payment/payme/attempts";
import { listingPreview } from "@/lib/experiments/share";
import { sellerHandleFromEmail } from "@/lib/catalog/identity";
import { recoverAcceptedCharge, unknownAfterAcceptance } from "@/lib/commerce/payment/recover";
import { captureTwoSupplier } from "@/lib/commerce/payment/sandbox";
import { readPaymentCases, writePaymentCase } from "@/lib/commerce/payment/store";
import { acceptBackorder, claimTransfer, deliverParcel, handoffUnit, inspectUnit, markTransferred, offerBackorder, recordLocalEvidence, rejectBeforeHandoff, resolveBackorder } from "@/lib/commerce/payment/workflow";
import { readWorkspace, writeWorkspace } from "@/lib/workspace/store";
import { readSellerPlan } from "@/lib/seller-plan";

function deny(role: AppRole, allowed: AppRole[]): string | null {
  if (role === "guest") return "צריך להתחבר.";
  if (!allowed.includes(role)) return "אין הרשאה לפעולה הזו.";
  return null;
}

function supplierMayFulfill(access: Awaited<ReturnType<typeof readAccess>>, warehouseCode: string | null | undefined): boolean {
  return can(
    { role: access.role, userId: access.userId, tenantId: supplierWarehouse(access), plan: null },
    "supplier.fulfill",
    { tenantId: warehouseCode ?? null },
  ) === "FULL_ACCESS";
}

function attributionFrom(formData: FormData): WorkOrder["attribution"] {
  const creator = String(formData.get("c") ?? "");
  const offer = String(formData.get("o") ?? "");
  const campaign = String(formData.get("k") ?? "");
  const channel = String(formData.get("ch") ?? "");
  if (!creator && !offer && !campaign && !channel) return null;
  return { creator, offer, campaign, channel };
}

export async function saveCart(formData: FormData): Promise<void> {
  const access = await readAccess();
  const ownerId = access.userId ?? "guest";
  const workspace = readWorkspace();
  const line = {
    sellerHandle: String(formData.get("seller") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    quantity: Number(formData.get("quantity") ?? 1),
  };
  const carts = workspace.carts.filter((cart) => cart.ownerId !== ownerId);
  carts.push({ ownerId, line });
  writeWorkspace({ ...workspace, carts });
  revalidatePath("/cart");
  redirect("/cart");
}

function paymentPolicyOrder(version: string | undefined): boolean {
  return version === PAYMENT_POLICY || version === WEEKLY_POLICY;
}

async function beginWeeklyCheckout(formData: FormData, seller: string, slug: string, quantity: number): Promise<void> {
  const back = `/s/${seller}/${slug}/checkout`;
  const catalog = readCatalog();
  const listing = catalog.listings.find((item) => item.sellerHandle === seller && item.slug === slug && item.retailAgorot > 0);
  const product = listing ? catalog.products.find((item) => item.sku === listing.sku) : undefined;
  if (!listing || !product || !Number.isInteger(quantity) || quantity < 1) redirect(`${back}?hold=missing`);
  const owners = [...new Set(readTariffs().filter((rule) => rule.status === "published" && rule.warehouseCode === product.warehouseCode).map((rule) => rule.supplierId))];
  if (owners.length !== 1) redirect(`${back}?hold=shipping`);
  const supplierId = owners[0] ?? "unassigned";
  const destination = {
    postcode: String(formData.get("postcode") ?? ""),
    city: String(formData.get("city") ?? ""),
    zone: String(formData.get("zone") ?? ""),
  };
  const rate = rateAt(readCommissions().cards, Date.now());
  const quoted = quoteListing({
    supplierId,
    warehouseCode: product.warehouseCode,
    sku: product.sku,
    quantity,
    retailAgorot: listing.retailAgorot,
    wholesaleAgorot: product.costAgorot,
    destination,
    rules: readTariffs(),
    rate: rate ? { id: rate.id, supplierBps: rate.supplierBps, creatorBps: rate.creatorBps } : null,
    at: Date.now(),
    service: String(formData.get("service") ?? ""),
    creatorFundsShipping: listing.creatorFundsShipping === true,
  });
  if (!quoted.ok || !quoted.snapshot || quoted.hash !== String(formData.get("quoteHash") ?? "")) {
    const reason = quoted.reason === "no-service" || quoted.reason === "pickup-required" ? "shipping" : quoted.reason === "no-rate" ? "rate" : "stale";
    redirect(`${back}?hold=${reason}`);
  }
  const reserved = reserveHold(catalog.stock, { sku: product.sku, warehouseCode: product.warehouseCode, quantity, now: Date.now() });
  if (!reserved.ok) redirect(`${back}?hold=stock`);
  const order: WorkOrder = {
    id: `ord-${Date.now()}`,
    token: `tok-${Date.now()}`,
    sku: product.sku,
    sellerHandle: seller,
    quantity,
    unitAgorot: listing.retailAgorot,
    warehouseCode: product.warehouseCode,
    status: "held",
    holdExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    tracking: null,
    policyVersion: WEEKLY_POLICY,
    paymentCaseId: null,
    paymentNote: null,
    shippingSnapshot: quoted.snapshot,
    attribution: attributionFrom(formData),
    previewSale: await sellerPreview(seller, listing.sellerId),
  };
  const workspace = readWorkspace();
  workspace.orders.unshift(order);
  writeWorkspace(workspace);
  writeCatalog({ ...catalog, stock: reserved.stock });
  revalidatePath(`/track/${order.token}`);
  redirect(`/track/${order.token}`);
}

async function sellerPreview(sellerHandle: string, sellerId: string): Promise<boolean> {
  const access = await readAccess();
  const viewerHandle = access.email || access.userId ? sellerHandleFromEmail(access.email ?? "", access.userId ?? "") : null;
  return listingPreview({
    previewQuery: false,
    viewerRole: access.role,
    viewerId: access.userId,
    viewerHandle,
    sellerId,
    sellerHandle,
  });
}

export async function beginListingCheckout(formData: FormData): Promise<void> {
  await releaseExpiredHolds();
  const seller = String(formData.get("seller") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const quantity = Number(formData.get("quantity") ?? 1);
  if (policyForSeller(seller) === WEEKLY_POLICY) {
    await beginWeeklyCheckout(formData, seller, slug, quantity);
    return;
  }
  const catalog = readCatalog();
  const listing = catalog.listings.find((item) => item.sellerHandle === seller && item.slug === slug && item.retailAgorot > 0);
  const product = listing ? catalog.products.find((item) => item.sku === listing.sku) : undefined;
  if (!listing || !product) redirect(`/s/${seller}/${slug}/checkout?hold=missing`);
  const reserved = reserveHold(catalog.stock, { sku: product.sku, warehouseCode: product.warehouseCode, quantity, now: Date.now() });
  if (!reserved.ok) redirect(`/s/${seller}/${slug}/checkout?hold=stock`);
  const order: WorkOrder = {
    id: `ord-${Date.now()}`,
    token: `tok-${Date.now()}`,
    sku: product.sku,
    sellerHandle: seller,
    quantity,
    unitAgorot: listing.retailAgorot,
    warehouseCode: product.warehouseCode,
    status: "held",
    holdExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    tracking: null,
    policyVersion: policyForSeller(seller),
    paymentCaseId: null,
    paymentNote: null,
    attribution: attributionFrom(formData),
    previewSale: await sellerPreview(seller, listing.sellerId),
  };
  const workspace = readWorkspace();
  workspace.orders.unshift(order);
  writeWorkspace(workspace);
  writeCatalog({ ...catalog, stock: reserved.stock });
  revalidatePath(`/track/${order.token}`);
  redirect(`/track/${order.token}`);
}

export async function sandboxPurchase(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const workspace = readWorkspace();
  const order = workspace.orders.find((item) => item.id === id && item.status === "held");
  if (!order) return;
  if (readPaymeAttempt(order.id)) {
    order.paymentNote = "יש ניסיון PayMe פתוח. לא נפתח מתאם אחר.";
    writeWorkspace(workspace);
    revalidatePath(`/track/${order.token}`);
    return;
  }
  if (paymentPolicyOrder(order.policyVersion)) {
    const existingCharge = readProviderCharges().find((charge) => charge.orderId === order.id);
    if (existingCharge) {
      const existing = readPaymentCases().find((item) => item.state.id === order.id) ?? null;
      const recovered = recoverAcceptedCharge(existingCharge, existing?.state ?? null);
      if (recovered?.state.status === "captured") {
        writePaymentCase({ adapter: "test", live: false, simulatedNow: existing?.simulatedNow, state: recovered.state });
        order.paymentCaseId = order.id;
        order.paymentNote = "האישור שוחזר לפי האסמכתה המקורית. לא נשלחה בקשת תשלום נוספת.";
        order.status = "sandbox_paid";
        writeWorkspace(workspace);
      }
      revalidatePath(`/track/${order.token}`);
      return;
    }
    const catalog = readCatalog();
    const product = catalog.products.find((item) => item.sku === order.sku);
    const now = Date.now();
    const priced = order.policyVersion === WEEKLY_POLICY
      ? order.shippingSnapshot
        ? { ok: true as const, allocation: order.shippingSnapshot.allocation }
        : { ok: false as const }
      : priceQuote({
      ...testRates(),
      lines: [
        {
          id: "item",
          supplierId: product?.warehouseCode ?? "pilot",
          sku: order.sku,
          quantity: order.quantity,
          unitRetailAgorot: order.unitAgorot,
          unitWholesaleAgorot: product?.costAgorot ?? 0,
          prepaidQuantity: 0,
          serviceGroup: "ship",
          taxAgorot: 0,
        },
      ],
      services: [{ id: "ship", buyerFreightAgorot: 0, supplierFreightAgorot: 0, packingAgorot: 0 }],
      buyerFeeAgorot: 0,
      discountAgorot: 0,
      pspFeeAgorot: 0,
    });
    if (!priced.ok) {
      order.paymentNote = "ההצעה נחסמה לפני הרשאה. לא נוצר חיוב.";
      writeWorkspace(workspace);
      revalidatePath(`/track/${order.token}`);
      return;
    }
    const charge = {
      ref: `test-${order.id}`,
      orderId: order.id,
      amount: priced.allocation.charge,
      eventId: "test-capture",
      status: "captured" as const,
      acceptedAt: now,
      allocation: priced.allocation,
    };
    writeProviderCharge(charge);
    const unknown = unknownAfterAcceptance(charge);
    if (!unknown) {
      order.paymentNote = "ההצעה נחסמה לפני הרשאה. לא נוצר חיוב.";
      writeWorkspace(workspace);
      revalidatePath(`/track/${order.token}`);
      return;
    }
    if (crashBeforeConfirm()) {
      disarmCrash();
      writePaymentCase({ adapter: "test", live: false, state: unknown });
      order.paymentCaseId = order.id;
      order.paymentNote = "המתאם אישר את הסכום. האישור עדיין לא נרשם. אין בקשת תשלום נוספת.";
      writeWorkspace(workspace);
      if (process.env.NODE_ENV !== "production") process.exit(0);
      return;
    }
    const recovered = recoverAcceptedCharge(charge, unknown);
    if (!recovered || recovered.state.status !== "captured") {
      writePaymentCase({ adapter: "test", live: false, state: unknown });
      order.paymentCaseId = order.id;
      order.paymentNote = "המתאם אישר את הסכום. האישור עדיין לא נרשם. אין בקשת תשלום נוספת.";
      writeWorkspace(workspace);
      revalidatePath(`/track/${order.token}`);
      return;
    }
    writePaymentCase({ adapter: "test", live: false, state: recovered.state });
    order.paymentCaseId = recovered.state.id;
    order.paymentNote = "מתאם בדיקה אישר את הסכום. לא חויב כרטיס.";
  }
  order.status = "sandbox_paid";
  workspace.audit.unshift({ at: new Date().toISOString(), actor: "sandbox", action: "sandbox-purchase", detail: id });
  writeWorkspace(workspace);
  revalidatePath("/supplier");
  revalidatePath(`/track/${order.token}`);
}

export async function advanceOrder(formData: FormData): Promise<void> {
  const access = await readAccess();
  if (deny(access.role, ["supplier"])) return;
  const id = String(formData.get("id") ?? "");
  const workspace = readWorkspace();
  const order = workspace.orders.find((item) => item.id === id);
  if (!order || !supplierMayFulfill(access, order.warehouseCode)) return;
  if (paymentPolicyOrder(order.policyVersion)) {
    const payment = readPaymentCases().find((item) => item.state.id === order.paymentCaseId);
    if (!payment || payment.state.status !== "captured") return;
  }
  const next = nextFulfillment(order.status);
  if (!next) return;
  if (next === "dispatched") {
    const catalog = readCatalog();
    const moved = dispatchUnits(catalog.stock, { sku: order.sku, warehouseCode: order.warehouseCode, quantity: order.quantity });
    if (!moved.ok) return;
    writeCatalog({ ...catalog, stock: moved.stock });
    order.tracking = `SBX-${order.id}`;
  }
  order.status = next;
  writeWorkspace(workspace);
  revalidatePath("/supplier");
  revalidatePath(`/track/${order.token}`);
}

export async function requestOrderReturn(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const quantity = Number(formData.get("quantity") ?? 1);
  const workspace = readWorkspace();
  const order = workspace.orders.find((item) => item.token === token);
  if (!order) return;
  const already = workspace.returns.filter((item) => item.orderId === order.id).reduce((sum, item) => sum + item.quantity, 0);
  const opened = openReturn(order, already, quantity);
  if (!opened.ok) return;
  workspace.returns.unshift({ id: `ret-${Date.now()}`, orderId: order.id, quantity, status: "requested", restore: 0 });
  writeWorkspace(workspace);
  revalidatePath(`/track/${token}`);
  revalidatePath("/supplier/returns");
}

export async function receiveReturn(formData: FormData): Promise<void> {
  const access = await readAccess();
  if (deny(access.role, ["supplier"])) return;
  const id = String(formData.get("id") ?? "");
  const workspace = readWorkspace();
  const item = workspace.returns.find((row) => row.id === id && row.status === "requested");
  const returnOrder = item ? workspace.orders.find((row) => row.id === item.orderId) : undefined;
  if (!item || !supplierMayFulfill(access, returnOrder?.warehouseCode)) return;
  item.status = "received";
  writeWorkspace(workspace);
  revalidatePath("/supplier/returns");
}

export async function reconcileReturn(formData: FormData): Promise<void> {
  const access = await readAccess();
  if (deny(access.role, ["supplier"])) return;
  const id = String(formData.get("id") ?? "");
  const workspace = readWorkspace();
  const item = workspace.returns.find((row) => row.id === id && row.status === "received");
  if (item && !supplierMayFulfill(access, workspace.orders.find((row) => row.id === item.orderId)?.warehouseCode)) return;
  const order = item ? workspace.orders.find((row) => row.id === item.orderId) : undefined;
  if (!item || !order || item.restore > 0) return;
  const disposition = String(formData.get("disposition") ?? "");
  const holdStock = order.paymentCaseId && (disposition === "quarantine" || disposition === "loss");
  if (!holdStock) {
    const catalog = readCatalog();
    writeCatalog({
      ...catalog,
      stock: catalog.stock.map((stock) =>
        stock.sku === order.sku && stock.warehouseCode === order.warehouseCode
          ? { ...stock, onHand: stock.onHand + item.quantity }
          : stock,
      ),
    });
  }
  if (order.paymentCaseId && (disposition === "sellable" || disposition === "quarantine" || disposition === "loss")) {
    const payment = readPaymentCases().find((row) => row.state.id === order.paymentCaseId);
    const unit = payment?.state.units.find((row) => row.stage === "delivered" || row.stage === "returned");
    if (payment && unit) {
      const inspected = inspectUnit(payment.state, { key: `inspect:${item.id}`, unitId: unit.id, disposition, refund: true });
      if (inspected.ok) writePaymentCase({ ...payment, state: inspected.state });
    }
    if (disposition !== "sellable") {
      item.status = "reconciled";
      item.restore = 0;
      writeWorkspace(workspace);
      revalidatePath("/supplier/returns");
      return;
    }
  }
  item.status = "reconciled";
  item.restore = item.quantity;
  writeWorkspace(workspace);
  revalidatePath("/supplier/returns");
}

function paymentFor(orderId: string) {
  return readPaymentCases().find((item) => item.state.id === orderId);
}

export async function offerLateSupply(formData: FormData): Promise<void> {
  const access = await readAccess();
  if (deny(access.role, ["supplier"])) return;
  const id = String(formData.get("id") ?? "");
  if (!supplierMayFulfill(access, readWorkspace().orders.find((order) => order.id === id)?.warehouseCode)) return;
  const payment = paymentFor(id);
  if (!payment) return;
  const deadline = Date.now() + 2 * 24 * 60 * 60 * 1000;
  const offered = offerBackorder(payment.state, { key: `backorder:${id}`, unitIds: payment.state.units.map((unit) => unit.id), deadline });
  if (!offered.ok) return;
  writePaymentCase({ ...payment, state: offered.state });
  revalidatePath("/supplier");
  revalidatePath("/track");
}

export async function answerBackorder(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const workspace = readWorkspace();
  const order = workspace.orders.find((item) => item.token === token);
  if (!order?.paymentCaseId) return;
  const payment = paymentFor(order.paymentCaseId);
  const unitId = payment?.state.backorders?.find((row) => row.decision === "offered")?.unitId;
  if (!payment || !unitId) return;
  const now = Date.now();
  const next = decision === "accept"
    ? acceptBackorder(payment.state, { key: `backorder-accept:${unitId}`, unitId, now })
    : resolveBackorder(payment.state, { key: `backorder-reject:${unitId}`, unitId, now, decision: "rejected" });
  if (!next.ok) return;
  writePaymentCase({ ...payment, state: next.state });
  revalidatePath(`/track/${token}`);
}

export async function timeoutBackorder(formData: FormData): Promise<void> {
  const access = await readAccess();
  if (deny(access.role, ["supplier"])) return;
  const id = String(formData.get("id") ?? "");
  if (!supplierMayFulfill(access, readWorkspace().orders.find((order) => order.id === id)?.warehouseCode)) return;
  const payment = paymentFor(id);
  const unitId = payment?.state.backorders?.find((row) => row.decision === "offered")?.unitId;
  if (!payment || !unitId) return;
  const deadline = payment.state.backorders?.find((row) => row.unitId === unitId)?.deadline ?? 0;
  const next = resolveBackorder(payment.state, { key: `backorder-timeout:${unitId}`, unitId, now: deadline + 1, decision: "timed_out" });
  if (!next.ok) return;
  writePaymentCase({ ...payment, state: next.state });
  revalidatePath("/supplier");
}

export async function simulateDelivery(formData: FormData): Promise<void> {
  const access = await readAccess();
  if (deny(access.role, ["supplier"])) return;
  const id = String(formData.get("id") ?? "");
  if (!supplierMayFulfill(access, readWorkspace().orders.find((order) => order.id === id)?.warehouseCode)) return;
  const payment = paymentFor(id);
  if (!payment || payment.state.status !== "captured") return;
  let state = payment.state;
  const parcelId = `parcel-${id}`;
  for (const unit of state.units) {
    if (unit.refunded || unit.stage === "canceled" || unit.stage === "handed" || unit.stage === "delivered") continue;
    const handed = handoffUnit(state, { key: `hand:${unit.id}`, unitId: unit.id, parcelId });
    if (!handed.ok) return;
    state = handed.state;
  }
  const delivered = deliverParcel(state, { key: `deliver:${id}`, parcelId, at: Date.now() });
  if (!delivered.ok) return;
  const noted = recordLocalEvidence(delivered.state, { key: `evidence:${id}`, parcelId });
  writePaymentCase({ ...payment, state: noted.ok ? noted.state : delivered.state });
  revalidatePath("/admin/finance");
  revalidatePath("/earnings");
  revalidatePath("/supplier/settlements");
}

export async function simulateEligibility(formData: FormData): Promise<void> {
  const access = await readAccess();
  if (adminPageDecision(access.role) !== "allow") return;
  const id = String(formData.get("id") ?? "");
  const payment = paymentFor(id);
  if (!payment) return;
  const due = payment.state.units.reduce((latest, unit) => Math.max(latest, unit.eligibleAt ?? 0), 0);
  if (due < 1) return;
  writePaymentCase({ ...payment, simulatedNow: due });
  revalidatePath("/admin/finance");
  revalidatePath("/earnings");
  revalidatePath("/supplier/settlements");
}

export async function simulateTransfer(formData: FormData): Promise<void> {
  const access = await readAccess();
  if (adminPageDecision(access.role) !== "allow") return;
  const id = String(formData.get("id") ?? "");
  const payment = paymentFor(id);
  if (!payment?.simulatedNow) return;
  let state = payment.state;
  const creator = claimTransfer(state, { key: `transfer-creator:${id}`, now: payment.simulatedNow, party: "creator" });
  if (creator.ok) state = markTransferred(creator.state, `transfer-creator:${id}`);
  const supplierId = state.units.find((unit) => !unit.refunded)?.supplierId;
  if (supplierId) {
    const supplier = claimTransfer(state, { key: `transfer-supplier:${id}`, now: payment.simulatedNow, party: "supplier", supplierId });
    if (supplier.ok) state = markTransferred(supplier.state, `transfer-supplier:${id}`);
  }
  writePaymentCase({ ...payment, state });
  revalidatePath("/admin/finance");
  revalidatePath("/earnings");
  revalidatePath("/supplier/settlements");
}

export async function runTwoSupplierFixture(): Promise<void> {
  const access = await readAccess();
  if (adminPageDecision(access.role) !== "allow") return;
  const now = Date.now();
  const captured = captureTwoSupplier(now);
  if (!captured.ok) return;
  const rejected = rejectBeforeHandoff(captured.state, { key: "reject-b", unitIds: ["b#1"] });
  if (!rejected.ok) return;
  const replay = rejectBeforeHandoff(rejected.state, { key: "reject-b", unitIds: ["b#1"] });
  if (!replay.ok || !replay.replayed || replay.state.buyerRefunded !== 8200) return;
  const handed = handoffUnit(replay.state, { key: "hand-a", unitId: "a#1", parcelId: "parcel-a" });
  if (!handed.ok) return;
  const delivered = deliverParcel(handed.state, { key: "deliver-a", parcelId: "parcel-a", at: now });
  if (!delivered.ok) return;
  writePaymentCase({ adapter: "test", live: false, cancelReplayed: true, state: delivered.state });
  revalidatePath("/admin/finance");
  revalidatePath("/earnings");
  revalidatePath("/supplier/settlements");
}

export async function releaseExpiredHolds(): Promise<void> {
  const now = Date.now();
  const workspace = readWorkspace();
  const catalog = readCatalog();
  let stock = catalog.stock;
  for (const order of workspace.orders) {
    if (order.status === "held" && Date.parse(order.holdExpiresAt) <= now) {
      stock = releaseHold(stock, { sku: order.sku, warehouseCode: order.warehouseCode, quantity: order.quantity });
      order.status = "cancelled";
    }
  }
  writeCatalog({ ...catalog, stock });
  writeWorkspace(workspace);
}

export async function submitApplication(formData: FormData): Promise<void> {
  const role = formData.get("role") === "supplier" ? "supplier" : "creator";
  const email = String(formData.get("email") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const planValue = String(formData.get("plan") ?? "");
  const productId = String(formData.get("product") ?? "");
  const plan = role === "creator" && (planValue === "social" || planValue === "branded" || planValue === "scale") ? planValue : undefined;
  const workspace = readWorkspace();
  const missing = [];
  if (name.length < 2) missing.push("שם");
  if (!email.includes("@")) missing.push("אימייל");
  workspace.applications.unshift({
    id: `app-${Date.now()}`,
    role,
    email,
    name,
    status: missing.length > 0 ? "missing" : "pending",
    missing,
    ...(plan ? { plan } : {}),
  });
  writeWorkspace(workspace);
  revalidatePath("/onboarding");
  revalidatePath("/admin/approvals");
  if (role === "creator" && missing.length === 0) {
    const catalog = readCatalog();
    const destination = onboardingDestination(productId, { products: catalog.products, listings: catalog.listings });
    if (destination) redirect(destination);
  }
}

export async function approveApplication(formData: FormData): Promise<void> {
  const access = await readAccess();
  if (adminPageDecision(access.role) !== "allow") return;
  const id = String(formData.get("id") ?? "");
  const workspace = readWorkspace();
  const application = workspace.applications.find((item) => item.id === id);
  if (!application || application.missing.length > 0) return;
  application.status = "approved";
  workspace.audit = appendAudit(workspace.audit, {
    at: new Date().toISOString(),
    actor: access.userId ?? access.email ?? "admin",
    action: "approve-application",
    detail: application.id,
    role: "admin",
    beforeState: "pending",
    afterState: "approved",
    reason: "application complete",
  });
  writeWorkspace(workspace);
  revalidatePath("/admin/approvals");
}

export async function saveStorefront(formData: FormData): Promise<void> {
  const access = await readAccess();
  const plan = access.role === "creator" ? (await readSellerPlan()).code : null;
  const level = can({ role: access.role, userId: access.userId, tenantId: access.userId, plan }, "creator.storefront", { ownerId: access.userId });
  if (commitIfAllowed(level, "keep", "write") !== "write") return;
  const workspace = readWorkspace();
  const sellerId = access.userId ?? "";
  const next = { sellerId, policy: String(formData.get("policy") ?? ""), collection: String(formData.get("collection") ?? "") };
  writeWorkspace({ ...workspace, storefronts: [...workspace.storefronts.filter((item) => item.sellerId !== sellerId), next] });
  revalidatePath("/storefront");
}

export async function reserveCampaign(formData: FormData): Promise<void> {
  const access = await readAccess();
  const plan = access.role === "creator" ? (await readSellerPlan()).code : null;
  const level = can({ role: access.role, userId: access.userId, tenantId: access.userId, plan }, "creator.campaign", { ownerId: access.userId });
  if (commitIfAllowed(level, "keep", "write") !== "write") return;
  const sku = String(formData.get("sku") ?? "");
  const handle = sellerHandleFromEmail(access.email ?? "", access.userId ?? "");
  const owns = readCatalog().listings.some((item) => item.sku === sku && (item.sellerId === access.userId || item.sellerHandle === handle));
  if (!owns) return;
  const workspace = readWorkspace();
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
  workspace.campaigns.unshift({ id: `camp-${Date.now()}`, sellerId: access.userId ?? "", sku, quantity: 1, expiresAt });
  workspace.audit = appendAudit(workspace.audit, {
    at: new Date().toISOString(),
    actor: access.userId ?? "",
    action: "campaign-hold",
    detail: sku,
    role: "creator",
    beforeState: null,
    afterState: expiresAt,
    reason: "72-hour campaign hold",
  });
  writeWorkspace(workspace);
  revalidatePath("/campaigns");
}
