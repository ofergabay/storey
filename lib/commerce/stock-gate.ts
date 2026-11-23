const MINUTE = 60 * 1000;
export const HEARTBEAT_LIMIT_MS = 5 * MINUTE;

export function activateLivePool(
  attested: boolean,
  counted: number,
):
  | { ok: true; mode: "live"; sellable: number }
  | { ok: false; code: "BLOCKED_NO_ATTESTATION"; operation: "live stock activation" } {
  if (!attested || !Number.isInteger(counted) || counted < 0) {
    return { ok: false, code: "BLOCKED_NO_ATTESTATION", operation: "live stock activation" };
  }
  return { ok: true, mode: "live", sellable: counted };
}

export function sandboxPool(quantity: number): { mode: "sandbox"; quantity: number; attested: false } {
  return { mode: "sandbox", quantity, attested: false };
}

export function warehouseCheckout(
  lastHeartbeatAt: number,
  now: number,
): { ok: true } | { ok: false; code: "HEARTBEAT_STALE"; operation: "new checkout holds" } {
  if (now - lastHeartbeatAt > HEARTBEAT_LIMIT_MS) {
    return { ok: false, code: "HEARTBEAT_STALE", operation: "new checkout holds" };
  }
  return { ok: true };
}
