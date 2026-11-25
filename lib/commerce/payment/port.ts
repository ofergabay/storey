export const PAYME_SANDBOX_ORIGIN = "https://sandbox.payme.io";
export const PAYME_SANDBOX_BASE = "https://sandbox.payme.io/api/";

export type SaleOperation = "authorized" | "completed" | "voided" | "failed" | "partial-refund" | "unknown";

export type SaleSnapshot = {
  saleId: string;
  merchantId: string;
  orderId: string;
  currency: "ILS";
  amount: number;
  operation: SaleOperation;
  refunded: number;
  transactionId: string;
  refundTransactionIds: string[];
};

export type HostedAuthorization = {
  saleId: string;
  saleUrl: string;
  amount: number;
  orderId: string;
};

export type PortFailure = "CONFIG" | "UNKNOWN" | "DECLINED" | "MISMATCH" | "HOLD_EXPIRED" | "DISABLED";

export type PortResult<T> = { ok: true; value: T } | { ok: false; code: PortFailure };

export type PaymentPort = {
  adapter: "test" | "payme";
  live: false;
  createAuthorization(input: {
    orderId: string;
    amount: number;
    sellerPaymeId: string;
    callbackUrl: string;
    returnUrl: string;
  }): Promise<PortResult<HostedAuthorization>>;
  resume(sale: HostedAuthorization): Promise<PortResult<HostedAuthorization>>;
  readSale(input: { sellerPaymeId: string; orderId: string; saleId: string; amount: number; authorization: boolean }): Promise<PortResult<SaleSnapshot>>;
  capture(input: { sellerPaymeId: string; saleId: string; amount: number }): Promise<PortResult<SaleSnapshot>>;
  voidAuthorization(input: { sellerPaymeId: string; saleId: string }): Promise<PortResult<SaleSnapshot>>;
  refund(input: { sellerPaymeId: string; saleId: string; amount: number }): Promise<PortResult<SaleSnapshot>>;
};

export function testPaymentPort(): PaymentPort {
  return {
    adapter: "test",
    live: false,
    async createAuthorization(input) {
      return { ok: true, value: { saleId: `test-${input.orderId}`, saleUrl: "", amount: input.amount, orderId: input.orderId } };
    },
    async resume(sale) {
      return { ok: true, value: sale };
    },
    async readSale(input) {
      return {
        ok: true,
        value: {
          saleId: input.saleId,
          merchantId: input.sellerPaymeId,
          orderId: input.orderId,
          currency: "ILS",
          amount: input.amount,
          operation: "authorized",
          refunded: 0,
          transactionId: `test-${input.saleId}`,
          refundTransactionIds: [],
        },
      };
    },
    async capture(input) {
      return {
        ok: true,
        value: {
          saleId: input.saleId,
          merchantId: input.sellerPaymeId,
          orderId: "",
          currency: "ILS",
          amount: input.amount,
          operation: "completed",
          refunded: 0,
          transactionId: `test-capture-${input.saleId}`,
          refundTransactionIds: [],
        },
      };
    },
    async voidAuthorization(input) {
      return {
        ok: true,
        value: {
          saleId: input.saleId,
          merchantId: input.sellerPaymeId,
          orderId: "",
          currency: "ILS",
          amount: 0,
          operation: "voided",
          refunded: 0,
          transactionId: `test-void-${input.saleId}`,
          refundTransactionIds: [],
        },
      };
    },
    async refund(input) {
      return {
        ok: true,
        value: {
          saleId: input.saleId,
          merchantId: input.sellerPaymeId,
          orderId: "",
          currency: "ILS",
          amount: input.amount,
          operation: "partial-refund",
          refunded: input.amount,
          transactionId: `test-refund-${input.saleId}`,
          refundTransactionIds: [`test-refund-${input.saleId}`],
        },
      };
    },
  };
}
