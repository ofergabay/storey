import type { CatalogDb } from "./model.ts";

// Same deployed fallback as the workspace pilot: the gitignored catalog file is not on the server.
export function pilotCatalog(): CatalogDb {
  return {
    products: [
      {
        sku: "LILAC-24",
        titleHe: "סרט לילך",
        packSize: 24,
        unit: "יחידות",
        costAgorot: 1800,
        warehouseCode: "PILOT-01",
        rights: "pending",
      },
      {
        sku: "PARTY-01",
        titleHe: "קונספט למסיבה",
        titleEn: "Party concept",
        packSize: 8,
        unit: "יחידות",
        costAgorot: 3200,
        warehouseCode: "PILOT-01",
        rights: "cleared",
      },
    ],
    stock: [
      {
        sku: "LILAC-24",
        warehouseCode: "PILOT-01",
        onHand: 12,
        held: 0,
        sequence: 1,
        countedAt: "2026-11-23T00:00:00.000Z",
        watermark: "0",
        halted: false,
      },
      {
        sku: "PARTY-01",
        warehouseCode: "PILOT-01",
        onHand: 5,
        held: 1,
        sequence: 1,
        countedAt: "2026-11-23T00:00:00.000Z",
        watermark: "0",
        halted: false,
      },
    ],
    listings: [
      {
        sellerId: "dev-creator",
        sellerHandle: "creator",
        sellerName: "creator",
        sku: "PARTY-01",
        slug: "party-01",
        retailAgorot: 5000,
        publishedAt: "2026-11-22T22:46:43.730Z",
      },
    ],
  };
}
