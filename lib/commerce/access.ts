export type Actor = "seller" | "supplier" | "consumer" | "admin";

const grants: Record<string, Actor[]> = {
  publish: ["seller", "admin"],
  place_order: ["consumer"],
  pick: ["supplier"],
  inspect_return: ["supplier", "admin"],
  payout: ["admin"],
};

export function allow(actor: Actor, operation: keyof typeof grants): boolean {
  return grants[operation].includes(actor);
}

export function secondApproval(
  initiator: string,
  approver: string,
): { ok: true } | { ok: false; code: "SECOND_ACTOR_REQUIRED"; operation: "manual payout destination override" } {
  if (!initiator || !approver || initiator === approver) {
    return { ok: false, code: "SECOND_ACTOR_REQUIRED", operation: "manual payout destination override" };
  }
  return { ok: true };
}
