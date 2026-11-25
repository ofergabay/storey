import type { StockState } from "@/lib/catalog/model";
import type { ShippingSnapshot } from "@/lib/commerce/payment/shipping-quote";

export const HOLD_MS = 10 * 60 * 1000;

export type StagedItem = {
  id: string;
  sku: string;
  titleHe: string;
  titleEn: string;
  packSize: number;
  unit: string;
  costAgorot: number;
  warehouseCode: string;
  state: "unreviewed" | "ignored" | "approved";
};

export type WorkOrder = {
  id: string;
  token: string;
  sku: string;
  sellerHandle: string;
  quantity: number;
  unitAgorot: number;
  warehouseCode: string;
  status: "held" | "sandbox_paid" | "picking" | "packed" | "labeled" | "dispatched" | "failed" | "cancelled";
  previewSale?: boolean;
  holdExpiresAt: string;
  tracking: string | null;
  policyVersion?: "original-2026-11" | "pay-2026-11" | "weekly-2026-11";
  paymentCaseId?: string | null;
  paymentNote?: string | null;
  shippingSnapshot?: ShippingSnapshot;
  attribution?: { creator: string; offer: string; campaign: string; channel: string } | null;
};

export type ReturnCase = {
  id: string;
  orderId: string;
  quantity: number;
  status: "requested" | "received" | "reconciled";
  restore: number;
};

export type CartLine = {
  sellerHandle: string;
  slug: string;
  quantity: number;
};

export function sellable(state: StockState | undefined): number {
  if (!state || state.halted || state.sequence < 1) return 0;
  return Math.max(0, state.onHand - state.held);
}

export function reserveHold(
  stock: StockState[],
  input: { sku: string; warehouseCode: string; quantity: number; now: number },
): { ok: true; stock: StockState[] } | { ok: false; code: "STOCK_CHANGED" | "UNAVAILABLE"; stock: StockState[] } {
  const state = stock.find((item) => item.sku === input.sku && item.warehouseCode === input.warehouseCode);
  if (!state || sellable(state) < input.quantity || input.quantity < 1) {
    return { ok: false, code: state ? "STOCK_CHANGED" : "UNAVAILABLE", stock };
  }
  return {
    ok: true,
    stock: stock.map((item) =>
      item === state ? { ...item, held: item.held + input.quantity } : item,
    ),
  };
}

export function releaseHold(
  stock: StockState[],
  input: { sku: string; warehouseCode: string; quantity: number },
): StockState[] {
  return stock.map((item) =>
    item.sku === input.sku && item.warehouseCode === input.warehouseCode
      ? { ...item, held: Math.max(0, item.held - input.quantity) }
      : item,
  );
}

export function dispatchUnits(
  stock: StockState[],
  input: { sku: string; warehouseCode: string; quantity: number },
): { ok: true; stock: StockState[] } | { ok: false; code: "QUANTITY"; stock: StockState[] } {
  const state = stock.find((item) => item.sku === input.sku && item.warehouseCode === input.warehouseCode);
  if (!state || state.held < input.quantity || state.onHand < input.quantity) {
    return { ok: false, code: "QUANTITY", stock };
  }
  return {
    ok: true,
    stock: stock.map((item) =>
      item === state
        ? { ...item, held: item.held - input.quantity, onHand: item.onHand - input.quantity }
        : item,
    ),
  };
}

const steps = ["sandbox_paid", "picking", "packed", "labeled", "dispatched"] as const;

export function nextFulfillment(status: WorkOrder["status"]): WorkOrder["status"] | null {
  const index = steps.indexOf(status as (typeof steps)[number]);
  if (index < 0 || index === steps.length - 1) return null;
  return steps[index + 1];
}

export function openReturn(order: WorkOrder, already: number, quantity: number): { ok: true } | { ok: false; code: "QUANTITY" | "NOT_DELIVERED" } {
  if (order.status !== "dispatched") return { ok: false, code: "NOT_DELIVERED" };
  if (quantity < 1 || already + quantity > order.quantity) return { ok: false, code: "QUANTITY" };
  return { ok: true };
}
