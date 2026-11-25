import { Suspense } from "react";
import type { Metadata } from "next";
import { Denied, RoleNav } from "@/components/role-nav";
import { openSurface } from "@/lib/auth/guards";
import { pickCopy } from "@/lib/i18n/locale";
import { readLocale } from "@/lib/i18n/server";
import { supplierWarehouse } from "@/lib/auth/tenant";
import { blindShippingSlip, supplierQueue } from "@/lib/auth/views";
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

async function QueueContent({ searchParams }: { searchParams: Promise<{ inspect?: string }> }) {
  const [query, locale] = await Promise.all([searchParams, readLocale()]);
  const opened = await openSurface("supplier", "/supplier", query.inspect);
  if ("denied" in opened) return <Denied access={opened.denied} />;
  const { access, readOnly } = opened;
  const warehouse = supplierWarehouse(access);
  const orders = supplierQueue(readWorkspace().orders, warehouse, readOnly);
  const open = orders.filter((order) => order.status in step);
  const delivered = orders.filter((order) => order.status === "dispatched" && (order.policyVersion === "pay-2026-11" || order.policyVersion === "weekly-2026-11"));
  return (
    <>
      <RoleNav access={access} />
      <h1 className="page-title">{pickCopy(locale, "תור ליקוט ואריזה", "Pick and pack queue")}</h1>
      <p className="hint">{pickCopy(locale, "המדבקה מסתירה את זהות הספק. אין כאן רכישת משלוח, ומחיר המכירה ללקוח לא מוצג.", "The label hides the supplier. Shipping is not bought here, and the customer price is not shown.")}</p>
      {readOnly ? <p className="status">{pickCopy(locale, "בדיקת ניהול מתועדת. אפשר לראות את התור, והפעולות נעולות.", "This is a recorded admin inspection. The queue is visible and the actions are locked.")}</p> : null}
      {!readOnly && warehouse === null ? <p className="status">{pickCopy(locale, "אין מחסן משויך לחשבון הזה.", "No warehouse is assigned to this account.")}</p> : null}
      {open.length === 0 ? <p className="status">{pickCopy(locale, "אין הזמנות בתור.", "The queue is empty.")}</p> : null}
      <div className="catalog-list">
        {open.map((order) => (
          <article className="card" key={order.id}>
            <div className="copy">
              <h2 className="section-title" dir="ltr">{order.sku}</h2>
              <p>{order.quantity} מארזים · מחסן {order.warehouseCode}</p>
              <BlindSlip brand={order.sellerHandle} sku={order.sku} quantity={order.quantity} />
              {readOnly ? null : (
              <form action={advanceOrder}>
                <input type="hidden" name="id" value={order.id} />
                <button className="button-publish" type="submit">{step[order.status]}</button>
              </form>
              )}
              {!readOnly && order.policyVersion === "pay-2026-11" ? (
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
      {readOnly ? null : delivered.map((order) => (
        <form key={order.id} action={simulateDelivery}>
          <input type="hidden" name="id" value={order.id} />
          <button className="button-secondary" type="submit">סימון כנמסר</button>
        </form>
      ))}
    </>
  );
}

function BlindSlip({ brand, sku, quantity }: { brand: string; sku: string; quantity: number }) {
  const slip = blindShippingSlip({ brand, recipient: "נמען למשלוח", lines: [`${sku} × ${quantity}`] });
  return (
    <p className="hint">
      פתק משלוח: {slip.brand} · {slip.lines.join(" · ")}. בלי שם הספק ובלי מחיר מכירה.
    </p>
  );
}

export default function SupplierQueuePage({ searchParams }: { searchParams: Promise<{ inspect?: string }> }) {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <QueueContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
