import Link from "next/link";
import { developmentPlans } from "@/lib/commerce/plans";

const presentation = {
  social: {
    summary: "קישור לשיתוף בוואטסאפ, ומכירה מהקטלוג המשותף בלי לקנות מלאי מראש.",
    features: ["קישור אישי לכל מוצר", "מכירה מהמלאי המשותף", "בלי חנות פרטית ובלי שריון מלאי"],
    action: "הרשמה בחינם",
  },
  branded: {
    summary: "חנות עם השם שלכם, שריון מלאי לקמפיין, והנחה לכמות.",
    features: ["חנות ודומיין משלכם", "שריון מלאי לקמפיין", "נפתח אחרי אישור מחיר וסליקה"],
    action: "השארת פרטים",
  },
  scale: {
    summary: "מלאי ששמור אצל הספק, אריזה לפי הסכם, ומחיר שותפות.",
    features: ["מלאי שמור במחסן הספק", "אריזה ותנאים לפי הסכם", "חנות, קמפיין וקישורי מכירה"],
    action: "השארת פרטים",
  },
} as const;

export function PlanCards() {
  return (
    <div className="plan-board" aria-label="מסלולים">
      <div className="plan-billing" role="radiogroup" aria-label="אופן התשלום">
        <input className="plan-billing-input" id="plan-monthly" type="radio" name="plan-billing" defaultChecked />
        <label htmlFor="plan-monthly">תשלום חודשי</label>
        <input className="plan-billing-input" id="plan-yearly" type="radio" name="plan-billing" />
        <label htmlFor="plan-yearly">
          תשלום שנתי
          <span className="plan-save">חיסכון של 20%</span>
        </label>
      </div>
      <div className="plan-grid">
        {developmentPlans.map((plan) => {
          const copy = presentation[plan.code];
          const popular = plan.code === "branded";
          const price = plan.priceAgorot === 0 ? "₪0" : "בקרוב";
          const monthlyNote = plan.priceAgorot === 0 ? "נפתח בלי חיוב." : "המחיר החודשי עדיין לא אושר.";
          const yearlyNote = plan.priceAgorot === 0 ? "₪0 לשנה" : "כשהמחיר יאושר, החיוב השנתי נמוך ב-20% מ-12 תשלומים חודשיים.";
          return (
            <article className={popular ? "card plan-card popular" : "card plan-card"} key={plan.code}>
              <div className="copy">
                {popular ? <p className="plan-badge">הכי פופולרי</p> : null}
                <h3 className="section-title">{plan.nameHe}</h3>
                <p className="hint">{copy.summary}</p>
                <p className="plan-price price-month">
                  <strong dir="ltr">{price}</strong>
                  <span>לחודש</span>
                </p>
                <p className="plan-price price-year">
                  <strong dir="ltr">{price}</strong>
                  <span>לחודש</span>
                </p>
                <p className="hint price-month">{monthlyNote}</p>
                <p className="hint price-year">{yearlyNote}</p>
                <Link className={popular ? "button-publish" : "button-secondary"} href="/register">
                  {copy.action}
                </Link>
                <ul className="plan-features">
                  {copy.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
