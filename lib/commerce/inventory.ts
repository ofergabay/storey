export const HOLD_MS = 10 * 60 * 1000;

export type Tier = "social" | "branded" | "scale";

export type Segment =
  | { pool: "shared" }
  | { pool: "campaign"; campaignId: string }
  | { pool: "dedicated"; sellerId: string };

export type Hold = {
  id: string;
  quoteId: string;
  quantity: number;
  expiresAt: number;
  released: boolean;
  segments: { segment: Segment; quantity: number }[];
};

export type Campaign = {
  sellerId: string;
  quantity: number;
  expiresAt: number;
  allowOverflow: boolean;
  released: boolean;
};

export type Book = {
  buffer: number;
  free: number;
  committed: number;
  quarantined: number;
  pendingMove: number;
  campaigns: Record<string, Campaign>;
  dedicated: Record<string, { sellerId: string; quantity: number }>;
  holds: Hold[];
};

export type StockResult =
  | { ok: true; book: Book; hold: Hold; replayed: boolean }
  | { ok: false; code: "STOCK_CHANGED"; remaining: number; book: Book }
  | { ok: false; code: "FEATURE_UNAVAILABLE"; book: Book };

export function emptyBook(free: number, buffer = 0): Book {
  return {
    buffer,
    free,
    committed: 0,
    quarantined: 0,
    pendingMove: 0,
    campaigns: {},
    dedicated: {},
    holds: [],
  };
}

export function onHand(book: Book): number {
  const campaign = Object.values(book.campaigns).reduce((sum, row) => sum + row.quantity, 0);
  const dedicated = Object.values(book.dedicated).reduce((sum, row) => sum + row.quantity, 0);
  const held = book.holds.filter((hold) => !hold.released).reduce((sum, hold) => sum + hold.quantity, 0);
  return book.free + campaign + dedicated + held + book.committed + book.quarantined + book.pendingMove;
}

export function sellableShared(book: Book): number {
  return Math.max(0, book.free - book.buffer);
}

export function inspectLink(book: Book): { book: Book; sellable: number } {
  return { book, sellable: sellableShared(book) };
}

export function reserveCampaign(
  book: Book,
  input: { tier: Tier; campaignId: string; sellerId: string; quantity: number; expiresAt: number; allowOverflow: boolean },
): StockResult | { ok: true; book: Book; hold?: undefined; replayed: false } {
  if (input.tier === "social") return { ok: false, code: "FEATURE_UNAVAILABLE", book };
  if (!Number.isInteger(input.quantity) || input.quantity < 1) return { ok: false, code: "STOCK_CHANGED", remaining: sellableShared(book), book };
  if (sellableShared(book) < input.quantity) return { ok: false, code: "STOCK_CHANGED", remaining: sellableShared(book), book };
  const next: Book = {
    ...book,
    free: book.free - input.quantity,
    campaigns: {
      ...book.campaigns,
      [input.campaignId]: {
        sellerId: input.sellerId,
        quantity: input.quantity,
        expiresAt: input.expiresAt,
        allowOverflow: input.allowOverflow,
        released: false,
      },
    },
  };
  return { ok: true, book: next, replayed: false };
}

export function dedicateStock(book: Book, tier: Tier, sellerId: string, quantity: number): StockResult | { ok: true; book: Book; replayed: false } {
  if (tier !== "scale") return { ok: false, code: "FEATURE_UNAVAILABLE", book };
  if (sellableShared(book) < quantity) return { ok: false, code: "STOCK_CHANGED", remaining: sellableShared(book), book };
  const next: Book = {
    ...book,
    free: book.free - quantity,
    dedicated: { ...book.dedicated, [sellerId]: { sellerId, quantity: (book.dedicated[sellerId]?.quantity ?? 0) + quantity } },
  };
  return { ok: true, book: next, replayed: false };
}

export function acquireHold(
  book: Book,
  input: { quoteId: string; quantity: number; now: number; tier: Tier; sellerId: string; campaignId?: string },
): StockResult {
  const existing = book.holds.find((hold) => hold.quoteId === input.quoteId && !hold.released);
  if (existing) return { ok: true, book, hold: existing, replayed: true };
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    return { ok: false, code: "STOCK_CHANGED", remaining: availableFor(book, input), book };
  }
  const segments = allocate(book, input);
  if (!segments) return { ok: false, code: "STOCK_CHANGED", remaining: availableFor(book, input), book };
  const hold: Hold = {
    id: `hold-${input.quoteId}`,
    quoteId: input.quoteId,
    quantity: input.quantity,
    expiresAt: input.now + HOLD_MS,
    released: false,
    segments,
  };
  return { ok: true, book: applySegments(book, segments, -1, hold), hold, replayed: false };
}

export function releaseExpired(book: Book, now: number): { book: Book; releasedUnits: number } {
  let releasedUnits = 0;
  let free = book.free;
  const campaigns = { ...book.campaigns };
  for (const [id, campaign] of Object.entries(campaigns)) {
    if (campaign.released || campaign.expiresAt > now) continue;
    free += campaign.quantity;
    releasedUnits += campaign.quantity;
    campaigns[id] = { ...campaign, quantity: 0, released: true };
  }
  const holds = book.holds.map((hold) => {
    if (hold.released || hold.expiresAt > now) return hold;
    for (const part of hold.segments) {
      releasedUnits += part.quantity;
      if (part.segment.pool === "shared") {
        free += part.quantity;
      } else if (part.segment.pool === "campaign") {
        const campaign = campaigns[part.segment.campaignId];
        if (campaign && !campaign.released && campaign.expiresAt > now) {
          campaigns[part.segment.campaignId] = { ...campaign, quantity: campaign.quantity + part.quantity };
        } else {
          free += part.quantity;
        }
      } else {
        const lot = book.dedicated[part.segment.sellerId];
        if (lot) lot.quantity += part.quantity;
      }
    }
    return { ...hold, released: true };
  });
  return { book: { ...book, free, campaigns, holds, dedicated: { ...book.dedicated } }, releasedUnits };
}

function availableFor(book: Book, input: { tier: Tier; sellerId: string; campaignId?: string }): number {
  const segments = allocate(book, { ...input, quantity: Number.MAX_SAFE_INTEGER });
  if (segments) return Number.MAX_SAFE_INTEGER;
  let available = 0;
  if (input.campaignId) {
    const campaign = book.campaigns[input.campaignId];
    if (campaign && campaign.sellerId === input.sellerId && !campaign.released) available += campaign.quantity;
    if (campaign?.allowOverflow) available += sellableShared(book);
    return available;
  }
  if (input.tier === "scale") available += book.dedicated[input.sellerId]?.quantity ?? 0;
  return available + sellableShared(book);
}

function allocate(book: Book, input: { quantity: number; tier: Tier; sellerId: string; campaignId?: string }): Hold["segments"] | null {
  if (input.quantity === Number.MAX_SAFE_INTEGER) return null;
  let remaining = input.quantity;
  const segments: Hold["segments"] = [];
  const take = (segment: Segment, available: number) => {
    const quantity = Math.min(remaining, available);
    if (quantity <= 0) return;
    segments.push({ segment, quantity });
    remaining -= quantity;
  };
  if (input.campaignId) {
    const campaign = book.campaigns[input.campaignId];
    if (!campaign || campaign.released || campaign.sellerId !== input.sellerId) return null;
    take({ pool: "campaign", campaignId: input.campaignId }, campaign.quantity);
    if (remaining > 0 && campaign.allowOverflow) take({ pool: "shared" }, sellableShared(book));
    return remaining === 0 ? segments : null;
  }
  if (input.tier === "scale") take({ pool: "dedicated", sellerId: input.sellerId }, book.dedicated[input.sellerId]?.quantity ?? 0);
  take({ pool: "shared" }, sellableShared(book));
  return remaining === 0 ? segments : null;
}

function applySegments(book: Book, segments: Hold["segments"], direction: -1, hold: Hold): Book {
  let free = book.free;
  const campaigns = { ...book.campaigns };
  const dedicated = { ...book.dedicated };
  for (const part of segments) {
    const delta = direction * part.quantity;
    if (part.segment.pool === "shared") free += delta;
    if (part.segment.pool === "campaign") {
      const campaign = campaigns[part.segment.campaignId];
      if (!campaign) continue;
      campaigns[part.segment.campaignId] = { ...campaign, quantity: campaign.quantity + delta };
    }
    if (part.segment.pool === "dedicated") {
      const lot = dedicated[part.segment.sellerId];
      if (!lot) continue;
      dedicated[part.segment.sellerId] = { ...lot, quantity: lot.quantity + delta };
    }
  }
  return { ...book, free, campaigns, dedicated, holds: [...book.holds, hold] };
}
