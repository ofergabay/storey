import { developmentPlans, type PlanCode } from "@/lib/commerce/plans";
import { submitApplication } from "@/lib/workspace/actions";

export function LeadForm({ plan }: { plan: Exclude<PlanCode, "social"> }) {
  const name = developmentPlans.find((item) => item.code === plan)?.nameHe ?? "";
  return (
    <section className="auth-panel" aria-labelledby="lead-title">
      <h1 id="lead-title">השארת פרטים</h1>
      <p className="auth-plan">{name} · בקרוב</p>
      <p>הפרטים נשמרים כבקשה ממתינה. המסלול לא נפתח לפני אישור, ובלי חשבון של מכירה חברתית.</p>
      <form className="auth-form" action={submitApplication}>
        <input type="hidden" name="role" value="creator" />
        <input type="hidden" name="plan" value={plan} />
        <label htmlFor="lead-name">
          שם
          <input id="lead-name" name="name" required minLength={2} />
        </label>
        <label htmlFor="lead-email">
          אימייל
          <input id="lead-email" name="email" type="email" dir="ltr" required />
        </label>
        <button className="button-publish" type="submit">
          שליחת פרטים
        </button>
      </form>
    </section>
  );
}
