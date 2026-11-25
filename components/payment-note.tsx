import { formatShekels } from "@/lib/money";
import { pilotSelection } from "@/lib/commerce/payment/cohort";
import type { PartyMoney } from "@/lib/commerce/payment/views";

export function PaymentPolicyBanner() {
  const selection = pilotSelection();
  const enrolled = selection.enabled ? selection.sellers.join(", ") : "";
  return (
    <p className="status">
      {!selection.enabled || enrolled.length === 0
        ? "מדיניות התשלום החדשה מושהית להצעות חדשות. הזמנות שכבר נפתחו בה ממשיכות לפי הצילום שנשמר. אין חיוב, החזר או העברה חיה."
        : `המדיניות החדשה פתוחה רק למוכרים ${enrolled}. שאר ההצעות נשארות במדיניות המקורית. המתאם מדומה ואין חיוב כרטיס.`}
    </p>
  );
}

export function MoneyBuckets({ money }: { money: PartyMoney }) {
  const open = money.pending + money.eligible + money.transferred + money.bankPaid + money.recovery;
  if (open === 0) return <p>אין יתרה פתוחה בחשבון הזה.</p>;
  return (
    <ul>
      {money.pending > 0 ? <li>ממתין: {formatShekels(money.pending)}</li> : null}
      {money.eligible > 0 ? <li>זכאי להעברה: {formatShekels(money.eligible)}</li> : null}
      {money.transferred > 0 ? <li>הועבר לספק הסליקה: {formatShekels(money.transferred)}</li> : null}
      {money.bankPaid > 0 ? <li>אושר בבנק: {formatShekels(money.bankPaid)}</li> : null}
      {money.recovery > 0 ? <li>חוב לגבייה: {formatShekels(money.recovery)}</li> : null}
    </ul>
  );
}
