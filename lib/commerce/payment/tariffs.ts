export type DeliveryService = "standard" | "express" | "pickup";
export type CoverageKind = "postcode" | "city" | "zone" | "nationwide";
export type ShippingSponsor = "buyer" | "supplier" | "creator";

export type WeightBand = {
  minGrams: number;
  maxGrams: number | null;
  priceAgorot: number;
};

export type TariffRule = {
  id: string;
  supplierId: string;
  warehouseCode: string;
  service: DeliveryService;
  coverage: { kind: CoverageKind; value: string };
  priceAgorot: number;
  windowMinDays: number;
  windowMaxDays: number;
  cutoffHour: number;
  effectiveFrom: number;
  effectiveTo: number | null;
  status: "draft" | "published" | "retired";
  version: number;
  weightBands?: WeightBand[];
  bulkyMinCm?: number | null;
  bulkySurchargeAgorot?: number;
  freeThresholdAgorot?: number | null;
};

export type Destination = { postcode: string; city: string; zone: string };

export type TariffPrice = {
  rule: TariffRule;
  buyerAgorot: number;
  supplierEntitlementAgorot: number;
  absorbedAgorot: number;
  sponsor: ShippingSponsor;
  windowMinDays: number;
  windowMaxDays: number;
};

const RANK: Record<CoverageKind, number> = { postcode: 4, city: 3, zone: 2, nationwide: 1 };

export function coverageRank(kind: CoverageKind): number {
  return RANK[kind];
}

function clean(value: string): string {
  return value.trim().toLowerCase();
}

function datesOverlap(left: TariffRule, right: TariffRule): boolean {
  const leftEnd = left.effectiveTo ?? Number.MAX_SAFE_INTEGER;
  const rightEnd = right.effectiveTo ?? Number.MAX_SAFE_INTEGER;
  return left.effectiveFrom < rightEnd && right.effectiveFrom < leftEnd;
}

function bandsOverlap(left: WeightBand[] | undefined, right: WeightBand[] | undefined): boolean {
  if (!left?.length || !right?.length) return true;
  return left.some((band) => right.some((other) => {
    const bandEnd = band.maxGrams ?? Number.MAX_SAFE_INTEGER;
    const otherEnd = other.maxGrams ?? Number.MAX_SAFE_INTEGER;
    return band.minGrams < otherEnd && other.minGrams < bandEnd;
  }));
}

export function samePriorityOverlap(left: TariffRule, right: TariffRule): boolean {
  if (left.id === right.id || left.status !== "published" || right.status !== "published") return false;
  if (left.supplierId !== right.supplierId || left.warehouseCode !== right.warehouseCode || left.service !== right.service) return false;
  if (left.coverage.kind !== right.coverage.kind) return false;
  if (left.coverage.kind !== "nationwide" && clean(left.coverage.value) !== clean(right.coverage.value)) return false;
  if (!datesOverlap(left, right)) return false;
  return bandsOverlap(left.weightBands, right.weightBands);
}

function validRule(rule: TariffRule): boolean {
  if (!rule.id || !rule.supplierId || !rule.warehouseCode) return false;
  if (!["standard", "express", "pickup"].includes(rule.service)) return false;
  if (!["postcode", "city", "zone", "nationwide"].includes(rule.coverage.kind)) return false;
  if (rule.coverage.kind !== "nationwide" && clean(rule.coverage.value).length === 0) return false;
  if (!Number.isInteger(rule.priceAgorot) || rule.priceAgorot < 0) return false;
  if (!Number.isInteger(rule.windowMinDays) || !Number.isInteger(rule.windowMaxDays) || rule.windowMinDays < 0 || rule.windowMaxDays < rule.windowMinDays) return false;
  if (!Number.isInteger(rule.cutoffHour) || rule.cutoffHour < 0 || rule.cutoffHour > 23) return false;
  if (!Number.isInteger(rule.effectiveFrom)) return false;
  if (rule.effectiveTo !== null && (!Number.isInteger(rule.effectiveTo) || rule.effectiveTo <= rule.effectiveFrom)) return false;
  if (rule.freeThresholdAgorot != null && (!Number.isInteger(rule.freeThresholdAgorot) || rule.freeThresholdAgorot < 0)) return false;
  if (rule.bulkySurchargeAgorot != null && (!Number.isInteger(rule.bulkySurchargeAgorot) || rule.bulkySurchargeAgorot < 0)) return false;
  for (const band of rule.weightBands ?? []) {
    if (!Number.isInteger(band.minGrams) || band.minGrams < 0 || !Number.isInteger(band.priceAgorot) || band.priceAgorot < 0) return false;
    if (band.maxGrams !== null && (!Number.isInteger(band.maxGrams) || band.maxGrams <= band.minGrams)) return false;
  }
  return true;
}

export function publishTariff(rules: TariffRule[], rule: TariffRule): { ok: true; rules: TariffRule[] } | { ok: false; code: "INVALID" | "OVERLAP" } {
  const next: TariffRule = { ...rule, status: "published", version: rule.version > 0 ? rule.version : 1 };
  if (!validRule(next)) return { ok: false, code: "INVALID" };
  const peers = rules.filter((item) => item.id !== next.id && item.status === "published");
  if (peers.some((item) => samePriorityOverlap(next, item))) return { ok: false, code: "OVERLAP" };
  return { ok: true, rules: [...rules.filter((item) => item.id !== next.id), next] };
}

export function retireTariff(rules: TariffRule[], id: string, at: number, supplierId: string): { ok: true; rules: TariffRule[] } | { ok: false; code: "MISSING" | "FORBIDDEN" } {
  const rule = rules.find((item) => item.id === id);
  if (!rule) return { ok: false, code: "MISSING" };
  if (rule.supplierId !== supplierId) return { ok: false, code: "FORBIDDEN" };
  return {
    ok: true,
    rules: rules.map((item) => (item.id === id ? { ...item, status: "retired", effectiveTo: at } : item)),
  };
}

function matches(rule: TariffRule, destination: Destination): boolean {
  if (rule.coverage.kind === "nationwide") return true;
  const value = clean(rule.coverage.value);
  if (rule.coverage.kind === "postcode") return value.length > 0 && value === clean(destination.postcode);
  if (rule.coverage.kind === "city") return value.length > 0 && value === clean(destination.city);
  return value.length > 0 && value === clean(destination.zone);
}

function bandPrice(rule: TariffRule, grams: number): number | null {
  if (!rule.weightBands?.length) return rule.priceAgorot;
  const band = rule.weightBands.find((item) => grams >= item.minGrams && (item.maxGrams === null || grams < item.maxGrams));
  return band ? band.priceAgorot : null;
}

export function resolveTariff(input: {
  rules: TariffRule[];
  supplierId: string;
  warehouseCode: string;
  service: DeliveryService;
  destination: Destination;
  grams: number;
  longestCm: number;
  merchandiseAgorot: number;
  at: number;
  creatorFundsShipping?: boolean;
}): { ok: true; price: TariffPrice } | { ok: false; code: "NONE" | "OVERLAP" } {
  const candidates = input.rules.filter((rule) => {
    if (rule.status !== "published" || rule.supplierId !== input.supplierId || rule.warehouseCode !== input.warehouseCode) return false;
    if (rule.service !== input.service || rule.effectiveFrom > input.at) return false;
    if (rule.effectiveTo !== null && rule.effectiveTo <= input.at) return false;
    return matches(rule, input.destination);
  });
  if (candidates.length === 0) return { ok: false, code: "NONE" };
  const best = Math.max(...candidates.map((rule) => coverageRank(rule.coverage.kind)));
  const tied = candidates.filter((rule) => coverageRank(rule.coverage.kind) === best);
  const priced = tied.flatMap((rule) => {
    const base = bandPrice(rule, input.grams);
    return base === null ? [] : [{ rule, base }];
  });
  if (priced.length === 0) return { ok: false, code: "NONE" };
  if (priced.length > 1) return { ok: false, code: "OVERLAP" };
  const winner = priced[0];
  if (!winner) return { ok: false, code: "NONE" };
  const bulky = winner.rule.bulkyMinCm != null && input.longestCm >= winner.rule.bulkyMinCm ? winner.rule.bulkySurchargeAgorot ?? 0 : 0;
  const courier = winner.base + bulky;
  const supplierFree = winner.rule.freeThresholdAgorot != null && input.merchandiseAgorot >= winner.rule.freeThresholdAgorot;
  if (supplierFree) {
    return {
      ok: true,
      price: {
        rule: winner.rule,
        buyerAgorot: 0,
        supplierEntitlementAgorot: 0,
        absorbedAgorot: courier,
        sponsor: "supplier",
        windowMinDays: winner.rule.windowMinDays,
        windowMaxDays: winner.rule.windowMaxDays,
      },
    };
  }
  if (input.creatorFundsShipping) {
    return {
      ok: true,
      price: {
        rule: winner.rule,
        buyerAgorot: 0,
        supplierEntitlementAgorot: courier,
        absorbedAgorot: 0,
        sponsor: "creator",
        windowMinDays: winner.rule.windowMinDays,
        windowMaxDays: winner.rule.windowMaxDays,
      },
    };
  }
  return {
    ok: true,
    price: {
      rule: winner.rule,
      buyerAgorot: courier,
      supplierEntitlementAgorot: courier,
      absorbedAgorot: 0,
      sponsor: "buyer",
      windowMinDays: winner.rule.windowMinDays,
      windowMaxDays: winner.rule.windowMaxDays,
    },
  };
}

export function previewTariff(input: {
  rules: TariffRule[];
  supplierId: string;
  warehouseCode: string;
  destination: Destination;
  grams: number;
  longestCm: number;
  merchandiseAgorot: number;
  at: number;
  service?: DeliveryService;
}): TariffPrice[] {
  const services: DeliveryService[] = input.service ? [input.service] : ["standard", "express", "pickup"];
  const prices: TariffPrice[] = [];
  for (const service of services) {
    const resolved = resolveTariff({ ...input, service });
    if (resolved.ok) prices.push(resolved.price);
  }
  return prices;
}
