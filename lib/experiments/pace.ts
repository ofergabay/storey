import { addLocalDays, zonedParts, zonedToUtc } from "../commerce/payment/time.ts";

export type PaceScenario = {
  multiplier: 1 | 2 | 3;
  ordersPerWeek: number;
  monthlyAgorot: number;
  annualAgorot: number;
};

export type PaceReport = {
  observedDays: number;
  deliveredOrders: number;
  netAgorot: number;
  ordersPerWeek: number;
  averageAgorot: number | null;
  early: boolean;
  negative: boolean;
  scenarios: PaceScenario[] | null;
};

export function observedDays(firstAt: number, asOf: number): number {
  const start = zonedParts(firstAt, "Asia/Jerusalem");
  const end = zonedParts(asOf, "Asia/Jerusalem");
  const span = Math.floor((Date.UTC(end.y, end.m - 1, end.d) - Date.UTC(start.y, start.m - 1, start.d)) / 86_400_000) + 1;
  return Math.min(30, Math.max(1, span));
}

export function paceReport(input: { deliveredOrders: number; netAgorot: number; observedDays: number }): PaceReport {
  const days = Math.min(30, Math.max(1, Math.floor(input.observedDays)));
  const orders = Math.max(0, input.deliveredOrders);
  const net = input.netAgorot;
  const ordersPerWeek = (orders / days) * 7;
  const average = orders > 0 ? net / orders : null;
  const early = orders === 1 || days < 7;
  const negative = net < 0;
  const scenarios = orders === 0 || negative ? null : ([1, 2, 3] as const).map((multiplier) => {
    const annual = (net / days) * 365 * multiplier;
    return { multiplier, ordersPerWeek: ordersPerWeek * multiplier, monthlyAgorot: annual / 12, annualAgorot: annual };
  });
  return { observedDays: days, deliveredOrders: orders, netAgorot: net, ordersPerWeek, averageAgorot: average, early, negative, scenarios };
}

export function displayShekelAgorot(unroundedAgorot: number): number {
  return Math.round(unroundedAgorot / 100) * 100;
}

export function formatPaceShekels(unroundedAgorot: number): string {
  const shekels = Math.round(unroundedAgorot / 100);
  const sign = shekels < 0 ? "-" : "";
  return `${sign}₪${new Intl.NumberFormat("en-US").format(Math.abs(shekels))}`;
}

export function paceWindow(firstPublishedAt: number, asOf: number): { days: number; start: number } {
  const days = observedDays(firstPublishedAt, asOf);
  const end = zonedParts(asOf, "Asia/Jerusalem");
  const endStart = zonedToUtc({ y: end.y, m: end.m, d: end.d, hh: 0, mm: 0, ss: 0 }, "Asia/Jerusalem");
  return { days, start: addLocalDays(endStart, -(days - 1), "Asia/Jerusalem") };
}

export function orderContribution(units: { deliveredAt: number | null; refunded: boolean; creatorPayable: number }[]): { counts: boolean; netAgorot: number } {
  const delivered = units.filter((unit) => unit.deliveredAt !== null);
  if (delivered.length === 0) return { counts: false, netAgorot: 0 };
  return {
    counts: true,
    netAgorot: delivered.reduce((sum, unit) => sum + (unit.refunded ? 0 : unit.creatorPayable), 0),
  };
}

export function countsForPace(order: { id: string; status: string; paymentNote?: string | null; previewSale?: boolean }): boolean {
  if (order.previewSale || order.status === "cancelled" || order.status === "failed") return false;
  const note = (order.paymentNote ?? "").toLowerCase();
  if (order.id.toLowerCase().includes("self") || note.includes("test") || note.includes("self")) return false;
  return true;
}

export function claimRecap(seen: Set<string>, creatorId: string): "new" | "replay" {
  const key = `first-delivery:${creatorId}`;
  if (seen.has(key)) return "replay";
  seen.add(key);
  return "new";
}

export function shippingNotice(input: { available: boolean; previousHash: string | null; nextHash: string | null }): string | null {
  if (!input.available) return "אין הצעת משלוח ליעד הזה. אי אפשר להמשיך לתשלום לפני שיש יעד נתמך.";
  if (input.previousHash && input.nextHash && input.previousHash !== input.nextHash) {
    return "המשלוח או המלאי השתנו. הסכום המעודכן מוצג לפני הרכישה.";
  }
  return null;
}

export function freshCampaignId(existing: string[], now: number): string {
  let sequence = 0;
  let id = `camp-${now}`;
  while (existing.includes(id)) {
    sequence += 1;
    id = `camp-${now}-${sequence}`;
  }
  return id;
}
