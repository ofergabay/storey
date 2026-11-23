import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { PublicListing } from "@/components/public-listing";
import { saveCart } from "@/lib/workspace/actions";
import { readCatalog } from "@/lib/catalog/store";
import { formatShekels } from "@/lib/money";

export const metadata: Metadata = {
  title: "מודעה",
  robots: { index: false, follow: false },
};

async function ListingContent({ params }: { params: Promise<{ seller: string; listing: string }> }) {
  await connection();
  const { seller, listing } = await params;
  const catalog = readCatalog();
  const saved = catalog.listings.find((item) => item.sellerHandle === seller && item.slug === listing && item.retailAgorot > 0);
  const product = saved ? catalog.products.find((item) => item.sku === saved.sku) : undefined;
  if (!saved || !product || saved.paused) return <p className="status">הקישור אינו פעיל</p>;
  const initials = saved.sellerHandle.slice(0, 2).toUpperCase();

  return (
    <>
      <PublicListing
        title={saved.buyerHeadline?.trim() || product.titleHe}
        summary={saved.recommendation?.trim() || "מוצר שפורסם מהקטלוג."}
        packLabel="מארז"
        packSize={product.packSize}
        packUnit={product.unit}
        sellerHandle={`@${saved.sellerHandle}`}
        sellerInitials={initials}
        sellerName={saved.sellerName}
        sellingPrice={formatShekels(saved.retailAgorot)}
      />
      <form action={saveCart} className="copy">
        <input type="hidden" name="seller" value={seller} />
        <input type="hidden" name="slug" value={listing} />
        <input type="hidden" name="quantity" value="1" />
        <button className="button-secondary" type="submit">
          הוספה לעגלה
        </button>
      </form>
      <a className="button-publish" href={`/s/${seller}/${listing}/checkout`}>
        להצעת מחיר
      </a>
    </>
  );
}

export default function PublishedListingPage({ params }: { params: Promise<{ seller: string; listing: string }> }) {
  return (
    <main className="customer-shell">
      <Suspense fallback={<p className="status">טוען את המודעה…</p>}>
        <ListingContent params={params} />
      </Suspense>
    </main>
  );
}
