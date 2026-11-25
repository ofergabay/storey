"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { signOutSeller } from "@/lib/auth-actions";
import { publishDemoListing } from "@/lib/publish-listing";
import { ProductArt } from "@/components/product-art";
import { PUBLIC_LISTING } from "@/lib/cloud-nine-public";
import { LOCAL_DRAFT_STORAGE_KEY } from "@/lib/local-draft";
import type { SellerQuoteList } from "@/lib/seller-quotes";
import type { SellerPlanView } from "@/lib/commerce/plans";
import { maskPhone, maskStreet } from "@/lib/privacy";
import { agorotToInput, formatMarginRatio, formatShekelAfter, formatShekels } from "@/lib/money";
import { grossMarginRatio, grossProfitAgorot, parseRetailDraft } from "@/lib/pricing";

const PACK = `${PUBLIC_LISTING.packLabel} · ${PUBLIC_LISTING.packSize} ${PUBLIC_LISTING.packUnit}`;

function subscribeToDraft(onStoreChange: () => void) {
  window.addEventListener("storey-draft", onStoreChange);
  return () => window.removeEventListener("storey-draft", onStoreChange);
}

function writeLocalDraft(value: string) {
  window.localStorage.setItem(LOCAL_DRAFT_STORAGE_KEY, value);
  window.dispatchEvent(new Event("storey-draft"));
}

function publishError(reason: "invalid" | "below-cost" | "auth" | "plan" | "save"): string {
  if (reason === "below-cost") {
    return "המחיר נמוך מכלל המרווח. לפני עמלות צריך להישאר אפס או יותר.";
  }
  if (reason === "auth") return "צריך להתחבר לחשבון של מאיה כדי לפרסם.";
  if (reason === "plan") return "התוכנית לא כוללת פרסום. הטיוטה נשארה כאן.";
  if (reason === "save") return "הפרסום לא נשמר במסד הנתונים. הטיוטה נשארה כאן ואפשר לנסות שוב.";
  return "המחיר לא תקין. הזינו מספר חיובי עם עד שתי ספרות אחרי הנקודה.";
}

export function SellerWorkspace({
  wholesaleAgorot,
  initialDraftAgorot,
  publishedAgorot,
  listingUrl,
  quotes,
  plan,
}: {
  wholesaleAgorot: number;
  initialDraftAgorot: number;
  publishedAgorot: number | null;
  listingUrl: string;
  quotes: SellerQuoteList;
  plan: SellerPlanView;
}) {
  const fallbackDraft = agorotToInput(initialDraftAgorot);
  const draft = useSyncExternalStore(
    subscribeToDraft,
    () => window.localStorage.getItem(LOCAL_DRAFT_STORAGE_KEY) ?? fallbackDraft,
    () => fallbackDraft,
  );
  const [published, setPublished] = useState(publishedAgorot);
  const [actionMessage, setActionMessage] = useState<string | null>(
    publishedAgorot === null ? null : `המחיר ${formatShekels(publishedAgorot)} פורסם.`,
  );
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">("idle");
  const [pending, startTransition] = useTransition();
  const parsed = parseRetailDraft(draft);
  const profit =
    parsed.status === "priced" ? grossProfitAgorot(parsed.agorot, wholesaleAgorot) : null;
  const margin =
    parsed.status === "priced" ? grossMarginRatio(parsed.agorot, wholesaleAgorot) : null;
  const belowCost = profit !== null && profit < 0;
  const matchesPublished =
    parsed.status === "priced" && published !== null && parsed.agorot === published;
  const planAllows = !plan.installed || plan.canPublish;
  const canPublish = planAllows && parsed.status === "priced" && !belowCost && !matchesPublished && !pending;

  const profitText =
    profit === null || margin === null
      ? null
      : `${formatShekelAfter(profit)} (${formatMarginRatio(margin)})`;

  function statusText(): string {
    if (parsed.status === "empty") {
      return "השדה ריק. הזינו מחיר מכירה כדי לראות את הרווח למארז.";
    }
    if (parsed.status === "invalid" || profitText === null) {
      return "המחיר לא תקין. הזינו מספר חיובי עם עד שתי ספרות אחרי הנקודה.";
    }
    if (belowCost) {
      return `הרווח שלך למארז ${profitText}. פרסום אפשרי רק כשהרווח הוא אפס או חיובי.`;
    }
    return `הרווח שלך למארז ${profitText}.`;
  }

  function onPublish() {
    if (!canPublish) return;
    const submitted = draft;
    startTransition(async () => {
      try {
        const result = await publishDemoListing(submitted);
        if (!result.ok) {
          setActionMessage(publishError(result.reason));
          return;
        }
        const saved = agorotToInput(result.agorot);
        setPublished(result.agorot);
        writeLocalDraft(saved);
        setCopyState("idle");
        setActionMessage(`המחיר ${formatShekels(result.agorot)} פורסם. הקישור ללקוחות מציג את המחיר הזה.`);
      } catch {
        setActionMessage("הפרסום לא נשמר במסד הנתונים. הטיוטה נשארה כאן ואפשר לנסות שוב.");
      }
    });
  }

  async function copyLink() {
    if (published === null) return;
    try {
      await navigator.clipboard.writeText(listingUrl);
      setCopyState("copied");
    } catch {
      const field = document.getElementById("listing-url");
      if (field instanceof HTMLInputElement) {
        field.focus();
        field.select();
      }
      setCopyState("manual");
    }
  }

  const whatsAppHref =
    published === null
      ? null
      : `https://wa.me/?text=${encodeURIComponent(
          [
            `${PUBLIC_LISTING.title} מאת ${PUBLIC_LISTING.sellerName}`,
            PACK,
            `מחיר ${formatShekels(published)}`,
            listingUrl,
          ].join("\n"),
        )}`;

  const publishLabel = matchesPublished ? "המחיר פורסם" : published === null ? "פרסום המודעה" : "פרסום המחיר המעודכן";

  return (
    <div className="workspace">
      <section className="card" aria-labelledby="pricing-title">
        <div className="kicker-row">
          <p className="kicker">סטודיו מוכרת · {PUBLIC_LISTING.sellerName}</p>
          <form action={signOutSeller}>
            <button className="text-button" type="submit">
              יציאה
            </button>
          </form>
        </div>
        <p className="hint">
          {plan.organizationName ? `${plan.organizationName} · ` : ""}
          {plan.nameHe}
          {plan.priceAgorot === 0 ? " · 0 ₪. " : ". "}
          תוכנית במחיר אפס נפתחת בלי חיוב.
        </p>
        {plan.installed && !plan.canPublish ? <p className="status">התוכנית לא כוללת פרסום.</p> : null}
        <h1 id="pricing-title" className="page-title">
          תמחור
        </h1>
        <ProductArt sticker="12 בלונים במארז" />
        <div className="copy">
          <p className="meta">
            <span dir="ltr">{PUBLIC_LISTING.sellerHandle}</span>
            <span> · הפצה חברתית</span>
          </p>
          <h2 className="product-title">{PUBLIC_LISTING.title}</h2>
          <p className="summary">מארז בלונים בגוון לילך לבוקר יום ההולדת</p>
          <p className="pack">12 בלונים במארז</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onPublish();
            }}
          >
            <div className="figures">
              <label className="figure" htmlFor="retail-price">
                <span>מחיר המכירה שלך</span>
                <span className="retail-field" dir="ltr">
                  <input
                    id="retail-price"
                    name="retail"
                    inputMode="decimal"
                    autoComplete="off"
                    enterKeyHint="done"
                    aria-invalid={parsed.status === "invalid"}
                    aria-describedby="price-status price-footnote"
                    value={draft}
                    onChange={(event) => {
                      writeLocalDraft(event.target.value);
                      setActionMessage(null);
                      setCopyState("idle");
                    }}
                  />
                  <span aria-hidden="true">₪</span>
                </span>
              </label>
              <div className="figure figure-profit">
                <span>לפני עמלות</span>
                <strong dir="ltr" className={belowCost ? "is-negative" : undefined}>
                  {profitText ?? "—"}
                </strong>
              </div>
            </div>
            <p id="price-footnote" className="hint">
              המחירים לפני מע״מ. הרווח לפני עמלות סליקה ופלטפורמה.
            </p>
            <p
              id="price-status"
              className={profitText !== null && !belowCost ? "sr-only" : "status"}
              role="status"
            >
              {statusText()}
            </p>
            <button className="button-publish" type="submit" disabled={!canPublish}>
              {pending ? "מפרסם…" : publishLabel}
            </button>
          </form>
        </div>
      </section>

      <aside className="card share-card" aria-labelledby="share-title">
        <h2 id="share-title" className="section-title">
          שיתוף
        </h2>
        {published === null ? (
          <p>פרסמו את המודעה כדי להעתיק את הקישור ולשתף אותו בוואטסאפ.</p>
        ) : (
          <p>
            הקישור מציג את המחיר שפורסם:{" "}
            <strong dir="ltr">{formatShekels(published)}</strong>
            {parsed.status === "priced" && parsed.agorot !== published
              ? " החישוב מתעדכן לפי מה שמקלידים. השיתוף נשאר על המחיר שפורסם עד לפרסום מחדש."
              : ""}
          </p>
        )}
        <label className="url-field" htmlFor="listing-url">
          קישור המודעה
          <input
            id="listing-url"
            readOnly
            dir="ltr"
            value={published === null ? "" : listingUrl}
            placeholder="הקישור יופיע אחרי הפרסום"
          />
        </label>
        {whatsAppHref === null ? (
          <button className="button-primary" type="button" disabled>
            <span>שיתוף בוואטסאפ</span>
            <span aria-hidden="true">↗</span>
          </button>
        ) : (
          <a className="button-primary" href={whatsAppHref} target="_blank" rel="noopener noreferrer">
            <span>שיתוף בוואטסאפ</span>
            <span aria-hidden="true">↗</span>
          </a>
        )}
        <button className="button-secondary" type="button" disabled={published === null} onClick={copyLink}>
          העתקת קישור
        </button>
        <p className="status" role="status">
          {copyState === "copied"
            ? "הקישור הועתק."
            : copyState === "manual"
              ? "העתיקו את הקישור מהשדה."
              : actionMessage}
        </p>
        <p className="hint">פתיחת הקישור לא נועלת מלאי ולא משנה את המלאי.</p>
        <p className="seller-line">
          <span className="avatar" aria-hidden="true">
            {PUBLIC_LISTING.sellerInitials}
          </span>
          {PUBLIC_LISTING.sellerName}
        </p>
      </aside>
      <SellerQuotes quotes={quotes} publishedAgorot={published} />
    </div>
  );
}

function SellerQuotes({ quotes, publishedAgorot }: { quotes: SellerQuoteList; publishedAgorot: number | null }) {
  return (
    <section className="card quotes-card" aria-labelledby="quotes-title">
      <h2 id="quotes-title" className="section-title">
        הצעות מחיר
      </h2>
      <p className="hint">
        המחיר בכל הצעה נשמר לפי מה שפורסם באותו רגע. מע״מ ומשלוח לא מחושבים, ולא בוצע תשלום.
      </p>
      {quotes.status === "missing" ? (
        <p className="status">צריך להריץ את מיגרציית ההצעות ב-Supabase כדי לראות אותן כאן.</p>
      ) : null}
      {quotes.status === "error" ? (
        <p className="status">לא הצלחנו לטעון את ההצעות. התמחור נשאר זמין.</p>
      ) : null}
      {quotes.status === "ready" && quotes.items.length === 0 ? (
        <p>עדיין אין הצעות מחיר.</p>
      ) : null}
      {quotes.status === "ready" && quotes.items.length > 0 ? (
        <div className="quote-inbox">
          {quotes.items.map((quote) => (
            <article key={quote.id}>
              <h3>
                {quote.quantity} מארזים · <span dir="ltr">{quote.totalLabel}</span>
              </h3>
              <p className="quote-line">
                <span>מחיר למארז שנשמר</span>
                <strong dir="ltr">{quote.unitLabel}</strong>
              </p>
              {publishedAgorot !== null && quote.unitRetailAgorot !== publishedAgorot ? (
                <p className="hint">
                  המחיר שפורסם עכשיו הוא <span dir="ltr">{formatShekels(publishedAgorot)}</span>. ההצעה נשארת על{" "}
                  <span dir="ltr">{quote.unitLabel}</span>.
                </p>
              ) : null}
              <p className="meta" dir="ltr">
                {quote.createdLabel}
              </p>
              <p className="quote-address">
                {quote.recipientName}
                <br />
                <span dir="ltr">{maskPhone(quote.phone)}</span>
                <br />
                {quote.city}, {maskStreet()}
              </p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
