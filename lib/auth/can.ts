import type { PlanCode } from "../commerce/plans.ts";
import type { AppRole } from "./access.ts";
import type { AccessLevel } from "./permissions.ts";

export type SodActor = {
  role: AppRole;
  userId: string | null;
  tenantId: string | null;
  plan: PlanCode | null;
};

export type SodAction =
  | "creator.storefront"
  | "creator.campaign"
  | "creator.orders"
  | "creator.catalog"
  | "creator.bin"
  | "supplier.queue"
  | "supplier.catalog"
  | "supplier.fulfill"
  | "supplier.settlements"
  | "admin.refund";

export type SodResource = {
  tenantId?: string | null;
  ownerId?: string | null;
};

export function can(actor: SodActor, action: SodAction, resource: SodResource = {}): AccessLevel {
  if (actor.role === "guest") return "NO_ACCESS";
  const otherOwner = resource.ownerId != null && resource.ownerId !== actor.userId;
  const otherTenant = resource.tenantId != null && resource.tenantId !== actor.tenantId;

  if (action === "creator.storefront" || action === "creator.campaign") {
    if (actor.role !== "creator" || otherOwner) return "NO_ACCESS";
    if (actor.plan !== "branded" && actor.plan !== "scale") return "TIER_GATED";
    return "FULL_ACCESS";
  }
  if (action === "creator.orders") {
    if (actor.role !== "creator" || otherOwner || otherTenant) return "NO_ACCESS";
    return "MASKED_PII";
  }
  if (action === "creator.catalog") return actor.role === "creator" ? "FULL_ACCESS" : "NO_ACCESS";
  if (action === "creator.bin") {
    if (actor.role !== "creator" || otherOwner || otherTenant) return "NO_ACCESS";
    if (actor.plan === "scale") return "FULL_ACCESS";
    return actor.plan === "branded" ? "TIER_GATED" : "NO_ACCESS";
  }
  if (action === "supplier.queue" || action === "supplier.catalog" || action === "supplier.fulfill") {
    if (actor.role !== "supplier" || actor.tenantId == null || otherTenant) return "NO_ACCESS";
    return "FULL_ACCESS";
  }
  if (action === "supplier.settlements") {
    if (actor.role !== "supplier" || otherTenant) return "NO_ACCESS";
    return "VIEW_ONLY";
  }
  if (action === "admin.refund") return actor.role === "admin" ? "VIEW_ONLY" : "NO_ACCESS";
  return "NO_ACCESS";
}

export function commitIfAllowed<T>(level: AccessLevel, current: T, next: T): T {
  return level === "FULL_ACCESS" ? next : current;
}

export function denialCode(level: AccessLevel): "UPGRADE_REQUIRED" | "NO_ACCESS" | null {
  if (level === "TIER_GATED") return "UPGRADE_REQUIRED";
  if (level === "NO_ACCESS") return "NO_ACCESS";
  return null;
}

export function developmentRole(nodeEnv: string | undefined, value: string | undefined): "creator" | "supplier" | "admin" | null {
  if (nodeEnv !== "development") return null;
  if (value === "creator" || value === "supplier" || value === "admin") return value;
  return null;
}
