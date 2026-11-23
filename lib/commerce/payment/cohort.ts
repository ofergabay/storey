import { readFileSync } from "node:fs";
import path from "node:path";
import { PAYMENT_POLICY, paymentPolicyForSeller, type PilotSelection, type PolicyVersion } from "./flag.ts";

const file = path.join(process.cwd(), "data", "dev-payment-cohort.json");

export function pilotSelection(): PilotSelection {
  if (process.env.NODE_ENV !== "production") {
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8")) as { enabled?: boolean; sellers?: string[] };
      if (typeof parsed.enabled === "boolean" && Array.isArray(parsed.sellers)) {
        return { enabled: parsed.enabled, sellers: parsed.sellers.filter((seller) => typeof seller === "string") };
      }
    } catch {
      // The development file is optional. The environment variables remain the fallback.
    }
  }
  const sellers = (process.env.STOREY_PAYMENT_COHORT ?? "").split(",").map((seller) => seller.trim()).filter((seller) => seller.length > 0);
  return { enabled: process.env.STOREY_PAYMENT_POLICY === PAYMENT_POLICY, sellers };
}

export function policyForSeller(sellerHandle: string): PolicyVersion {
  return paymentPolicyForSeller(sellerHandle, pilotSelection());
}
