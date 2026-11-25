import type { WeeklyInstruction } from "../weekly.ts";

export type WithdrawalDraft = {
  kind: "withdrawal";
  sellerPaymeId: string;
  withdrawal_currency: "ILS";
  withdrawal_amount: number;
};

export type BalanceTransferDraft = {
  kind: "transfer";
  fromSellerPaymeId: string;
  toSellerPaymeId: string;
  amount: number;
  currency: "ILS";
};

export function withdrawalAmount(batchAmount: number, walletBalance: number): number {
  if (!Number.isInteger(batchAmount) || batchAmount < 1) return 0;
  if (!Number.isInteger(walletBalance) || walletBalance < 0) return batchAmount;
  return batchAmount;
}

export function draftWithdrawal(input: { sellerPaymeId: string; batch: WeeklyInstruction; walletBalance: number }): WithdrawalDraft {
  return {
    kind: "withdrawal",
    sellerPaymeId: input.sellerPaymeId,
    withdrawal_currency: "ILS",
    withdrawal_amount: withdrawalAmount(input.batch.amount, input.walletBalance),
  };
}

export function draftBalanceTransfer(input: { fromSellerPaymeId: string; toSellerPaymeId: string; amount: number }): BalanceTransferDraft {
  return { kind: "transfer", fromSellerPaymeId: input.fromSellerPaymeId, toSellerPaymeId: input.toSellerPaymeId, amount: input.amount, currency: "ILS" };
}

export function submitWithdrawal(draft: WithdrawalDraft, enabled: boolean): { submitted: false; reason: "DISABLED"; withdrawal_amount: number } {
  if (enabled) return { submitted: false, reason: "DISABLED", withdrawal_amount: draft.withdrawal_amount };
  return { submitted: false, reason: "DISABLED", withdrawal_amount: draft.withdrawal_amount };
}
