import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { recoverAcceptedCharge, type ProviderCharge } from "./recover.ts";
import { readPaymentCases, writePaymentCase, type StoredPayment } from "./store.ts";
import { readWorkspace, writeWorkspace } from "../../workspace/store.ts";

const providerFile = path.join(process.cwd(), "data", "dev-payment-provider.json");
const crashFile = path.join(process.cwd(), "data", "dev-payment-crash.json");

export function readProviderCharges(): ProviderCharge[] {
  try {
    const parsed = JSON.parse(readFileSync(providerFile, "utf8")) as { charges?: ProviderCharge[] };
    return Array.isArray(parsed.charges) ? parsed.charges.filter((charge) => charge.status === "captured" && typeof charge.ref === "string" && charge.ref.length > 0) : [];
  } catch {
    return [];
  }
}

export function writeProviderCharge(charge: ProviderCharge): void {
  const charges = readProviderCharges().filter((item) => item.ref !== charge.ref);
  charges.unshift(charge);
  mkdirSync(path.dirname(providerFile), { recursive: true });
  writeFileSync(providerFile, JSON.stringify({ charges }, null, 2));
}

export function crashBeforeConfirm(): boolean {
  try {
    const parsed = JSON.parse(readFileSync(crashFile, "utf8")) as { beforeConfirm?: boolean };
    return parsed.beforeConfirm === true;
  } catch {
    return false;
  }
}

export function disarmCrash(): void {
  mkdirSync(path.dirname(crashFile), { recursive: true });
  writeFileSync(crashFile, JSON.stringify({ beforeConfirm: false }, null, 2));
}

export function recoverAcceptedCaptures(): void {
  const workspace = readWorkspace();
  let changed = false;
  for (const charge of readProviderCharges()) {
    const existing = readPaymentCases().find((item) => item.state.id === charge.orderId) ?? null;
    const recovered = recoverAcceptedCharge(charge, existing?.state ?? null);
    if (!recovered) continue;
    if (!existing || existing.state.status !== "captured") {
      const stored: StoredPayment = { adapter: "test", live: false, simulatedNow: existing?.simulatedNow, state: recovered.state };
      writePaymentCase(stored);
    }
    const order = workspace.orders.find((item) => item.id === charge.orderId);
    if (order && order.status === "held" && recovered.state.status === "captured") {
      order.status = "sandbox_paid";
      order.paymentCaseId = charge.orderId;
      order.paymentNote = "האישור שוחזר לפי האסמכתה המקורית. לא נשלחה בקשת תשלום נוספת.";
      changed = true;
    }
  }
  if (changed) writeWorkspace(workspace);
}
