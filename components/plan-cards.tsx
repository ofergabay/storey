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
      summary: "בוחרים מוצר, קובעים מחיר ושולחים לינק. הספק כבר ידאג לחבילה.",
      features: ["לינק אישי לכל מוצר", "שיתוף בסטורי, בטיקטוק או בוואטסאפ", "מוכרים מהמלאי של הספק, בלי לקנות מראש"],
      action: "תתחילו להרוויח",
    },
    en: {
      summary: "Pick a product, name your price, and drop the link in a Story, a DM, or the group chat.",
      features: ["A personal link for every product", "Share it in a Story, on TikTok, or on WhatsApp", "Sell the supplier’s stock without buying it first"],
      action: "Start earning",
    },
  },
  branded: {
    he: {
      summary: "כל הבחירות שלכם בחנות אחת, עם הלוגו והכתובת שלכם. מתכננים השקה? אפשר לשמור סחורה מראש.",
      features: ["חנות עם הלוגו והדומיין שלכם", "מלאי שאפשר לשמור לקמפיין", "הנחה לפי הכמות"],
      action: "עדכנו אותי כשנפתח",
    },
    en: {
      summary: "Give all your picks one home, with your logo and your own domain. Got a launch coming? Reserve stock for it.",
      features: ["A store with your logo and your domain", "Stock you can reserve for a launch", "A lower price when the quantity goes up"],
      action: "Tell me when it opens",
    },
  },
  scale: {
    he: {
      summary: "כבר מוכרים בכמויות? שומרים מלאי אצל הספק ומסכמים יחד על הכמות, המחיר והאריזה.",
      features: ["מלאי ששמור לכם אצל הספק", "אריזה ממותגת לפי הסכם", "חנות, קמפיינים ולינקים במקום אחד"],
      action: "דברו איתי על המסלול",
    },
    en: {
      summary: "Selling in volume? Agree on wholesale pricing, reserve stock at your supplier’s warehouse, and put your branding on the box.",
      features: ["Stock reserved for you at the supplier", "Branded packaging by agreement", "A store, campaigns, and links in one place"],
      action: "Talk to me about this plan",
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
  const hasYearlyPrice = false;
  return (
    <div className="plan-board" aria-label={text.plans}>
      {hasYearlyPrice ? (
        <div className="plan-billing" role="radiogroup" aria-label={locale === "he" ? "אופן התשלום" : "Billing"}>
          <input className="plan-billing-input" id="plan-monthly" type="radio" name="plan-billing" defaultChecked />
          <label htmlFor="plan-monthly">{text.monthly}</label>
          <input className="plan-billing-input" id="plan-yearly" type="radio" name="plan-billing" />
          <label htmlFor="plan-yearly">
            {text.yearly}
            <span className="plan-save">{text.yearlySave}</span>
          </label>
        </div>
      ) : null}
      <div className="plan-grid">
        {developmentPlans.map((plan) => {
          const copy = presentation[plan.code][locale];
          const channel = channelForPlan[plan.code];
          const active = selected === channel;
          const dim = selected !== null && !active;
          const free = plan.priceAgorot === 0;
          const soon = locale === "he" ? "בקרוב" : "Soon";
          const title = locale === "he" ? plan.nameHe : plan.code === "social" ? "Social Selling" : plan.code === "branded" ? "Branded Store" : "Partnership";
          return (
            <article
              className={`card plan-card${active ? " plan-card-active" : ""}${dim ? " plan-card-dim" : ""}`}
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
                <h3 className="section-title">{title}</h3>
                <p className="hint">{copy.summary}</p>
                <p className="plan-price price-month">
                  <strong>
                    <PlanAmount free={free} soon={soon} />
                  </strong>
                  {free ? <span>{locale === "he" ? "לחודש" : "per month"}</span> : null}
                </p>
                {hasYearlyPrice ? (
                  <p className="plan-price price-year">
                    <strong>
                      <PlanAmount free={free} soon={soon} />
                    </strong>
                    <span>{locale === "he" ? "לחודש" : "per month"}</span>
                  </p>
                ) : null}
                {free ? <p className="hint">{locale === "he" ? "בלי תשלום חודשי." : "No monthly fee."}</p> : null}
                {free && onFreePlan ? (
                  <button
                    className={active ? "button-publish" : "button-secondary"}
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
                    className={active ? "button-publish" : "button-secondary"}
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
