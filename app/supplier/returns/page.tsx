import { WorkspaceTitle } from "@/components/workspace-title";
import { Suspense } from "react";
import type { Metadata } from "next";
import { Denied, RoleNav } from "@/components/role-nav";
import { openSurface } from "@/lib/auth/guards";
import { supplierWarehouse } from "@/lib/auth/tenant";
import { receiveReturn, reconcileReturn } from "@/lib/workspace/actions";
import { readWorkspace } from "@/lib/workspace/store";

export const metadata: Metadata = { title: "קבלת החזרות", description: "קבלה ובדיקה של החזרה." };

async function ReturnsContent({ searchParams }: { searchParams: Promise<{ inspect?: string }> }) {
  const query = await searchParams;
  const opened = await openSurface("supplier", "/supplier/returns", query.inspect);
  if ("denied" in opened) return <Denied access={opened.denied} />;
  const { access, readOnly } = opened;
  const warehouse = supplierWarehouse(access);
  const workspace = readWorkspace();
  const rows = workspace.returns.filter((row) => {
    const order = workspace.orders.find((item) => item.id === row.orderId);
    return readOnly || order?.warehouseCode === warehouse;
  });
  return (
    <>
      <RoleNav access={access} />
      <WorkspaceTitle he="קבלת החזרות" en="Incoming returns" />
      {rows.length === 0 ? <p className="status">אין החזרות שממתינות.</p> : null}
      <div className="catalog-list">
        {rows.map((row) => (
          <article className="card" key={row.id}>
            <div className="copy">
              <p>
                {row.quantity} מארזים ·{" "}
                {row.status === "requested" ? "התבקשה" : row.status === "received" ? "התקבלה" : "הותאמה"}
              </p>
              {!readOnly && row.status === "requested" ? (
                <form action={receiveReturn}>
                  <input type="hidden" name="id" value={row.id} />
                  <button className="button-publish" type="submit">קבלת ההחזרה</button>
                </form>
              ) : null}
              {!readOnly && row.status === "received" ? (
                <form action={reconcileReturn}>
                  <input type="hidden" name="id" value={row.id} />
                  {workspace.orders.find((order) => order.id === row.orderId)?.paymentCaseId ? (
                    <label>
                      תוצאת בדיקה
                      <select name="disposition" defaultValue="sellable">
                        <option value="sellable">חזרה למלאי המקור</option>
                        <option value="quarantine">הסגר</option>
                        <option value="loss">אובדן</option>
                      </select>
                    </label>
                  ) : null}
                  <button className="button-publish" type="submit">התאמת המלאי</button>
                </form>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

export default function SupplierReturnsPage({ searchParams }: { searchParams: Promise<{ inspect?: string }> }) {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <ReturnsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
