import { Suspense } from "react";
import { connection } from "next/server";
import { beginListingCheckout } from "@/lib/workspace/actions";
import { policyForSeller } from "@/lib/commerce/payment/cohort";
import { readCatalog } from "@/lib/catalog/store";
import { formatShekels } from "@/lib/money";

async function CheckoutContent({
  params,
  searchParams,
}: {
  params: Promise<{ seller: string; listing: string }>;
  searchParams: Promise<{ hold?: string }>;
}) {
  await connection();
  const [{ seller, listing }, query] = await Promise.all([params, searchParams]);
  const saved = readCatalog().listings.find((item) => item.sellerHandle === seller && item.slug === listing && item.retailAgorot > 0);
  if (!saved) return <p className="status">הקישור אינו פעיל</p>;
  return (
    <article className="customer-card">
      <div className="copy">
        <h1 className="page-title">הצעת מחיר</h1>
        <p>
          מחיר למארז <strong dir="ltr">{formatShekels(saved.retailAgorot)}</strong>
        </p>
        <p className="hint">שמירת ההצעה והעגלה לא שומרות מלאי. רק התחלת קופה שומרת מארזים ל-10 דקות. אין תשלום.</p>
        <p>הצעה חדשה נשמרת במדיניות <span dir="ltr">{policyForSeller(seller)}</span>.</p>
        {query.hold === "stock" ? <p className="status">אין מספיק מארזים פנויים. המלאי לא נשמר.</p> : null}
        <form action={beginListingCheckout}>
          <input type="hidden" name="seller" value={seller} />
          <input type="hidden" name="slug" value={listing} />
          <label htmlFor="checkout-qty">
            כמות מארזים
            <input id="checkout-qty" name="quantity" type="number" min={1} max={20} defaultValue={1} />
          </label>
          <button className="button-publish" type="submit">
            התחלת קופה
          </button>
        </form>
      </div>
    </article>
  );
}

export default function ListingCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ seller: string; listing: string }>;
  searchParams: Promise<{ hold?: string }>;
}) {
  return (
    <main className="customer-shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <CheckoutContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
