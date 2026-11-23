import { PAYMENT_POLICY, TEST_CREATOR_BPS, TEST_SUPPLIER_BPS } from "./flag.ts";
import { allocateLargestRemainder, applyBps } from "./round.ts";

export type QuoteLine = {
  id: string;
  supplierId: string;
  sku: string;
  quantity: number;
  unitRetailAgorot: number;
  unitWholesaleAgorot: number;
  prepaidQuantity: number;
  serviceGroup: string;
  taxAgorot: number;
};

export type ServiceGroupInput = {
  id: string;
  buyerFreightAgorot: number;
  supplierFreightAgorot: number;
  packingAgorot: number;
};

export type QuoteInput = {
  currency: "ILS";
  lines: QuoteLine[];
  services: ServiceGroupInput[];
  buyerFeeAgorot: number;
  discountAgorot: number;
  pspFeeAgorot: number;
  supplierBps: number;
  creatorBps: number;
  taxDetermined: boolean;
  stockFresh: boolean;
  setupApproved: boolean;
};

export type BlockCode = "MISSING_TAX" | "MIXED_CURRENCY" | "NEGATIVE_PROCEEDS" | "STALE_STOCK" | "UNAPPROVED_SETUP" | "INVALID";

export type UnitSlice = {
  id: string;
  lineId: string;
  supplierId: string;
  sku: string;
  ordinal: number;
  prepaid: boolean;
  serviceGroup: string;
  retail: number;
  wholesale: number;
  payableWholesale: number;
  supplierCommission: number;
  creatorCommission: number;
  buyerFreight: number;
  supplierFreight: number;
  packing: number;
  buyerFee: number;
  tax: number;
  supplierPayable: number;
  creatorPayable: number;
  storeyGross: number;
};

export type Allocation = {
  policyVersion: typeof PAYMENT_POLICY;
  supplierBps: number;
  creatorBps: number;
  currency: "ILS";
  charge: number;
  retail: number;
  wholesale: number;
  payableWholesale: number;
  supplierCommission: number;
  creatorCommission: number;
  buyerFreight: number;
  supplierFreight: number;
  packing: number;
  buyerFee: number;
  tax: number;
  supplierPayable: number;
  creatorPayable: number;
  storeyGross: number;
  pspFee: number;
  storeyNet: number;
  prepaidCost: number;
  creatorEconomic: number;
  units: UnitSlice[];
  bySupplier: { supplierId: string; payable: number }[];
};

export function testRates(): Pick<QuoteInput, "supplierBps" | "creatorBps" | "currency" | "taxDetermined" | "stockFresh" | "setupApproved"> {
  return {
    supplierBps: TEST_SUPPLIER_BPS,
    creatorBps: TEST_CREATOR_BPS,
    currency: "ILS",
    taxDetermined: true,
    stockFresh: true,
    setupApproved: true,
  };
}

export function priceQuote(input: QuoteInput): { ok: true; allocation: Allocation } | { ok: false; code: BlockCode } {
  if (input.currency !== "ILS") return { ok: false, code: "MIXED_CURRENCY" };
  if (!input.taxDetermined) return { ok: false, code: "MISSING_TAX" };
  if (!input.stockFresh) return { ok: false, code: "STALE_STOCK" };
  if (!input.setupApproved) return { ok: false, code: "UNAPPROVED_SETUP" };
  if (input.discountAgorot < 0 || input.pspFeeAgorot < 0 || input.buyerFeeAgorot < 0) return { ok: false, code: "INVALID" };
  for (const line of input.lines) {
    if (line.quantity < 1 || line.prepaidQuantity < 0 || line.prepaidQuantity > line.quantity) return { ok: false, code: "INVALID" };
    if (line.unitRetailAgorot < 0 || line.unitWholesaleAgorot < 0 || line.taxAgorot < 0) return { ok: false, code: "INVALID" };
  }

  const gross = input.lines.map((line) => ({ id: line.id, weight: line.quantity * line.unitRetailAgorot }));
  const grossTotal = gross.reduce((sum, line) => sum + line.weight, 0);
  if (input.discountAgorot > grossTotal) return { ok: false, code: "INVALID" };
  const lineDiscount = allocateLargestRemainder(input.discountAgorot, gross);

  const units: UnitSlice[] = [];
  for (const line of [...input.lines].sort((left, right) => left.id.localeCompare(right.id))) {
    const discount = lineDiscount.get(line.id) ?? 0;
    const preDiscount = line.quantity * line.unitRetailAgorot;
    const net = preDiscount - discount;
    if (net < line.quantity * line.unitWholesaleAgorot) return { ok: false, code: "NEGATIVE_PROCEEDS" };
    const retailByUnit = allocateLargestRemainder(net, Array.from({ length: line.quantity }, (_, index) => ({ id: `${line.id}#${index + 1}`, weight: line.unitRetailAgorot })));
    const payableWholesale = (line.quantity - line.prepaidQuantity) * line.unitWholesaleAgorot;
    const margin = net - line.quantity * line.unitWholesaleAgorot;
    const supplierCommission = applyBps(payableWholesale, input.supplierBps);
    const creatorCommission = applyBps(margin, input.creatorBps);
    const payableOrdinals = Array.from({ length: line.quantity }, (_, index) => index + 1).filter((ordinal) => ordinal > line.prepaidQuantity);
    const supplierByUnit = allocateLargestRemainder(
      supplierCommission,
      payableOrdinals.map((ordinal) => ({ id: `${line.id}#${ordinal}`, weight: line.unitWholesaleAgorot })),
    );
    const creatorByUnit = allocateLargestRemainder(
      creatorCommission,
      Array.from({ length: line.quantity }, (_, index) => ({ id: `${line.id}#${index + 1}`, weight: Math.max(0, (retailByUnit.get(`${line.id}#${index + 1}`) ?? 0) - line.unitWholesaleAgorot) })),
    );
    const taxByUnit = allocateLargestRemainder(
      line.taxAgorot,
      Array.from({ length: line.quantity }, (_, index) => ({ id: `${line.id}#${index + 1}`, weight: 1 })),
    );
    for (let ordinal = 1; ordinal <= line.quantity; ordinal += 1) {
      const id = `${line.id}#${ordinal}`;
      const prepaid = ordinal <= line.prepaidQuantity;
      units.push({
        id,
        lineId: line.id,
        supplierId: line.supplierId,
        sku: line.sku,
        ordinal,
        prepaid,
        serviceGroup: line.serviceGroup,
        retail: retailByUnit.get(id) ?? 0,
        wholesale: line.unitWholesaleAgorot,
        payableWholesale: prepaid ? 0 : line.unitWholesaleAgorot,
        supplierCommission: supplierByUnit.get(id) ?? 0,
        creatorCommission: creatorByUnit.get(id) ?? 0,
        buyerFreight: 0,
        supplierFreight: 0,
        packing: 0,
        buyerFee: 0,
        tax: taxByUnit.get(id) ?? 0,
        supplierPayable: 0,
        creatorPayable: 0,
        storeyGross: 0,
      });
    }
  }

  const feeByUnit = allocateLargestRemainder(input.buyerFeeAgorot, units.map((unit) => ({ id: unit.id, weight: unit.retail })));
  for (const unit of units) unit.buyerFee = feeByUnit.get(unit.id) ?? 0;
  for (const service of input.services) {
    const members = units.filter((unit) => unit.serviceGroup === service.id);
    const buyer = allocateLargestRemainder(service.buyerFreightAgorot, members.map((unit) => ({ id: unit.id, weight: unit.retail })));
    const supplier = allocateLargestRemainder(service.supplierFreightAgorot, members.map((unit) => ({ id: unit.id, weight: unit.retail })));
    const packing = allocateLargestRemainder(service.packingAgorot, members.map((unit) => ({ id: unit.id, weight: unit.retail })));
    for (const unit of members) {
      unit.buyerFreight = buyer.get(unit.id) ?? 0;
      unit.supplierFreight = supplier.get(unit.id) ?? 0;
      unit.packing = packing.get(unit.id) ?? 0;
    }
  }
  for (const unit of units) recompute(unit);

  const allocation = summarize(units, input);
  if (allocation.creatorEconomic < 0) return { ok: false, code: "NEGATIVE_PROCEEDS" };
  if (allocation.supplierPayable + allocation.creatorPayable + allocation.storeyGross + allocation.tax !== allocation.charge) {
    return { ok: false, code: "INVALID" };
  }
  return { ok: true, allocation };
}

export function recompute(unit: UnitSlice): void {
  unit.supplierPayable = unit.payableWholesale + unit.supplierFreight + unit.packing - unit.supplierCommission;
  unit.creatorPayable = unit.retail - unit.payableWholesale + unit.buyerFreight - unit.supplierFreight - unit.packing - unit.creatorCommission;
  unit.storeyGross = unit.supplierCommission + unit.creatorCommission + unit.buyerFee;
}

function summarize(units: UnitSlice[], input: QuoteInput): Allocation {
  const sum = (pick: (unit: UnitSlice) => number) => units.reduce((total, unit) => total + pick(unit), 0);
  const suppliers = [...new Set(units.map((unit) => unit.supplierId))].sort();
  const retail = sum((unit) => unit.retail);
  const buyerFreight = sum((unit) => unit.buyerFreight);
  const buyerFee = sum((unit) => unit.buyerFee);
  const tax = sum((unit) => unit.tax);
  const storeyGross = sum((unit) => unit.storeyGross);
  return {
    policyVersion: PAYMENT_POLICY,
    supplierBps: input.supplierBps,
    creatorBps: input.creatorBps,
    currency: "ILS",
    charge: retail + buyerFreight + buyerFee + tax,
    retail,
    wholesale: sum((unit) => unit.wholesale),
    payableWholesale: sum((unit) => unit.payableWholesale),
    supplierCommission: sum((unit) => unit.supplierCommission),
    creatorCommission: sum((unit) => unit.creatorCommission),
    buyerFreight,
    supplierFreight: sum((unit) => unit.supplierFreight),
    packing: sum((unit) => unit.packing),
    buyerFee,
    tax,
    supplierPayable: sum((unit) => unit.supplierPayable),
    creatorPayable: sum((unit) => unit.creatorPayable),
    storeyGross,
    pspFee: input.pspFeeAgorot,
    storeyNet: storeyGross - input.pspFeeAgorot,
    prepaidCost: sum((unit) => (unit.prepaid ? unit.wholesale : 0)),
    creatorEconomic: sum((unit) => unit.creatorPayable) - sum((unit) => (unit.prepaid ? unit.wholesale : 0)),
    units,
    bySupplier: suppliers.map((supplierId) => ({
      supplierId,
      payable: units.filter((unit) => unit.supplierId === supplierId).reduce((total, unit) => total + unit.supplierPayable, 0),
    })),
  };
}

export function supplierPayable(units: UnitSlice[], supplierId: string): number {
  return units.filter((unit) => unit.supplierId === supplierId).reduce((total, unit) => total + unit.supplierPayable, 0);
}
