import { PAYME_SANDBOX_BASE, PAYME_SANDBOX_ORIGIN, type PaymentPort, type PortResult, type SaleSnapshot } from "../port.ts";
import type { PaymeConfig } from "./config.ts";
import { interpretTransactions, type TransactionRow } from "./transactions.ts";

export type PaymeTransport = {
  post(path: string, body: Record<string, unknown>): Promise<{ httpStatus: number; json: unknown | null }>;
};

const UNKNOWN_CODES = new Set([991, 20002, 999, 998]);

export type PaymeBody = Record<string, unknown>;

export function interpretPayme(httpStatus: number, json: unknown): { kind: "ok"; body: PaymeBody } | { kind: "declined"; body: PaymeBody } | { kind: "unknown" } {
  if (httpStatus === 429 || json === null || typeof json !== "object" || Array.isArray(json)) return { kind: "unknown" };
  const body = json as PaymeBody;
  const code = typeof body.status_code === "number" ? body.status_code : null;
  if (code === null || UNKNOWN_CODES.has(code)) return { kind: "unknown" };
  if (code === 0 && httpStatus >= 200 && httpStatus < 300) return { kind: "ok", body };
  if (code === 1) return { kind: "declined", body };
  return { kind: "unknown" };
}

export function fetchTransport(base = PAYME_SANDBOX_BASE): PaymeTransport {
  return {
    async post(path, body) {
      const url = new URL(path, base);
      if (url.origin !== PAYME_SANDBOX_ORIGIN) return { httpStatus: 0, json: null };
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15000),
        });
        const text = await response.text();
        try {
          return { httpStatus: response.status, json: JSON.parse(text) as unknown };
        } catch {
          return { httpStatus: response.status, json: null };
        }
      } catch {
        return { httpStatus: 0, json: null };
      }
    },
  };
}

function saleUrlAccepted(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).origin === PAYME_SANDBOX_ORIGIN;
  } catch {
    return false;
  }
}

export function generateSaleBody(config: PaymeConfig, input: { orderId: string; amount: number; sellerPaymeId: string; callbackUrl: string; returnUrl: string }): PaymeBody {
  return {
    payme_client_key: config.clientKey,
    seller_payme_id: input.sellerPaymeId,
    sale_price: input.amount,
    currency: "ILS",
    sale_type: "authorize",
    transaction_id: input.orderId,
    sale_callback_url: input.callbackUrl,
    sale_return_url: input.returnUrl,
    market_fee: 0,
    language: "en",
  };
}

export function saleAmountAccepted(amount: number): boolean {
  return Number.isInteger(amount) && amount > 0;
}

export async function generateSale(config: PaymeConfig, transport: PaymeTransport, input: { orderId: string; amount: number; sellerPaymeId: string; callbackUrl: string; returnUrl: string }): Promise<PortResult<{ saleId: string; saleUrl: string }>> {
  if (!saleAmountAccepted(input.amount) || config.env !== "sandbox") return { ok: false, code: "DECLINED" };
  const response = await transport.post("generate-sale", generateSaleBody(config, input));
  const interpreted = interpretPayme(response.httpStatus, response.json);
  if (interpreted.kind === "unknown") return { ok: false, code: "UNKNOWN" };
  if (interpreted.kind === "declined") return { ok: false, code: "DECLINED" };
  const saleId = interpreted.body.payme_sale_id;
  const saleUrl = interpreted.body.sale_url;
  if (typeof saleId !== "string" || saleId.length === 0 || !saleUrlAccepted(saleUrl)) return { ok: false, code: "UNKNOWN" };
  return { ok: true, value: { saleId, saleUrl } };
}

export async function getTransactions(config: PaymeConfig, transport: PaymeTransport, input: { sellerPaymeId: string; orderId: string; saleId: string; amount: number; authorization: boolean }): Promise<PortResult<SaleSnapshot>> {
  const body: PaymeBody = {
    payme_client_key: config.clientKey,
    seller_payme_id: input.sellerPaymeId,
    transaction_id: input.orderId,
    language: "en",
  };
  if (input.authorization) body.transaction_type = 40;
  const response = await transport.post("get-transactions", body);
  const interpreted = interpretPayme(response.httpStatus, response.json);
  if (interpreted.kind !== "ok") return { ok: false, code: interpreted.kind === "declined" ? "DECLINED" : "UNKNOWN" };
  const rows = rowsFrom(interpreted.body);
  const snapshot = interpretTransactions(rows, input);
  if (!snapshot) return { ok: false, code: "MISMATCH" };
  return { ok: true, value: snapshot };
}

export async function captureSale(config: PaymeConfig, transport: PaymeTransport, input: { sellerPaymeId: string; saleId: string; amount: number }): Promise<PortResult<{ accepted: boolean }>> {
  const response = await transport.post("capture-sale", {
    payme_client_key: config.clientKey,
    seller_payme_id: input.sellerPaymeId,
    payme_sale_id: input.saleId,
    sale_price: input.amount,
    language: "en",
  });
  const interpreted = interpretPayme(response.httpStatus, response.json);
  if (interpreted.kind === "unknown") return { ok: false, code: "UNKNOWN" };
  if (interpreted.kind === "declined") return { ok: false, code: "DECLINED" };
  return { ok: true, value: { accepted: true } };
}

export async function refundSale(config: PaymeConfig, transport: PaymeTransport, input: { sellerPaymeId: string; saleId: string; amount?: number }): Promise<PortResult<{ accepted: boolean }>> {
  const body: PaymeBody = {
    payme_client_key: config.clientKey,
    seller_payme_id: input.sellerPaymeId,
    payme_sale_id: input.saleId,
    language: "en",
  };
  if (input.amount !== undefined) body.sale_refund_amount = input.amount;
  const response = await transport.post("refund-sale", body);
  const interpreted = interpretPayme(response.httpStatus, response.json);
  if (interpreted.kind === "unknown") return { ok: false, code: "UNKNOWN" };
  if (interpreted.kind === "declined") return { ok: false, code: "DECLINED" };
  return { ok: true, value: { accepted: true } };
}

export function rowsFrom(body: PaymeBody): TransactionRow[] {
  const list = body.items ?? body.transactions ?? body.sales;
  if (!Array.isArray(list)) return [];
  return list.filter((row): row is TransactionRow => typeof row === "object" && row !== null);
}

export function paymePaymentPort(config: PaymeConfig, transport: PaymeTransport): PaymentPort {
  return {
    adapter: "payme",
    live: false,
    async createAuthorization(input) {
      const opened = await generateSale(config, transport, input);
      if (!opened.ok) return opened;
      return { ok: true, value: { ...opened.value, amount: input.amount, orderId: input.orderId } };
    },
    async resume(sale) {
      if (!saleUrlAccepted(sale.saleUrl)) return { ok: false, code: "CONFIG" };
      return { ok: true, value: sale };
    },
    readSale(input) {
      return getTransactions(config, transport, input);
    },
    async capture(input) {
      const captured = await captureSale(config, transport, input);
      if (!captured.ok) return captured;
      return {
        ok: true,
        value: {
          saleId: input.saleId,
          merchantId: input.sellerPaymeId,
          orderId: input.saleId,
          currency: "ILS",
          amount: input.amount,
          operation: "completed",
          refunded: 0,
          transactionId: input.saleId,
          refundTransactionIds: [],
        },
      };
    },
    async voidAuthorization(input) {
      const voided = await refundSale(config, transport, input);
      if (!voided.ok) return voided;
      return { ok: true, value: emptySnapshot(input.saleId, input.sellerPaymeId, "voided") };
    },
    async refund(input) {
      const refunded = await refundSale(config, transport, input);
      if (!refunded.ok) return refunded;
      return { ok: true, value: { ...emptySnapshot(input.saleId, input.sellerPaymeId, "partial-refund"), amount: input.amount, refunded: input.amount } };
    },
  };
}

function emptySnapshot(saleId: string, merchantId: string, operation: SaleSnapshot["operation"]): SaleSnapshot {
  return { saleId, merchantId, orderId: "", currency: "ILS", amount: 0, operation, refunded: 0, transactionId: saleId, refundTransactionIds: [] };
}
