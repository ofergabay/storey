import { createHash, timingSafeEqual } from "node:crypto";

export function partnerSignature(clientKey: string, clientPassword: string, paymeTransactionId: string, paymeSaleId: string): string {
  return createHash("md5").update(`${clientKey}${clientPassword}${paymeTransactionId}${paymeSaleId}`).digest("hex");
}

export function signaturesMatch(expected: string, provided: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function classifySignature(input: {
  clientKey: string;
  clientPassword: string;
  fields: Record<string, string>;
}): "valid" | "invalid" | "unsigned" {
  const provided = input.fields.payme_signature ?? "";
  if (!provided) return "unsigned";
  const expected = partnerSignature(
    input.clientKey,
    input.clientPassword,
    input.fields.payme_transaction_id ?? "",
    input.fields.payme_sale_id ?? "",
  );
  return signaturesMatch(expected, provided) ? "valid" : "invalid";
}
