const DAY = 24 * 60 * 60 * 1000;
export const PAYOUT_HOLD_MS = 7 * DAY;

export function reviewPayout(input: {
  deliveredAt: number | null;
  now: number;
  amountAgorot: number;
  openCase: boolean;
}): { ok: false; code: "NOT_ELIGIBLE" | "BLOCKED_NO_PSP"; paid: false } {
  if (input.amountAgorot < 1 || input.openCase || input.deliveredAt === null) {
    return { ok: false, code: "NOT_ELIGIBLE", paid: false };
  }
  if (input.now < input.deliveredAt + PAYOUT_HOLD_MS) {
    return { ok: false, code: "NOT_ELIGIBLE", paid: false };
  }
  return { ok: false, code: "BLOCKED_NO_PSP", paid: false };
}
