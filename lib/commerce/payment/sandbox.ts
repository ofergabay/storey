import { priceQuote, testRates, type Allocation, type BlockCode } from "./calculate.ts";
import { authorize, captureResult, deliverParcel, handoffUnit, rejectBeforeHandoff, startFromAllocation, submitAttempt, type PayState } from "./workflow.ts";

export type TestCapture =
  | { ok: true; adapter: "test"; live: false; state: PayState }
  | { ok: false; adapter: "test"; live: false; code: BlockCode | "NOT_CAPTURED" };

export function captureTestAdapter(input: {
  id: string;
  quantity: number;
  retailAgorot: number;
  wholesaleAgorot: number;
  supplierId: string;
  now: number;
}): TestCapture {
  const priced = priceQuote({
    ...testRates(),
    lines: [
      {
        id: "item",
        supplierId: input.supplierId,
        sku: "sandbox",
        quantity: input.quantity,
        unitRetailAgorot: input.retailAgorot,
        unitWholesaleAgorot: input.wholesaleAgorot,
        prepaidQuantity: 0,
        serviceGroup: "ship",
        taxAgorot: 0,
      },
    ],
    services: [{ id: "ship", buyerFreightAgorot: 0, supplierFreightAgorot: 0, packingAgorot: 0 }],
    buyerFeeAgorot: 0,
    discountAgorot: 0,
    pspFeeAgorot: 0,
  });
  if (!priced.ok) return { ok: false, adapter: "test", live: false, code: priced.code };
  const quoted = startFromAllocation({ id: input.id, allocation: priced.allocation, now: input.now });
  const provider = { ref: `test-${input.id}`, status: "authorized" as const, amount: quoted.charge, eventId: "test-auth" };
  const submitted = submitAttempt(quoted, { key: `attempt:${input.id}`, provider, now: input.now });
  if (!submitted.ok) return { ok: false, adapter: "test", live: false, code: "NOT_CAPTURED" };
  const authorized = authorize(submitted.state, { key: `auth:${input.id}`, provider, now: input.now });
  if (!authorized.ok) return { ok: false, adapter: "test", live: false, code: "NOT_CAPTURED" };
  const captured = captureResult(authorized.state, {
    key: `capture:${input.id}`,
    provider: { ...provider, status: "captured", eventId: "test-capture" },
    eventId: "test-capture",
  });
  if (!captured.ok || captured.state.status !== "captured") return { ok: false, adapter: "test", live: false, code: "NOT_CAPTURED" };
  return { ok: true, adapter: "test", live: false, state: captured.state };
}

export function captureAllocation(input: { id: string; allocation: Allocation; now: number }): TestCapture {
  const quoted = startFromAllocation(input);
  const provider = { ref: `test-${input.id}`, status: "authorized" as const, amount: quoted.charge, eventId: "test-auth" };
  const submitted = submitAttempt(quoted, { key: `attempt:${input.id}`, provider, now: input.now });
  if (!submitted.ok) return { ok: false, adapter: "test", live: false, code: "NOT_CAPTURED" };
  const authorized = authorize(submitted.state, { key: `auth:${input.id}`, provider, now: input.now });
  if (!authorized.ok) return { ok: false, adapter: "test", live: false, code: "NOT_CAPTURED" };
  const captured = captureResult(authorized.state, {
    key: `capture:${input.id}`,
    provider: { ...provider, status: "captured", eventId: "test-capture" },
    eventId: "test-capture",
  });
  if (!captured.ok || captured.state.status !== "captured") return { ok: false, adapter: "test", live: false, code: "NOT_CAPTURED" };
  return { ok: true, adapter: "test", live: false, state: captured.state };
}

export function captureTwoSupplier(now: number): TestCapture {
  const priced = priceQuote({
    ...testRates(),
    lines: [
      { id: "a", supplierId: "a", sku: "a", quantity: 1, unitRetailAgorot: 5900, unitWholesaleAgorot: 2400, prepaidQuantity: 0, serviceGroup: "ship", taxAgorot: 0 },
      { id: "b", supplierId: "b", sku: "b", quantity: 1, unitRetailAgorot: 8200, unitWholesaleAgorot: 4200, prepaidQuantity: 0, serviceGroup: "ship", taxAgorot: 0 },
    ],
    services: [{ id: "ship", buyerFreightAgorot: 0, supplierFreightAgorot: 0, packingAgorot: 0 }],
    buyerFeeAgorot: 0,
    discountAgorot: 0,
    pspFeeAgorot: 300,
  });
  if (!priced.ok) return { ok: false, adapter: "test", live: false, code: priced.code };
  return captureAllocation({ id: "qa-02-local", allocation: priced.allocation, now });
}

export function twoSupplierFixture(now: number): TestCapture {
  const captured = captureTwoSupplier(now);
  if (!captured.ok) return captured;
  const rejected = rejectBeforeHandoff(captured.state, { key: "reject-b", unitIds: ["b#1"] });
  if (!rejected.ok) return { ok: false, adapter: "test", live: false, code: "NOT_CAPTURED" };
  const handed = handoffUnit(rejected.state, { key: "hand-a", unitId: "a#1", parcelId: "parcel-a" });
  if (!handed.ok) return { ok: false, adapter: "test", live: false, code: "NOT_CAPTURED" };
  const delivered = deliverParcel(handed.state, { key: "deliver-a", parcelId: "parcel-a", at: now });
  if (!delivered.ok) return { ok: false, adapter: "test", live: false, code: "NOT_CAPTURED" };
  return { ok: true, adapter: "test", live: false, state: delivered.state };
}
