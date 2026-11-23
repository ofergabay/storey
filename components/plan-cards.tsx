import Link from "next/link";

const plans = [
  {
    name: "מוכרת חברתית",
    summary: "פרסום קישור ומכירה מהמלאי המשותף.",
    monthly: "₪0",
    yearly: "₪0",
    monthlyNote: "נפתחת בלי חיוב.",
    yearlyNote: "₪0 לשנה",
    features: ["קישור אישי לכל מוצר", "מכירה מהמלאי המשותף", "בלי קמפיין ובלי מלאי ייעודי"],
    action: "הרשמה כיוצר/ת",
    href: "/register",
    popular: false,
  },
  {
    name: "חנות מותג",
    summary: "קמפיין וחנות עם השם שלכם.",
    monthly: "בקרוב",
    yearly: "בקרוב",
    monthlyNote: "המחיר החודשי עדיין לא אושר.",
    yearlyNote: "כשהמחיר יאושר, החיוב השנתי נמוך ב-20% מ-12 תשלומים חודשיים.",
    features: ["חנות עם השם שלכם", "שמירת מלאי לקמפיין", "נפתח אחרי אישור מחיר וסליקה"],
    action: "השארת פרטים",
    href: "/register",
    popular: true,
  },
  {
    name: "שותפת קנה מידה",
    summary: "מלאי ייעודי בנוסף לקמפיין.",
    monthly: "בקרוב",
    yearly: "בקרוב",
    monthlyNote: "המחיר החודשי עדיין לא אושר.",
    yearlyNote: "כשהמחיר יאושר, החיוב השנתי נמוך ב-20% מ-12 תשלומים חודשיים.",
    features: ["מלאי שמור במחסן", "קמפיין וחנות", "נפתח עם חוזה ועם סליקה"],
    action: "השארת פרטים",
    href: "/register",
    popular: false,
  },
];

export function PlanCards() {
  return (
    <section className="plan-board" aria-label="מסלולים">
      <h2 className="section-title">מסלולים</h2>
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
        {plans.map((plan) => (
          <article className={plan.popular ? "card plan-card popular" : "card plan-card"} key={plan.name}>
            <div className="copy">
              {plan.popular ? <p className="plan-badge">הכי פופולרי</p> : null}
              <h3 className="section-title">{plan.name}</h3>
              <p className="hint">{plan.summary}</p>
              <p className="plan-price price-month">
                <strong dir="ltr">{plan.monthly}</strong>
                <span>לחודש</span>
              </p>
              <p className="plan-price price-year">
                <strong dir="ltr">{plan.yearly}</strong>
                <span>לחודש</span>
              </p>
              <p className="hint price-month">{plan.monthlyNote}</p>
              <p className="hint price-year">{plan.yearlyNote}</p>
              <Link className={plan.popular ? "button-publish" : "button-secondary"} href={plan.href}>
                {plan.action}
              </Link>
              <ul className="plan-features">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
