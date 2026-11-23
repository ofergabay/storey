import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { PayState } from "./workflow.ts";

export type StoredPayment = { adapter: "test"; live: false; simulatedNow?: number; cancelReplayed?: boolean; state: PayState };

const file = path.join(process.cwd(), "data", "dev-payment-cases.json");

export function readPaymentCases(): StoredPayment[] {
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as { cases?: StoredPayment[] };
    return Array.isArray(parsed.cases) ? parsed.cases.filter((item) => item.adapter === "test" && item.live === false) : [];
  } catch {
    return [];
  }
}

export function writePaymentCase(payment: StoredPayment): void {
  const cases = readPaymentCases().filter((item) => item.state.id !== payment.state.id);
  cases.unshift(payment);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ cases }, null, 2));
}
