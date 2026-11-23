export type OrderLine = {
  id: string;
  supplierId: string;
  warehouseId: string;
  sku: string;
  quantity: number;
  merchandiseAgorot: number;
  freightAgorot: number;
};

export type FulfillmentLine = OrderLine & {
  shipped: number;
  rejected: number;
};

export type Shipment = {
  key: string;
  lineId: string;
  quantity: number;
};

export type Fulfillment = {
  lines: FulfillmentLine[];
  shipments: Shipment[];
};

export function routeOrder(lines: OrderLine[]): Fulfillment {
  const groups = new Map<string, FulfillmentLine[]>();
  for (const line of lines) {
    const key = `${line.supplierId}:${line.warehouseId}`;
    const bucket = groups.get(key) ?? [];
    bucket.push({ ...line, shipped: 0, rejected: 0 });
    groups.set(key, bucket);
  }
  const ordered = [...groups.entries()].sort((left, right) => {
    const leftFreight = left[1].reduce((sum, line) => sum + line.freightAgorot, 0);
    const rightFreight = right[1].reduce((sum, line) => sum + line.freightAgorot, 0);
    if (leftFreight !== rightFreight) return leftFreight - rightFreight;
    return left[0].localeCompare(right[0]);
  });
  return { lines: ordered.flatMap((entry) => entry[1]), shipments: [] };
}

export function handoff(
  state: Fulfillment,
  input: { key: string; lineId: string; quantity: number },
):
  | { ok: true; state: Fulfillment; replayed: boolean }
  | { ok: false; code: "MISSING" | "QUANTITY"; state: Fulfillment } {
  const existing = state.shipments.find((shipment) => shipment.key === input.key);
  if (existing) {
    if (existing.lineId !== input.lineId || existing.quantity !== input.quantity) {
      return { ok: false, code: "QUANTITY", state };
    }
    return { ok: true, state, replayed: true };
  }
  const line = state.lines.find((row) => row.id === input.lineId);
  if (!line) return { ok: false, code: "MISSING", state };
  const open = line.quantity - line.shipped - line.rejected;
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > open) {
    return { ok: false, code: "QUANTITY", state };
  }
  return {
    ok: true,
    replayed: false,
    state: {
      shipments: [...state.shipments, { key: input.key, lineId: input.lineId, quantity: input.quantity }],
      lines: state.lines.map((row) => (row.id === line.id ? { ...row, shipped: row.shipped + input.quantity } : row)),
    },
  };
}

export function rejectOutstanding(
  state: Fulfillment,
  lineId: string,
):
  | { ok: true; state: Fulfillment; merchandiseAgorot: number; freightAgorot: number }
  | { ok: false; code: "MISSING" | "NONE"; state: Fulfillment } {
  const line = state.lines.find((row) => row.id === lineId);
  if (!line) return { ok: false, code: "MISSING", state };
  const open = line.quantity - line.shipped - line.rejected;
  if (open < 1) return { ok: false, code: "NONE", state };
  const merchandise = Math.round((line.merchandiseAgorot * open) / line.quantity);
  const freight = line.shipped === 0 ? line.freightAgorot : 0;
  return {
    ok: true,
    merchandiseAgorot: merchandise,
    freightAgorot: freight,
    state: {
      ...state,
      lines: state.lines.map((row) => (row.id === line.id ? { ...row, rejected: row.rejected + open } : row)),
    },
  };
}
