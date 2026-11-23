import fs from "node:fs";
import path from "node:path";
import { emptyCatalog, type CatalogDb } from "@/lib/catalog/model";

const filePath = path.join(process.cwd(), "data", "dev-catalog.json");

export function readCatalog(): CatalogDb {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<CatalogDb>;
    return {
      products: Array.isArray(parsed.products) ? parsed.products : [],
      stock: Array.isArray(parsed.stock) ? parsed.stock : [],
      listings: Array.isArray(parsed.listings) ? parsed.listings : [],
    };
  } catch {
    return emptyCatalog();
  }
}

export function writeCatalog(catalog: CatalogDb) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(catalog, null, 2));
}
