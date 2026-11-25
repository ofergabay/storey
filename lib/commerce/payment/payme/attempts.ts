import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { PayState } from "../workflow.ts";

export type PaymeCallbackRecord = {
  at: number;
  saleId: string;
  transactionId: string;
  signature: "valid" | "invalid" | "unsigned";
  applied: boolean;
};

export type PaymeAttempt = {
  orderId: string;
  token: string;
  sellerHandle: string;
  sellerPaymeId: string;
  paymeSaleId: string;
  saleUrl: string;
  amount: number;
  currency: "ILS";
  status: "open" | "authorized" | "capture_unknown" | "captured" | "failed" | "voided";
  callbacks: PaymeCallbackRecord[];
  operations: string[];
  state: PayState;
};

const file = path.join(process.cwd(), "data", "dev-payme-attempts.json");

export function readPaymeAttempts(): PaymeAttempt[] {
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as { attempts?: PaymeAttempt[] };
    return Array.isArray(parsed.attempts) ? parsed.attempts.filter((item) => item.currency === "ILS" && item.paymeSaleId.length > 0) : [];
  } catch {
    return [];
  }
}

export function writePaymeAttempt(attempt: PaymeAttempt): void {
  const attempts = readPaymeAttempts().filter((item) => item.orderId !== attempt.orderId);
  attempts.unshift(attempt);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ attempts }, null, 2));
}

export function readPaymeAttempt(orderId: string): PaymeAttempt | null {
  return readPaymeAttempts().find((item) => item.orderId === orderId) ?? null;
}

export function readPaymeAttemptBySale(saleId: string): PaymeAttempt | null {
  return readPaymeAttempts().find((item) => item.paymeSaleId === saleId) ?? null;
}
