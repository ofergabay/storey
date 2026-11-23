import { BeginCheckout } from "@/components/begin-checkout";
import { LISTING_PATH } from "@/lib/cloud-nine-public";
import type { SavedQuote } from "@/lib/checkout-quote";
import { formatShekels } from "@/lib/money";

const holdTime = new Intl.DateTimeFormat("he-IL", {
  timeZone: "Asia/Jerusalem",
  hour: "2-digit",
  minute: "2-digit",
});

function formatHoldTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return holdTime.format(parsed);
}

export function QuoteSummary({ quote }: { quote: SavedQuote }) {
  return (
    <div className="copy">
      <p className="kicker">ההצעה נשמרה</p>
      <h1 className="page-title">אין תשלום</h1>
      <p>ההצעה נשמרה במסד הנתונים. לא בוצע חיוב, ומע״מ ומשלוח לא מחושבים.</p>
      <div className="quote-lines">
        <p className="quote-line">
          <span>כמות מארזים</span>
          <strong dir="ltr">{quote.quantity}</strong>
        </p>
        <p className="quote-line">
          <span>מחיר למארז</span>
          <strong dir="ltr">{formatShekels(quote.unitRetailAgorot)}</strong>
        </p>
        <p className="quote-line">
          <span>סה״כ למארזים</span>
          <strong dir="ltr">{formatShekels(quote.merchandiseAgorot)}</strong>
        </p>
        <p className="quote-line">
          <span>מע״מ</span>
          <strong>לא חושב</strong>
        </p>
        <p className="quote-line">
          <span>משלוח</span>
          <strong>לא חושב</strong>
        </p>
      </div>
      {quote.holdExpiresAt ? (
        <p className="hint">
          נשמרו {quote.quantity} מארזים עד {formatHoldTime(quote.holdExpiresAt)}. שמירת ההצעה ופתיחת הקישור לא שומרות מלאי.
        </p>
      ) : (
        <BeginCheckout quoteId={quote.id} />
      )}
      <p className="quote-address">
        {quote.recipientName}
        <br />
        <span dir="ltr">{quote.phone}</span>
        <br />
        {quote.city}, {quote.street}
      </p>
      <a className="button-secondary" href={LISTING_PATH}>
        חזרה למודעה
      </a>
    </div>
  );
}
