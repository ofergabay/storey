import { CLOUD_NINE_SKU } from "../catalog/identity.ts";

export const googleCancelledHe = "ההתחברות עם Google בוטלה. אפשר לנסות שוב או להמשיך עם אימייל.";
export const productUnavailableHe = "המוצר שבחרתם כבר לא זמין לתמחור. בחרו מוצר אחר מהקטלוג.";
export const productUnavailablePath = "/catalog?unavailable=1";

export const AUTH_INTENT_COOKIE = "storey_auth_intent";
export const AUTH_FROM_COOKIE = "storey_auth_from";
export const AUTH_CHANNEL_COOKIE = "storey_auth_channel";
export const AUTH_NEXT_COOKIE = "storey_auth_next";
export const AUTH_PRODUCT_COOKIE = "storey_auth_product";
export const AUTH_COOKIE_NAMES = [AUTH_INTENT_COOKIE, AUTH_FROM_COOKIE, AUTH_CHANNEL_COOKIE, AUTH_NEXT_COOKIE, AUTH_PRODUCT_COOKIE] as const;

const CREATOR_PATHS = new Set([
  "/earnings",
  "/catalog",
  "/studio",
  "/onboarding",
  "/listings",
  "/orders",
  "/account",
  "/storefront",
  "/campaigns",
]);

export type AuthIntent = "login" | "register";
export type AuthSurface = "landing" | "page";
export type AccountRole = "admin" | "supplier" | "creator";

export type AuthContext = {
  intent: AuthIntent;
  from: AuthSurface;
  channel: "social" | "brand" | "partnership" | null;
  next: string | null;
  productId: string | null;
};

export type CatalogContinuation = {
  products: { sku: string }[];
  listings?: { sku: string; slug: string }[];
};

export type ContinuationResult =
  | { kind: "none" }
  | { kind: "pricing"; path: string; sku: string }
  | { kind: "unavailable"; path: typeof productUnavailablePath };

const PRODUCT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,64}$/;
const SHOWCASE_SKU: Record<string, string> = {
  "party-01": "PARTY-01",
  "cloud-nine": CLOUD_NINE_SKU,
};

export function isCreatorPricingPath(pathname: string): boolean {
  if (pathname === "/studio") return true;
  return /^\/catalog\/[A-Za-z0-9][A-Za-z0-9_-]{0,64}$/.test(pathname);
}

export function sanitizeProductId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = safeDecode(value.trim());
  if (!PRODUCT_ID.test(trimmed)) return null;
  return trimmed;
}

export function sanitizeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\") || trimmed.includes("://") || trimmed.includes("\0")) {
    return null;
  }
  const hash = trimmed.split("#")[0] ?? "";
  const queryIndex = hash.indexOf("?");
  const pathname = queryIndex >= 0 ? hash.slice(0, queryIndex) : hash;
  const query = queryIndex >= 0 ? hash.slice(queryIndex + 1) : "";
  if (pathname === "/onboarding") {
    return new URLSearchParams(query).get("plan") === "social" ? "/onboarding?plan=social" : "/onboarding";
  }
  if (isCreatorPricingPath(pathname)) return pathname;
  if (pathname === "/admin" || pathname === "/admin/staging" || pathname === "/supplier" || CREATOR_PATHS.has(pathname)) {
    return pathname;
  }
  return null;
}

export function resolveCreatorContinuation(productId: string | null | undefined, catalog: CatalogContinuation): ContinuationResult {
  if (productId == null || productId.trim() === "") return { kind: "none" };
  const id = sanitizeProductId(productId);
  if (!id) return { kind: "unavailable", path: productUnavailablePath };
  const key = id.toLowerCase();
  if (key === "cloud-nine" || key === CLOUD_NINE_SKU.toLowerCase()) {
    return { kind: "pricing", path: "/studio", sku: CLOUD_NINE_SKU };
  }
  const products = catalog.products;
  const listings = catalog.listings ?? [];
  const hinted = SHOWCASE_SKU[key] ?? id;
  const listed = listings.find((item) => item.slug.toLowerCase() === key || item.sku.toLowerCase() === key);
  const sku = products.find((item) => item.sku.toLowerCase() === hinted.toLowerCase() || item.sku.toLowerCase() === key)?.sku
    ?? (listed ? products.find((item) => item.sku === listed.sku)?.sku : undefined);
  if (!sku || !PRODUCT_ID.test(sku)) return { kind: "unavailable", path: productUnavailablePath };
  if (sku === CLOUD_NINE_SKU) return { kind: "pricing", path: "/studio", sku };
  return { kind: "pricing", path: `/catalog/${sku}`, sku };
}

export function onboardingDestination(productId: string | null | undefined, catalog: CatalogContinuation): string | null {
  const resolved = resolveCreatorContinuation(productId, catalog);
  if (resolved.kind === "none") return null;
  return resolved.path;
}

export function productEntryDestination(role: "guest" | AccountRole, productId: string | null | undefined, catalog: CatalogContinuation): string {
  if (role === "guest") {
    const id = sanitizeProductId(productId);
    return id ? `/?auth=register&product=${encodeURIComponent(id)}#inventory` : "/?auth=register#inventory";
  }
  const resolved = resolveCreatorContinuation(productId, catalog);
  if (resolved.kind !== "none" && (role === "creator" || role === "admin")) return resolved.path;
  if (role === "admin") return "/admin/staging";
  if (role === "supplier") return "/supplier";
  if (role === "creator") return "/earnings";
  return "/";
}

export function readAuthContext(
  params: Pick<URLSearchParams, "get">,
  cookie: (name: string) => string | undefined,
): AuthContext {
  const intentValue = params.get("intent") ?? cookie(AUTH_INTENT_COOKIE);
  const fromValue = params.get("from") ?? cookie(AUTH_FROM_COOKIE);
  const channelValue = params.get("channel") ?? cookie(AUTH_CHANNEL_COOKIE);
  const nextValue = params.get("next") ?? cookie(AUTH_NEXT_COOKIE);
  return {
    intent: intentValue === "register" ? "register" : "login",
    from: fromValue === "landing" ? "landing" : "page",
    channel: channelValue === "social" || channelValue === "brand" || channelValue === "partnership" ? channelValue : null,
    next: sanitizeNextPath(nextValue ? safeDecode(nextValue) : null),
    productId: sanitizeProductId(params.get("product") ?? cookie(AUTH_PRODUCT_COOKIE)),
  };
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function failurePath(context: AuthContext): string {
  if (context.from === "landing") {
    const channel = context.channel ? `&channel=${context.channel}` : "";
    return `/?auth=${context.intent}&error=google${channel}#channel-selection`;
  }
  return context.intent === "register" ? "/register?error=google" : "/login?error=google";
}

export function isFreshAccount(createdAt: string | null | undefined, now: number): boolean {
  if (!createdAt) return false;
  const created = Date.parse(createdAt);
  return Number.isFinite(created) && created <= now && now - created < 120_000;
}

export function workspaceDestination(input: {
  role: AccountRole;
  createdAt: string | null;
  now: number;
  requested: string | null;
  intent: AuthIntent;
  productId?: string | null;
  products?: { sku: string }[];
  listings?: { sku: string; slug: string }[];
  onboarded?: boolean;
}): string {
  const fresh = isFreshAccount(input.createdAt, input.now);
  const needsOnboarding = input.role === "creator" && input.onboarded !== true && (input.intent === "register" || fresh);
  const productId = sanitizeProductId(input.productId) ?? productIdFromPricingPath(input.requested);
  if (needsOnboarding) {
    return productId ? `/onboarding?plan=social&product=${encodeURIComponent(productId)}` : "/onboarding?plan=social";
  }
  const continuation = resolveCreatorContinuation(productId, { products: input.products ?? [], listings: input.listings ?? [] });
  if (continuation.kind !== "none" && (input.role === "creator" || input.role === "admin")) return continuation.path;
  return authorizedDestination(input.role, input.requested);
}

function productIdFromPricingPath(requested: string | null | undefined): string | null {
  const path = sanitizeNextPath(requested);
  if (path === "/studio") return "cloud-nine";
  const match = path?.match(/^\/catalog\/([A-Za-z0-9][A-Za-z0-9_-]{0,64})$/);
  return match?.[1] ?? null;
}

export function authorizedDestination(role: AccountRole, requested: string | null): string {
  const pathOnly = requested?.split("?")[0] ?? "";
  if (role === "admin") {
    if (requested === "/admin" || requested === "/admin/staging") return requested;
    return "/admin/staging";
  }
  if (role === "supplier") return requested === "/supplier" ? requested : "/supplier";
  if (isCreatorPricingPath(pathOnly)) return pathOnly;
  if (requested && CREATOR_PATHS.has(pathOnly)) return requested;
  return "/earnings";
}
