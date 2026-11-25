import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProductArt } from "@/components/product-art";
import { Denied, RoleNav } from "@/components/role-nav";
import { openSurface } from "@/lib/auth/guards";
import { productUnavailableHe } from "@/lib/auth/oauth";
import { pickCopy } from "@/lib/i18n/locale";
import { readLocale } from "@/lib/i18n/server";
import { sellableQuantity } from "@/lib/catalog/model";
import { readCatalog } from "@/lib/catalog/store";
import { PUBLIC_LISTING } from "@/lib/cloud-nine-public";

export const metadata: Metadata = {
  title: "קטלוג",
  description: "מוצרים מאושרים לתמחור.",
};

async function CatalogContent({ searchParams }: { searchParams: Promise<{ q?: string; inspect?: string; unavailable?: string }> }) {
  const [query, locale] = await Promise.all([searchParams, readLocale()]);
  const unavailable = query.unavailable === "1";
  const opened = await openSurface("creator", "/catalog", query.inspect, { allowAdmin: unavailable });
  if ("denied" in opened) return <Denied access={opened.denied} />;
  const { access } = opened;
  const catalog = readCatalog();
  const q = (query.q ?? "").trim();
  const products = catalog.products.filter(
    (product) => !q || product.titleHe.includes(q) || product.sku.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <>
      <RoleNav access={access} />
      <h1 className="page-title">{pickCopy(locale, "קטלוג", "Catalog")}</h1>
      {unavailable ? <p className="status" role="status">{productUnavailableHe}</p> : null}
      <p>{pickCopy(locale, "בוחרים מוצר מאושר, רואים את התמונה ואת גודל המארז, וקובעים מחיר מכירה.", "Choose an approved product, see the photo and pack size, and set a selling price.")}</p>
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
            <p className="hint">הספירה של המוצר הזה נשארת במסלול Cloud Nine הקיים. מחיר המכירה נקבע בסטודיו.</p>
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

export default function CatalogPage({ searchParams }: { searchParams: Promise<{ q?: string; inspect?: string; unavailable?: string }> }) {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען את הקטלוג…</p>}>
        <CatalogContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
