import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MoneyBuckets, PaymentPolicyBanner } from "@/components/payment-note";
import { Denied, RoleNav } from "@/components/role-nav";
import { readAccess } from "@/lib/auth/access";
import { readPaymentCases } from "@/lib/commerce/payment/store";
import { supplierView } from "@/lib/commerce/payment/views";
import { readCatalog } from "@/lib/catalog/store";
import { formatShekels } from "@/lib/money";
import { readWorkspace } from "@/lib/workspace/store";

export const metadata: Metadata = { title: "התחשבנות ספק", description: "סכום עלות בלי העברה." };

async function SettlementsContent() {
  const access = await readAccess();
  if (access.role === "guest") redirect("/login?next=/supplier/settlements");
  if (access.role !== "supplier" && access.role !== "admin") return <Denied access={access} />;
  const catalog = readCatalog();
  const workspace = readWorkspace();
  const amount = workspace.orders.reduce((sum, order) => {
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
      <h1 className="page-title">התחשבנות ספק</h1>
      <p>עלות משלוחים שנסגרו: {formatShekels(amount)}</p>
      <p className="status">הסכום לא שולם. ההעברה ממתינה לספק סליקה.</p>
      {workspace.orders
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
      {readPaymentCases().map((item) => {
        const suppliers = [...new Set(item.state.units.map((unit) => unit.supplierId))];
        return suppliers.map((supplierId) => (
          <section key={`${item.state.id}-${supplierId}`}>
            <p>הזמנה {item.state.id}, מקור {supplierId}</p>
            <MoneyBuckets money={supplierView(item.state, supplierId, item.simulatedNow ?? item.state.units.reduce((latest, unit) => Math.max(latest, unit.deliveredAt ?? 0), 0))} />
          </section>
        ));
      })}
    </>
  );
}

export default function SettlementsPage() {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <SettlementsContent />
      </Suspense>
    </main>
  );
}
