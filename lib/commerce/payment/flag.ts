export const ORIGINAL_POLICY = "original-2026-11" as const;
export const PAYMENT_POLICY = "pay-2026-11" as const;

export type PolicyVersion = typeof ORIGINAL_POLICY | typeof PAYMENT_POLICY;

export const TEST_SUPPLIER_BPS = 500;
export const TEST_CREATOR_BPS = 1000;

export type PilotSelection = { enabled: boolean; sellers: string[] };

export function paymentPolicyForNewQuotes(): PolicyVersion {
  return process.env.STOREY_PAYMENT_POLICY === PAYMENT_POLICY ? PAYMENT_POLICY : ORIGINAL_POLICY;
}

export function paymentPolicyForSeller(sellerHandle: string, selection: PilotSelection): PolicyVersion {
  if (!selection.enabled) return ORIGINAL_POLICY;
  const sellers = selection.sellers.map((seller) => seller.trim().toLowerCase()).filter((seller) => seller.length > 0);
  if (!sellers.includes(sellerHandle.trim().toLowerCase())) return ORIGINAL_POLICY;
  return PAYMENT_POLICY;
}

export function paymentPolicyPaused(): boolean {
  return paymentPolicyForNewQuotes() === ORIGINAL_POLICY;
}
