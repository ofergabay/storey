import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isDevelopmentAdmin } from "@/lib/auth/admin";
import { AUTH_COOKIE_NAMES, failurePath, readAuthContext, workspaceDestination, type AccountRole } from "@/lib/auth/oauth";
import { supabaseEnv } from "@/lib/supabase/env";
import { readWorkspace } from "@/lib/workspace/store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const context = readAuthContext(url.searchParams, (name) => jar.get(name)?.value);
  const fail = failurePath(context);
  const providerError = url.searchParams.get("error") || url.searchParams.get("error_description");
  const code = url.searchParams.get("code");
  const env = supabaseEnv();
  if (providerError || !code || !env) return finish(url.origin, fail);

  const pending: { name: string; value: string; options?: Parameters<typeof jar.set>[2] }[] = [];
  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return jar.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach((cookie) => pending.push(cookie));
      },
    },
  });
  const exchanged = await supabase.auth.exchangeCodeForSession(code);
  const user = exchanged.data.user;
  if (exchanged.error || !user) return finish(url.origin, fail, pending);

  const approved = readWorkspace().applications.find((item) => item.email === user.email && item.status === "approved");
  const role: AccountRole = isDevelopmentAdmin(user.email)
    ? "admin"
    : approved?.role === "supplier"
      ? "supplier"
      : "creator";
  const destination = workspaceDestination({
    role,
    createdAt: user.created_at,
    now: Date.now(),
    requested: context.next,
    intent: context.intent,
  });
  return finish(url.origin, destination, pending);
}

function finish(
  origin: string,
  path: string,
  pending: { name: string; value: string; options?: Parameters<Awaited<ReturnType<typeof cookies>>["set"]>[2] }[] = [],
) {
  const response = NextResponse.redirect(new URL(path, origin));
  for (const cookie of pending) response.cookies.set(cookie.name, cookie.value, cookie.options);
  for (const name of AUTH_COOKIE_NAMES) response.cookies.set(name, "", { path: "/", maxAge: 0 });
  return response;
}
