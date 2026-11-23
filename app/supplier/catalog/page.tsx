import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Denied, RoleNav } from "@/components/role-nav";
import { readAccess } from "@/lib/auth/access";
import { readCatalog } from "@/lib/catalog/store";
import { formatShekels } from "@/lib/money";

export const metadata: Metadata = { title: "הצעות ספק", description: "מוצרים שאושרו מהייבוא." };

async function OffersContent() {
  const access = await readAccess();
  if (access.role === "guest") redirect("/login?next=/supplier/catalog");
  if (access.role !== "supplier" && access.role !== "admin") return <Denied access={access} />;
  const products = readCatalog().products;
  return (
    <>
      <RoleNav access={access} />
      <h1 className="page-title">המלאי והקטלוג שלי</h1>
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

export default function SupplierCatalogPage() {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <OffersContent />
      </Suspense>
    </main>
  );
}
