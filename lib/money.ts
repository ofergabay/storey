export function formatShekels(agorot: number): string {
  return `${shekelSign(agorot)}₪${shekelBody(agorot)}`;
}

export function formatShekelAfter(agorot: number): string {
  return `${shekelSign(agorot)}${shekelBody(agorot)} ₪`;
}

function shekelSign(agorot: number): string {
  return agorot < 0 ? "-" : "";
}

function shekelBody(agorot: number): string {
  const absolute = Math.abs(agorot);
  const whole = Math.trunc(absolute / 100);
  const fraction = absolute % 100;
  return fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(2, "0")}`;
}

export function formatMarginRatio(ratio: number): string {
  const percent = Math.round(ratio * 1000) / 10;
  const sign = percent < 0 ? "-" : "";
  return `${sign}${Math.abs(percent).toFixed(1)}%`;
}

export function agorotToInput(agorot: number): string {
  const whole = Math.trunc(agorot / 100);
  const fraction = Math.abs(agorot % 100);
  if (fraction === 0) return String(whole);
  return `${whole}.${String(fraction).padStart(2, "0")}`;
}
