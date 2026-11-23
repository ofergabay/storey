import { Suspense } from "react";
import { connection } from "next/server";
import { PaymentPolicyBanner } from "@/components/payment-note";
import { captureEvidence } from "@/lib/commerce/payment/recover";
import { recoverAcceptedCaptures } from "@/lib/commerce/payment/provider-store";
import { readPaymentCases } from "@/lib/commerce/payment/store";
import { buyerView } from "@/lib/commerce/payment/views";
import { readWorkspace } from "@/lib/workspace/store";
import { answerBackorder, requestOrderReturn, sandboxPurchase } from "@/lib/workspace/actions";
import { formatShekels } from "@/lib/money";

const labels: Record<string, string> = {
  held: "המארזים שמורים ל-10 דקות. אין תשלום.",
  sandbox_paid: "רכישת ארגז פיתוח נקלטה. אין חיוב.",
  picking: "בליקוט במחסן.",
  packed: "המארז נארז.",
  labeled: "נוצרה מדבקת פיתוח.",
  dispatched: "נמסר לשליח.",
  cancelled: "השמירה שוחררה.",
};

async function TrackContent({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  recoverAcceptedCaptures();
  const { token } = await params;
  const workspace = readWorkspace();
  const order = workspace.orders.find((item) => item.token === token);
  if (!order) return <p className="status">ההזמנה לא נמצאה.</p>;
  const openReturn = workspace.returns.find((item) => item.orderId === order.id);
  return (
    <article className="customer-card">
      <div className="copy">
        <h1 className="page-title">מעקב הזמנה</h1>
        <p>{labels[order.status]}</p>
        <p>
          {order.quantity} מארזים · <span dir="ltr">{formatShekels(order.unitAgorot * order.quantity)}</span>
        </p>
        {order.tracking ? <p dir="ltr">{order.tracking}</p> : null}
        {order.paymentNote ? <p className="status">{order.paymentNote}</p> : null}
        <p>מדיניות שמורה: <span dir="ltr">{order.policyVersion ?? "original-2026-11"}</span></p>
        <PaymentPolicyBanner />
        {(() => {
          const payment = readPaymentCases().find((item) => item.state.id === order.paymentCaseId);
          if (!payment) return null;
          const buyer = buyerView(payment.state);
          const evidence = captureEvidence(payment.state);
          return (
            <p>
              {buyer.checking ? "בודקים את התשלום. " : ""}
              סכום {formatShekels(buyer.charge)}. החזר שאושר {formatShekels(buyer.refundConfirmed)}. החזר שממתין לאישור אינו כסף שחזר.
              {payment.state.providerRef ? <span dir="ltr"> {payment.state.providerRef}</span> : null}
              {payment.state.status === "captured" ? ` יומן לכידה ${evidence.entries}. שחרור מחסן ${evidence.releases}.` : ""}
            </p>
          );
        })()}
        {(() => {
          const payment = readPaymentCases().find((item) => item.state.id === order.paymentCaseId);
          const offer = payment?.state.backorders?.find((row) => row.decision === "offered");
          if (!offer) return null;
          return (
            <>
              <p className="status">הוצעה אספקה מאוחרת עם תאריך יעד. ההחזר עדיין לא בוצע.</p>
              <form action={answerBackorder}>
                <input type="hidden" name="token" value={order.token} />
                <input type="hidden" name="decision" value="accept" />
                <button className="button-publish" type="submit">אישור האספקה המאוחרת</button>
              </form>
              <form action={answerBackorder}>
                <input type="hidden" name="token" value={order.token} />
                <input type="hidden" name="decision" value="reject" />
                <button className="button-secondary" type="submit">דחיית האספקה המאוחרת</button>
              </form>
            </>
          );
        })()}
        {order.status === "held" && !order.paymentCaseId ? (
          <form action={sandboxPurchase}>
            <input type="hidden" name="id" value={order.id} />
            <button className="button-publish" type="submit">
              רכישת ארגז פיתוח
            </button>
          </form>
        ) : null}
        <p className="hint">הכפתור לא גובה תשלום. הוא מעביר את ההזמנה לתור המחסן.</p>
        {order.status === "dispatched" && !openReturn ? (
          <form action={requestOrderReturn}>
            <input type="hidden" name="token" value={order.token} />
            <input type="hidden" name="quantity" value={String(order.quantity)} />
            <button className="button-secondary" type="submit">
              בקשת החזרה
            </button>
          </form>
        ) : null}
        {openReturn ? <p className="status">סטטוס החזרה: {openReturn.status}</p> : null}
      </div>
    </article>
  );
}

export default function TrackPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <main className="customer-shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <TrackContent params={params} />
      </Suspense>
    </main>
  );
}
