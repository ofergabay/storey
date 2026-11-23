import { NextResponse } from "next/server";
import { isDevelopmentAdmin } from "@/lib/auth/admin";
import { readAuthContext, workspaceDestination, type AccountRole } from "@/lib/auth/oauth";
import { createClient } from "@/lib/supabase/server";
import { readWorkspace } from "@/lib/workspace/store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const context = readAuthContext(url.searchParams, () => undefined);
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user?.email) return NextResponse.redirect(new URL("/login?error=google", url.origin));
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
  return NextResponse.redirect(new URL(destination, url.origin));
}
