import { secondApproval } from "../commerce/access.ts";

export type LedgerCorrection = {
  id: string;
  kind: "refund" | "split";
  initiatorId: string;
  approverId: string | null;
  status: "pending" | "refused";
  reason: string;
  posted: false;
};

export function requestCorrection(input: { id: string; kind: "refund" | "split"; initiatorId: string; reason: string }): LedgerCorrection {
  return {
    id: input.id,
    kind: input.kind,
    initiatorId: input.initiatorId,
    approverId: null,
    status: "pending",
    reason: input.reason,
    posted: false,
  };
}

export function approveCorrection(request: LedgerCorrection, approverId: string): { ok: true; request: LedgerCorrection } | { ok: false; code: "SECOND_ACTOR_REQUIRED"; request: LedgerCorrection } {
  const approval = secondApproval(request.initiatorId, approverId);
  if (!approval.ok) {
    return { ok: false, code: "SECOND_ACTOR_REQUIRED", request: { ...request, status: "refused", approverId, posted: false } };
  }
  return { ok: true, request: { ...request, status: "pending", approverId, posted: false } };
}
