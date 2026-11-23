import fs from "node:fs";
import path from "node:path";

export type FaqItem = {
  id: string;
  heQ: string;
  heA: string;
  enQ: string;
  enA: string;
};

export const defaultFaqs: FaqItem[] = [
  {
    id: "faq-margin",
    heQ: "איך עובד מודל הרווחים ומתי הכסף עובר אליי?",
    heA: "היוצר קובע את מחיר המכירה למארז. עלות הספק נשארת גלויה ליוצר, וההפרש הוא המרווח לפני עמלות. כשמופעלת מדיניות תשלום, הרווח הצפוי מחושב בשרת לפי אותה מדיניות ואינו מחירון מאושר. ההעברה לחשבון ממתינה לחיבור ספק סליקה. חשבונית נרשמת מול הזמנה שנסגרה.",
    enQ: "How do earnings work, and when is the money paid out?",
    enA: "The creator sets the pack price. The supplier cost stays visible to the creator, and the difference is the margin before fees. If a payment policy is on, expected profit is calculated on the server from that policy and is not an approved rate card. A payout waits until a payment provider is connected. An invoice is recorded against a closed order.",
  },
  {
    id: "faq-blind",
    heQ: "האם הלקוח רואה מי הספק ששלח את החבילה?",
    heA: "עמוד המכירה מציג את היוצר ואת המחיר ללקוח. שם הספק לא מופיע שם, והמשלוח יוצא בלי לחשוף את המחסן. בחנות מותג ובשותפות אפשר להוסיף אריזה ושפה של המותג כשהמסלול פתוח.",
    enQ: "Can the buyer see which supplier shipped the parcel?",
    enA: "The sale page shows the creator and the buyer price. The supplier name is not shown, and the shipment leaves without exposing the warehouse. A branded store and a partnership can add the brand’s packaging when that plan is open.",
  },
  {
    id: "faq-supplier",
    heQ: "איך ספקים מתחברים ומנהלים את המלאי וההזמנות?",
    heA: "ספק מגיש בקשת הצטרפות. אחרי אישור הוא מסנכרן קטלוג ומלאי, ורואה תור ליקוט ואריזה. התווית לא חושפת את זהות הספק ללקוח, ואין במערכת רכישת משלוח מחברת הובלה. החזרות נכנסות למסך החזרות ובקרת איכות.",
    enQ: "How do suppliers join and run stock and orders?",
    enA: "A supplier applies to join. After approval they sync catalog and stock and work from the pick-and-pack queue. The label does not reveal the supplier to the buyer, and the app does not buy a carrier label. Returns go to the returns and quality screen.",
  },
  {
    id: "faq-plans",
    heQ: "מה ההבדל בין מכירה חברתית, חנות מותג ומסלול שותפות?",
    heA: "מכירה חברתית היא קישור מהקטלוג המשותף, בלי חנות פרטית ובלי שריון מלאי, ונפתחת בלי חיוב. חנות מותג מוסיפה חנות בשם של היוצר ושריון מלאי לקמפיין. שותפות מוסיפה מלאי שמור אצל הספק ואריזה לפי הסכם. המחיר החודשי של חנות מותג ושל שותפות עדיין לא אושר.",
    enQ: "What is the difference between social selling, a branded store, and partnership?",
    enA: "Social selling is a link from the shared catalog, without a private store and without reserved stock, and it opens at no charge. A branded store adds a store in the creator’s name and campaign stock. Partnership adds stock held at the supplier and packaging by agreement. The monthly price of the branded store and partnership is not approved yet.",
  },
  {
    id: "faq-returns",
    heQ: "מי מטפל בהחזרות, ביטולים ושירות לקוחות?",
    heA: "בקשת החזר נרשמת על ההזמנה. הספק בודק את הפריט במחסן. מחלוקת עולה למסך הניהול. אין במערכת החזר כסף חי לפני שספק הסליקה מחובר.",
    enQ: "Who handles returns, cancellations, and customer care?",
    enA: "A return request is recorded on the order. The supplier checks the item in the warehouse. A dispute goes to the admin screen. The app does not send a live refund before a payment provider is connected.",
  },
];

const filePath = path.join(process.cwd(), "data", "landing-faq.json");

export function readLandingFaq(): FaqItem[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
    if (!Array.isArray(parsed)) return defaultFaqs;
    const items = parsed.filter(isFaqItem);
    return items.length > 0 ? items : defaultFaqs;
  } catch {
    return defaultFaqs;
  }
}

export function writeLandingFaq(items: FaqItem[]): { ok: true } | { ok: false; message: string } {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(items, null, 2)}\n`, "utf8");
    return { ok: true };
  } catch {
    return { ok: false, message: "שמירת השאלות נכשלה. הקובץ לא נכתב." };
  }
}

export function isFaqItem(value: unknown): value is FaqItem {
  if (!value || typeof value !== "object") return false;
  const item = value as FaqItem;
  return [item.id, item.heQ, item.heA, item.enQ, item.enA].every((field) => typeof field === "string" && field.trim().length > 1);
}

export function cleanFaqDraft(input: Omit<FaqItem, "id"> & { id?: string }): FaqItem | null {
  const item = {
    id: input.id?.trim() || "",
    heQ: input.heQ.trim(),
    heA: input.heA.trim(),
    enQ: input.enQ.trim(),
    enA: input.enA.trim(),
  };
  return isFaqItem(item) ? item : null;
}
