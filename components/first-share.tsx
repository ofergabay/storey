"use client";

import { useState } from "react";
import { replaceShareLine, saveShareLine } from "@/lib/experiments/actions";
import { channelText, disclosure, facebookHref, storySvg, trackedPath, whatsAppHref, xHref, type ShareAngle, type ShareChannel, type ShareLocale } from "@/lib/experiments/share";

export function FirstShare({
  creatorId,
  productKey,
  sku,
  title,
  quantityLabel,
  verifiedGuestCount,
  salePath,
  initial,
}: {
  creatorId: string;
  productKey: string;
  sku: string;
  title: string;
  quantityLabel: string;
  verifiedGuestCount: number | null;
  salePath: string | null;
  initial: { text: string; manual: boolean; angle: ShareAngle; why: string; locale: ShareLocale; attempt: number } | null;
}) {
  const [locale, setLocale] = useState<ShareLocale>(initial?.locale ?? "he");
  const [angle, setAngle] = useState<ShareAngle>(initial?.angle ?? "practical");
  const [why, setWhy] = useState(initial?.why ?? "");
  const [text, setText] = useState(initial?.text ?? "");
  const [manual, setManual] = useState(initial?.manual ?? false);
  const [attempt, setAttempt] = useState(initial?.attempt ?? 0);
  const [notice, setNotice] = useState("");
  const [channel, setChannel] = useState<ShareChannel>("whatsapp");
  const [note, setNote] = useState(disclosure(locale));
  const path = salePath ? trackedPath(salePath, { creator: creatorId, offer: productKey, campaign: productKey, channel }) : "";
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = path && origin ? `${origin}${path}` : path;
  const composed = text.trim().length > 0 ? channelText({ core: text.trim(), locale, channel, url, disclosureText: note }) : null;
  const guest = verifiedGuestCount && verifiedGuestCount > 0 ? (locale === "he" ? `מתאים ל-${verifiedGuestCount}` : `Serves ${verifiedGuestCount}`) : null;

  async function another() {
    const result = await replaceShareLine({
      creatorId,
      productKey,
      sku,
      locale,
      angle,
      why,
      facts: { title, quantityLabel, verifiedGuestCount },
      attempt: attempt + 1,
    });
    setAttempt(attempt + 1);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setText(result.text);
    setManual(false);
    setNotice(locale === "he" ? "נשמרה שורה אחרת." : "A different line was saved.");
  }

  async function saveManual() {
    const result = await saveShareLine({ creatorId, productKey, sku, locale, angle, why, text });
    setNotice(result.ok ? (locale === "he" ? "העריכה נשמרה." : "Your edit was saved.") : result.message);
    if (result.ok) setManual(true);
  }

  async function copy(value: string, message: string) {
    await navigator.clipboard.writeText(value);
    setNotice(message);
  }

  function downloadStory() {
    const svg = storySvg({ title, line: text.trim() });
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `${sku}-story.svg`;
    link.click();
    URL.revokeObjectURL(href);
    setNotice(locale === "he" ? "תמונת הסטורי נשמרה. הקישור לא מוטמע בה." : "The Story image was saved. The link is not inside it.");
  }

  async function nativeStory() {
    const svg = storySvg({ title, line: text.trim() });
    const file = new File([svg], `${sku}-story.svg`, { type: "image/svg+xml" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return;
    }
    downloadStory();
  }

  return (
    <section className="card">
      <h2 className="section-title">{locale === "he" ? "שיתוף ראשון" : "First share"}</h2>
      <p>{locale === "he" ? "בחירת מוצר, מחיר ורווח צפוי כבר למעלה. כאן מוסיפים שורה אישית ומשתפים." : "Product, price, and expected earnings are above. Add a personal line and share."}</p>
      {guest ? <p>{guest}</p> : null}
      <div className="offer-actions">
        <button className="button-secondary" type="button" onClick={() => setLocale(locale === "he" ? "en" : "he")}>{locale === "he" ? "English" : "עברית"}</button>
        {(["practical", "playful", "design"] as const).map((item) => (
          <button key={item} className={angle === item ? "button-publish" : "button-secondary"} type="button" onClick={() => setAngle(item)}>
            {item === "practical" ? (locale === "he" ? "מעשי" : "Practical") : item === "playful" ? (locale === "he" ? "קליל" : "Playful") : (locale === "he" ? "עיצובי" : "Design-led")}
          </button>
        ))}
      </div>
      <label htmlFor="why-picked">
        {locale === "he" ? "למה בחרתי בזה" : "Why I picked this"}
        <input id="why-picked" value={why} onChange={(event) => setWhy(event.target.value)} />
      </label>
      <label htmlFor="punchline">
        {locale === "he" ? "השורה" : "Line"}
        <textarea id="punchline" value={text} rows={3} onChange={(event) => { setText(event.target.value); setManual(true); }} onBlur={() => void saveManual()} />
      </label>
      <label htmlFor="disclosure">
        {locale === "he" ? "גילוי מסחרי" : "Commercial disclosure"}
        <input id="disclosure" value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <p className="hint">{disclosure(locale)}</p>
      {manual ? <p className="hint">{locale === "he" ? "העריכה שלך נשמרת עד שתבקש שורה אחרת." : "Your edit stays until you ask for another line."}</p> : null}
      <button className="button-secondary" type="button" onClick={() => void another()}>{locale === "he" ? "תנו לי אחרת" : "Give me another"}</button>
      <p className="status" role="status" aria-live="polite">{notice}</p>
      {salePath ? null : <p className="status">{locale === "he" ? "אחרי פרסום הקישור, השיתוף נפתח עם אותו קישור." : "After you publish, sharing uses that same link."}</p>}
      {composed && url ? (
        <div className="offer-actions">
          {(["whatsapp", "instagram", "facebook", "x", "copy"] as const).map((item) => (
            <button key={item} className={channel === item ? "button-publish" : "button-secondary"} type="button" onClick={() => setChannel(item)}>
              {item === "whatsapp" ? "WhatsApp" : item === "instagram" ? "Instagram" : item === "facebook" ? "Facebook" : item === "x" ? "X" : (locale === "he" ? "העתקת קישור" : "Copy link")}
            </button>
          ))}
          {channel === "whatsapp" ? <a className="button-publish" href={whatsAppHref(`${composed.text} ${url}`)} target="_blank" rel="noreferrer">{locale === "he" ? "פתיחת וואטסאפ" : "Open WhatsApp"}</a> : null}
          {channel === "instagram" ? (
            <>
              <button className="button-publish" type="button" onClick={() => void nativeStory()}>{locale === "he" ? "שמירת תמונת סטורי" : "Save Story image"}</button>
              <button className="button-secondary" type="button" onClick={() => void copy(url, locale === "he" ? "הקישור הועתק למדבקה." : "The link was copied for the sticker.")}>{locale === "he" ? "העתקת קישור למדבקה" : "Copy link for sticker"}</button>
            </>
          ) : null}
          {channel === "facebook" ? (
            <>
              <a className="button-publish" href={facebookHref(url)} target="_blank" rel="noreferrer">{locale === "he" ? "שיתוף הקישור בפייסבוק" : "Share the link on Facebook"}</a>
              <button className="button-secondary" type="button" onClick={() => void copy(composed.text, locale === "he" ? "הכיתוב הועתק." : "The caption was copied.")}>{locale === "he" ? "העתקת הכיתוב שלי" : "Copy my caption"}</button>
            </>
          ) : null}
          {channel === "x" && composed.limit !== null && composed.weight > composed.limit ? (
            <p className="status">{locale === "he" ? "הטקסט ארוך מדי ל־X. אפשר לקצר אותו." : "The copy is too long for X. Shorten it."}</p>
          ) : null}
          {channel === "x" && xHref(composed.text, url) ? (
            <a className="button-publish" href={xHref(composed.text, url) as string} target="_blank" rel="noreferrer">{locale === "he" ? "פתיחת X" : "Open X"}</a>
          ) : null}
          {channel === "copy" ? <button className="button-publish" type="button" onClick={() => void copy(url, locale === "he" ? "הקישור הועתק." : "The link was copied.")}>{locale === "he" ? "העתקת קישור" : "Copy link"}</button> : null}
        </div>
      ) : null}
    </section>
  );
}
