import { Suspense } from "react";
import type { Metadata } from "next";
import { PaymentPolicyBanner } from "@/components/payment-note";
import { Denied, RoleNav } from "@/components/role-nav";
import { requireAdminPage } from "@/lib/auth/admin-gate";
import { pickCopy } from "@/lib/i18n/locale";
import { readLocale } from "@/lib/i18n/server";
import { readPaymentCases } from "@/lib/commerce/payment/store";
import { accountNet, journalTotals, type PayState } from "@/lib/commerce/payment/workflow";
import { buyerView, creatorView, supplierView } from "@/lib/commerce/payment/views";
import { nowMs } from "@/lib/commerce/payment/time";
import { confirmLocalWeeklyBank, runLocalWeeklyPayout } from "@/lib/commerce/payment/policy-actions";
import { readWeeklyPayouts } from "@/lib/commerce/payment/policy-store";
import { WEEKLY_POLICY } from "@/lib/commerce/payment/flag";
import { runTwoSupplierFixture, simulateEligibility, simulateTransfer } from "@/lib/workspace/actions";
import { readCatalog } from "@/lib/catalog/store";
import { formatShekels } from "@/lib/money";
import { readWorkspace } from "@/lib/workspace/store";

export const metadata: Metadata = { title: "כספים", description: "התאמה בלי תשלום חי." };

async function FinanceContent() {
  const [gate, locale] = await Promise.all([requireAdminPage("/admin/finance"), readLocale()]);
  if (!gate.admin) return <Denied access={gate.access} />;
  const access = gate.access;
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
      <h1 className="page-title">{pickCopy(locale, "כספים והתאמה", "Finance and reconciliation")}</h1>
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
      <section>
        <h2 className="section-title">תשלום שבועי</h2>
        <p className="status">ההוראה נשמרת מקומית. סיום מדומה אינו אישור בנק ואינו מסמן כסף כשולם אצל הספק. הגשה ל־PayMe כבויה.</p>
        <form action={runLocalWeeklyPayout}>
          <button className="button-secondary" type="submit">הרצת תשלום שבועי</button>
        </form>
        {readWeeklyPayouts().map((payout) => (
          <article key={payout.key}>
            <p>
              {payout.beneficiaryId} · <span dir="ltr">{formatShekels(payout.amount)}</span> · שבוע {payout.week}
            </p>
            <p>הוראה <span dir="ltr">{payout.instructionRef}</span></p>
            <p>זכאות <span dir="ltr">{formatShekels(payout.withdrawalAmount ?? payout.amount)}</span></p>
            <p>זמינות אצל הספק: נשמרת בנפרד ואינה מגדילה את סכום המשיכה.</p>
            <p>הגשת העברה: {payout.providerSubmission === "pending" ? "ממתינה" : "לא הוגשה"}</p>
            <p>אישור בנק: {payout.status === "bank_paid" ? payout.bankRef : "ממתין"}</p>
            {payout.status === "simulated" ? <p>ההוראה סומנה כסיום מדומה. היא לא שולמה אצל הספק.</p> : null}
            <ul>
              {payout.lines.map((line) => (
                <li key={`${payout.key}-${line.orderId}-${line.unitId}`}>
                  הזמנה {line.orderId} · יוצר {line.creatorId} · <span dir="ltr">{formatShekels(line.amount)}</span>
                </li>
              ))}
            </ul>
            {payout.status === "instructed" ? (
              <form action={confirmLocalWeeklyBank}>
                <input type="hidden" name="key" value={payout.key} />
                <button className="button-secondary" type="submit">סיום מדומה של ההוראה</button>
              </form>
            ) : null}
          </article>
        ))}
      </section>
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
            {policy === WEEKLY_POLICY ? <PayoutStates state={item.state} /> : null}
            {policy === WEEKLY_POLICY ? null : (
              <form action={simulateEligibility}>
                <input type="hidden" name="id" value={item.state.id} />
                <button className="button-secondary" type="submit">סיום שבעת הימים</button>
              </form>
            )}
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

function PayoutStates({ state }: { state: PayState }) {
  const at = nowMs();
  const supplierId = state.units[0]?.supplierId ?? "";
  const supplier = supplierView(state, supplierId, at);
  const creator = creatorView(state, at);
  return (
    <p>
      זכאות ספק {formatShekels(supplier.eligible)}, זכאות יוצר {formatShekels(creator.eligible)}.
      זמינות אצל הספק נשמרת בנפרד.
      הגשת העברה {supplier.transferred + creator.transferred > 0 ? "סומנה מקומית" : "לא הוגשה"}.
      אישור בנק {supplier.bankPaid + creator.bankPaid > 0 ? "נקלט" : "ממתין"}.
    </p>
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
