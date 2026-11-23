import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Denied, RoleNav } from "@/components/role-nav";
import { readAccess } from "@/lib/auth/access";
import { sellableQuantity } from "@/lib/catalog/model";
import { readCatalog } from "@/lib/catalog/store";

export const metadata: Metadata = { title: "ספירות מלאי", description: "ספירות פיתוח ופערים." };

async function StockContent() {
  const access = await readAccess();
  if (access.role === "guest") redirect("/login?next=/supplier/stock");
  if (access.role !== "supplier" && access.role !== "warehouse" && access.role !== "admin") return <Denied access={access} />;
  const stock = readCatalog().stock;
  return (
    <>
      <RoleNav access={access} />
      <h1 className="page-title">ספירות מלאי</h1>
      <p className="hint">אלה ספירות פיתוח. הן לא אישור מחסן חי.</p>
      {stock.length === 0 ? <p className="status">אין ספירות.</p> : null}
      <ul>
        {stock.map((row) => (
          <li key={`${row.sku}-${row.warehouseCode}`}>
            {row.sku} · במחסן {row.onHand} · שמור {row.held} · פנוי {sellableQuantity(row) ?? 0}
            {row.halted ? " · פער: המכירה נעצרה" : ""}
          </li>
        ))}
      </ul>
    </>
  );
}

export default function SupplierStockPage() {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <StockContent />
      </Suspense>
    </main>
  );
}
