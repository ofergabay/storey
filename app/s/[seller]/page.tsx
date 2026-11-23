import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { readCatalog } from "@/lib/catalog/store";
import { formatShekels } from "@/lib/money";
import { readWorkspace } from "@/lib/workspace/store";

export const metadata: Metadata = { title: "חנות", description: "מוצרים שפורסמו." };

async function StorefrontContent({ params }: { params: Promise<{ seller: string }> }) {
  const { seller } = await params;
  const listings = readCatalog().listings.filter((item) => item.sellerHandle === seller && item.retailAgorot > 0);
  const policy = readWorkspace().storefronts.find((item) => listings.some((listing) => listing.sellerId === item.sellerId));
  return (
    <>
      <h1 className="page-title">חנות</h1>
      {policy?.collection ? <p>{policy.collection}</p> : null}
      {listings.length === 0 ? <p className="status">אין מוצרים שפורסמו בחנות הזו.</p> : null}
      <div className="catalog-list">
        {listings.map((item) => (
          <article className="card" key={item.slug}>
            <div className="copy">
              <p dir="ltr">{formatShekels(item.retailAgorot)}</p>
              <Link href={`/s/${seller}/${item.slug}`}>למוצר</Link>
            </div>
          </article>
        ))}
      </div>
      {policy?.policy ? <p>{policy.policy}</p> : <p className="hint">מדיניות ההחזרות תופיע כאן אחרי שהיוצר ישמור אותה.</p>}
    </>
  );
}

export default function SellerStorefrontPage({ params }: { params: Promise<{ seller: string }> }) {
  return (
    <main className="customer-shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <StorefrontContent params={params} />
      </Suspense>
    </main>
  );
}
