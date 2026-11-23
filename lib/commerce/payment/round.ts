export function divHalfUp(numerator: number, denominator: number): number {
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || denominator <= 0) {
    throw new Error("invalid rounding");
  }
  const negative = numerator < 0;
  const numer = Math.abs(numerator);
  const quotient = Math.floor(numer / denominator);
  const remainder = numer % denominator;
  const rounded = remainder * 2 >= denominator ? quotient + 1 : quotient;
  return negative ? -rounded : rounded;
}

export function applyBps(amount: number, basisPoints: number): number {
  return divHalfUp(amount * basisPoints, 10_000);
}

export function allocateLargestRemainder(total: number, parts: { id: string; weight: number }[]): Map<string, number> {
  if (!Number.isInteger(total) || total < 0) throw new Error("invalid allocation");
  if (parts.length === 0) return new Map();
  const weight = parts.reduce((sum, part) => sum + part.weight, 0);
  if (weight <= 0) return allocateLargestRemainder(total, parts.map((part) => ({ id: part.id, weight: 1 })));
  const rows = parts.map((part) => {
    const numerator = total * part.weight;
    const floor = Math.floor(numerator / weight);
    return { id: part.id, floor, remainder: numerator % weight };
  });
  let left = total - rows.reduce((sum, row) => sum + row.floor, 0);
  const ranked = [...rows].sort((leftRow, rightRow) => rightRow.remainder - leftRow.remainder || leftRow.id.localeCompare(rightRow.id));
  const extra = new Set(ranked.slice(0, left).map((row) => row.id));
  left = 0;
  return new Map(rows.map((row) => [row.id, row.floor + (extra.has(row.id) ? 1 : 0)]));
}
