import { priceQuote, testRates } from "../commerce/payment/calculate.ts";
import { PAYMENT_POLICY, type PolicyVersion } from "../commerce/payment/flag.ts";
import { formatMarginRatio, formatShekelAfter, formatShekels } from "../money.ts";
import { grossMarginRatio, grossProfitAgorot } from "../pricing.ts";

export type PackEarnings = {
  label: "מרווח לפני עמלות" | "הרווח הצפוי שלך למארז";
  amount: string;
  hint: string;
};

export function packEarnings(retailAgorot: number, wholesaleAgorot: number, policy: PolicyVersion): PackEarnings | null {
  if (retailAgorot <= 0 || retailAgorot < wholesaleAgorot) return null;
  const margin = grossProfitAgorot(retailAgorot, wholesaleAgorot);
  const ratio = grossMarginRatio(retailAgorot, wholesaleAgorot);
  const marginText = ratio === null ? formatShekelAfter(margin) : `${formatShekelAfter(margin)} (${formatMarginRatio(ratio)})`;
  if (policy !== PAYMENT_POLICY) {
    return {
      label: "מרווח לפני עמלות",
      amount: marginText,
      hint: "ההפרש בין מחיר המכירה לעלות. עמלת היוצר/ת להצעה הזו עדיין לא נקבעה.",
    };
  }
  const quote = priceQuote({
    ...testRates(),
    discountAgorot: 0,
    buyerFeeAgorot: 0,
    pspFeeAgorot: 0,
    services: [],
    lines: [
      {
        id: "pack",
        supplierId: "catalog",
        sku: "pack",
        quantity: 1,
        prepaidQuantity: 0,
        unitRetailAgorot: retailAgorot,
        unitWholesaleAgorot: wholesaleAgorot,
        taxAgorot: 0,
        serviceGroup: "pack",
      },
    ],
  });
  if (!quote.ok) return { label: "מרווח לפני עמלות", amount: marginText, hint: "ההפרש בין מחיר המכירה לעלות. עמלת היוצר/ת להצעה הזו עדיין לא נקבעה." };
  return {
    label: "הרווח הצפוי שלך למארז",
    amount: formatShekelAfter(quote.allocation.creatorPayable),
    hint: "אחרי עמלת היוצר/ת במדיניות שחלה על ההצעה. שיעור הבדיקה אינו מחירון מאושר.",
  };
}

export type OfferAction = "publish" | "publish-changes" | "copy" | "resume";

export function offerControls(input: {
  publishedAgorot: number;
  currentAgorot: number | null;
  copyChanged: boolean;
  synced: boolean;
  paused: boolean;
  justUpdated: boolean;
}): { action: OfferAction; status: string; share: boolean } {
  if (input.publishedAgorot <= 0) {
    return { action: "publish", status: "טיוטה · טרם פורסמה", share: false };
  }
  if (input.paused) {
    return {
      action: "resume",
      status: "המכירה מושהית. הקישור לא מציג את המוצר.",
      share: false,
    };
  }

  const priceChanged = input.currentAgorot !== null && input.currentAgorot !== input.publishedAgorot;
  if (priceChanged || input.copyChanged) {
    const shown = formatShekels(input.publishedAgorot);
    const status = priceChanged
      ? input.synced
        ? `המחיר החדש נשמר בטיוטה. בעמוד המכירה עדיין מוצג ${shown}.`
        : `בעמוד המכירה עדיין מוצג ${shown}.`
      : input.synced
        ? "השינויים נשמרו בטיוטה. עמוד המכירה עדיין מציג את הגרסה שפורסמה."
        : "בעמוד המכירה עדיין מוצגת הגרסה שפורסמה.";
    return { action: "publish-changes", status, share: true };
  }
  if (input.justUpdated) {
    return { action: "copy", status: "המחיר עודכן. קישור המכירה נשאר זהה.", share: true };
  }
  return { action: "copy", status: "עמוד המכירה פעיל", share: true };
}

export function offerActionLabel(action: OfferAction): string {
  if (action === "publish") return "פרסום וקבלת קישור";
  if (action === "publish-changes") return "פרסום השינויים";
  if (action === "resume") return "המשך המכירה";
  return "העתקת קישור המכירה";
}
