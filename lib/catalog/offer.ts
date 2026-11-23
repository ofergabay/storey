import { formatShekels } from "../money.ts";

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
