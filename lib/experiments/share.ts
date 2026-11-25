export type ShareLocale = "he" | "en";
export type ShareAngle = "practical" | "playful" | "design";
export type ShareChannel = "whatsapp" | "instagram" | "facebook" | "x" | "copy";

export type OfferFacts = {
  title: string;
  quantityLabel: string;
  verifiedGuestCount: number | null;
};

const DISCLOSURE = {
  he: "קישור שיווקי. ייתכן שאקבל עמלה אם תרכוש.",
  en: "Commercial link. I may earn a commission if you buy.",
} as const;

export function disclosure(locale: ShareLocale): string {
  return DISCLOSURE[locale];
}

export function guestLabel(count: number | null, locale: ShareLocale): string | null {
  if (count === null || !Number.isInteger(count) || count < 1) return null;
  return locale === "he" ? `מתאים ל-${count}` : `Serves ${count}`;
}

export function normalizeLine(line: string): string {
  return line
    .toLowerCase()
    .replace(/[\p{Extended_Pictographic}\u200d]/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tooSimilar(left: string, right: string): boolean {
  const a = new Set(normalizeLine(left).split(" ").filter((word) => word.length > 2));
  const b = new Set(normalizeLine(right).split(" ").filter((word) => word.length > 2));
  if (a.size === 0 || b.size === 0) return normalizeLine(left) === normalizeLine(right);
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  const union = a.size + b.size - shared;
  return shared / union >= 0.72;
}

const PRACTICAL_HE = [
  "הכמות במארז כבר סגורה. נשאר להזמין אנשים.",
  "בלי רשימת קניות נפרדת. המארז כולל את מה שכתוב בקטלוג.",
  "סופרים לפי המארז, לא לפי מדף בחנות.",
];
const PLAYFUL_HE = [
  "השולחן מקבל מארז אחד במקום סיבוב בין חנויות.",
  "פחות החלטות קטנות, יותר מקום לשיחה.",
  "המארז עושה את הסדר, האורחים מביאים את הרעש.",
];
const DESIGN_HE = [
  "מארז אחד, שפה אחת, בלי להתאים כל פריט בנפרד.",
  "השולחן נראה אחיד כי הפריטים כבר נבחרו יחד.",
  "בלי תרגיל התאמה. המארז מגיע כסט מהקטלוג.",
];
const PRACTICAL_EN = [
  "The kit quantity is already decided. What remains is the guest list.",
  "No separate shopping list. The kit is what the catalog states.",
  "Count from the kit, not from a store aisle.",
];
const PLAYFUL_EN = [
  "One kit for the table, instead of a lap around the shops.",
  "Fewer small decisions, more room for the conversation.",
  "The kit handles the setup. The guests handle the noise.",
];
const DESIGN_EN = [
  "One kit, one visual language, without matching each piece.",
  "The table looks consistent because the pieces were chosen together.",
  "No matching exercise. The catalog kit already arrives as a set.",
];

function pool(locale: ShareLocale, angle: ShareAngle): string[] {
  if (locale === "he" && angle === "practical") return PRACTICAL_HE;
  if (locale === "he" && angle === "playful") return PLAYFUL_HE;
  if (locale === "he") return DESIGN_HE;
  if (angle === "practical") return PRACTICAL_EN;
  if (angle === "playful") return PLAYFUL_EN;
  return DESIGN_EN;
}

export function suggestPunchline(input: {
  creatorId: string;
  productKey: string;
  locale: ShareLocale;
  angle: ShareAngle;
  why: string;
  facts: OfferFacts;
  taken: string[];
  attempt: number;
}): { text: string | null; normalized: string | null; exhausted: boolean } {
  const lines = pool(input.locale, input.angle);
  const why = input.why.trim();
  const guests = guestLabel(input.facts.verifiedGuestCount, input.locale);
  const fact = guests ?? input.facts.quantityLabel;
  for (let offset = 0; offset < lines.length; offset += 1) {
    const base = lines[(hashIndex(input.creatorId, input.productKey, input.attempt) + offset) % lines.length] ?? lines[0];
    const whyClause = why.length > 0 ? (input.locale === "he" ? ` ${why}` : ` ${why}`) : "";
    const text = `${fact}. ${base}${whyClause}`.replace(/\s+/g, " ").trim();
    const normalized = normalizeLine(text);
    if (input.taken.some((line) => line === normalized || tooSimilar(line, text))) continue;
    return { text, normalized, exhausted: false };
  }
  return { text: null, normalized: null, exhausted: true };
}

export function claimPunchline(input: Parameters<typeof suggestPunchline>[0], claimed: Set<string>): ReturnType<typeof suggestPunchline> {
  const next = suggestPunchline({ ...input, taken: [...input.taken, ...claimed] });
  if (next.normalized) claimed.add(next.normalized);
  return next;
}

function hashIndex(creatorId: string, productKey: string, attempt: number): number {
  return [...`${creatorId}|${productKey}|${attempt}`].reduce((sum, char) => sum + (char.codePointAt(0) ?? 0), 0);
}

export function channelText(input: { core: string; locale: ShareLocale; channel: ShareChannel; url: string; disclosureText?: string }): { text: string; limit: number | null; weight: number } {
  const note = input.disclosureText?.trim() || disclosure(input.locale);
  const cta = input.channel === "x"
    ? input.locale === "he" ? "הקישור בציוץ." : "Link in the post."
    : input.locale === "he" ? "הקישור כאן." : "The link is here.";
  const text = input.channel === "instagram" ? `${input.core}` : `${input.core} ${cta} ${note}`;
  const limit = input.channel === "x" ? 280 : null;
  const weight = input.channel === "x" ? xWeight(text, input.url) : [...text].length;
  return { text, limit, weight };
}

export function xWeight(text: string, url: string): number {
  const body = text.includes(url) ? text.replace(url, "") : text;
  return [...body].length + 1 + 23;
}

export function whatsAppHref(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function facebookHref(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}

export function xHref(text: string, url: string): string | null {
  if (xWeight(text, url) > 280) return null;
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

export function storySvg(input: { title: string; line: string }): string {
  const title = escapeXml(input.title);
  const line = escapeXml(input.line);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920"><rect width="1080" height="1920" fill="#eff5fc"/><text x="80" y="860" fill="#0b1f44" font-size="64" font-family="Rubik, sans-serif">${title}</text><text x="80" y="980" fill="#0b1f44" font-size="42" font-family="Rubik, sans-serif">${line}</text></svg>`;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char);
}

export function qualifiedVisit(input: { userAgent: string; creatorPreview: boolean }): boolean {
  if (input.creatorPreview) return false;
  return !/facebookexternalhit|facebot|whatsapp|twitterbot|telegrambot|slackbot|linkedinbot|pinterest|googlebot|bingbot|preview/i.test(input.userAgent);
}

export function listingPreview(input: {
  previewQuery: boolean;
  viewerRole: string;
  viewerId: string | null;
  viewerHandle: string | null;
  sellerId: string;
  sellerHandle: string;
}): boolean {
  if (input.previewQuery) return true;
  if (input.viewerRole === "admin" || input.viewerRole === "supplier") return true;
  if (input.viewerId !== null && input.viewerId === input.sellerId) return true;
  return input.viewerRole === "creator" && input.viewerHandle === input.sellerHandle;
}

export function trackedPath(path: string, input: { creator: string; offer: string; campaign: string; channel: ShareChannel }): string {
  const url = new URL(path, "https://storey.local");
  url.searchParams.set("c", input.creator);
  url.searchParams.set("o", input.offer);
  url.searchParams.set("k", input.campaign);
  url.searchParams.set("ch", input.channel);
  return `${url.pathname}${url.search}`;
}
