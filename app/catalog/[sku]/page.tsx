import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CatalogPricing } from "@/components/catalog-pricing";
import { Denied, RoleNav } from "@/components/role-nav";
import { readAccess } from "@/lib/auth/access";
import { CLOUD_NINE_SKU } from "@/lib/catalog/identity";
import { sellableQuantity } from "@/lib/catalog/model";
import { readCatalog } from "@/lib/catalog/store";

export const metadata: Metadata = {
  title: "תמחור מוצר",
  description: "קביעת מחיר מכירה למוצר מאושר.",
};

async function PricingContent({ params }: { params: Promise<{ sku: string }> }) {
  const [{ sku }, access] = await Promise.all([params, readAccess()]);
  if (access.role === "guest") redirect("/login?next=/catalog");
  if (access.role !== "creator" && access.role !== "admin") return <Denied access={access} />;
  if (sku === CLOUD_NINE_SKU) redirect("/studio");
  const catalog = readCatalog();
  const product = catalog.products.find((item) => item.sku === sku);
  if (!product) {
    return (
      <>
        <RoleNav access={access} />
        <p className="status">המוצר לא נמצא בקטלוג המאושר.</p>
        <Link href="/catalog">חזרה לקטלוג</Link>
      </>
    );
  }
  const stock = catalog.stock.find(
    (item) => item.sku === product.sku && item.warehouseCode === product.warehouseCode,
  );
  const listing = catalog.listings.find((item) => item.sellerId === access.userId && item.sku === product.sku);
  const sellable = sellableQuantity(stock);
  const canPublishStock = sellable !== null;
  const stockLabel = stock?.halted
    ? "המכירה נעצרה עד לספירה תקינה."
    : sellable === null
      ? "עדיין אין ספירת מלאי תקינה."
      : `במלאי: ${sellable}`;

  return (
    <>
      <RoleNav access={access} />
      <CatalogPricing
        sku={product.sku}
        title={product.titleHe}
        pack={`${product.packSize} ${product.unit}`}
        costAgorot={product.costAgorot}
        stockLabel={stockLabel}
        canPublishStock={canPublishStock}
        publishedAgorot={listing?.retailAgorot ?? 0}
        draftAgorot={listing?.draftAgorot ?? null}
        publishedHeadline={listing?.buyerHeadline ?? ""}
        publishedRecommendation={listing?.recommendation ?? ""}
        draftHeadline={listing?.draftHeadline ?? listing?.buyerHeadline ?? ""}
        draftRecommendation={listing?.draftRecommendation ?? listing?.recommendation ?? ""}
        paused={listing?.paused ?? false}
        salePath={listing ? `/s/${listing.sellerHandle}/${listing.slug}` : null}
        storefront={false}
      />
    </>
  );
}

export default function CatalogPricingPage({ params }: { params: Promise<{ sku: string }> }) {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען את המוצר…</p>}>
        <PricingContent params={params} />
      </Suspense>
    </main>
  );
}
