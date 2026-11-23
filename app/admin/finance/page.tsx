import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PaymentPolicyBanner } from "@/components/payment-note";
import { Denied, RoleNav } from "@/components/role-nav";
import { readAccess } from "@/lib/auth/access";
import { readPaymentCases } from "@/lib/commerce/payment/store";
import { accountNet, journalTotals } from "@/lib/commerce/payment/workflow";
import { buyerView } from "@/lib/commerce/payment/views";
import { runTwoSupplierFixture, simulateEligibility, simulateTransfer } from "@/lib/workspace/actions";
import { readCatalog } from "@/lib/catalog/store";
import { formatShekels } from "@/lib/money";
import { readWorkspace } from "@/lib/workspace/store";

export const metadata: Metadata = { title: "כספים", description: "התאמה בלי תשלום חי." };

async function FinanceContent() {
  const access = await readAccess();
  if (access.role === "guest") redirect("/login?next=/admin/finance");
  if (access.role !== "admin") return <Denied access={access} />;
  const catalog = readCatalog();
  const workspace = readWorkspace();
  const net = (orderId: string, quantity: number) =>
    Math.max(
      0,
      quantity -
        workspace.returns
          .filter((item) => item.orderId === orderId && item.status === "reconciled")
          .reduce((total, item) => total + item.quantity, 0),
    );
  const dispatched = workspace.orders.filter((order) => order.status === "dispatched");
  const retail = dispatched.reduce((sum, order) => sum + order.unitAgorot * net(order.id, order.quantity), 0);
  const cost = dispatched.reduce((sum, order) => {
    const product = catalog.products.find((item) => item.sku === order.sku);
    return sum + (product?.costAgorot ?? 0) * net(order.id, order.quantity);
  }, 0);
  return (
    <>
      <RoleNav access={access} />
      <h1 className="page-title">כספים והתאמה</h1>
      <p>מחיר ללקוח במשלוחים: {formatShekels(retail)}</p>
      <p>עלות ספק במשלוחים: {formatShekels(cost)}</p>
      <p className="status">אין ספק סליקה ואין העברה. הסכומים הם חישוב על רכישות ארגז פיתוח, לא חיוב.</p>
      {workspace.orders
        .filter((order) => order.status === "dispatched" && !order.paymentCaseId)
        .map((order) => {
          const product = catalog.products.find((item) => item.sku === order.sku);
          return (
            <p key={order.id}>
              הזמנה {order.id}: מחיר נטו {formatShekels(order.unitAgorot * net(order.id, order.quantity))}. עלות נטו {formatShekels((product?.costAgorot ?? 0) * net(order.id, order.quantity))}.
            </p>
          );
        })}
      <PaymentPolicyBanner />
      <form action={runTwoSupplierFixture}>
        <button className="button-secondary" type="submit">תרחיש שני ספקים</button>
      </form>
      {readPaymentCases().map((item) => {
        const buyer = buyerView(item.state);
        const totals = journalTotals(item.state);
        const recovery = item.state.recovery.filter((row) => row.open).reduce((sum, row) => sum + row.amount, 0);
        const clock = item.state.units.filter((unit) => unit.eligibleAt !== null).map((unit) => unit.id);
        const policy = workspace.orders.find((order) => order.id === item.state.id)?.policyVersion;
        return (
          <section key={item.state.id}>
            <p>הזמנה {item.state.id}: חיוב {formatShekels(buyer.charge)}, החזר שאושר {formatShekels(buyer.refundConfirmed)}, החזר ממתין {formatShekels(buyer.refundPending)}.{policy ? ` מדיניות ${policy}.` : ""}</p>
            {item.cancelReplayed ? <p>ביטול חוזר של אותה יחידה לא יצר החזר נוסף.</p> : null}
            {item.state.journal.some((line) => line.account === "supplier-payable:a") ? (
              <p>ספק א {formatShekels(accountNet(item.state, "supplier-payable:a"))}. יוצר {formatShekels(accountNet(item.state, "creator-payable"))}. נטו חנות {formatShekels(accountNet(item.state, "platform-revenue") + accountNet(item.state, "processing-expense"))}. סליקה {formatShekels(Math.abs(accountNet(item.state, "processing-expense")))}.</p>
            ) : null}
            <p>{totals.debit === totals.credit ? "היומן מאוזן." : "היומן אינו מאוזן."} חוב לגבייה {formatShekels(recovery)}. שעון תשלום: {clock.length === 0 ? "אף יחידה" : clock.join(", ")}.</p>
            <form action={simulateEligibility}>
              <input type="hidden" name="id" value={item.state.id} />
              <button className="button-secondary" type="submit">סיום שבעת הימים</button>
            </form>
            <form action={simulateTransfer}>
              <input type="hidden" name="id" value={item.state.id} />
              <button className="button-secondary" type="submit">העברה מדומה</button>
            </form>
          </section>
        );
      })}
    </>
  );
}

export default function FinancePage() {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <FinanceContent />
      </Suspense>
    </main>
  );
}
