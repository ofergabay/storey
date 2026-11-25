import { WorkspaceTitle } from "@/components/workspace-title";
import { Suspense } from "react";
import type { Metadata } from "next";
import { PlanCards } from "@/components/plan-cards";
import { Denied, RoleNav } from "@/components/role-nav";
import { requireAdminPage } from "@/lib/auth/admin-gate";
import { publishCommission } from "@/lib/commerce/payment/policy-actions";
import { readCommissions } from "@/lib/commerce/payment/policy-store";
import { rateAt } from "@/lib/commerce/payment/commissions";
import { nowMs } from "@/lib/commerce/payment/time";

export const metadata: Metadata = { title: "תוכניות וחוזים", description: "כללי מחיר וחיבורים." };

function formatBps(bps: number): string {
  const whole = Math.floor(bps / 100);
  const fraction = String(bps % 100).padStart(2, "0");
  return fraction === "00" ? `${whole}%` : `${whole}.${fraction}%`;
}

async function AdminPlans({ searchParams }: { searchParams: Promise<{ commission?: string }> }) {
  const [gate, query] = await Promise.all([requireAdminPage("/admin/plans"), searchParams]);
  if (!gate.admin) return <Denied access={gate.access} />;
  const access = gate.access;
  const book = readCommissions();
  const current = rateAt(book.cards, nowMs());
  return (
    <>
      <RoleNav access={access} />
      <WorkspaceTitle he="תוכניות, חוזים וחיבורים" en="Plans, contracts, and connections" />
      <PlanCards />
      <p className="status">אין חוזה חתום, אין כלל מחיר נוסף, ואין חיבור סליקה. משימות שנכשלו לא נרשמו.</p>
      <section>
        <h2 className="section-title">עמלות Storey</h2>
        <p>השיעורים נשמרים בנקודות בסיס וחלים רק על הצעות חדשות במדיניות השבועית. משלוח, אריזה, מע״מ וסליקה לא נכללים בבסיס.</p>
        {current ? (
          <p>
            בתוקף: ספק <span dir="ltr">{formatBps(current.supplierBps)}</span>, יוצר/ת <span dir="ltr">{formatBps(current.creatorBps)}</span>.
          </p>
        ) : (
          <p className="status">אין שיעור מפורסם.</p>
        )}
        {query.commission === "published" ? <p className="status">השיעור פורסם.</p> : null}
        {query.commission === "invalid" ? <p className="status">השיעור צריך להיות בין 0% ל־100%.</p> : null}
        {query.commission === "forbidden" ? <p className="status">רק ניהול מורשה יכול לפרסם שיעור.</p> : null}
        <form action={publishCommission}>
          <label htmlFor="supplier-percent">
            עמלת ספק
            <input id="supplier-percent" name="supplierPercent" inputMode="decimal" dir="ltr" required />
          </label>
          <label htmlFor="creator-percent">
            עמלת יוצר/ת
            <input id="creator-percent" name="creatorPercent" inputMode="decimal" dir="ltr" required />
          </label>
          <label htmlFor="commission-date">
            תאריך תחולה
            <input id="commission-date" name="effectiveOn" type="date" required />
          </label>
          <button className="button-publish" type="submit">פרסום שיעור</button>
        </form>
        {book.audit.length > 0 ? (
          <ul>
            {book.audit.map((entry) => (
              <li key={`${entry.at}-${entry.after}`}>
                <span dir="ltr">{entry.before} → {entry.after}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </>
  );
}

export default function AdminPlansPage({ searchParams }: { searchParams: Promise<{ commission?: string }> }) {
  return (
    <main className="shell">
      <Suspense fallback={<p className="status">טוען…</p>}>
        <AdminPlans searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
