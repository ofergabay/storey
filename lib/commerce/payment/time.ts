type Parts = { y: number; m: number; d: number; hh: number; mm: number; ss: number };

export function addLocalDays(utcMs: number, days: number, timeZone: string): number {
  const parts = zonedParts(utcMs, timeZone);
  const shifted = new Date(Date.UTC(parts.y, parts.m - 1, parts.d + days, parts.hh, parts.mm, parts.ss));
  const wanted: Parts = {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth() + 1,
    d: shifted.getUTCDate(),
    hh: parts.hh,
    mm: parts.mm,
    ss: parts.ss,
  };
  return zonedToUtc(wanted, timeZone);
}

function zonedParts(utcMs: number, timeZone: string): Parts {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const value = (type: string) => Number(formatted.find((part) => part.type === type)?.value);
  return { y: value("year"), m: value("month"), d: value("day"), hh: value("hour"), mm: value("minute"), ss: value("second") };
}

function sameParts(left: Parts, right: Parts): boolean {
  return left.y === right.y && left.m === right.m && left.d === right.d && left.hh === right.hh && left.mm === right.mm && left.ss === right.ss;
}

function zonedToUtc(wanted: Parts, timeZone: string): number {
  let utc = Date.UTC(wanted.y, wanted.m - 1, wanted.d, wanted.hh, wanted.mm, wanted.ss);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const seen = zonedParts(utc, timeZone);
    const seenAsUtc = Date.UTC(seen.y, seen.m - 1, seen.d, seen.hh, seen.mm, seen.ss);
    const wantAsUtc = Date.UTC(wanted.y, wanted.m - 1, wanted.d, wanted.hh, wanted.mm, wanted.ss);
    const delta = wantAsUtc - seenAsUtc;
    if (delta === 0) break;
    utc += delta;
  }
  const matches: number[] = [];
  for (let offset = -3 * 60 * 60 * 1000; offset <= 3 * 60 * 60 * 1000; offset += 60 * 1000) {
    const candidate = utc + offset;
    if (sameParts(zonedParts(candidate, timeZone), wanted)) matches.push(candidate);
  }
  if (matches.length > 0) return Math.max(...matches);
  for (let step = 60 * 1000; step <= 3 * 60 * 60 * 1000; step += 60 * 1000) {
    const candidate = utc + step;
    const seen = zonedParts(candidate, timeZone);
    const seenStamp = Date.UTC(seen.y, seen.m - 1, seen.d, seen.hh, seen.mm, seen.ss);
    const wantStamp = Date.UTC(wanted.y, wanted.m - 1, wanted.d, wanted.hh, wanted.mm, wanted.ss);
    if (seenStamp >= wantStamp) return candidate;
  }
  return utc;
}
