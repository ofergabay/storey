import type { PayState, PayUnit } from "./workflow.ts";

export type PartyMoney = {
  pending: number;
  eligible: number;
  transferred: number;
  bankPaid: number;
  recovery: number;
};

export function buyerView(state: PayState): { charge: number; refundConfirmed: number; refundPending: number; checking: boolean } {
  return {
    charge: state.charge,
    refundConfirmed: state.buyerRefunded,
    refundPending: state.cancelIntent && state.status === "capture_unknown" ? state.charge : 0,
    checking: state.status === "checking" || state.status === "capture_unknown",
  };
}

export function creatorView(state: PayState, now: number): PartyMoney & { economic: number; commission: number; expected: number } {
  const open = state.units.filter((unit) => !unit.refunded);
  const economic = open.reduce((sum, unit) => sum + unit.creatorPayable, 0) - open.reduce((sum, unit) => sum + (unit.prepaid ? unit.wholesale : 0), 0);
  const commission = open.reduce((sum, unit) => sum + unit.creatorCommission, 0);
  const expected = open.reduce((sum, unit) => sum + unit.creatorPayable, 0);
  return { ...partyMoney(open, now, "creator"), economic, commission, expected, recovery: state.recovery.filter((row) => row.supplierId === "creator" && row.open).reduce((sum, row) => sum + row.amount, 0) };
}

export function supplierView(state: PayState, supplierId: string, now: number): PartyMoney & { commission: number; expected: number } {
  const open = state.units.filter((unit) => unit.supplierId === supplierId && !unit.refunded);
  const money = partyMoney(open, now, "supplier");
  return {
    ...money,
    commission: open.reduce((sum, unit) => sum + unit.supplierCommission, 0),
    expected: open.reduce((sum, unit) => sum + unit.supplierPayable, 0),
    recovery: state.recovery.filter((row) => row.supplierId === supplierId && row.open).reduce((sum, row) => sum + row.amount, 0),
  };
}

function partyMoney(units: PayUnit[], now: number, party: "supplier" | "creator"): PartyMoney {
  const amount = (unit: PayUnit) => (party === "supplier" ? unit.supplierPayable : unit.creatorPayable);
  const status = (unit: PayUnit) => (party === "supplier" ? unit.supplierTransfer : unit.creatorTransfer);
  let pending = 0;
  let eligible = 0;
  let transferred = 0;
  let bankPaid = 0;
  for (const unit of units) {
    const value = amount(unit);
    const transfer = status(unit);
    if (transfer === "bank_paid") bankPaid += value;
    else if (transfer === "claimed" || transfer === "transferred" || transfer === "bank_failed") transferred += value;
    else if (unit.stage === "delivered" && unit.eligibleAt !== null && now >= unit.eligibleAt) eligible += value;
    else pending += value;
  }
  return { pending, eligible, transferred, bankPaid, recovery: 0 };
}
