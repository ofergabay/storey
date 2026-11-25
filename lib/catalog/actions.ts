"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readAccess } from "@/lib/auth/access";
import { adminPageDecision } from "@/lib/auth/admin-gate";
import { packEarnings } from "@/lib/catalog/offer";
import { rateAt } from "@/lib/commerce/payment/commissions";
import { WEEKLY_POLICY } from "@/lib/commerce/payment/flag";
import { policyForSeller } from "@/lib/commerce/payment/cohort";
import { readCommissions, readTariffs } from "@/lib/commerce/payment/policy-store";
import { parseProductCsv, parseStockCsv } from "@/lib/catalog/csv";
import { previewProducts, previewStock, type ProductPreview, type StockPreview } from "@/lib/catalog/model";
import { listingSlug, sellerHandleFromEmail } from "@/lib/catalog/identity";
import { readCatalog, writeCatalog } from "@/lib/catalog/store";
import { parseRetailDraft } from "@/lib/pricing";
import { readWorkspace, writeWorkspace } from "@/lib/workspace/store";
import fs from "node:fs";
import path from "node:path";

export type CsvActionResult<T> = { ok: true; rows: T[]; notes: string[] } | { ok: false; message: string };

async function requireAdmin(): Promise<{ ok: true; userId: string } | { ok: false; message: string }> {
  const access = await readAccess();
  if (adminPageDecision(access.role) !== "allow") {
    return { ok: false, message: access.role === "guest" ? "צריך להתחבר קודם." : "החשבון הזה אינו מורשה לניהול הקטלוג." };
  }
  return { ok: true, userId: access.userId ?? "admin" };
}

export async function previewProductUpload(csv: string): Promise<CsvActionResult<ProductPreview>> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  const parsed = parseProductCsv(csv);
  if (parsed.errors.length > 0 && parsed.rows.length === 0) return { ok: false, message: parsed.errors[0] };
  const catalog = readCatalog();
  return { ok: true, notes: parsed.errors, rows: previewProducts(catalog.products, parsed.rows) };
}

export async function approveProductUpload(csv: string): Promise<{ ok: true; approved: number } | { ok: false; message: string }> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  const parsed = parseProductCsv(csv);
  if (parsed.errors.length > 0 && parsed.rows.length === 0) return { ok: false, message: parsed.errors[0] };
  const preview = previewProducts(readCatalog().products, parsed.rows);
  const workspace = readWorkspace();
  let staged = 0;
  for (const row of preview) {
    if (row.status !== "ready" || !row.product) continue;
    if (workspace.staged.some((item) => item.sku === row.product?.sku && item.state === "unreviewed")) continue;
    workspace.staged.push({
      id: `stg-${row.product.sku}`,
      sku: row.product.sku,
      titleHe: row.product.titleHe,
      titleEn: row.product.titleHe,
      packSize: row.product.packSize,
      unit: row.product.unit,
      costAgorot: row.product.costAgorot,
      warehouseCode: row.product.warehouseCode,
      state: "unreviewed",
    });
    staged += 1;
  }
  writeWorkspace(workspace);
  revalidatePath("/admin/staging");
  return { ok: true, approved: staged };
}

export async function previewStockUpload(csv: string): Promise<CsvActionResult<StockPreview>> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  const parsed = parseStockCsv(csv);
  if (parsed.errors.length > 0) return { ok: false, message: parsed.errors[0] };
  const catalog = readCatalog();
  const result = previewStock(catalog.products, catalog.stock, parsed.rows);
  return { ok: true, notes: [], rows: result.previews };
}

export async function applyStockUpload(csv: string): Promise<{ ok: true; applied: number } | { ok: false; message: string }> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  const parsed = parseStockCsv(csv);
  if (parsed.errors.length > 0) return { ok: false, message: parsed.errors[0] };
  const catalog = readCatalog();
  const result = previewStock(catalog.products, catalog.stock, parsed.rows);
  writeCatalog({ ...catalog, stock: result.stock });
  revalidatePath("/catalog");
  revalidatePath("/admin");
  return { ok: true, applied: result.previews.filter((row) => row.status === "apply").length };
}

type SaleCopy = { headline?: string; recommendation?: string };

const listingWrites = new Map<string, Promise<void>>();

function writeListing<T>(key: string, job: () => Promise<T>): Promise<T> {
  const previous = listingWrites.get(key) ?? Promise.resolve();
  const run = previous.then(job, job);
  listingWrites.set(
    key,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

function cleanCopy(value: string | undefined, max: number): string {
  return (value ?? "").trim().slice(0, max);
}

async function pricedListing(sku: string, rawRetail: string, publish: boolean, copy?: SaleCopy) {
  const access = await readAccess();
  const sellerId = access.userId;
  if (!sellerId || (access.role !== "creator" && access.role !== "admin")) {
    return { ok: false as const, message: "צריך להתחבר כיוצר כדי לשמור מחיר." };
  }
  const sellerEmail = access.email ?? sellerId;
  return writeListing(`${sellerId}:${sku}`, async () => {
    const parsed = parseRetailDraft(rawRetail);
    if (parsed.status !== "priced") return { ok: false as const, message: "המחיר לא תקין. הזינו מספר חיובי עם עד שתי ספרות אחרי הנקודה." };
    const catalog = readCatalog();
    const product = catalog.products.find((item) => item.sku === sku);
    if (!product) return { ok: false as const, message: "המוצר לא נמצא בקטלוג המאושר." };
    if (parsed.agorot < product.costAgorot) return { ok: false as const, message: "אי אפשר לשמור מחיר שנמוך מעלות המארז." };
    const stock = catalog.stock.find((item) => item.sku === product.sku && item.warehouseCode === product.warehouseCode);
    if (publish && (!stock || stock.halted || stock.sequence < 1)) {
      return { ok: false as const, message: "עדיין אין ספירת מלאי תקינה למוצר הזה. הפרסום לא נשמר." };
    }
    const sellerHandle = sellerHandleFromEmail(sellerEmail, sellerId);
    const slug = listingSlug(product.sku);
    const current = catalog.listings.find((item) => item.sellerId === sellerId && item.sku === product.sku);
    const headline = cleanCopy(copy?.headline, 80);
    const recommendation = cleanCopy(copy?.recommendation, 280);
    const listing = {
      sellerId,
      sellerHandle,
      sellerName: sellerHandle,
      sku: product.sku,
      slug,
      retailAgorot: publish ? parsed.agorot : current?.retailAgorot ?? 0,
      draftAgorot: parsed.agorot,
      publishedAt: publish ? new Date().toISOString() : current?.publishedAt ?? "",
      buyerHeadline: publish ? headline : current?.buyerHeadline ?? "",
      recommendation: publish ? recommendation : current?.recommendation ?? "",
      draftHeadline: headline,
      draftRecommendation: recommendation,
      paused: publish ? false : current?.paused ?? false,
      creatorFundsShipping: current?.creatorFundsShipping ?? false,
    };
    writeCatalog({
      ...catalog,
      listings: [...catalog.listings.filter((item) => item !== current), listing],
    });
    const path = `/s/${sellerHandle}/${slug}`;
    revalidatePath("/catalog");
    revalidatePath("/listings");
    revalidatePath(path);
    return { ok: true as const, path, published: publish && (current?.retailAgorot ?? 0) > 0 };
  });
}

export async function saveCatalogDraft(sku: string, rawRetail: string, copy?: SaleCopy) {
  return pricedListing(sku, rawRetail, false, copy);
}

export async function publishCatalogPrice(sku: string, rawRetail: string, copy?: SaleCopy) {
  return pricedListing(sku, rawRetail, true, copy);
}

export async function setCatalogSalePaused(sku: string, paused: boolean) {
  const access = await readAccess();
  const sellerId = access.userId;
  if (!sellerId || (access.role !== "creator" && access.role !== "admin")) {
    return { ok: false as const, message: "צריך להתחבר כיוצר כדי לעדכן את המכירה." };
  }
  return writeListing(`${sellerId}:${sku}`, async () => {
    const catalog = readCatalog();
    const current = catalog.listings.find((item) => item.sellerId === sellerId && item.sku === sku);
    if (!current || current.retailAgorot <= 0) {
      return { ok: false as const, message: "אפשר להשהות רק מכירה שכבר פורסמה." };
    }
    writeCatalog({
      ...catalog,
      listings: catalog.listings.map((item) => (item === current ? { ...current, paused } : item)),
    });
    revalidatePath(`/s/${current.sellerHandle}/${current.slug}`);
    revalidatePath("/listings");
    return { ok: true as const };
  });
}

export async function setCreatorFundsShipping(formData: FormData): Promise<void> {
  const access = await readAccess();
  const sellerId = access.userId;
  const sku = String(formData.get("sku") ?? "");
  const enabled = String(formData.get("enabled") ?? "") === "yes";
  if (!sellerId || (access.role !== "creator" && access.role !== "admin")) redirect(`/catalog/${sku}?shipping=forbidden`);
  const catalog = readCatalog();
  const current = catalog.listings.find((item) => item.sellerId === sellerId && item.sku === sku);
  const product = catalog.products.find((item) => item.sku === sku);
  if (!current || !product || current.retailAgorot <= 0) redirect(`/catalog/${sku}?shipping=missing`);
  const handle = sellerHandleFromEmail(access.email ?? sellerId, sellerId);
  if (enabled && policyForSeller(handle) === WEEKLY_POLICY) {
    const rate = rateAt(readCommissions().cards, Date.now());
    const sample = readTariffs().find((rule) => rule.status === "published" && rule.warehouseCode === product.warehouseCode && rule.service === "standard");
    if (rate && sample) {
      const preview = packEarnings(current.retailAgorot, product.costAgorot, WEEKLY_POLICY, rate, sample.priceAgorot);
      if (preview?.hint.includes("מתחת לאפס")) redirect(`/catalog/${sku}?shipping=negative`);
    }
  }
  writeCatalog({
    ...catalog,
    listings: catalog.listings.map((item) => (item === current ? { ...current, creatorFundsShipping: enabled } : item)),
  });
  revalidatePath(`/catalog/${sku}`);
  revalidatePath(`/s/${current.sellerHandle}/${current.slug}/checkout`);
  redirect(`/catalog/${sku}?shipping=${enabled ? "on" : "off"}`);
}

export async function importPartySample(): Promise<void> {
  const admin = await requireAdmin();
  if (!admin.ok) redirect(`/admin?notice=${encodeURIComponent(admin.message)}`);
  const csv = fs.readFileSync(path.join(process.cwd(), "public/samples/party-products.csv"), "utf8");
  const staged = await approveProductUpload(csv);
  if (!staged.ok) redirect(`/admin?notice=${encodeURIComponent(staged.message)}`);
  redirect("/admin/staging");
}

export async function approveStaged(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin.ok) return;
  const id = String(formData.get("id") ?? "");
  const workspace = readWorkspace();
  const item = workspace.staged.find((row) => row.id === id && row.state === "unreviewed");
  if (!item) return;
  item.state = "approved";
  const catalog = readCatalog();
  if (!catalog.products.some((product) => product.sku === item.sku)) {
    catalog.products.push({
      sku: item.sku,
      titleHe: item.titleHe,
      packSize: item.packSize,
      unit: item.unit,
      costAgorot: item.costAgorot,
      warehouseCode: item.warehouseCode,
    });
  }
  workspace.audit.unshift({ at: new Date().toISOString(), actor: admin.userId, action: "approve-product", detail: item.sku });
  writeWorkspace(workspace);
  writeCatalog(catalog);
  revalidatePath("/catalog");
  revalidatePath("/admin/staging");
}

export async function saveProductCopy(formData: FormData): Promise<void> {
  const access = await readAccess();
  if (adminPageDecision(access.role) !== "allow") return;
  const sku = String(formData.get("sku") ?? "");
  const catalog = readCatalog();
  const product = catalog.products.find((item) => item.sku === sku);
  if (!product) return;
  const titleHe = String(formData.get("titleHe") ?? "").trim();
  if (titleHe.length < 2) return;
  product.titleHe = titleHe;
  product.titleEn = String(formData.get("titleEn") ?? "").trim();
  product.rights = formData.get("rights") === "cleared" ? "cleared" : "pending";
  writeCatalog(catalog);
  const workspace = readWorkspace();
  workspace.audit.unshift({ at: new Date().toISOString(), actor: access.userId ?? "", action: "edit-product", detail: sku });
  writeWorkspace(workspace);
  revalidatePath(`/admin/products/${sku}`);
}

export async function ignoreStaged(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin.ok) return;
  const id = String(formData.get("id") ?? "");
  const workspace = readWorkspace();
  const item = workspace.staged.find((row) => row.id === id);
  if (item) item.state = "ignored";
  writeWorkspace(workspace);
  revalidatePath("/admin/staging");
}

export async function importPartyStock(): Promise<void> {
  const admin = await requireAdmin();
  if (!admin.ok) redirect(`/admin?notice=${encodeURIComponent(admin.message)}`);
  const csv = fs.readFileSync(path.join(process.cwd(), "public/samples/party-stock.csv"), "utf8");
  const applied = await applyStockUpload(csv);
  if (!applied.ok) redirect(`/admin?notice=${encodeURIComponent(applied.message)}`);
  if (applied.applied < 1) redirect("/admin?notice=" + encodeURIComponent("לא הוחלה ספירה. קודם מאשרים את המוצר בתור הבדיקה."));
  redirect("/admin?notice=stock");
}
