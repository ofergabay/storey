import type { SaleSnapshot } from "../port.ts";

export type TransactionRow = {
  payme_sale_id?: string;
  payme_transaction_id?: string;
  transaction_id?: string;
  seller_payme_id?: string;
  sale_currency?: string;
  transaction_price?: number;
  transaction_status?: string;
  transaction_action?: string;
  transaction_created_at?: string;
};

export function interpretTransactions(
  rows: TransactionRow[],
  expected: { sellerPaymeId: string; orderId: string; saleId: string; amount: number },
): SaleSnapshot | null {
  const matched = rows.filter((row) => rowMatches(row, expected));
  const refunds = matched.filter(refundCounts);
  const sales = matched.filter((row) => !isRefundAction(row.transaction_action) && row.transaction_price === expected.amount);
  const sale = newest(sales);
  if (!sale || !sale.payme_transaction_id) return null;
  const refunded = refunds.reduce((sum, row) => sum + (row.transaction_price ?? 0), 0);
  const operation = operationOf(sale.transaction_status ?? "", refunded, expected.amount);
  return {
    saleId: expected.saleId,
    merchantId: expected.sellerPaymeId,
    orderId: expected.orderId,
    currency: "ILS",
    amount: expected.amount,
    operation,
    refunded,
    transactionId: sale.payme_transaction_id,
    refundTransactionIds: refunds.map((row) => row.payme_transaction_id ?? "").filter((id) => id.length > 0),
  };
}

function rowMatches(row: TransactionRow, expected: { sellerPaymeId: string; orderId: string; saleId: string }): boolean {
  return row.payme_sale_id === expected.saleId && row.transaction_id === expected.orderId && row.seller_payme_id === expected.sellerPaymeId && row.sale_currency === "ILS";
}

function isRefundAction(action: string | undefined): boolean {
  return action === "Refund" || action === "Partial Refund";
}

function refundCounts(row: TransactionRow): boolean {
  if (!isRefundAction(row.transaction_action)) return false;
  const status = (row.transaction_status ?? "").toLowerCase();
  return status === "refunded" || status === "p-refund" || status === "partial-refund";
}

function newest(rows: TransactionRow[]): TransactionRow | null {
  if (rows.length === 0) return null;
  return [...rows].sort((left, right) => Date.parse(right.transaction_created_at ?? "") - Date.parse(left.transaction_created_at ?? ""))[0] ?? null;
}

function operationOf(status: string, refunded: number, amount: number): SaleSnapshot["operation"] {
  const value = status.toLowerCase();
  if (value.includes("void") || value.includes("cancel")) return "voided";
  if (value.includes("fail") || value.includes("declin") || value.includes("reject")) return "failed";
  if (refunded > 0 && refunded < amount) return "partial-refund";
  if (refunded > 0 && refunded === amount) return "partial-refund";
  if (value.includes("complete") || value.includes("capture") || value.includes("charge") || value === "paid") return "completed";
  if (value.includes("auth")) return "authorized";
  return "unknown";
}
