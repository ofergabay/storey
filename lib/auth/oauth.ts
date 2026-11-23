export const googleCancelledHe = "ההתחברות עם Google בוטלה. אפשר לנסות שוב או להמשיך עם אימייל.";

export const AUTH_INTENT_COOKIE = "storey_auth_intent";
export const AUTH_FROM_COOKIE = "storey_auth_from";
export const AUTH_CHANNEL_COOKIE = "storey_auth_channel";
export const AUTH_NEXT_COOKIE = "storey_auth_next";
export const AUTH_COOKIE_NAMES = [AUTH_INTENT_COOKIE, AUTH_FROM_COOKIE, AUTH_CHANNEL_COOKIE, AUTH_NEXT_COOKIE] as const;

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
};

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
  if (pathname === "/admin" || pathname === "/admin/staging" || pathname === "/supplier" || CREATOR_PATHS.has(pathname)) {
    return pathname;
  }
  return null;
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
}): string {
  const fresh = isFreshAccount(input.createdAt, input.now);
  if ((input.intent === "register" || fresh) && input.role !== "admin") return "/onboarding?plan=social";
  return authorizedDestination(input.role, input.requested);
}

export function authorizedDestination(role: AccountRole, requested: string | null): string {
  if (role === "admin") {
    if (requested === "/admin" || requested === "/admin/staging") return requested;
    return "/admin/staging";
  }
  if (role === "supplier") return requested === "/supplier" ? requested : "/supplier";
  if (requested && CREATOR_PATHS.has(requested.split("?")[0] ?? "")) return requested;
  return "/earnings";
}
