import Link from "next/link";
import { formatPaceShekels, type PaceReport } from "@/lib/experiments/pace";
import { formatShekels } from "@/lib/money";

const he = {
  title: "הקצב שלי",
  keep: "בקצב הנוכחי",
  double: "בקצב כפול",
  triple: "בקצב משולש",
  week: "הזמנות שנמסרו בשבוע",
  month: "הכנסה חודשית משוערת",
  year: "הכנסה שנתית משוערת",
  assumption: "התחזית מניחה שההכנסה הממוצעת להזמנה תישאר דומה. היא אינה כוללת הוצאות עסקיות או מס אישי.",
};

export function PaceCard({ report, range, shareHref }: { report: PaceReport; range: string; shareHref: string }) {
  return (
    <section className="card" id="my-pace">
      <h2 className="section-title">{he.title}</h2>
      <p>{range}</p>
      {report.deliveredOrders === 0 ? (
        <>
          <p>עדיין אין הזמנות שנמסרו בחלון הזה.</p>
          <Link className="button-publish" href={shareHref}>שיתוף הצעה</Link>
        </>
      ) : (
        <>
          <p>
            ב-{report.observedDays} הימים האלה נמסרו {report.deliveredOrders} הזמנות, וההכנסה נטו היא <strong dir="ltr">{formatShekels(report.netAgorot)}</strong>.
            {report.averageAgorot !== null ? ` ממוצע להזמנה ${formatShekels(Math.round(report.averageAgorot))}.` : ""}
          </p>
          {report.negative ? <p className="status">ההכנסה נטו שלילית אחרי זיכויים. אין כאן תרחיש שמכפיל הפסד.</p> : null}
          {report.early && !report.negative ? <p className="hint">זו הערכה מוקדמת על מדגם קטן. אפשר לפתוח אותה אחרי שמבינים שהמכירה בודדת או שהחלון קצר משבוע.</p> : null}
          {report.scenarios && !report.early ? <PaceTable report={report} /> : null}
          {report.scenarios && report.early ? <details><summary>בדיקת הערכה מוקדמת</summary><PaceTable report={report} /></details> : null}
        </>
      )}
    </section>
  );
}

function PaceTable({ report }: { report: PaceReport }) {
  const labels = [he.keep, he.double, he.triple];
  return (
    <>
      <p>{he.week} · {he.month} · {he.year}</p>
      {report.scenarios?.map((scenario, index) => (
        <p key={scenario.multiplier}>
          {labels[index]} · {formatCount(scenario.ordersPerWeek)} · <span dir="ltr">{formatPaceShekels(scenario.monthlyAgorot)}</span> · <span dir="ltr">{formatPaceShekels(scenario.annualAgorot)}</span>
        </p>
      ))}
      <p className="hint">{he.assumption}</p>
      <p className="hint">קצב כפול או משולש הוא תרחיש לבדיקה. הוא מניח שיש ביקוש ומלאי.</p>
    </>
  );
}

function formatCount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
