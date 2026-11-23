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
  return (
    <ul>
      <li>ממתין: {formatShekels(money.pending)}</li>
      <li>זכאי להעברה: {formatShekels(money.eligible)}</li>
      <li>הועבר לספק הסליקה: {formatShekels(money.transferred)}</li>
      <li>אושר בבנק: {formatShekels(money.bankPaid)}</li>
      {money.recovery > 0 ? <li>חוב לגבייה: {formatShekels(money.recovery)}</li> : null}
    </ul>
  );
}
