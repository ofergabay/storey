import { WorkspaceTitle } from "@/components/workspace-title";
import { Suspense } from "react";
import type { Metadata } from "next";
import { Denied, RoleNav } from "@/components/role-nav";
import { openSurface } from "@/lib/auth/guards";
import { supplierWarehouse } from "@/lib/auth/tenant";
import { supplierCatalogView } from "@/lib/auth/views";
import { readCatalog } from "@/lib/catalog/store";
import { formatShekels } from "@/lib/money";

export const metadata: Metadata = { title: "הצעות ספק", description: "מוצרים שאושרו מהייבוא." };

async function OffersContent({ searchParams }: { searchParams: Promise<{ inspect?: string }> }) {
  const query = await searchParams;
  const opened = await openSurface("supplier", "/supplier/catalog", query.inspect);
  if ("denied" in opened) return <Denied access={opened.denied} />;
  const { access, readOnly } = opened;
  const warehouse = supplierWarehouse(access);
  const products = readOnly ? readCatalog().products : supplierCatalogView(readCatalog().products, warehouse);
  return (
    <>
      <RoleNav access={access} />
      <WorkspaceTitle he="המלאי והקטלוג שלי" en="My stock and catalog" />
      <p className="hint">מוצג הקטלוג המאושר של החשבון הזה. מחיר המכירה ללקוח וקטלוגים של ספקים אחרים לא מוצגים.</p>
      {products.length === 0 ? <p className="status">אין הצעות מאושרות. תוצאות הייבוא מופיעות בתור הבדיקה.</p> : null}
      <ul>
        {products.map((product) => (
          <li key={product.sku}>
            {product.titleHe} · {product.packSize} {product.unit} · {formatShekels(product.costAgorot)}
          </li>
        ))}
      </ul>
    </>
  );
}

export default function SupplierCatalogPage({ searchParams }: { searchParams: Promise<{ inspect?: string }> }) {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <OffersContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
