import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProductArt } from "@/components/product-art";
import { Denied, RoleNav } from "@/components/role-nav";
import { readAccess } from "@/lib/auth/access";
import { sellableQuantity } from "@/lib/catalog/model";
import { readCatalog } from "@/lib/catalog/store";
import { PUBLIC_LISTING } from "@/lib/cloud-nine-public";
import { CLOUD_NINE_SELLER } from "@/lib/cloud-nine-seller";
import { formatShekels } from "@/lib/money";

export const metadata: Metadata = {
  title: "קטלוג",
  description: "מוצרים מאושרים לתמחור.",
};

async function CatalogContent({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [access, query] = await Promise.all([readAccess(), searchParams]);
  if (access.role === "guest") redirect("/login?next=/catalog");
  if (access.role !== "creator" && access.role !== "admin") return <Denied access={access} />;
  const catalog = readCatalog();
  const q = (query.q ?? "").trim();
  const products = catalog.products.filter(
    (product) => !q || product.titleHe.includes(q) || product.sku.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <>
      <RoleNav access={access} />
      <h1 className="page-title">קטלוג</h1>
      <p>בוחרים מוצר מאושר, רואים את התמונה, את גודל המארז ואת העלות, ועוברים לקביעת מחיר.</p>
      <form className="auth-form" action="/catalog">
        <label htmlFor="catalog-q">
          חיפוש
          <input id="catalog-q" name="q" defaultValue={q} placeholder="שם או מק״ט" />
        </label>
        <button className="button-secondary" type="submit">
          סינון
        </button>
      </form>
      <div className="catalog-list">
        <article className="card">
          <ProductArt sticker={`${PUBLIC_LISTING.packSize} ${PUBLIC_LISTING.packUnit}`} />
          <div className="copy">
            <h2 className="product-title">{PUBLIC_LISTING.title}</h2>
            <p>
              {PUBLIC_LISTING.packSize} {PUBLIC_LISTING.packUnit}
            </p>
            <p className="quote-line">
              <span>עלות המארז</span>
              <strong dir="ltr">{formatShekels(CLOUD_NINE_SELLER.wholesaleAgorot)}</strong>
            </p>
            <p className="hint">הספירה של המוצר הזה נשארת במסלול Cloud Nine הקיים.</p>
            <Link className="button-publish" href="/studio">
              בחירת מוצר
            </Link>
          </div>
        </article>
        {products.map((product) => {
          const stock = catalog.stock.find(
            (item) => item.sku === product.sku && item.warehouseCode === product.warehouseCode,
          );
          const sellable = sellableQuantity(stock);
          const stockLabel = stock?.halted
            ? "המכירה נעצרה עד לספירה תקינה."
            : sellable === null
              ? "עדיין אין ספירת מלאי."
              : `במלאי: ${sellable}`;
          return (
            <article className="card" key={product.sku}>
              <ProductArt sticker={`${product.packSize} ${product.unit}`} />
              <div className="copy">
                <h2 className="product-title">{product.titleHe}</h2>
                <p>
                  {product.packSize} {product.unit}
                </p>
                <p className="quote-line">
                  <span>עלות המארז</span>
                  <strong dir="ltr">{formatShekels(product.costAgorot)}</strong>
                </p>
                <p className="hint">{stockLabel}</p>
                <Link className="button-publish" href={`/catalog/${product.sku}`}>
                  בחירת מוצר
                </Link>
              </div>
            </article>
          );
        })}
      </div>
      {products.length === 0 ? <p className="status">אין מוצרים שמתאימים לחיפוש.</p> : null}
    </>
  );
}

export default function CatalogPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען את הקטלוג…</p>}>
        <CatalogContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
