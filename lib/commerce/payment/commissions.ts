export type RateCard = {
  id: string;
  supplierBps: number;
  creatorBps: number;
  effectiveAt: number;
  publishedAt: number;
  publishedBy: string;
  status: "published";
};

export type CommissionAudit = {
  at: number;
  actor: string;
  before: string;
  after: string;
};

export type CommissionBook = {
  cards: RateCard[];
  audit: CommissionAudit[];
};

export function emptyCommissionBook(): CommissionBook {
  return { cards: [], audit: [] };
}

export function basisPoints(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 10_000;
}

export function percentToBasisPoints(text: string): number | null {
  const trimmed = text.trim().replace("%", "");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  const bps = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  return basisPoints(bps) ? bps : null;
}

export function publishRates(
  book: CommissionBook,
  input: {
    actorRole: string;
    actorId: string;
    supplierBps: number;
    creatorBps: number;
    effectiveAt: number;
    now: number;
  },
): { ok: true; book: CommissionBook; card: RateCard } | { ok: false; code: "FORBIDDEN" | "INVALID" } {
  if (input.actorRole !== "admin") return { ok: false, code: "FORBIDDEN" };
  if (!basisPoints(input.supplierBps) || !basisPoints(input.creatorBps)) return { ok: false, code: "INVALID" };
  if (!Number.isInteger(input.effectiveAt) || !Number.isInteger(input.now)) return { ok: false, code: "INVALID" };
  const current = rateAt(book.cards, input.effectiveAt);
  const card: RateCard = {
    id: `rate-${input.now}-${book.cards.length + 1}`,
    supplierBps: input.supplierBps,
    creatorBps: input.creatorBps,
    effectiveAt: input.effectiveAt,
    publishedAt: input.now,
    publishedBy: input.actorId,
    status: "published",
  };
  const before = current ? `${current.supplierBps}/${current.creatorBps}` : "none";
  return {
    ok: true,
    card,
    book: {
      cards: [...book.cards, card],
      audit: [...book.audit, { at: input.now, actor: input.actorId, before, after: `${card.supplierBps}/${card.creatorBps}` }],
    },
  };
}

export function rateAt(cards: RateCard[], at: number): RateCard | null {
  const eligible = cards
    .filter((card) => card.status === "published" && card.effectiveAt <= at)
    .sort((left, right) => right.effectiveAt - left.effectiveAt || right.publishedAt - left.publishedAt || left.id.localeCompare(right.id));
  return eligible[0] ?? null;
}
