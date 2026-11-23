const plans = [
  { name: "מוכרת חברתית", price: "0 ₪", detail: "פרסום קישור ומכירה מהמלאי המשותף. בלי קמפיין ובלי מלאי ייעודי. נפתחת בלי חיוב." },
  { name: "חנות מותג", price: "מחיר לא הוגדר", detail: "קמפיין וחנות מותג. ההפעלה ממתינה למחיר מאושר ולספק סליקה." },
  { name: "שותפת קנה מידה", price: "מחיר לא הוגדר", detail: "מלאי ייעודי בנוסף לקמפיין. ההפעלה ממתינה לחוזה ולספק סליקה." },
];

export function PlanCards() {
  return (
    <div className="catalog-list">
      {plans.map((plan) => (
        <article className="card" key={plan.name}>
          <div className="copy">
            <h2 className="section-title">{plan.name}</h2>
            <p dir="ltr">{plan.price}</p>
            <p>{plan.detail}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
