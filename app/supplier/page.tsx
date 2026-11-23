import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Denied, RoleNav } from "@/components/role-nav";
import { readAccess } from "@/lib/auth/access";
import { advanceOrder, offerLateSupply, simulateDelivery, timeoutBackorder } from "@/lib/workspace/actions";
import { readPaymentCases } from "@/lib/commerce/payment/store";
import { readWorkspace } from "@/lib/workspace/store";

export const metadata: Metadata = { title: "תור אספקה", description: "ליקוט, אריזה, מדבקה ושליחה." };

const step: Record<string, string> = {
  sandbox_paid: "ליקוט",
  picking: "אריזה",
  packed: "מדבקה",
  labeled: "שליחה",
};

async function QueueContent() {
  const access = await readAccess();
  if (access.role === "guest") redirect("/login?next=/supplier");
  if (access.role !== "supplier" && access.role !== "warehouse" && access.role !== "admin") return <Denied access={access} />;
  const orders = readWorkspace().orders;
  const open = orders.filter((order) => order.status in step);
  const delivered = orders.filter((order) => order.status === "dispatched" && order.policyVersion === "pay-2026-11");
  return (
    <>
      <RoleNav access={access} />
      <h1 className="page-title">{access.role === "warehouse" ? "תור מחסן" : "תור אספקה"}</h1>
      <p className="hint">המדבקה היא מספר פיתוח. אין רכישת משלוח אצל חברת שילוח.</p>
      {open.length === 0 ? <p className="status">אין הזמנות בתור.</p> : null}
      <div className="catalog-list">
        {open.map((order) => (
          <article className="card" key={order.id}>
            <div className="copy">
              <h2 className="section-title" dir="ltr">{order.sku}</h2>
              <p>{order.quantity} מארזים · מחסן {order.warehouseCode}</p>
              <form action={advanceOrder}>
                <input type="hidden" name="id" value={order.id} />
                <button className="button-publish" type="submit">{step[order.status]}</button>
              </form>
              {order.policyVersion === "pay-2026-11" ? (
                <>
                  <form action={offerLateSupply}>
                    <input type="hidden" name="id" value={order.id} />
                    <button className="button-secondary" type="submit">הצעת אספקה מאוחרת</button>
                  </form>
                  <form action={timeoutBackorder}>
                    <input type="hidden" name="id" value={order.id} />
                    <button className="button-secondary" type="submit">פסק זמן לאספקה</button>
                  </form>
                  <p className="hint">{readPaymentCases().find((item) => item.state.id === order.id)?.state.evidence?.[0]?.detail ?? "מדבקה ומניפסט נשמרים מקומית. חברת השילוח עדיין חיצונית."}</p>
                </>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      {delivered.map((order) => (
        <form key={order.id} action={simulateDelivery}>
          <input type="hidden" name="id" value={order.id} />
          <button className="button-secondary" type="submit">אישור מסירה מדומה {order.id}</button>
        </form>
      ))}
    </>
  );
}

export default function SupplierQueuePage() {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <QueueContent />
      </Suspense>
    </main>
  );
}
