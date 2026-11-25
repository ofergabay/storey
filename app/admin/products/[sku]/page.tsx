import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Denied, RoleNav } from "@/components/role-nav";
import { requireAdminPage } from "@/lib/auth/admin-gate";
import { saveProductCopy } from "@/lib/catalog/actions";
import { readCatalog } from "@/lib/catalog/store";
import { formatShekels } from "@/lib/money";

export const metadata: Metadata = { title: "עריכת מוצר", description: "נוסח, עלות וזכויות." };

async function EditorContent({ params }: { params: Promise<{ sku: string }> }) {
  const [{ sku }, gate] = await Promise.all([params, requireAdminPage("/admin/catalog")]);
  if (!gate.admin) return <Denied access={gate.access} />;
  const access = gate.access;
  const product = readCatalog().products.find((item) => item.sku === sku);
  if (!product) {
    return (
      <>
        <RoleNav access={access} />
        <p className="status">המוצר לא אושר לקטלוג.</p>
        <Link href="/admin/staging">לתור הבדיקה</Link>
      </>
    );
  }
  return (
    <>
      <RoleNav access={access} />
      <p>
        <Link href="/admin/catalog">חזרה לקטלוג שפורסם</Link>
      </p>
      <h1 className="page-title">{product.titleHe}</h1>
      <p>נתוני ספק: {product.sku} · מחסן {product.warehouseCode} · עלות {formatShekels(product.costAgorot)}</p>
      <p className="hint">העלות נשארת אצל הניהול והיוצר. היא לא מופיעה בקישור הציבורי.</p>
      <form className="auth-form" action={saveProductCopy}>
        <input type="hidden" name="sku" value={product.sku} />
        <label htmlFor="title-he">
          שם בעברית
          <input id="title-he" name="titleHe" defaultValue={product.titleHe} required minLength={2} />
        </label>
        <label htmlFor="title-en">
          שם באנגלית
          <input id="title-en" name="titleEn" defaultValue={product.titleEn ?? ""} />
        </label>
        <label htmlFor="rights">
          זכויות תמונה
          <select id="rights" name="rights" defaultValue={product.rights ?? "pending"}>
            <option value="pending">ממתין לבדיקה</option>
            <option value="cleared">נבדק</option>
          </select>
        </label>
        <button className="button-publish" type="submit">שמירת הנוסח</button>
      </form>
    </>
  );
}

export default function ProductEditorPage({ params }: { params: Promise<{ sku: string }> }) {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <EditorContent params={params} />
      </Suspense>
    </main>
  );
}
