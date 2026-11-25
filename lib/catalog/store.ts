import fs from "node:fs";
import path from "node:path";
import { pilotCatalog } from "./pilot.ts";
import { emptyCatalog, type CatalogDb } from "./model.ts";

const filePath = path.join(process.cwd(), "data", "dev-catalog.json");

export function catalogFromJson(raw: string): CatalogDb {
  try {
    const parsed = JSON.parse(raw) as Partial<CatalogDb>;
    return {
      products: Array.isArray(parsed.products) ? parsed.products : [],
      stock: Array.isArray(parsed.stock) ? parsed.stock : [],
      listings: Array.isArray(parsed.listings) ? parsed.listings : [],
    };
  } catch {
    return emptyCatalog();
  }
}

export function readCatalog(file = filePath): CatalogDb {
  try {
    return catalogFromJson(fs.readFileSync(file, "utf8"));
  } catch {
    return pilotCatalog();
  }
}

export function writeCatalog(catalog: CatalogDb) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(catalog, null, 2));
}
