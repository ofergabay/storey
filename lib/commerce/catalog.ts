export type SourceRow = {
  row: number;
  supplierId: string;
  sku: string;
  titleHe: string;
  titleEn: string;
  packSize: number;
  unit: string;
  priceAgorot: number;
  currency: "ILS";
  taxClass: string | null;
  active: boolean;
  rights: boolean;
  primaryImage: boolean;
};

export type StagedItem = {
  supplierId: string;
  sku: string;
  revision: number;
  priceAgorot: number;
  fingerprint: string;
  rights: boolean;
  primaryImage: boolean;
  taxClass: string | null;
  titleHe: string;
  titleEn: string;
  packSize: number;
};

export type LiveOffer = {
  supplierId: string;
  sku: string;
  revision: number;
  priceAgorot: number;
};

export type Catalog = {
  jobs: { key: string; fingerprint: string }[];
  staged: StagedItem[];
  live: LiveOffer[];
};

export function emptyCatalog(): Catalog {
  return { jobs: [], staged: [], live: [] };
}

function fingerprint(rows: SourceRow[]): string {
  return JSON.stringify(
    rows.map((row) => ({
      supplierId: row.supplierId,
      sku: row.sku,
      priceAgorot: row.priceAgorot,
      packSize: row.packSize,
      titleHe: row.titleHe,
      titleEn: row.titleEn,
      rights: row.rights,
      primaryImage: row.primaryImage,
      taxClass: row.taxClass,
    })),
  );
}

function invalid(row: SourceRow): { row: number; field: string } | null {
  if (!row.titleHe || !row.titleEn) return { row: row.row, field: "title" };
  if (!Number.isInteger(row.packSize) || row.packSize < 1) return { row: row.row, field: "packSize" };
  if (!Number.isInteger(row.priceAgorot) || row.priceAgorot < 0) return { row: row.row, field: "priceAgorot" };
  if (row.currency !== "ILS") return { row: row.row, field: "currency" };
  if (!row.unit) return { row: row.row, field: "unit" };
  if (!row.sku || !row.supplierId) return { row: row.row, field: "sku" };
  return null;
}

export function stageBatch(
  catalog: Catalog,
  input: { key: string; rows: SourceRow[] },
):
  | { ok: true; catalog: Catalog; replayed: boolean }
  | { ok: false; code: "INVALID"; row: number; field: string; catalog: Catalog }
  | { ok: false; code: "CONFLICT"; catalog: Catalog } {
  for (const row of input.rows) {
    const problem = invalid(row);
    if (problem) return { ok: false, code: "INVALID", ...problem, catalog };
  }
  const content = fingerprint(input.rows);
  const existing = catalog.jobs.find((job) => job.key === input.key);
  if (existing) {
    if (existing.fingerprint !== content) return { ok: false, code: "CONFLICT", catalog };
    return { ok: true, catalog, replayed: true };
  }
  const staged = input.rows.map((row) => {
    const previous = catalog.staged.find((item) => item.supplierId === row.supplierId && item.sku === row.sku);
    return {
      supplierId: row.supplierId,
      sku: row.sku,
      revision: previous ? previous.revision + 1 : 1,
      priceAgorot: row.priceAgorot,
      fingerprint: content,
      rights: row.rights,
      primaryImage: row.primaryImage,
      taxClass: row.taxClass,
      titleHe: row.titleHe,
      titleEn: row.titleEn,
      packSize: row.packSize,
    };
  });
  const keys = new Set(staged.map((item) => `${item.supplierId}:${item.sku}`));
  return {
    ok: true,
    replayed: false,
    catalog: {
      jobs: [...catalog.jobs, { key: input.key, fingerprint: content }],
      staged: [...catalog.staged.filter((item) => !keys.has(`${item.supplierId}:${item.sku}`)), ...staged],
      live: catalog.live,
    },
  };
}

export function publishStaged(
  catalog: Catalog,
  input: { supplierId: string; sku: string; expectedRevision: number },
):
  | { ok: true; catalog: Catalog; offer: LiveOffer }
  | { ok: false; code: "MISSING" | "STALE" | "RIGHTS" | "COST" | "COPY" | "IMAGE"; catalog: Catalog } {
  const item = catalog.staged.find((row) => row.supplierId === input.supplierId && row.sku === input.sku);
  if (!item) return { ok: false, code: "MISSING", catalog };
  if (item.revision !== input.expectedRevision) return { ok: false, code: "STALE", catalog };
  if (!item.rights) return { ok: false, code: "RIGHTS", catalog };
  if (!item.primaryImage) return { ok: false, code: "IMAGE", catalog };
  if (!item.taxClass || item.priceAgorot < 0 || item.packSize < 1) return { ok: false, code: "COST", catalog };
  if (!item.titleHe || !item.titleEn) return { ok: false, code: "COPY", catalog };
  const offer: LiveOffer = {
    supplierId: item.supplierId,
    sku: item.sku,
    revision: item.revision,
    priceAgorot: item.priceAgorot,
  };
  const live = [
    ...catalog.live.filter((row) => !(row.supplierId === offer.supplierId && row.sku === offer.sku)),
    offer,
  ];
  return { ok: true, catalog: { ...catalog, live }, offer };
}
