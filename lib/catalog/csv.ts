import type { ProductDraft, StockDraft } from "@/lib/catalog/model";

export function parseProductCsv(text: string): { rows: ProductDraft[]; errors: string[] } {
  const table = parseTable(text);
  if (!table.ok) return { rows: [], errors: [table.message] };
  const required = ["supplier_sku", "title_he", "pack_size", "unit", "cost_agorot", "warehouse_code"];
  const missing = required.filter((column) => !table.headers.includes(column));
  if (missing.length > 0) return { rows: [], errors: [`חסרות עמודות: ${missing.join(", ")}`] };
  const rows: ProductDraft[] = [];
  const errors: string[] = [];
  for (let index = 0; index < table.records.length; index += 1) {
    const record = table.records[index];
    const line = index + 2;
    if (Object.values(record).some((value) => /^[=+@]/.test(value.trim()))) {
      errors.push(`שורה ${line}: תא שנראה כמו נוסחה לא מתקבל.`);
    } else {
      rows.push({
        line,
        sku: record.supplier_sku.trim(),
        titleHe: record.title_he.trim(),
        packSize: Number(record.pack_size.trim()),
        unit: record.unit.trim(),
        costAgorot: Number(record.cost_agorot.trim()),
        warehouseCode: record.warehouse_code.trim(),
      });
    }
  }
  return { rows, errors };
}

export function parseStockCsv(text: string): { rows: StockDraft[]; errors: string[] } {
  const table = parseTable(text);
  if (!table.ok) return { rows: [], errors: [table.message] };
  const required = ["supplier_sku", "warehouse_code", "counted_quantity", "counted_at", "sequence", "movement_watermark"];
  const missing = required.filter((column) => !table.headers.includes(column));
  if (missing.length > 0) return { rows: [], errors: [`חסרות עמודות: ${missing.join(", ")}`] };
  return {
    errors: [],
    rows: table.records.map((record, index) => ({
      line: index + 2,
      sku: record.supplier_sku.trim(),
      warehouseCode: record.warehouse_code.trim(),
      counted: Number(record.counted_quantity.trim()),
      countedAt: record.counted_at.trim(),
      sequence: Number(record.sequence.trim()),
      watermark: record.movement_watermark.trim(),
    })),
  };
}

function parseTable(text: string): { ok: true; headers: string[]; records: Record<string, string>[] } | { ok: false; message: string } {
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!source) return { ok: false, message: "הקובץ ריק." };
  if (source.length > 100_000) return { ok: false, message: "הקובץ גדול מדי." };
  const lines = source.split("\n").filter((line) => line.trim() !== "");
  const headers = splitCsvLine(lines[0]).map((header) => header.trim());
  if (headers.length === 0 || headers.some((header) => header === "")) {
    return { ok: false, message: "שורת הכותרת לא תקינה." };
  }
  const records = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = cells[index] ?? "";
    });
    return record;
  });
  return { ok: true, headers, records };
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}
