import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Denied, RoleNav } from "@/components/role-nav";
import { openSurface } from "@/lib/auth/guards";
import { planLabel } from "@/lib/auth/permissions";
import { pickCopy, type Locale } from "@/lib/i18n/locale";
import { readLocale } from "@/lib/i18n/server";
import { readSellerPlan } from "@/lib/seller-plan";
import { creatorOrderView, ordersForCreator } from "@/lib/auth/views";
import { sellerHandleFromEmail } from "@/lib/catalog/identity";
import { formatShekels } from "@/lib/money";
import { readWorkspace } from "@/lib/workspace/store";

export const metadata: Metadata = { title: "הזמנות", description: "הזמנות של המודעות שפורסמו." };

async function OrdersContent({ searchParams }: { searchParams: Promise<{ inspect?: string }> }) {
  const [query, locale] = await Promise.all([searchParams, readLocale()]);
  const opened = await openSurface("creator", "/orders", query.inspect);
  if ("denied" in opened) return <Denied access={opened.denied} />;
  const { access, readOnly } = opened;
  const handle = sellerHandleFromEmail(access.email ?? "", access.userId ?? "");
  const orders = ordersForCreator(readWorkspace().orders, handle, readOnly).map((order) => ({
    retail: formatShekels(order.unitAgorot * order.quantity),
    token: order.token,
    view: creatorOrderView(order),
  }));
  return (
    <>
      <RoleNav access={access} />
      <h1 className="page-title">{pickCopy(locale, "הזמנות והחזרות", "Orders and returns")}</h1>
      <PrivacyNote locale={locale} />
      {orders.length === 0 ? <p className="status">{pickCopy(locale, "אין הזמנות עדיין.", "No orders yet.")}</p> : null}
      <div className="catalog-list">
        {orders.map((order) => (
          <article className="card" key={order.view.id}>
            <div className="copy">
              <p>
                {order.view.status === "held"
                  ? "שמירה פתוחה"
                    : order.view.status === "sandbox_paid"
                    ? "שולם בסביבת בדיקה"
                    : order.view.status === "picking"
                      ? "בליקוט"
                      : order.view.status === "packed"
                        ? "נארז"
                        : order.view.status === "labeled"
                          ? "עם מדבקה"
                          : order.view.status === "dispatched"
                            ? "נשלח"
                            : order.view.status === "failed"
                              ? "התשלום נכשל"
                              : "בוטל"}
              </p>
              <p dir="ltr">{order.retail}</p>
              <Link href={`/track/${order.token}`}>מעקב</Link>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

async function PrivacyNote({ locale }: { locale: Locale }) {
  const plan = await readSellerPlan();
  return (
    <p className="hint">
      {pickCopy(
        locale,
        `טלפון ורחוב של הקונה לא מוצגים במסלול ${planLabel(plan.code)}.`,
        `The buyer's phone and street stay hidden on ${planLabel(plan.code, "en")}.`,
      )}
    </p>
  );
}

export default function OrdersPage({ searchParams }: { searchParams: Promise<{ inspect?: string }> }) {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <OrdersContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
