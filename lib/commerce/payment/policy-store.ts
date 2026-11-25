import fs from "node:fs";
import path from "node:path";
import { emptyCommissionBook, type CommissionBook } from "./commissions.ts";
import type { TariffRule } from "./tariffs.ts";
import { DEFAULT_WEEKLY_CUTOFF, type WeeklyCutoff, type WeeklyInstruction } from "./weekly.ts";

const commissionFile = path.join(process.cwd(), "data", "dev-commissions.json");
const tariffFile = path.join(process.cwd(), "data", "dev-tariffs.json");
const payoutFile = path.join(process.cwd(), "data", "dev-weekly-payouts.json");

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

export function readCommissions(): CommissionBook {
  const parsed = readJson<Partial<CommissionBook>>(commissionFile, emptyCommissionBook());
  return { cards: parsed.cards ?? [], audit: parsed.audit ?? [] };
}

export function writeCommissions(book: CommissionBook): void {
  writeJson(commissionFile, book);
}

export function readTariffs(): TariffRule[] {
  return readJson<{ rules?: TariffRule[] }>(tariffFile, {}).rules ?? [];
}

export function writeTariffs(rules: TariffRule[]): void {
  writeJson(tariffFile, { rules });
}

export function readWeeklyPayouts(): WeeklyInstruction[] {
  return readJson<{ instructions?: WeeklyInstruction[] }>(payoutFile, {}).instructions ?? [];
}

export function writeWeeklyPayouts(instructions: WeeklyInstruction[]): void {
  writeJson(payoutFile, { instructions });
}

export function weeklyCutoffFromEnv(): WeeklyCutoff {
  const weekday = Number(process.env.STOREY_WEEKLY_WEEKDAY ?? DEFAULT_WEEKLY_CUTOFF.weekday);
  const hour = Number(process.env.STOREY_WEEKLY_HOUR ?? DEFAULT_WEEKLY_CUTOFF.hour);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return DEFAULT_WEEKLY_CUTOFF;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return DEFAULT_WEEKLY_CUTOFF;
  return { weekday, hour, minute: 0 };
}
