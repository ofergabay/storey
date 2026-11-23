export type CatalogProduct = {
  sku: string;
  titleHe: string;
  packSize: number;
  unit: string;
  costAgorot: number;
  warehouseCode: string;
  titleEn?: string;
  rights?: "pending" | "cleared";
};

export type StockState = {
  sku: string;
  warehouseCode: string;
  onHand: number;
  held: number;
  sequence: number;
  countedAt: string;
  watermark: string;
  halted: boolean;
};

export type CreatorListing = {
  sellerId: string;
  sellerHandle: string;
  sellerName: string;
  sku: string;
  slug: string;
  retailAgorot: number;
  draftAgorot?: number | null;
  publishedAt: string;
  buyerHeadline?: string;
  recommendation?: string;
  draftHeadline?: string;
  draftRecommendation?: string;
  paused?: boolean;
};

export type CatalogDb = {
  products: CatalogProduct[];
  stock: StockState[];
  listings: CreatorListing[];
};

export function emptyCatalog(): CatalogDb {
  return { products: [], stock: [], listings: [] };
}

export type ProductDraft = {
  line: number;
  sku: string;
  titleHe: string;
  packSize: number;
  unit: string;
  costAgorot: number;
  warehouseCode: string;
};

export type ProductPreview = {
  line: number;
  sku: string;
  status: "ready" | "invalid" | "replay" | "conflict";
  message: string;
  product: ProductDraft | null;
};

const ALLOWED_UNITS = new Set(["יחידות", "balloon", "pack", "מארז"]);

export function previewProducts(existing: CatalogProduct[], rows: ProductDraft[]): ProductPreview[] {
  const seen = new Set<string>();
  return rows.map((row) => {
    const problem = productProblem(row);
    if (problem) return { line: row.line, sku: row.sku, status: "invalid", message: problem, product: null };
    if (seen.has(row.sku)) {
      return { line: row.line, sku: row.sku, status: "conflict", message: "המק״ט מופיע פעמיים בקובץ.", product: null };
    }
    seen.add(row.sku);
    const current = existing.find((product) => product.sku === row.sku);
    if (!current) return { line: row.line, sku: row.sku, status: "ready", message: "מוכן לאישור.", product: row };
    if (
      current.titleHe === row.titleHe &&
      current.packSize === row.packSize &&
      current.unit === row.unit &&
      current.costAgorot === row.costAgorot &&
      current.warehouseCode === row.warehouseCode
    ) {
      return { line: row.line, sku: row.sku, status: "replay", message: "המוצר כבר מאושר באותו תוכן.", product: row };
    }
    return { line: row.line, sku: row.sku, status: "conflict", message: "המק״ט קיים עם תוכן אחר.", product: null };
  });
}

export function approveProducts(existing: CatalogProduct[], rows: ProductDraft[]): { products: CatalogProduct[]; approved: number } {
  const preview = previewProducts(existing, rows);
  const products = [...existing];
  let approved = 0;
  for (const row of preview) {
    if (row.status !== "ready" || !row.product) continue;
    products.push({
      sku: row.product.sku,
      titleHe: row.product.titleHe,
      packSize: row.product.packSize,
      unit: row.product.unit,
      costAgorot: row.product.costAgorot,
      warehouseCode: row.product.warehouseCode,
    });
    approved += 1;
  }
  return { products, approved };
}

function productProblem(row: ProductDraft): string | null {
  if (!/^[A-Za-z0-9-]{1,40}$/.test(row.sku)) return "מק״ט לא תקין.";
  if (row.titleHe.trim().length < 2) return "חסרה כותרת.";
  if (!Number.isInteger(row.packSize) || row.packSize < 1) return "גודל המארז חייב להיות מספר חיובי.";
  if (!ALLOWED_UNITS.has(row.unit)) return "יחידת המידה לא מוכרת.";
  if (!Number.isInteger(row.costAgorot) || row.costAgorot < 0) return "העלות חייבת להיות מספר שלם של אגורות, אפס או יותר.";
  if (!/^[A-Za-z0-9-]{1,40}$/.test(row.warehouseCode)) return "קוד המחסן לא תקין.";
  return null;
}

export type StockDraft = {
  line: number;
  sku: string;
  warehouseCode: string;
  counted: number;
  countedAt: string;
  sequence: number;
  watermark: string;
};

export type StockPreview = {
  line: number;
  sku: string;
  warehouseCode: string;
  status: "apply" | "replay" | "invalid" | "unknown" | "old" | "conflict" | "gap" | "deficit";
  message: string;
  previous: number | null;
  next: number | null;
};

export function previewStock(products: CatalogProduct[], states: StockState[], rows: StockDraft[]): { previews: StockPreview[]; stock: StockState[] } {
  const stock = states.map((state) => ({ ...state }));
  const previews: StockPreview[] = [];
  for (const row of rows) {
    const problem = stockProblem(row);
    if (problem) {
      previews.push(emptyPreview(row, "invalid", problem));
      continue;
    }
    if (!products.some((product) => product.sku === row.sku && product.warehouseCode === row.warehouseCode)) {
      previews.push(emptyPreview(row, "unknown", "אין מוצר מאושר למק״ט ולמחסן האלה."));
      continue;
    }
    const state = stock.find((item) => item.sku === row.sku && item.warehouseCode === row.warehouseCode) ?? null;
    const sequence = state?.sequence ?? 0;
    if (state && row.sequence === sequence) {
      const same =
        state.onHand === row.counted && state.countedAt === row.countedAt && state.watermark === row.watermark;
      previews.push({
        line: row.line,
        sku: row.sku,
        warehouseCode: row.warehouseCode,
        status: same ? "replay" : "conflict",
        message: same ? "אותה ספירה כבר נקלטה." : "אותו מספר ספירה הגיע עם תוכן אחר.",
        previous: state.onHand,
        next: same ? state.onHand : null,
      });
      continue;
    }
    if (row.sequence < sequence) {
      previews.push({
        line: row.line,
        sku: row.sku,
        warehouseCode: row.warehouseCode,
        status: "old",
        message: "זו ספירה ישנה והיא לא משנה את המלאי.",
        previous: state?.onHand ?? null,
        next: null,
      });
      continue;
    }
    if (row.sequence > sequence + 1) {
      if (state) state.halted = true;
      else stock.push(haltedState(row));
      previews.push({
        line: row.line,
        sku: row.sku,
        warehouseCode: row.warehouseCode,
        status: "gap",
        message: "חסרה ספירה ברצף. המכירה נעצרת והכמות לא משתנה.",
        previous: state?.onHand ?? null,
        next: null,
      });
      continue;
    }
    const previousOnHand = state && state.sequence > 0 ? state.onHand : null;
    const held = state?.held ?? 0;
    if (row.counted < held) {
      if (state) state.halted = true;
      else stock.push({ ...haltedState(row), sequence });
      previews.push({
        line: row.line,
        sku: row.sku,
        warehouseCode: row.warehouseCode,
        status: "deficit",
        message: "הספירה נמוכה מהשמירות הפתוחות. המכירה נעצרת והכמות לא משתנה.",
        previous: state?.onHand ?? null,
        next: null,
      });
      continue;
    }
    if (state) {
      state.onHand = row.counted;
      state.sequence = row.sequence;
      state.countedAt = row.countedAt;
      state.watermark = row.watermark;
      state.halted = false;
    } else {
      stock.push({
        sku: row.sku,
        warehouseCode: row.warehouseCode,
        onHand: row.counted,
        held: 0,
        sequence: row.sequence,
        countedAt: row.countedAt,
        watermark: row.watermark,
        halted: false,
      });
    }
    previews.push({
      line: row.line,
      sku: row.sku,
      warehouseCode: row.warehouseCode,
      status: "apply",
      message: "הספירה תחליף את הכמות.",
      previous: previousOnHand,
      next: row.counted,
    });
  }
  return { previews, stock };
}

function emptyPreview(row: StockDraft, status: StockPreview["status"], message: string): StockPreview {
  return { line: row.line, sku: row.sku, warehouseCode: row.warehouseCode, status, message, previous: null, next: null };
}

function haltedState(row: StockDraft): StockState {
  return {
    sku: row.sku,
    warehouseCode: row.warehouseCode,
    onHand: 0,
    held: 0,
    sequence: 0,
    countedAt: "",
    watermark: "",
    halted: true,
  };
}

function stockProblem(row: StockDraft): string | null {
  if (!/^[A-Za-z0-9-]{1,40}$/.test(row.sku)) return "מק״ט לא תקין.";
  if (!/^[A-Za-z0-9-]{1,40}$/.test(row.warehouseCode)) return "קוד המחסן לא תקין.";
  if (!Number.isInteger(row.counted) || row.counted < 0) return "הכמות חייבת להיות מספר שלם, אפס או יותר.";
  if (!Number.isInteger(row.sequence) || row.sequence < 1) return "מספר הספירה חייב להיות מספר שלם חיובי.";
  if (Number.isNaN(Date.parse(row.countedAt))) return "זמן הספירה לא תקין.";
  if (!row.watermark) return "חסר סימן תנועות.";
  return null;
}

export function sellableQuantity(state: StockState | undefined): number | null {
  if (!state || state.halted || state.sequence < 1) return null;
  return Math.max(0, state.onHand - state.held);
}
