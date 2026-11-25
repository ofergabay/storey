import { revalidatePath } from "next/cache";
import { priceQuote, testRates } from "@/lib/commerce/payment/calculate";
import { WEEKLY_POLICY } from "@/lib/commerce/payment/flag";
import { readPaymeAttempt, readPaymeAttemptBySale, writePaymeAttempt, type PaymeAttempt } from "@/lib/commerce/payment/payme/attempts";
import { openHostedSale, reconcileUnknownCapture, settlePaymeCallback } from "@/lib/commerce/payment/payme/checkout";
import { paymeConfigMessage, readPaymeConfig, sellerPaymeId } from "@/lib/commerce/payment/payme/config";
import { fetchTransport } from "@/lib/commerce/payment/payme/client";
import { writePaymentCase } from "@/lib/commerce/payment/store";
import { readCatalog, writeCatalog } from "@/lib/catalog/store";
import { releaseHold } from "@/lib/workspace/engine";
import { readWorkspace, writeWorkspace } from "@/lib/workspace/store";
import type { WorkOrder } from "@/lib/workspace/engine";

export function allocationForOrder(order: WorkOrder) {
  if (order.policyVersion === WEEKLY_POLICY && order.shippingSnapshot) return order.shippingSnapshot.allocation;
  const catalog = readCatalog();
  const product = catalog.products.find((item) => item.sku === order.sku);
  const priced = priceQuote({
    ...testRates(),
    policyVersion: order.policyVersion === WEEKLY_POLICY ? WEEKLY_POLICY : undefined,
    lines: [
      {
        id: "item",
        supplierId: product?.warehouseCode ?? "pilot",
        sku: order.sku,
        quantity: order.quantity,
        unitRetailAgorot: order.unitAgorot,
        unitWholesaleAgorot: product?.costAgorot ?? 0,
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
  return priced.ok ? priced.allocation : null;
}

export async function preparePaymeCheckout(orderId: string): Promise<{ redirectUrl: string } | { message: string }> {
  const workspace = readWorkspace();
  const order = workspace.orders.find((item) => item.id === orderId && item.status === "held");
  if (!order) return { message: "ההזמנה אינה ממתינה לתשלום." };
  const configured = readPaymeConfig();
  if (!configured.ok) {
    order.paymentNote = paymeConfigMessage(configured.missing);
    writeWorkspace(workspace);
    return { message: order.paymentNote };
  }
  const merchant = sellerPaymeId(configured.config, order.sellerHandle);
  if (!merchant) {
    order.paymentNote = paymeConfigMessage(["חשבון ספק מאושר"]);
    writeWorkspace(workspace);
    return { message: order.paymentNote };
  }
  const existing = readPaymeAttempt(order.id);
  if (existing?.status === "capture_unknown") {
    const reconciled = await reconcileUnknownCapture({
      attempt: existing,
      now: Date.now(),
      clientKey: configured.config.clientKey,
      clientPassword: configured.config.clientPassword,
      transport: fetchTransport(),
    });
    writePaymeAttempt(reconciled);
    writePaymentCase({ adapter: "payme", live: false, paymeSaleId: reconciled.paymeSaleId, state: reconciled.state });
    syncOrder(reconciled);
    if (reconciled.status !== "captured") {
      order.paymentNote = "בודקים את ניסיון התשלום המקורי. לא נפתח ניסיון נוסף.";
      writeWorkspace(workspace);
    }
    return { message: order.paymentNote ?? "בודקים את ניסיון התשלום המקורי." };
  }
  const allocation = allocationForOrder(order);
  if (!allocation) {
    order.paymentNote = "ההצעה נחסמה לפני הרשאה. לא נוצר חיוב.";
    writeWorkspace(workspace);
    return { message: order.paymentNote };
  }
  const opened = await openHostedSale({
    existing,
    orderId: order.id,
    token: order.token,
    sellerHandle: order.sellerHandle,
    sellerPaymeId: merchant,
    amount: allocation.charge,
    allocation,
    now: Date.now(),
    holdExpiresAt: Date.parse(order.holdExpiresAt),
    config: configured.config,
    transport: fetchTransport(),
  });
  if (!opened.ok) {
    order.paymentNote = opened.code === "HOLD_EXPIRED" ? "השמירה פגה. לא נפתח תשלום." : "לא נפתח עמוד תשלום. לא נפתח ניסיון נוסף.";
    writeWorkspace(workspace);
    return { message: order.paymentNote };
  }
  writePaymeAttempt(opened.attempt);
  writePaymentCase({ adapter: "payme", live: false, paymeSaleId: opened.attempt.paymeSaleId, state: opened.attempt.state });
  order.paymentCaseId = order.id;
  order.paymentNote = "נפתח עמוד תשלום מאובטח. Storey לא שומרת פרטי כרטיס.";
  writeWorkspace(workspace);
  return { redirectUrl: opened.redirectUrl };
}

export async function ingestPaymeFields(fields: Record<string, string>): Promise<void> {
  const saleId = fields.payme_sale_id ?? "";
  const attempt = saleId ? readPaymeAttemptBySale(saleId) : null;
  if (!attempt) return;
  const configured = readPaymeConfig();
  if (!configured.ok) return;
  const settled = await settlePaymeCallback({
    attempt,
    fields,
    now: Date.now(),
    clientKey: configured.config.clientKey,
    clientPassword: configured.config.clientPassword,
    transport: fetchTransport(),
  });
  writePaymeAttempt(settled.attempt);
  writePaymentCase({ adapter: "payme", live: false, paymeSaleId: settled.attempt.paymeSaleId, state: settled.attempt.state });
  syncOrder(settled.attempt);
}

function syncOrder(attempt: PaymeAttempt): void {
  const workspace = readWorkspace();
  const order = workspace.orders.find((item) => item.id === attempt.orderId);
  if (!order) return;
  order.paymentCaseId = order.id;
  if (attempt.status === "captured" && attempt.state.status === "captured") {
    const releases = attempt.state.events.filter((event) => event.startsWith("fo-release")).length;
    if (order.status === "held" && releases > 0) order.status = "sandbox_paid";
    order.paymentNote = "PayMe בסביבת בדיקה אישר את הסכום. Storey לא שמרה פרטי כרטיס.";
  } else if (attempt.status === "voided" && order.status === "held") {
    releaseOrderHold(order);
    order.status = "cancelled";
    order.paymentNote = "ההרשאה בוטלה. לא בוצע חיוב.";
  } else if (attempt.status === "failed" && order.status === "held") {
    releaseOrderHold(order);
    order.status = "failed";
    order.paymentNote = "התשלום נכשל. לא בוצע חיוב.";
  } else if (attempt.status === "capture_unknown") {
    order.paymentNote = "תשובת החיוב לא הגיעה. הבדיקה נשארת על אותו ניסיון.";
  }
  writeWorkspace(workspace);
  revalidatePath(`/track/${order.token}`);
  revalidatePath("/supplier");
  revalidatePath("/admin/finance");
}

function releaseOrderHold(order: WorkOrder): void {
  if (order.status !== "held") return;
  const catalog = readCatalog();
  writeCatalog({ ...catalog, stock: releaseHold(catalog.stock, { sku: order.sku, warehouseCode: order.warehouseCode, quantity: order.quantity }) });
}
