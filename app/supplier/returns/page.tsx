import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Denied, RoleNav } from "@/components/role-nav";
import { readAccess } from "@/lib/auth/access";
import { receiveReturn, reconcileReturn } from "@/lib/workspace/actions";
import { readWorkspace } from "@/lib/workspace/store";

export const metadata: Metadata = { title: "קבלת החזרות", description: "קבלה ובדיקה של החזרה." };

async function ReturnsContent() {
  const access = await readAccess();
  if (access.role === "guest") redirect("/login?next=/supplier/returns");
  if (access.role !== "supplier" && access.role !== "warehouse" && access.role !== "admin") return <Denied access={access} />;
  const workspace = readWorkspace();
  const rows = workspace.returns;
  return (
    <>
      <RoleNav access={access} />
      <h1 className="page-title">קבלת החזרות</h1>
      {rows.length === 0 ? <p className="status">אין החזרות שממתינות.</p> : null}
      <div className="catalog-list">
        {rows.map((row) => (
          <article className="card" key={row.id}>
            <div className="copy">
              <p>
                {row.quantity} מארזים ·{" "}
                {row.status === "requested" ? "התבקשה" : row.status === "received" ? "התקבלה" : "הותאמה"}
              </p>
              {row.status === "requested" ? (
                <form action={receiveReturn}>
                  <input type="hidden" name="id" value={row.id} />
                  <button className="button-publish" type="submit">קבלת ההחזרה</button>
                </form>
              ) : null}
              {row.status === "received" ? (
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

export default function SupplierReturnsPage() {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <ReturnsContent />
      </Suspense>
    </main>
  );
}
