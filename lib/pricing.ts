export type RetailDraft =
  | { status: "empty" }
  | { status: "invalid" }
  | { status: "priced"; agorot: number };

const PRICE_PATTERN = /^(?:0|[1-9]\d{0,6})(?:\.\d{0,2})?$/;

export function parseRetailDraft(raw: string): RetailDraft {
  const trimmed = raw
    .trim()
    .replace(/₪/g, "")
    .replace(/\s+/g, "")
    .replace(/,/g, ".");
  if (trimmed === "" || trimmed === ".") return { status: "empty" };
  if (!PRICE_PATTERN.test(trimmed)) return { status: "invalid" };

  const agorot = shekelTextToAgorot(trimmed);
  if (!Number.isSafeInteger(agorot) || agorot <= 0) return { status: "invalid" };
  return { status: "priced", agorot };
}

export function grossProfitAgorot(retailAgorot: number, wholesaleAgorot: number): number {
  return retailAgorot - wholesaleAgorot;
}

export function grossMarginRatio(
  retailAgorot: number,
  wholesaleAgorot: number,
): number | null {
  if (retailAgorot <= 0) return null;
  return (retailAgorot - wholesaleAgorot) / retailAgorot;
}

function shekelTextToAgorot(text: string): number {
  const [wholePart, fractionPart = ""] = text.split(".");
  const fraction = (fractionPart + "00").slice(0, 2);
  return Number(wholePart) * 100 + Number(fraction);
}
