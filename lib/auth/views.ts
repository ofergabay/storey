export type CreatorOrderView = {
  id: string;
  status: string;
  sellerHandle: string;
  buyerName: string;
  phone: null;
  street: null;
  email: null;
};

export function creatorOrderView(order: {
  id: string;
  status: string;
  sellerHandle: string;
  buyerName?: string | null;
  phone?: string | null;
  street?: string | null;
  email?: string | null;
}): CreatorOrderView {
  return {
    id: order.id,
    status: order.status,
    sellerHandle: order.sellerHandle,
    buyerName: order.buyerName ?? "",
    phone: null,
    street: null,
    email: null,
  };
}

export function ordersForCreator<T extends { sellerHandle: string }>(orders: T[], sellerHandle: string, readOnly: boolean): T[] {
  if (readOnly) return orders;
  return orders.filter((order) => order.sellerHandle === sellerHandle);
}

export type SupplierQueueOrder = {
  id: string;
  sku: string;
  quantity: number;
  warehouseCode: string;
  sellerHandle: string;
  status: string;
};

export function supplierQueue<T extends { warehouseCode: string }>(orders: T[], warehouse: string | null, readOnly: boolean): T[] {
  if (readOnly) return orders;
  if (!warehouse) return [];
  return orders.filter((order) => order.warehouseCode === warehouse);
}

export function supplierCatalogView<T extends { warehouseCode: string }>(products: T[], warehouse: string | null): T[] {
  if (!warehouse) return [];
  return products.filter((product) => product.warehouseCode === warehouse);
}

export function supplierFulfillmentView(order: SupplierQueueOrder & { unitAgorot?: number; phone?: string; street?: string; recipient?: string }) {
  return {
    id: order.id,
    sku: order.sku,
    quantity: order.quantity,
    warehouseCode: order.warehouseCode,
    recipient: order.recipient ?? "",
    phone: order.phone ?? "",
    street: order.street ?? "",
    retailAgorot: null as null,
  };
}

export function blindShippingSlip(input: { brand: string; recipient: string; lines: string[] }) {
  return {
    brand: input.brand,
    recipient: input.recipient,
    lines: input.lines,
    supplierName: null as null,
    supplierLogo: null as null,
  };
}

export function adminLedgerView(entry: { id: string; debit: number; credit: number }) {
  return { id: entry.id, debit: entry.debit, credit: entry.credit, mutable: false as const };
}
