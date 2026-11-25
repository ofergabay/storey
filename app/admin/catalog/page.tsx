import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Denied, RoleNav } from "@/components/role-nav";
import { requireAdminPage } from "@/lib/auth/admin-gate";
import { pickCopy } from "@/lib/i18n/locale";
import { readLocale } from "@/lib/i18n/server";
import { readCatalog } from "@/lib/catalog/store";
import { formatShekels } from "@/lib/money";
import { readWorkspace } from "@/lib/workspace/store";

export const metadata: Metadata = { title: "קטלוג שפורסם", description: "מוצרים מאושרים והיסטוריית עריכה." };

async function PublishedCatalog() {
  const [gate, locale] = await Promise.all([requireAdminPage("/admin/catalog"), readLocale()]);
  if (!gate.admin) return <Denied access={gate.access} />;
  const access = gate.access;
  const catalog = readCatalog();
  const edits = readWorkspace().audit.filter((entry) => entry.action === "edit-product" || entry.action === "approve-product");
  return (
    <>
      <RoleNav access={access} />
      <h1 className="page-title">{pickCopy(locale, "קטלוג שפורסם", "Published catalog")}</h1>
      {catalog.products.length === 0 ? <p className="status">{pickCopy(locale, "אין מוצרים מאושרים.", "No approved products.")}</p> : null}
      <div className="catalog-list">
        {catalog.products.map((product) => (
          <article className="card" key={product.sku}>
            <div className="copy">
              <h2 className="section-title">{product.titleHe}</h2>
              <p dir="ltr">{product.sku}</p>
              <p>עלות מארז: {formatShekels(product.costAgorot)}</p>
              <p>זכויות: {product.rights === "cleared" ? "נבדקו" : "ממתינות"}</p>
              <Link href={`/admin/products/${product.sku}`}>עריכה</Link>
            </div>
          </article>
        ))}
      </div>
      <h2 className="section-title">היסטוריית עריכה</h2>
      {edits.length === 0 ? <p className="status">אין עריכות עדיין.</p> : null}
      <ul>
        {edits.map((entry) => (
          <li key={`${entry.at}-${entry.detail}`}>{entry.action} · {entry.detail}</li>
        ))}
      </ul>
    </>
  );
}

export default function AdminCatalogPage() {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <PublishedCatalog />
      </Suspense>
    </main>
  );
}
