"use client";

import { useState } from "react";
import Link from "next/link";
import { developmentPlans, type PlanCode } from "@/lib/commerce/plans";
import { landingCopy, type LandingLocale, type SelectedChannel } from "@/lib/landing/copy";

const channelForPlan: Record<PlanCode, SelectedChannel> = {
  social: "social",
  branded: "brand",
  scale: "partnership",
};

const presentation = {
  social: {
    he: {
      summary: "קישור לשיתוף בוואטסאפ, ומכירה מהקטלוג המשותף בלי לקנות מלאי מראש.",
      features: ["קישור אישי לכל מוצר", "מכירה מהמלאי המשותף", "בלי חנות פרטית ובלי שריון מלאי"],
      action: "הרשמה בחינם",
    },
    en: {
      summary: "A WhatsApp link, selling from the shared catalog without buying stock first.",
      features: ["A personal link for every product", "Selling from shared stock", "No private store and no reserved stock"],
      action: "Sign up free",
    },
  },
  branded: {
    he: {
      summary: "חנות עם השם שלכם, שריון מלאי לקמפיין, והנחה לכמות.",
      features: ["חנות ודומיין משלכם", "שריון מלאי לקמפיין", "נפתח אחרי אישור מחיר וסליקה"],
      action: "השארת פרטים",
    },
    en: {
      summary: "A store in your name, campaign stock, and quantity pricing.",
      features: ["Your own store and domain", "Campaign stock", "Opens after price and checkout approval"],
      action: "Leave your details",
    },
  },
  scale: {
    he: {
      summary: "מלאי ששמור אצל הספק, אריזה לפי הסכם, ומחיר שותפות.",
      features: ["מלאי שמור במחסן הספק", "אריזה ותנאים לפי הסכם", "חנות, קמפיין וקישורי מכירה"],
      action: "השארת פרטים",
    },
    en: {
      summary: "Stock held by the supplier, packaging by agreement, and a partnership price.",
      features: ["Stock held in the supplier warehouse", "Packaging and terms by agreement", "Store, campaign, and sale links"],
      action: "Leave your details",
    },
  },
} as const;

function PlanAmount({ free, soon }: { free: boolean; soon: string }) {
  if (!free) return soon;
  return (
    <span className="shekel" dir="ltr">
      ₪0
    </span>
  );
}

export function PlanCards({
  locale = "he",
  selectedChannel,
  onSelect,
  onFreePlan,
}: {
  locale?: LandingLocale;
  selectedChannel?: SelectedChannel | null;
  onSelect?: (channel: SelectedChannel) => void;
  onFreePlan?: (opener: HTMLElement) => void;
}) {
  const [internalChannel, setInternalChannel] = useState<SelectedChannel | null>(selectedChannel ?? null);
  const selected = onSelect ? (selectedChannel ?? null) : internalChannel;
  const choose = (channel: SelectedChannel) => {
    if (onSelect) onSelect(channel);
    else setInternalChannel(channel);
  };
  const text = landingCopy[locale];
  const soon = locale === "he" ? "בקרוב" : "Soon";
  return (
    <div className="plan-board" aria-label={text.plans}>
      <div className="plan-billing" role="radiogroup" aria-label={locale === "he" ? "אופן התשלום" : "Billing"}>
        <input className="plan-billing-input" id="plan-monthly" type="radio" name="plan-billing" defaultChecked />
        <label htmlFor="plan-monthly">{text.monthly}</label>
        <input className="plan-billing-input" id="plan-yearly" type="radio" name="plan-billing" />
        <label htmlFor="plan-yearly">
          {text.yearly}
          <span className="plan-save">{text.yearlySave}</span>
        </label>
      </div>
      <div className="plan-grid">
        {developmentPlans.map((plan) => {
          const copy = presentation[plan.code][locale];
          const channel = channelForPlan[plan.code];
          const active = selected === channel;
          const dim = selected !== null && !active;
          const free = plan.priceAgorot === 0;
          const monthlyNote = free ? (locale === "he" ? "נפתח בלי חיוב." : "Opens with no charge.") : locale === "he" ? "המחיר החודשי עדיין לא אושר." : "The monthly price is not approved yet.";
          const title = locale === "he" ? plan.nameHe : plan.code === "social" ? "Social selling" : plan.code === "branded" ? "Branded store" : "Partnership";
          return (
            <article
              className={`card plan-card${active ? " plan-card-active" : ""}${dim ? " plan-card-dim" : ""}${selected === null && plan.code === "branded" ? " popular" : ""}`}
              key={plan.code}
              role="button"
              tabIndex={0}
              aria-pressed={active}
              onClick={() => choose(channel)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  choose(channel);
                }
              }}
            >
              <div className="copy">
                {plan.code === "branded" ? <p className="plan-badge">{locale === "he" ? "הכי פופולרי" : "Most popular"}</p> : null}
                <h3 className="section-title">{title}</h3>
                <p className="hint">{copy.summary}</p>
                <p className="plan-price price-month">
                  <strong>
                    <PlanAmount free={free} soon={soon} />
                  </strong>
                  <span>{locale === "he" ? "לחודש" : "per month"}</span>
                </p>
                <p className="plan-price price-year">
                  <strong>
                    <PlanAmount free={free} soon={soon} />
                  </strong>
                  <span>{locale === "he" ? "לחודש" : "per month"}</span>
                </p>
                <p className="hint price-month">{monthlyNote}</p>
                <p className="hint price-year">
                  {free ? (
                    <>
                      <span className="shekel" dir="ltr">
                        ₪0
                      </span>{" "}
                      {locale === "he" ? "לשנה" : "per year"}
                    </>
                  ) : locale === "he" ? (
                    "כשהמחיר יאושר, החיוב השנתי נמוך ב-20% מ-12 תשלומים חודשיים."
                  ) : (
                    "Once a price is approved, yearly billing is 20% below 12 monthly payments."
                  )}
                </p>
                {free && onFreePlan ? (
                  <button
                    className={active || (selected === null && plan.code === "branded") ? "button-publish" : "button-secondary"}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      choose(channel);
                      onFreePlan(event.currentTarget);
                    }}
                  >
                    {copy.action}
                  </button>
                ) : (
                  <Link
                    className={active || (selected === null && plan.code === "branded") ? "button-publish" : "button-secondary"}
                    href={free ? "/register?plan=social" : `/register?lead=1&plan=${plan.code}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {copy.action}
                  </Link>
                )}
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
