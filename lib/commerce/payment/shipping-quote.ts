import { priceQuote, type Allocation } from "./calculate.ts";
import { WEEKLY_POLICY } from "./flag.ts";
import { previewTariff, resolveTariff, type DeliveryService, type Destination, type ShippingSponsor, type TariffRule } from "./tariffs.ts";

export type CheckoutItem = {
  id: string;
  supplierId: string;
  warehouseCode: string;
  sku: string;
  quantity: number;
  unitRetailAgorot: number;
  unitWholesaleAgorot: number;
  prepaidQuantity: number;
  taxAgorot: number;
  grams: number;
  longestCm: number;
  profile?: string;
};

export type QuotedOption = {
  service: DeliveryService;
  buyerAgorot: number;
  supplierEntitlementAgorot: number;
  absorbedAgorot: number;
  sponsor: ShippingSponsor;
  windowMinDays: number;
  windowMaxDays: number;
  tariffId: string;
  tariffVersion: number;
  cutoffHour: number;
};

export type QuotedGroup = {
  id: string;
  supplierId: string;
  warehouseCode: string;
  itemIds: string[];
  merchandiseAgorot: number;
  options: QuotedOption[];
  selected: DeliveryService | null;
  blocked: boolean;
};

export type GroupSnapshot = {
  id: string;
  supplierId: string;
  warehouseCode: string;
  itemIds: string[];
  service: DeliveryService;
  buyerAgorot: number;
  supplierEntitlementAgorot: number;
  absorbedAgorot: number;
  sponsor: ShippingSponsor;
  windowMinDays: number;
  windowMaxDays: number;
  tariffId: string;
  tariffVersion: number;
};

export type ShippingSnapshot = {
  hash: string;
  shippingAgorot: number;
  groups: GroupSnapshot[];
  supplierBps: number;
  creatorBps: number;
  rateId: string;
  allocation: Allocation;
};

export type ShippingQuote = {
  ok: boolean;
  reason: "ok" | "no-service" | "pickup-required" | "no-rate" | "negative" | "overlap" | "invalid";
  blockedItemIds: string[];
  groups: QuotedGroup[];
  shippingAgorot: number;
  chargeAgorot: number;
  hash: string;
  snapshot: ShippingSnapshot | null;
};

const SERVICES: DeliveryService[] = ["standard", "express", "pickup"];

function groupId(item: CheckoutItem): string {
  return `${item.supplierId}:${item.warehouseCode}:${item.profile ?? "parcel"}`;
}

function cheapestDelivery(options: QuotedOption[]): DeliveryService | null {
  const delivery = options.filter((option) => option.service !== "pickup");
  delivery.sort((left, right) => left.buyerAgorot - right.buyerAgorot || left.service.localeCompare(right.service) || left.tariffId.localeCompare(right.tariffId));
  return delivery[0]?.service ?? null;
}

export function quoteShipments(input: {
  items: CheckoutItem[];
  destination: Destination;
  rules: TariffRule[];
  rate: { id: string; supplierBps: number; creatorBps: number } | null;
  at: number;
  selections?: { groupId: string; service: DeliveryService }[];
  creatorFundsShipping?: boolean;
  pspFeeAgorot?: number;
  taxDetermined?: boolean;
}): ShippingQuote {
  const groups = new Map<string, CheckoutItem[]>();
  for (const item of [...input.items].sort((left, right) => left.id.localeCompare(right.id))) {
    const id = groupId(item);
    groups.set(id, [...(groups.get(id) ?? []), item]);
  }
  const quoted: QuotedGroup[] = [];
  let overlap = false;
  for (const [id, items] of groups) {
    const first = items[0];
    if (!first) continue;
    const merchandise = items.reduce((sum, item) => sum + item.quantity * item.unitRetailAgorot, 0);
    const grams = items.reduce((sum, item) => sum + item.grams * item.quantity, 0);
    const longest = items.reduce((max, item) => Math.max(max, item.longestCm), 0);
    const options: QuotedOption[] = [];
    for (const service of SERVICES) {
      const resolved = resolveTariff({
        rules: input.rules,
        supplierId: first.supplierId,
        warehouseCode: first.warehouseCode,
        service,
        destination: input.destination,
        grams,
        longestCm: longest,
        merchandiseAgorot: merchandise,
        at: input.at,
        creatorFundsShipping: input.creatorFundsShipping,
      });
      if (!resolved.ok && resolved.code === "OVERLAP") overlap = true;
      if (!resolved.ok) continue;
      options.push({
        service,
        buyerAgorot: resolved.price.buyerAgorot,
        supplierEntitlementAgorot: resolved.price.supplierEntitlementAgorot,
        absorbedAgorot: resolved.price.absorbedAgorot,
        sponsor: resolved.price.sponsor,
        windowMinDays: resolved.price.windowMinDays,
        windowMaxDays: resolved.price.windowMaxDays,
        tariffId: resolved.price.rule.id,
        tariffVersion: resolved.price.rule.version,
        cutoffHour: resolved.price.rule.cutoffHour,
      });
    }
    const requested = input.selections?.find((selection) => selection.groupId === id)?.service ?? null;
    const selected = requested && options.some((option) => option.service === requested) ? requested : requested ? null : cheapestDelivery(options);
    quoted.push({
      id,
      supplierId: first.supplierId,
      warehouseCode: first.warehouseCode,
      itemIds: items.map((item) => item.id),
      merchandiseAgorot: merchandise,
      options,
      selected,
      blocked: options.length === 0 || selected === null,
    });
  }
  const blockedItemIds = quoted.filter((group) => group.blocked).flatMap((group) => group.itemIds);
  const empty = (reason: ShippingQuote["reason"]): ShippingQuote => ({
    ok: false,
    reason,
    blockedItemIds,
    groups: quoted,
    shippingAgorot: 0,
    chargeAgorot: 0,
    hash: "",
    snapshot: null,
  });
  if (!input.rate) return empty("no-rate");
  if (overlap) return empty("overlap");
  if (quoted.some((group) => group.options.length === 0)) return empty("no-service");
  if (quoted.some((group) => group.selected === null)) return empty("pickup-required");
  const chosen = quoted.flatMap((group) => {
    const option = group.options.find((item) => item.service === group.selected);
    return option ? [{ group, option }] : [];
  });
  if (chosen.length !== quoted.length) return empty("no-service");
  const priced = priceQuote({
    currency: "ILS",
    supplierBps: input.rate.supplierBps,
    creatorBps: input.rate.creatorBps,
    taxDetermined: input.taxDetermined ?? true,
    stockFresh: true,
    setupApproved: true,
    policyVersion: WEEKLY_POLICY,
    buyerFeeAgorot: 0,
    discountAgorot: 0,
    pspFeeAgorot: input.pspFeeAgorot ?? 0,
    lines: input.items.map((item) => ({
      id: item.id,
      supplierId: item.supplierId,
      sku: item.sku,
      quantity: item.quantity,
      unitRetailAgorot: item.unitRetailAgorot,
      unitWholesaleAgorot: item.unitWholesaleAgorot,
      prepaidQuantity: item.prepaidQuantity,
      serviceGroup: groupId(item),
      taxAgorot: item.taxAgorot,
    })),
    services: chosen.map(({ group, option }) => ({
      id: group.id,
      buyerFreightAgorot: option.buyerAgorot,
      supplierFreightAgorot: option.supplierEntitlementAgorot,
      packingAgorot: 0,
    })),
  });
  if (!priced.ok) return empty(priced.code === "NEGATIVE_PROCEEDS" ? "negative" : "invalid");
  const groupSnapshots: GroupSnapshot[] = chosen.map(({ group, option }) => ({
    id: group.id,
    supplierId: group.supplierId,
    warehouseCode: group.warehouseCode,
    itemIds: group.itemIds,
    service: option.service,
    buyerAgorot: option.buyerAgorot,
    supplierEntitlementAgorot: option.supplierEntitlementAgorot,
    absorbedAgorot: option.absorbedAgorot,
    sponsor: option.sponsor,
    windowMinDays: option.windowMinDays,
    windowMaxDays: option.windowMaxDays,
    tariffId: option.tariffId,
    tariffVersion: option.tariffVersion,
  }));
  const hash = JSON.stringify({
    destination: input.destination,
    items: input.items.map((item) => ({
      id: item.id,
      supplierId: item.supplierId,
      warehouseCode: item.warehouseCode,
      sku: item.sku,
      quantity: item.quantity,
      unitRetailAgorot: item.unitRetailAgorot,
      unitWholesaleAgorot: item.unitWholesaleAgorot,
      prepaidQuantity: item.prepaidQuantity,
      grams: item.grams,
      longestCm: item.longestCm,
      profile: item.profile ?? "parcel",
    })),
    selections: groupSnapshots.map((group) => ({ id: group.id, service: group.service, tariffId: group.tariffId, tariffVersion: group.tariffVersion })),
    rateId: input.rate.id,
    supplierBps: input.rate.supplierBps,
    creatorBps: input.rate.creatorBps,
    creatorFundsShipping: input.creatorFundsShipping === true,
    charge: priced.allocation.charge,
  });
  return {
    ok: true,
    reason: "ok",
    blockedItemIds: [],
    groups: quoted,
    shippingAgorot: priced.allocation.buyerFreight,
    chargeAgorot: priced.allocation.charge,
    hash,
    snapshot: {
      hash,
      shippingAgorot: priced.allocation.buyerFreight,
      groups: groupSnapshots,
      supplierBps: input.rate.supplierBps,
      creatorBps: input.rate.creatorBps,
      rateId: input.rate.id,
      allocation: priced.allocation,
    },
  };
}

export function quoteStillCurrent(acceptedHash: string, current: ShippingQuote): boolean {
  return current.ok && current.hash === acceptedHash;
}

export function quoteListing(input: {
  supplierId: string;
  warehouseCode: string;
  sku: string;
  quantity: number;
  retailAgorot: number;
  wholesaleAgorot: number;
  destination: Destination;
  rules: TariffRule[];
  rate: { id: string; supplierBps: number; creatorBps: number } | null;
  at: number;
  service: string;
  creatorFundsShipping: boolean;
  pspFeeAgorot?: number;
}): ShippingQuote {
  const service = input.service === "standard" || input.service === "express" || input.service === "pickup" ? input.service : null;
  return quoteShipments({
    items: [{
      id: "item",
      supplierId: input.supplierId,
      warehouseCode: input.warehouseCode,
      sku: input.sku,
      quantity: input.quantity,
      unitRetailAgorot: input.retailAgorot,
      unitWholesaleAgorot: input.wholesaleAgorot,
      prepaidQuantity: 0,
      taxAgorot: 0,
      grams: 0,
      longestCm: 0,
    }],
    destination: input.destination,
    rules: input.rules,
    rate: input.rate,
    at: input.at,
    selections: service ? [{ groupId: `${input.supplierId}:${input.warehouseCode}:parcel`, service }] : [],
    creatorFundsShipping: input.creatorFundsShipping,
    pspFeeAgorot: input.pspFeeAgorot,
  });
}

export function serviceOptions(rules: TariffRule[], input: Omit<Parameters<typeof previewTariff>[0], "rules">): ReturnType<typeof previewTariff> {
  return previewTariff({ ...input, rules });
}
