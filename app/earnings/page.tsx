import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MoneyBuckets, PaymentPolicyBanner } from "@/components/payment-note";
import { Denied, RoleNav } from "@/components/role-nav";
import { readAccess } from "@/lib/auth/access";
import { PAYMENT_POLICY } from "@/lib/commerce/payment/flag";
import { readPaymentCases } from "@/lib/commerce/payment/store";
import { creatorView } from "@/lib/commerce/payment/views";
import { sellerHandleFromEmail } from "@/lib/catalog/identity";
import { readCatalog } from "@/lib/catalog/store";
import { formatShekels } from "@/lib/money";
import { readWorkspace } from "@/lib/workspace/store";

export const metadata: Metadata = { title: "הכנסות", description: "רווח ממכירות ארגז פיתוח." };

async function EarningsContent() {
  const access = await readAccess();
  if (access.role === "guest") redirect("/login?next=/earnings");
  if (access.role !== "creator" && access.role !== "admin") return <Denied access={access} />;
  const handle = sellerHandleFromEmail(access.email ?? "", access.userId ?? "");
  const catalog = readCatalog();
  const workspace = readWorkspace();
  const profit = workspace.orders.reduce((sum, order) => {
    if (order.policyVersion === PAYMENT_POLICY) return sum;
    if (order.sellerHandle !== handle || order.status !== "dispatched") return sum;
    const restored = workspace.returns
      .filter((item) => item.orderId === order.id && item.status === "reconciled")
      .reduce((total, item) => total + item.quantity, 0);
    const quantity = Math.max(0, order.quantity - restored);
    const product = catalog.products.find((item) => item.sku === order.sku);
    return sum + (order.unitAgorot - (product?.costAgorot ?? order.unitAgorot)) * quantity;
  }, 0);
  const cases = readPaymentCases().filter((item) =>
    workspace.orders.some((order) => order.id === item.state.id && order.sellerHandle === handle && order.policyVersion === PAYMENT_POLICY),
  );
  return (
    <>
      <RoleNav access={access} />
      <h1 className="page-title">הכנסות</h1>
      <p>
        רווח מחושב ממכירות שנשלחו: <strong dir="ltr">{formatShekels(profit)}</strong>
      </p>
      <p className="status">העברה לחשבון ממתינה לספק סליקה. אין תשלום ואין משיכה.</p>
      {workspace.orders
        .filter((order) => order.sellerHandle === handle && order.status === "dispatched" && order.policyVersion !== PAYMENT_POLICY)
        .map((order) => {
          const restored = workspace.returns
            .filter((item) => item.orderId === order.id && item.status === "reconciled")
            .reduce((total, item) => total + item.quantity, 0);
          const quantity = Math.max(0, order.quantity - restored);
          const product = catalog.products.find((item) => item.sku === order.sku);
          const original = (order.unitAgorot - (product?.costAgorot ?? order.unitAgorot)) * quantity;
          return <p key={order.id}>הזמנה {order.id}: רווח מקורי {formatShekels(original)}.</p>;
        })}
      <PaymentPolicyBanner />
      {cases.map((item) => {
        const asOf = item.simulatedNow ?? item.state.units.reduce((latest, unit) => Math.max(latest, unit.deliveredAt ?? 0), 0);
        const money = creatorView(item.state, asOf);
        return (
          <section key={item.state.id}>
            <p>הזמנה {item.state.id}: תמורה כלכלית {formatShekels(money.economic)}. החזר שאושר ללקוח {formatShekels(item.state.buyerRefunded)}.</p>
            <MoneyBuckets money={money} />
          </section>
        );
      })}
    </>
  );
}

export default function EarningsPage() {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <EarningsContent />
      </Suspense>
    </main>
  );
}
