import { WorkspaceTitle } from "@/components/workspace-title";
import { Suspense } from "react";
import type { Metadata } from "next";
import { MoneyBuckets, PaymentPolicyBanner } from "@/components/payment-note";
import { Denied, RoleNav } from "@/components/role-nav";
import { openSurface } from "@/lib/auth/guards";
import { supplierWarehouse } from "@/lib/auth/tenant";
import { readPaymentCases } from "@/lib/commerce/payment/store";
import { supplierView } from "@/lib/commerce/payment/views";
import { readCatalog } from "@/lib/catalog/store";
import { formatShekels } from "@/lib/money";
import { readWorkspace } from "@/lib/workspace/store";

export const metadata: Metadata = { title: "התחשבנות ספק", description: "סכום עלות בלי העברה." };

async function SettlementsContent({ searchParams }: { searchParams: Promise<{ inspect?: string }> }) {
  const query = await searchParams;
  const opened = await openSurface("supplier", "/supplier/settlements", query.inspect);
  if ("denied" in opened) return <Denied access={opened.denied} />;
  const { access, readOnly } = opened;
  const warehouse = supplierWarehouse(access);
  const catalog = readCatalog();
  const workspace = readWorkspace();
  const visible = workspace.orders.filter((order) => readOnly || order.warehouseCode === warehouse);
  const amount = visible.reduce((sum, order) => {
    if (order.status !== "dispatched") return sum;
    const restored = workspace.returns
      .filter((item) => item.orderId === order.id && item.status === "reconciled")
      .reduce((total, item) => total + item.quantity, 0);
    const product = catalog.products.find((item) => item.sku === order.sku);
    return sum + (product?.costAgorot ?? 0) * Math.max(0, order.quantity - restored);
  }, 0);
  return (
    <>
      <RoleNav access={access} />
      <WorkspaceTitle he="התחשבנות ספק" en="Supplier settlements" />
      {visible.some((order) => order.status === "dispatched") ? (
        <p>עלות משלוחים שנסגרו: {formatShekels(amount)}</p>
      ) : (
        <p>אין משלוחים שנסגרו בחשבון הזה.</p>
      )}
      {visible.some((order) => order.status === "dispatched") ? <p className="status">הסכום לא שולם. ההעברה ממתינה לספק סליקה.</p> : null}
      {visible
        .filter((order) => order.status === "dispatched" && !order.paymentCaseId)
        .map((order) => {
          const restored = workspace.returns
            .filter((item) => item.orderId === order.id && item.status === "reconciled")
            .reduce((total, item) => total + item.quantity, 0);
          const product = catalog.products.find((item) => item.sku === order.sku);
          const original = (product?.costAgorot ?? 0) * Math.max(0, order.quantity - restored);
          return <p key={order.id}>הזמנה {order.id}: עלות מקורית {formatShekels(original)}.</p>;
        })}
      <PaymentPolicyBanner />
      {readPaymentCases().filter((item) => visible.some((order) => order.id === item.state.id)).map((item) => {
        const suppliers = [...new Set(item.state.units.map((unit) => unit.supplierId))];
        const own = suppliers.filter((supplierId) => readOnly || supplierId === access.userId || supplierId === warehouse);
        return own.map((supplierId) => {
          const asOf = item.simulatedNow ?? item.state.units.reduce((latest, unit) => Math.max(latest, unit.deliveredAt ?? 0), 0);
          const money = supplierView(item.state, supplierId, asOf);
          return (
            <section key={`${item.state.id}-${supplierId}`}>
              <p>הזמנה {item.state.id}, מקור {supplierId}. העמלה שלך {formatShekels(money.commission)}. תמורה צפויה {formatShekels(money.expected)}.</p>
              <MoneyBuckets money={money} />
            </section>
          );
        });
      })}
    </>
  );
}

export default function SettlementsPage({ searchParams }: { searchParams: Promise<{ inspect?: string }> }) {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <SettlementsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
