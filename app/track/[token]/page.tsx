import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Wordmark } from "@/components/wordmark";
import { PaymentPolicyBanner } from "@/components/payment-note";
import { captureEvidence } from "@/lib/commerce/payment/recover";
import { recoverAcceptedCaptures } from "@/lib/commerce/payment/provider-store";
import { readPaymentCases } from "@/lib/commerce/payment/store";
import { buyerView } from "@/lib/commerce/payment/views";
import { readWorkspace } from "@/lib/workspace/store";
import { answerBackorder, requestOrderReturn, sandboxPurchase } from "@/lib/workspace/actions";
import { startPaymeCheckout } from "@/lib/commerce/payment/payme/actions";
import { readPaymeAttempt } from "@/lib/commerce/payment/payme/attempts";
import { paymeConfigMessage, readPaymeConfig, sellerPaymeId } from "@/lib/commerce/payment/payme/config";
import { readAccess } from "@/lib/auth/access";
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
  const [{ token }, access] = await Promise.all([params, readAccess()]);
  const workspace = readWorkspace();
  const order = workspace.orders.find((item) => item.token === token);
  if (!order) {
    return (
      <article className="customer-card">
        <header className="topbar customer-topbar">
          <Wordmark href="/" />
        </header>
        <div className="copy">
          <h1 className="page-title">ההזמנה לא נמצאה</h1>
          <p>הקישור לא תואם הזמנה שמורה.</p>
          <Link className="button-secondary" href="/">חזרה לדף הבית</Link>
        </div>
      </article>
    );
  }
  const creatorViewing = access.role === "creator" || (access.role === "admin" && access.userId !== null);
  const openReturn = workspace.returns.find((item) => item.orderId === order.id);
  return (
    <article className="customer-card">
      <header className="topbar customer-topbar">
        <Wordmark href="/" />
        <Link className="button-secondary" href={creatorViewing ? "/orders" : "/"}>
          חזרה
        </Link>
      </header>
      <div className="copy">
        <h1 className="page-title">מעקב הזמנה</h1>
        {creatorViewing ? <p className="hint">טלפון ורחוב של הקונה לא מוצגים במעקב.</p> : null}
        <p>
          {readPaymentCases().find((item) => item.state.id === order.paymentCaseId)?.adapter === "payme" && order.status === "sandbox_paid"
            ? "PayMe בסביבת בדיקה אישר את הסכום. Storey לא שמרה פרטי כרטיס."
            : labels[order.status]}
        </p>
        <p>
          {order.quantity} מארזים · <span dir="ltr">{formatShekels(order.unitAgorot * order.quantity)}</span>
        </p>
        {order.shippingSnapshot ? (
          <p>
            משלוח <span dir="ltr">{formatShekels(order.shippingSnapshot.shippingAgorot)}</span>
            {" "}· סה״כ <span dir="ltr">{formatShekels(order.shippingSnapshot.allocation.charge)}</span>
            {order.shippingSnapshot.groups[0] ? ` · הגעה ${order.shippingSnapshot.groups[0].windowMinDays}–${order.shippingSnapshot.groups[0].windowMaxDays} ימים` : ""}
          </p>
        ) : null}
        {order.tracking ? <p dir="ltr">{order.tracking}</p> : null}
        {order.paymentNote ? <p className="status">{order.paymentNote}</p> : null}
        <PaymentActions orderId={order.id} sellerHandle={order.sellerHandle} status={order.status} />
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

function PaymentActions({ orderId, sellerHandle, status }: { orderId: string; sellerHandle: string; status: string }) {
  if (status !== "held") return null;
  const attempt = readPaymeAttempt(orderId);
  const configured = readPaymeConfig();
  const merchant = configured.ok ? sellerPaymeId(configured.config, sellerHandle) : null;
  const paymeMessage = !configured.ok ? paymeConfigMessage(configured.missing) : merchant ? null : paymeConfigMessage(["חשבון ספק מאושר"]);
  return (
    <>
      {attempt ? (
        <form action={startPaymeCheckout}>
          <input type="hidden" name="id" value={orderId} />
          <button className="button-publish" type="submit">המשך לתשלום המאובטח</button>
        </form>
      ) : paymeMessage ? (
        <p className="status">{paymeMessage}</p>
      ) : (
        <form action={startPaymeCheckout}>
          <input type="hidden" name="id" value={orderId} />
          <button className="button-publish" type="submit">תשלום מאובטח ב־PayMe</button>
        </form>
      )}
      {attempt ? null : (
        <form action={sandboxPurchase}>
          <input type="hidden" name="id" value={orderId} />
          <button className="button-secondary" type="submit">רכישת ארגז פיתוח</button>
        </form>
      )}
      <p className="hint">רכישת ארגז פיתוח היא מתאם מקומי. היא לא גובה כרטיס ולא מסמנת כסף כשולם אצל ספק.</p>
    </>
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
