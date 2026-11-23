export function requestReturn(input: {
  delivered: number;
  openOrCompleted: number;
  quantity: number;
}): { ok: true; quantity: number } | { ok: false; code: "QUANTITY" } {
  const remaining = input.delivered - input.openOrCompleted;
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > remaining) {
    return { ok: false, code: "QUANTITY" };
  }
  return { ok: true, quantity: input.quantity };
}

export function inspectReturn(input: {
  quantity: number;
  sellable: number;
  damaged: number;
}): { ok: true; restore: number; quarantine: number } | { ok: false; code: "QUANTITY" } {
  if (input.sellable < 0 || input.damaged < 0 || input.sellable + input.damaged !== input.quantity) {
    return { ok: false, code: "QUANTITY" };
  }
  return { ok: true, restore: input.sellable, quarantine: input.damaged };
}
