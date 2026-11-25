import type { PayState } from "./workflow.ts";
import { WEEKLY_POLICY } from "./flag.ts";
import { zonedParts, zonedToUtc } from "./time.ts";

export type WeeklyCutoff = { weekday: number; hour: number; minute: number };

export const DEFAULT_WEEKLY_CUTOFF: WeeklyCutoff = { weekday: 0, hour: 0, minute: 0 };

export type WeeklyLine = {
  orderId: string;
  creatorId: string;
  unitId: string;
  amount: number;
  freight: number;
};

export type WeeklyInstruction = {
  key: string;
  beneficiaryId: string;
  party: "supplier" | "creator";
  week: string;
  amount: number;
  lines: WeeklyLine[];
  instructionRef: string;
  bankRef: string | null;
  makerId?: string;
  status: "instructed" | "simulated" | "bank_paid";
  providerSubmission?: "none" | "pending";
  bankConfirmation?: "waiting" | "confirmed";
  withdrawalAmount?: number;
};

export type WeeklyOrder = {
  id: string;
  creatorId: string;
  state: PayState;
  providerAvailable?: boolean;
};

function weekStamp(now: number, cutoff: WeeklyCutoff): string {
  const instant = lastCutoff(now, cutoff);
  const parts = zonedParts(instant, "Asia/Jerusalem");
  const month = String(parts.m).padStart(2, "0");
  const day = String(parts.d).padStart(2, "0");
  return `${parts.y}-${month}-${day}`;
}

export function lastCutoff(now: number, cutoff: WeeklyCutoff = DEFAULT_WEEKLY_CUTOFF): number {
  const parts = zonedParts(now, "Asia/Jerusalem");
  const weekday = new Date(Date.UTC(parts.y, parts.m - 1, parts.d)).getUTCDay();
  let back = (weekday - cutoff.weekday + 7) % 7;
  const beforeCutoff = parts.hh < cutoff.hour || (parts.hh === cutoff.hour && parts.mm < cutoff.minute);
  if (back === 0 && beforeCutoff) back = 7;
  const shifted = new Date(Date.UTC(parts.y, parts.m - 1, parts.d - back));
  return zonedToUtc(
    { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth() + 1, d: shifted.getUTCDate(), hh: cutoff.hour, mm: cutoff.minute, ss: 0 },
    "Asia/Jerusalem",
  );
}

function eligibleUnits(order: WeeklyOrder, now: number, party: "supplier" | "creator", beneficiaryId: string) {
  if (order.state.policyVersion !== WEEKLY_POLICY || order.providerAvailable === false || order.state.status !== "captured") return [];
  return order.state.units.filter((unit) => {
    if (unit.refunded || unit.dispute === "open") return false;
    if (unit.stage !== "delivered" || unit.eligibleAt === null || now < unit.eligibleAt) return false;
    if (party === "supplier") return unit.supplierId === beneficiaryId && (unit.supplierTransfer === "none" || unit.supplierTransfer === "returned") && unit.supplierPayable > 0;
    return order.creatorId === beneficiaryId && (unit.creatorTransfer === "none" || unit.creatorTransfer === "returned") && unit.creatorPayable > 0;
  });
}

export function freightReleased(state: PayState): number {
  return state.units
    .filter((unit) => unit.stage === "delivered" || unit.stage === "returned")
    .reduce((sum, unit) => sum + unit.supplierFreight, 0);
}

export function freightWithinEntitlement(state: PayState): boolean {
  const entitled = state.units.reduce((sum, unit) => sum + unit.supplierFreight, 0);
  return freightReleased(state) <= entitled;
}

export function runWeeklyBatch(input: {
  orders: WeeklyOrder[];
  now: number;
  cutoff?: WeeklyCutoff;
  existing?: WeeklyInstruction[];
  lock?: Set<string>;
}): { instructions: WeeklyInstruction[]; created: WeeklyInstruction[]; replayed: string[] } {
  const cutoff = input.cutoff ?? DEFAULT_WEEKLY_CUTOFF;
  const week = weekStamp(input.now, cutoff);
  const existing = input.existing ?? [];
  const lock = input.lock ?? new Set<string>(existing.map((item) => item.key));
  const beneficiaries = new Map<string, { party: "supplier" | "creator"; id: string }>();
  for (const order of input.orders) {
    if (order.state.policyVersion !== WEEKLY_POLICY) continue;
    beneficiaries.set(`creator:${order.creatorId}`, { party: "creator", id: order.creatorId });
    for (const unit of order.state.units) beneficiaries.set(`supplier:${unit.supplierId}`, { party: "supplier", id: unit.supplierId });
  }
  const created: WeeklyInstruction[] = [];
  const replayed: string[] = [];
  for (const beneficiary of [...beneficiaries.values()].sort((left, right) => left.party.localeCompare(right.party) || left.id.localeCompare(right.id))) {
    const key = `${beneficiary.party}:${beneficiary.id}:${week}`;
    if (lock.has(key) || existing.some((item) => item.key === key)) {
      replayed.push(key);
      continue;
    }
    const lines: WeeklyLine[] = [];
    for (const order of input.orders) {
      for (const unit of eligibleUnits(order, input.now, beneficiary.party, beneficiary.id)) {
        lines.push({
          orderId: order.id,
          creatorId: order.creatorId,
          unitId: unit.id,
          amount: beneficiary.party === "supplier" ? unit.supplierPayable : unit.creatorPayable,
          freight: beneficiary.party === "supplier" ? unit.supplierFreight : 0,
        });
      }
    }
    const amount = lines.reduce((sum, line) => sum + line.amount, 0);
    const freight = lines.reduce((sum, line) => sum + line.freight, 0);
    const entitlement = input.orders
      .filter((order) => order.state.policyVersion === WEEKLY_POLICY)
      .flatMap((order) => order.state.units)
      .filter((unit) => beneficiary.party === "creator" || unit.supplierId === beneficiary.id)
      .reduce((sum, unit) => sum + unit.supplierFreight, 0);
    if (amount < 1 || freight > entitlement) continue;
    lock.add(key);
    created.push({
      key,
      beneficiaryId: beneficiary.id,
      party: beneficiary.party,
      week,
      amount,
      lines,
      instructionRef: `INST-${key}`,
      bankRef: null,
      status: "instructed",
      providerSubmission: "none",
      bankConfirmation: "waiting",
      withdrawalAmount: amount,
    });
  }
  return { instructions: [...existing, ...created], created, replayed };
}

export function confirmWeeklyBank(instructions: WeeklyInstruction[], key: string, bankRef: string, approverId?: string): WeeklyInstruction[] {
  return instructions.map((item) => {
    if (item.key !== key || item.status !== "instructed") return item;
    if (item.makerId && (!approverId || approverId === item.makerId)) return item;
    return { ...item, status: "bank_paid" as const, bankRef, bankConfirmation: "confirmed" as const };
  });
}

export function completeWeeklySimulation(instructions: WeeklyInstruction[], key: string): WeeklyInstruction[] {
  return instructions.map((item) =>
    item.key === key && item.status === "instructed"
      ? { ...item, status: "simulated", bankRef: null, providerSubmission: "none", bankConfirmation: "waiting" }
      : item,
  );
}
