import {
  AUTH_COOKIE_NAMES,
  failurePath,
  readAuthContext,
  workspaceDestination,
  type AccountRole,
  type AuthIntent,
} from "./oauth.ts";

export type CallbackUser = {
  id: string;
  email: string;
  created_at: string | null;
};

export type StoredProfile = {
  userId: string;
  email: string;
  role: AccountRole;
  onboarded: boolean;
};

export type AccountApplication = {
  email: string;
  role: "creator" | "supplier";
  status: string;
  name: string;
};

export type SessionCookie = {
  name: string;
  value: string;
  options?: {
    path?: string;
    maxAge?: number;
    expires?: Date;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: boolean | "lax" | "strict" | "none";
  };
};

export type AccountFacts = {
  developmentAdmin: boolean;
  approvedRole: "supplier" | "creator" | null;
  existing: StoredProfile | null;
  onboarded: boolean;
};

export function creatorAccountFacts(input: {
  email: string;
  developmentAdmin: boolean;
  applications: AccountApplication[];
}): AccountFacts {
  const mine = input.applications.filter((item) => item.email === input.email);
  const approved = mine.find((item) => item.status === "approved");
  const approvedRole = approved?.role === "supplier" ? "supplier" : approved?.role === "creator" ? "creator" : null;
  const completed = mine.some((item) => item.role === "creator" && item.name.trim().length >= 2 && item.status !== "missing");
  const onboarded = input.developmentAdmin || approvedRole === "supplier" || completed;
  const role: AccountRole = input.developmentAdmin ? "admin" : approvedRole === "supplier" ? "supplier" : "creator";
  const existing = mine.length > 0 ? { userId: "", email: input.email, role, onboarded } : null;
  return { developmentAdmin: input.developmentAdmin, approvedRole, existing, onboarded };
}

function accountRoleFromFacts(developmentAdmin: boolean, approvedRole: "supplier" | "creator" | null): AccountRole {
  if (developmentAdmin) return "admin";
  if (approvedRole === "supplier") return "supplier";
  return "creator";
}

export function accountFromFacts(input: {
  userId: string;
  email: string;
  developmentAdmin: boolean;
  approvedRole: "supplier" | "creator" | null;
  existing: StoredProfile | null;
}): { profile: StoredProfile; created: boolean } {
  if (input.existing) {
    const role: AccountRole = input.developmentAdmin ? "admin" : input.existing.role;
    return {
      created: false,
      profile: { ...input.existing, userId: input.userId, email: input.email, role, onboarded: input.existing.onboarded || role !== "creator" },
    };
  }
  const role = accountRoleFromFacts(input.developmentAdmin, input.approvedRole);
  return {
    created: true,
    profile: { userId: input.userId, email: input.email, role, onboarded: role !== "creator" },
  };
}

export type CallbackDeps = {
  cookie: (name: string) => string | undefined;
  now: () => number;
  products: () => { sku: string }[];
  listings: () => { sku: string; slug: string }[];
  exchange: (code: string) => Promise<{ user: CallbackUser | null; error: boolean; cookies: SessionCookie[] }>;
  accountFacts: (user: CallbackUser) => AccountFacts;
  saveProfile: (profile: StoredProfile) => Promise<void> | void;
};

export async function completeGoogleCallback(request: Request, deps: CallbackDeps): Promise<Response> {
  const url = new URL(request.url);
  const context = readAuthContext(url.searchParams, deps.cookie);
  const fail = failurePath(context);
  const providerError = url.searchParams.get("error") || url.searchParams.get("error_description");
  const code = url.searchParams.get("code");
  if (providerError || !code) return finish(url.origin, fail);

  const exchanged = await deps.exchange(code);
  const user = exchanged.user;
  if (exchanged.error || !user) return finish(url.origin, fail, exchanged.cookies);

  const facts = deps.accountFacts(user);
  const account = accountFromFacts({
    userId: user.id,
    email: user.email,
    developmentAdmin: facts.developmentAdmin,
    approvedRole: facts.approvedRole,
    existing: facts.existing ? { ...facts.existing, userId: user.id, email: user.email } : null,
  });
  if (account.created) {
    try {
      await deps.saveProfile(account.profile);
    } catch {
      // Profile storage can be absent. The redirect still follows the role decided here.
    }
  }
  const destination = workspaceDestination({
    role: account.profile.role,
    createdAt: user.created_at,
    now: deps.now(),
    requested: context.next,
    intent: context.intent,
    productId: context.productId,
    products: deps.products(),
    listings: deps.listings(),
    onboarded: facts.onboarded || account.profile.role !== "creator",
  });
  return finish(url.origin, destination, exchanged.cookies);
}

function finish(origin: string, path: string, pending: SessionCookie[] = []) {
  const headers = new Headers();
  headers.set("location", new URL(path, origin).toString());
  for (const cookie of pending) headers.append("set-cookie", serializeCookie(cookie));
  for (const name of AUTH_COOKIE_NAMES) headers.append("set-cookie", serializeCookie({ name, value: "", options: { path: "/", maxAge: 0 } }));
  return new Response(null, { status: 302, headers });
}

function serializeCookie(cookie: SessionCookie): string {
  const parts = [`${cookie.name}=${cookie.value}`, `Path=${cookie.options?.path ?? "/"}`];
  if (cookie.options?.maxAge != null) parts.push(`Max-Age=${cookie.options.maxAge}`);
  if (cookie.options?.expires instanceof Date) parts.push(`Expires=${cookie.options.expires.toUTCString()}`);
  if (cookie.options?.httpOnly) parts.push("HttpOnly");
  if (cookie.options?.secure) parts.push("Secure");
  const sameSite = cookie.options?.sameSite;
  if (sameSite === true) parts.push("SameSite=Strict");
  else if (typeof sameSite === "string") parts.push(`SameSite=${sameSite[0]?.toUpperCase()}${sameSite.slice(1)}`);
  return parts.join("; ");
}

export function resumeAfterAuth(input: {
  userId: string;
  email: string;
  createdAt: string | null;
  now: number;
  intent: AuthIntent;
  requested: string | null;
  productId: string | null;
  facts: AccountFacts;
  products: { sku: string }[];
  listings?: { sku: string; slug: string }[];
}): { destination: string; profile: StoredProfile; created: boolean } {
  const account = accountFromFacts({
    userId: input.userId,
    email: input.email,
    developmentAdmin: input.facts.developmentAdmin,
    approvedRole: input.facts.approvedRole,
    existing: input.facts.existing ? { ...input.facts.existing, userId: input.userId, email: input.email } : null,
  });
  return {
    profile: account.profile,
    created: account.created,
    destination: workspaceDestination({
      role: account.profile.role,
      createdAt: input.createdAt,
      now: input.now,
      requested: input.requested,
      intent: input.intent,
      productId: input.productId,
      products: input.products,
      listings: input.listings,
      onboarded: input.facts.onboarded || account.profile.role !== "creator",
    }),
  };
}
