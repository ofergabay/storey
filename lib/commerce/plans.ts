export type PlanCode = "social" | "branded" | "scale";

export type PlanVersion = {
  code: PlanCode;
  nameHe: string;
  priceAgorot: number | null;
  canPublish: boolean;
  canCampaign: boolean;
  canDedicate: boolean;
};

export const developmentPlans: PlanVersion[] = [
  {
    code: "social",
    nameHe: "מכירה חברתית",
    priceAgorot: 0,
    canPublish: true,
    canCampaign: false,
    canDedicate: false,
  },
  {
    code: "branded",
    nameHe: "חנות מותג",
    priceAgorot: null,
    canPublish: true,
    canCampaign: true,
    canDedicate: false,
  },
  {
    code: "scale",
    nameHe: "שותפות",
    priceAgorot: null,
    canPublish: true,
    canCampaign: true,
    canDedicate: true,
  },
];

export type Subscription = {
  sellerId: string;
  plan: PlanVersion;
  status: "active" | "past_due" | "cancelled";
  paidThrough: number | null;
  pastDueSince: number | null;
};

export type SellerPlanView = {
  installed: boolean;
  canPublish: boolean;
  code: PlanCode;
  nameHe: string;
  priceAgorot: number | null;
  organizationName: string | null;
};

export function planCodeFromName(nameHe: string): PlanCode {
  const named = developmentPlans.find((plan) => plan.nameHe === nameHe);
  if (named) return named.code;
  if (nameHe.includes("שותפ")) return "scale";
  if (nameHe.includes("מותג")) return "branded";
  return "social";
}

const hour = 60 * 60 * 1000;
export const PAST_DUE_BLOCK_MS = 72 * hour;

export function developmentPlanView(): SellerPlanView {
  const social = developmentPlans[0];
  return {
    installed: false,
    canPublish: true,
    code: social.code,
    nameHe: social.nameHe,
    priceAgorot: social.priceAgorot,
    organizationName: "מאיה לוי",
  };
}

export function activatePlan(
  sellerId: string,
  plan: PlanVersion,
  prior: Subscription | null,
):
  | { ok: true; subscription: Subscription; chargedAgorot: 0 }
  | { ok: false; code: "RATE_UNCONFIGURED" | "BLOCKED_NO_PSP"; subscription: Subscription | null } {
  if (plan.priceAgorot === null) return { ok: false, code: "RATE_UNCONFIGURED", subscription: prior };
  if (plan.priceAgorot > 0) return { ok: false, code: "BLOCKED_NO_PSP", subscription: prior };
  return {
    ok: true,
    chargedAgorot: 0,
    subscription: {
      sellerId,
      plan,
      status: "active",
      paidThrough: null,
      pastDueSince: null,
    },
  };
}

export function featureAllowed(
  subscription: Subscription | null,
  feature: "publish" | "campaign" | "dedicate" | "checkout",
  now: number,
): { ok: true } | { ok: false; code: "PLAN_REQUIRED" | "FEATURE_UNAVAILABLE" | "PAST_DUE" } {
  if (!subscription || subscription.status === "cancelled") return { ok: false, code: "PLAN_REQUIRED" };
  if (
    subscription.status === "past_due" &&
    subscription.pastDueSince !== null &&
    now >= subscription.pastDueSince + PAST_DUE_BLOCK_MS &&
    (feature === "checkout" || feature === "campaign")
  ) {
    return { ok: false, code: "PAST_DUE" };
  }
  const enabled =
    feature === "publish"
      ? subscription.plan.canPublish
      : feature === "campaign"
        ? subscription.plan.canCampaign
        : feature === "dedicate"
          ? subscription.plan.canDedicate
          : true;
  if (!enabled) return { ok: false, code: "FEATURE_UNAVAILABLE" };
  if (feature === "publish" && subscription.plan.priceAgorot !== 0) {
    return { ok: false, code: "FEATURE_UNAVAILABLE" };
  }
  return { ok: true };
}

export function quoteUpgrade(
  prior: PlanVersion,
  next: PlanVersion,
  remainingSeconds: number,
  cycleSeconds: number,
): { ok: true; amountAgorot: number } | { ok: false; code: "RATE_UNCONFIGURED" } {
  if (prior.priceAgorot === null || next.priceAgorot === null || cycleSeconds <= 0) {
    return { ok: false, code: "RATE_UNCONFIGURED" };
  }
  const amount = Math.round((remainingSeconds / cycleSeconds) * (next.priceAgorot - prior.priceAgorot));
  return { ok: true, amountAgorot: amount };
}

export function applyUpgrade(
  prior: Subscription,
  next: PlanVersion,
  payment: "confirmed" | "abandoned",
): Subscription {
  if (payment !== "confirmed" || next.priceAgorot === null || next.priceAgorot > 0) return prior;
  return { ...prior, plan: next };
}

export function customerPrice(record: { publishedAgorot: number | null; draftAgorot: number }): number | null {
  return record.publishedAgorot;
}

export function scheduleDowngrade(paidThrough: number, next: PlanVersion): { effectiveAt: number; next: PlanVersion } {
  return { effectiveAt: paidThrough, next };
}

export function applyScheduledPlan(subscription: Subscription, next: PlanVersion, now: number, effectiveAt: number): Subscription {
  if (now < effectiveAt) return subscription;
  return { ...subscription, plan: next };
}
