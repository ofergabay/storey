import { Suspense } from "react";
import type { Metadata } from "next";
import { MoneyBuckets, PaymentPolicyBanner } from "@/components/payment-note";
import { Denied, RoleNav } from "@/components/role-nav";
import { openSurface } from "@/lib/auth/guards";
import { pickCopy } from "@/lib/i18n/locale";
import { readLocale } from "@/lib/i18n/server";
import { PAYMENT_POLICY, WEEKLY_POLICY } from "@/lib/commerce/payment/flag";
import { readPaymentCases } from "@/lib/commerce/payment/store";
import { creatorView } from "@/lib/commerce/payment/views";
import { sellerHandleFromEmail } from "@/lib/catalog/identity";
import { readCatalog } from "@/lib/catalog/store";
import { formatShekels } from "@/lib/money";
import { readWorkspace } from "@/lib/workspace/store";
import { PaceCard } from "@/components/pace-card";
import { duplicateCampaignForm } from "@/lib/experiments/actions";
import { experimentEnabled } from "@/lib/experiments/flags";
import { claimRecap, countsForPace, orderContribution, paceReport, paceWindow } from "@/lib/experiments/pace";
import { readExperimentStore, rememberArm, writeExperimentStore } from "@/lib/experiments/store";
import { nowMs, zonedParts } from "@/lib/commerce/payment/time";

export const metadata: Metadata = { title: "הכנסות", description: "רווח ממכירות ארגז פיתוח." };

async function EarningsContent({ searchParams }: { searchParams: Promise<{ inspect?: string }> }) {
  const [query, locale] = await Promise.all([searchParams, readLocale()]);
  const opened = await openSurface("creator", "/earnings", query.inspect);
  if ("denied" in opened) return <Denied access={opened.denied} />;
  const { access } = opened;
  const handle = sellerHandleFromEmail(access.email ?? "", access.userId ?? "");
  const catalog = readCatalog();
  const workspace = readWorkspace();
  const profit = workspace.orders.reduce((sum, order) => {
    if (order.policyVersion === PAYMENT_POLICY || order.policyVersion === WEEKLY_POLICY) return sum;
    if (order.previewSale || order.sellerHandle !== handle || order.status !== "dispatched") return sum;
    const restored = workspace.returns
      .filter((item) => item.orderId === order.id && item.status === "reconciled")
      .reduce((total, item) => total + item.quantity, 0);
    const quantity = Math.max(0, order.quantity - restored);
    const product = catalog.products.find((item) => item.sku === order.sku);
    return sum + (order.unitAgorot - (product?.costAgorot ?? order.unitAgorot)) * quantity;
  }, 0);
  const cases = readPaymentCases().filter((item) =>
    workspace.orders.some((order) => order.id === item.state.id && order.sellerHandle === handle && (order.policyVersion === PAYMENT_POLICY || order.policyVersion === WEEKLY_POLICY)),
  );
  return (
    <>
      <RoleNav access={access} />
      <h1 className="page-title">{pickCopy(locale, "הכנסות", "Earnings")}</h1>
      {workspace.orders.some((order) => !order.previewSale && order.sellerHandle === handle && order.status === "dispatched" && order.policyVersion !== PAYMENT_POLICY && order.policyVersion !== WEEKLY_POLICY) ? (
        <p>
          {pickCopy(locale, "רווח מחושב ממכירות שנשלחו", "Profit from dispatched sales")}: <strong dir="ltr">{formatShekels(profit)}</strong>
        </p>
      ) : (
        <p>{pickCopy(locale, "אין מכירות שנשלחו במדיניות המקורית.", "No dispatched sales on the original policy.")}</p>
      )}
      <p className="status">{pickCopy(locale, "העברה לחשבון ממתינה לספק סליקה. אין תשלום ואין משיכה.", "A transfer is waiting on a payout provider. There is no payment and no withdrawal.")}</p>
      {workspace.orders
        .filter((order) => !order.previewSale && order.sellerHandle === handle && order.status === "dispatched" && order.policyVersion !== PAYMENT_POLICY && order.policyVersion !== WEEKLY_POLICY)
        .map((order) => {
          const restored = workspace.returns
            .filter((item) => item.orderId === order.id && item.status === "reconciled")
            .reduce((total, item) => total + item.quantity, 0);
          const quantity = Math.max(0, order.quantity - restored);
          const product = catalog.products.find((item) => item.sku === order.sku);
          const original = (order.unitAgorot - (product?.costAgorot ?? order.unitAgorot)) * quantity;
          return <p key={order.id}>הזמנה {order.id}: רווח מקורי {formatShekels(original)}.</p>;
        })}
      <DeliveryRecap accessUserId={access.userId ?? ""} handle={handle} />
      <PaymentPolicyBanner />
      {cases.map((item) => {
        const asOf = item.simulatedNow ?? item.state.units.reduce((latest, unit) => Math.max(latest, unit.deliveredAt ?? 0), 0);
        const money = creatorView(item.state, asOf);
        return (
          <section key={item.state.id}>
            <p>הזמנה {item.state.id}: תמורה כלכלית {formatShekels(money.economic)}. העמלה שלך {formatShekels(money.commission)}. תמורה צפויה {formatShekels(money.expected)}. החזר שאושר ללקוח {formatShekels(item.state.buyerRefunded)}.</p>
            <MoneyBuckets money={money} />
          </section>
        );
      })}
    </>
  );
}

function DeliveryRecap({ accessUserId, handle }: { accessUserId: string; handle: string }) {
  const catalog = readCatalog();
  const workspace = readWorkspace();
  const asOf = nowMs();
  const mine = readPaymentCases().filter((item) =>
    workspace.orders.some((order) => order.id === item.state.id && order.sellerHandle === handle && countsForPace(order)),
  );
  const delivered = mine.flatMap((item) => {
    const order = workspace.orders.find((entry) => entry.id === item.state.id);
    const contribution = orderContribution(item.state.units);
    if (!order || !contribution.counts) return [];
    const at = item.state.units.reduce((latest, unit) => Math.max(latest, unit.deliveredAt ?? 0), 0);
    return [{ order, state: item.state, contribution, at }];
  }).sort((left, right) => left.at - right.at);
  if (delivered.length === 0) return null;
  const remembered = rememberArm(readExperimentStore(), "my-pace", accessUserId, experimentEnabled("my-pace"));
  if (remembered.created) writeExperimentStore(remembered.store);
  if (remembered.arm !== "treatment") return null;
  const store = readExperimentStore();
  const seen = new Set(store.recaps.map((item) => `first-delivery:${item.creatorId}`));
  const first = delivered[0];
  if (!first) return null;
  if (claimRecap(seen, accessUserId) === "new") {
    store.recaps.unshift({ creatorId: accessUserId, orderId: first.order.id });
    writeExperimentStore(store);
  }
  const product = catalog.products.find((item) => item.sku === first.order.sku);
  const money = creatorView(first.state, asOf);
  const payout = money.bankPaid > 0 ? "שולם לבנק" : money.transferred > 0 ? "הועבר" : money.eligible > 0 ? "זכאי לתשלום" : "ממתין";
  const published = catalog.listings.filter((item) => item.sellerId === accessUserId && item.retailAgorot > 0).map((item) => Date.parse(item.publishedAt)).filter((value) => Number.isFinite(value));
  const firstPublished = published.length > 0 ? Math.min(...published) : first.at;
  const window = paceWindow(firstPublished, asOf);
  const inWindow = delivered.filter((item) => item.at >= window.start && item.at <= asOf);
  const report = paceReport({
    deliveredOrders: inWindow.length,
    netAgorot: inWindow.reduce((sum, item) => sum + item.contribution.netAgorot, 0),
    observedDays: window.days,
  });
  const start = zonedParts(window.start, "Asia/Jerusalem");
  const end = zonedParts(asOf, "Asia/Jerusalem");
  const range = `${start.d}.${start.m}.${start.y}–${end.d}.${end.m}.${end.y} · ${report.deliveredOrders} הזמנות שנמסרו · ${formatShekels(report.netAgorot)}`;
  return (
    <>
      <section className="card">
        <h2 className="section-title">אחרי המסירה הראשונה</h2>
        <p>{product?.titleHe ?? first.order.sku} · כמות {first.order.quantity}</p>
        <p>ההכנסה שנרשמה במחברת <strong dir="ltr">{formatShekels(first.contribution.netAgorot)}</strong>. מצב התשלום: {payout}.</p>
        <p className="hint">הסכום למעלה הוא מה שנרשם. הוא נפרד מהתחזית.</p>
        <a href="#my-pace">הקצב שלי</a>
        <form action={duplicateCampaignForm}>
          <input type="hidden" name="creatorId" value={accessUserId} />
          <input type="hidden" name="sku" value={first.order.sku} />
          <button className="button-secondary" type="submit">שכפול קמפיין</button>
        </form>
      </section>
      <PaceCard report={report} range={range} shareHref="/catalog" />
    </>
  );
}

export default function EarningsPage({ searchParams }: { searchParams: Promise<{ inspect?: string }> }) {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <EarningsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
