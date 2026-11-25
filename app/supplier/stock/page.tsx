import { WorkspaceTitle } from "@/components/workspace-title";
import { Suspense } from "react";
import type { Metadata } from "next";
import { Denied, RoleNav } from "@/components/role-nav";
import { openSurface } from "@/lib/auth/guards";
import { supplierWarehouse } from "@/lib/auth/tenant";
import { sellableQuantity } from "@/lib/catalog/model";
import { readCatalog } from "@/lib/catalog/store";

export const metadata: Metadata = { title: "ספירות מלאי", description: "ספירות פיתוח ופערים." };

async function StockContent({ searchParams }: { searchParams: Promise<{ inspect?: string }> }) {
  const query = await searchParams;
  const opened = await openSurface("supplier", "/supplier/stock", query.inspect);
  if ("denied" in opened) return <Denied access={opened.denied} />;
  const { access, readOnly } = opened;
  const warehouse = supplierWarehouse(access);
  const stock = readCatalog().stock.filter((row) => readOnly || row.warehouseCode === warehouse);
  return (
    <>
      <RoleNav access={access} />
      <WorkspaceTitle he="ספירות מלאי" en="Stock counts" />
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

export default function SupplierStockPage({ searchParams }: { searchParams: Promise<{ inspect?: string }> }) {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <StockContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
