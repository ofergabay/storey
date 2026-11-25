"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ProductArt } from "@/components/product-art";
import { Wordmark } from "@/components/wordmark";
import { publishCatalogPrice, saveCatalogDraft, setCatalogSalePaused } from "@/lib/catalog/actions";
import { offerActionLabel, offerControls, packEarnings } from "@/lib/catalog/offer";
import type { PolicyVersion } from "@/lib/commerce/payment/flag";
import { agorotToInput, formatShekels } from "@/lib/money";
import { grossProfitAgorot, parseRetailDraft } from "@/lib/pricing";

export function CatalogPricing({
  sku,
  title,
  pack,
  costAgorot,
  stockLabel,
  canPublishStock,
  publishedAgorot,
  draftAgorot,
  publishedHeadline,
  publishedRecommendation,
  draftHeadline,
  draftRecommendation,
  paused,
  salePath,
  storefront,
  campaign,
  feePolicy,
  rates,
}: {
  sku: string;
  title: string;
  pack: string;
  costAgorot: number;
  stockLabel: string;
  canPublishStock: boolean;
  publishedAgorot: number;
  draftAgorot: number | null;
  publishedHeadline: string;
  publishedRecommendation: string;
  draftHeadline: string;
  draftRecommendation: string;
  paused: boolean;
  salePath: string | null;
  storefront: boolean;
  campaign: boolean;
  feePolicy: PolicyVersion;
  rates?: { supplierBps: number; creatorBps: number };
}) {
  const suggested = Math.max(costAgorot, costAgorot + 1500);
  const opening = draftAgorot ?? (publishedAgorot > 0 ? publishedAgorot : suggested);
  const [draft, setDraft] = useState(agorotToInput(opening));
  const [headline, setHeadline] = useState(draftHeadline);
  const [recommendation, setRecommendation] = useState(draftRecommendation);
  const [savedAgorot, setSavedAgorot] = useState<number | null>(draftAgorot ?? (publishedAgorot > 0 ? publishedAgorot : null));
  const [savedHeadline, setSavedHeadline] = useState(draftHeadline);
  const [savedRecommendation, setSavedRecommendation] = useState(draftRecommendation);
  const [liveAgorot, setLiveAgorot] = useState(publishedAgorot);
  const [liveHeadline, setLiveHeadline] = useState(publishedHeadline);
  const [liveRecommendation, setLiveRecommendation] = useState(publishedRecommendation);
  const [salePaused, setSalePaused] = useState(paused);
  const [path, setPath] = useState(salePath);
  const [justUpdated, setJustUpdated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [manualLink, setManualLink] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState<"whatsapp" | "post" | null>(null);
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(false);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"publish" | "pause" | null>(null);
  const saveGeneration = useRef(0);
  const publishing = useRef(false);
  const previewRef = useRef<HTMLDialogElement>(null);

  const parsed = parseRetailDraft(draft);
  const currentAgorot = parsed.status === "priced" ? parsed.agorot : null;
  const profit = currentAgorot === null ? null : grossProfitAgorot(currentAgorot, costAgorot);
  const belowCost = profit !== null && profit < 0;
  const earnings = currentAgorot !== null && !belowCost ? packEarnings(currentAgorot, costAgorot, feePolicy, rates) : null;
  const priceSynced = currentAgorot !== null && currentAgorot === savedAgorot;
  const copySynced = headline.trim() === savedHeadline.trim() && recommendation.trim() === savedRecommendation.trim();
  const synced = priceSynced && copySynced;
  const copyChanged = headline.trim() !== liveHeadline.trim() || recommendation.trim() !== liveRecommendation.trim();
  const controls = offerControls({
    publishedAgorot: liveAgorot,
    currentAgorot,
    copyChanged,
    synced,
    paused: salePaused,
    justUpdated,
  });
  const canSubmit = canPublishStock && parsed.status === "priced" && !belowCost;
  const quietSaved = controls.action === "publish" && synced && !saveError ? "הטיוטה נשמרה" : null;

  useEffect(() => {
    const dialog = previewRef.current;
    if (!dialog) return;
    if (preview && !dialog.open) dialog.showModal();
    if (!preview && dialog.open) dialog.close();
  }, [preview]);

  useEffect(() => {
    if (synced || currentAgorot === null || belowCost) return;
    const generation = saveGeneration.current + 1;
    saveGeneration.current = generation;
    const snapshot = { retail: draft, agorot: currentAgorot, headline, recommendation };
    const timer = window.setTimeout(() => {
      if (generation !== saveGeneration.current) return;
      setSaving(true);
      startTransition(async () => {
        const result = await saveCatalogDraft(sku, snapshot.retail, {
          headline: snapshot.headline,
          recommendation: snapshot.recommendation,
        });
        if (generation !== saveGeneration.current) return;
        setSaving(false);
        if (!result.ok) {
          setSaveError(result.message);
          return;
        }
        setSavedAgorot(snapshot.agorot);
        setSavedHeadline(snapshot.headline.trim());
        setSavedRecommendation(snapshot.recommendation.trim());
        setPath(result.path);
        setSaveError(null);
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [belowCost, currentAgorot, draft, headline, recommendation, sku, synced]);

  function absoluteUrl() {
    if (!path || typeof window === "undefined") return path ?? "";
    return new URL(path, window.location.origin).toString();
  }

  function buyerNote(priceAgorot: number, buyerTitle: string) {
    return `${buyerTitle}\n${pack}\nמחיר למארז: ${formatShekels(priceAgorot)}`;
  }

  function withLink(text: string, url: string) {
    return text.includes(url) ? text : `${text.trim()}\n${url}`;
  }

  async function copyLink() {
    const url = absoluteUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setManualLink(null);
    } catch {
      setCopied(false);
      setManualLink(url);
    }
  }

  function publish() {
    if (!canSubmit || publishing.current) return;
    publishing.current = true;
    const submitted = draft;
    const submittedHeadline = headline;
    const submittedRecommendation = recommendation;
    const wasLive = liveAgorot > 0;
    saveGeneration.current += 1;
    setBusy("publish");
    setCopied(false);
    startTransition(async () => {
      try {
        const result = await publishCatalogPrice(sku, submitted, {
          headline: submittedHeadline,
          recommendation: submittedRecommendation,
        });
        if (!result.ok) {
          setRetry(true);
          setSaveError(result.message);
          return;
        }
        setRetry(false);
        const agorot = parseRetailDraft(submitted);
        if (agorot.status !== "priced") return;
        setLiveAgorot(agorot.agorot);
        setSavedAgorot(agorot.agorot);
        setLiveHeadline(submittedHeadline.trim());
        setSavedHeadline(submittedHeadline.trim());
        setLiveRecommendation(submittedRecommendation.trim());
        setSavedRecommendation(submittedRecommendation.trim());
        setSalePaused(false);
        setPath(result.path);
        setJustUpdated(wasLive);
        setSaveError(null);
        setNote(buyerNote(agorot.agorot, submittedHeadline.trim() || title));
      } finally {
        publishing.current = false;
        setBusy(null);
      }
    });
  }

  function setPaused(next: boolean) {
    setBusy("pause");
    startTransition(async () => {
      const result = await setCatalogSalePaused(sku, next);
      setBusy(null);
      if (!result.ok) {
        setSaveError(result.message);
        return;
      }
      setSalePaused(next);
      setJustUpdated(false);
      setCopied(false);
      setSaveError(null);
    });
  }

  function openShare(kind: "whatsapp" | "post") {
    const url = absoluteUrl();
    const text = withLink(note || buyerNote(liveAgorot, liveHeadline.trim() || title), url);
    setNote(text);
    if (kind === "whatsapp") {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    }
    setShareOpen(kind);
  }

  function downloadArt() {
    const svg = document.querySelector("#offer-art svg");
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sku}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const previewTitle = headline.trim() || title;
  const previewSummary = recommendation.trim() || "מוצר שפורסם מהקטלוג.";
  const previewPrice = parsed.status === "priced" ? formatShekels(parsed.agorot) : null;
  const primaryLabel = busy === "publish"
    ? "מפרסם…"
    : busy === "pause"
      ? "מעדכן…"
      : retry && (controls.action === "publish" || controls.action === "publish-changes")
        ? "ניסיון חוזר"
        : offerActionLabel(controls.action);
  const saveStatus = saving ? "שומר את הטיוטה…" : quietSaved;

  return (
    <section className="card offer-card">
      <div id="offer-art">
        <ProductArt sticker={pack} compact />
      </div>
      <div className="copy">
        <h1 className="page-title">{title}</h1>
        <p className="pack">{pack}</p>
        <p className="quote-line">
          <span>{earnings?.label ?? "מרווח לפני עמלות"}</span>
          <strong dir="ltr">{earnings?.amount ?? "—"}</strong>
        </p>
        <p className="hint">{earnings?.hint ?? "ההפרש לפני עמלות. עמלת היוצר/ת להצעה הזו עדיין לא נקבעה."}</p>
        {liveAgorot > 0 && currentAgorot !== null && currentAgorot !== liveAgorot ? (
          <p className="hint">
            בעמוד המכירה {formatShekels(liveAgorot)} · בטיוטה {formatShekels(currentAgorot)}
          </p>
        ) : null}
        <p className="hint">{stockLabel}</p>
        <form
          className="catalog-price"
          onSubmit={(event) => {
            event.preventDefault();
            if (controls.action === "copy") {
              void copyLink();
              return;
            }
            if (controls.action === "resume") {
              setPaused(false);
              return;
            }
            publish();
          }}
        >
          <label className="quote-line" htmlFor="catalog-retail">
            מחיר המכירה למארז
            <span className="retail-field" dir="ltr">
              <input
                id="catalog-retail"
                inputMode="decimal"
                autoComplete="off"
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setJustUpdated(false);
                  setCopied(false);
                  setSaveError(null);
                }}
              />
              <span aria-hidden="true">₪</span>
            </span>
          </label>
          {parsed.status === "invalid" ? <p className="status">המחיר לא תקין. הזינו מספר חיובי עם עד שתי ספרות אחרי הנקודה.</p> : null}
          {belowCost ? <p className="status">המחיר נמוך מכלל המרווח. לפני עמלות צריך להישאר אפס או יותר.</p> : null}
          <details className="sale-copy">
            <summary>עריכת פרטי המכירה</summary>
            <label htmlFor="buyer-headline">
              כותרת לקונה
              <input
                id="buyer-headline"
                value={headline}
                placeholder={title}
                maxLength={80}
                onChange={(event) => {
                  setHeadline(event.target.value);
                  setJustUpdated(false);
                  setSaveError(null);
                }}
              />
            </label>
            <label htmlFor="buyer-note">
              המלצה אישית
              <textarea
                id="buyer-note"
                value={recommendation}
                maxLength={280}
                placeholder="אפשר לפרסם מיד. בלי טקסט אישי, תוכן הקטלוג מוצג לקונה."
                onChange={(event) => {
                  setRecommendation(event.target.value);
                  setJustUpdated(false);
                  setSaveError(null);
                }}
              />
            </label>
          </details>
          <div className="offer-actions">
            {controls.share && controls.action === "copy" ? <p className="kicker">הקישור שלך מוכן לשיתוף</p> : null}
            <div className="offer-footer">
              <button
                className="button-publish"
                type="submit"
                disabled={pending || (controls.action !== "copy" && controls.action !== "resume" && !canSubmit)}
              >
                {primaryLabel}
              </button>
              <button
                className="button-secondary"
                type="button"
                disabled={parsed.status !== "priced" || belowCost}
                onClick={() => setPreview(true)}
              >
                תצוגה מקדימה
              </button>
            </div>
            <p className="status" role="status">
              {controls.status}
            </p>
            {saveStatus ? <p className="hint">{saveStatus}</p> : null}
            {copied ? <p className="status">הקישור הועתק</p> : null}
            {manualLink ? (
              <label className="sale-copy" htmlFor="manual-sale-link">
                הקישור מוכן להעתקה
                <input id="manual-sale-link" readOnly value={manualLink} onFocus={(event) => event.currentTarget.select()} />
              </label>
            ) : null}
            {saveError ? <p className="status">{saveError}</p> : null}
          </div>
        </form>
        {controls.share && path ? (
          <div className="share-block">
            {controls.action === "publish-changes" ? (
              <p className="hint">השיתוף משתמש במחיר שכבר פורסם.</p>
            ) : null}
            <button className="button-secondary" type="button" onClick={() => openShare("whatsapp")}>
              שיתוף בוואטסאפ
            </button>
            <button className="button-secondary" type="button" onClick={() => openShare("post")}>
              הכנת פוסט או סטורי
            </button>
            {shareOpen ? (
              <div className="sale-copy">
                <label htmlFor="share-note">
                  {shareOpen === "whatsapp" ? "ההודעה נפתחת בוואטסאפ ואפשר לערוך אותה לפני השליחה." : "אפשר לערוך את הטקסט ולהעתיק אותו."}
                  <textarea
                    id="share-note"
                    className="share-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </label>
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => {
                    const url = absoluteUrl();
                    void navigator.clipboard.writeText(withLink(note, url)).then(() => {
                      setCopied(true);
                      setManualLink(null);
                    }).catch(() => setManualLink(withLink(note, url)));
                  }}
                >
                  העתקת הטקסט
                </button>
                {shareOpen === "post" ? (
                  <button className="button-secondary" type="button" onClick={downloadArt}>
                    הורדת תמונת המוצר
                  </button>
                ) : null}
              </div>
            ) : null}
            <a className="offer-text-link" href={path}>
              פתיחת עמוד המכירה
            </a>
            <details className="more-actions">
              <summary>פעולות נוספות</summary>
              {campaign ? <a href="/campaigns">הוספה לקמפיין</a> : <p className="hint">הוספה לקמפיין זמינה במסלול שכולל קמפיינים.</p>}
              {storefront ? <a href="/storefront">הוספה לחנות שלי</a> : <p className="hint">הוספה לחנות זמינה במסלול שכולל חנות.</p>}
              <a href="/earnings">צפייה בביצועים</a>
              <button type="button" onClick={() => setPaused(true)}>
                השהיית המכירה
              </button>
            </details>
          </div>
        ) : null}
      </div>
      <dialog
        className="offer-preview"
        ref={previewRef}
        onClick={(event) => {
          if (event.target === event.currentTarget) setPreview(false);
        }}
        onClose={() => setPreview(false)}
      >
        <article className="customer-card">
          <header className="topbar customer-topbar">
            <Wordmark />
            <button className="button-secondary preview-close" type="button" onClick={() => setPreview(false)}>
              סגירה
            </button>
          </header>
          <ProductArt sticker={pack} />
          <div className="copy">
            <h2 className="product-title">{previewTitle}</h2>
            <p className="summary">{previewSummary}</p>
            <p className="pack">{pack}</p>
            {previewPrice ? (
              <p className="selling-price">
                <span>מחיר למארז</span>
                <strong dir="ltr">{previewPrice}</strong>
              </p>
            ) : null}
            <button className="button-publish" type="button" disabled>
              להצעת מחיר
            </button>
            <p className="hint">תצוגה מקדימה. הרכישה לא פעילה כאן.</p>
          </div>
        </article>
      </dialog>
    </section>
  );
}
