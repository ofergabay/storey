import { NextResponse } from "next/server";
import { isDevelopmentAdmin } from "@/lib/auth/admin";
import { creatorAccountFacts, resumeAfterAuth } from "@/lib/auth/callback";
import { readAuthContext } from "@/lib/auth/oauth";
import { readCatalog } from "@/lib/catalog/store";
import { createClient } from "@/lib/supabase/server";
import { readWorkspace } from "@/lib/workspace/store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const context = readAuthContext(url.searchParams, () => undefined);
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user?.email) return NextResponse.redirect(new URL("/login?error=google", url.origin));
  const catalog = readCatalog();
  const resume = resumeAfterAuth({
    userId: user.id,
    email: user.email,
    createdAt: user.created_at ?? null,
    now: Date.now(),
    intent: context.intent,
    requested: context.next,
    productId: context.productId,
    facts: creatorAccountFacts({
      email: user.email,
      developmentAdmin: isDevelopmentAdmin(user.email),
      applications: readWorkspace().applications,
    }),
    products: catalog.products,
    listings: catalog.listings,
  });
  if (resume.created && supabase) {
    try {
      await supabase.from("profiles").upsert({ user_id: resume.profile.userId, active_workspace: resume.profile.role }, { onConflict: "user_id" });
    } catch {
      // A missing profiles table must not block the creator continuation.
    }
  }
  return NextResponse.redirect(new URL(resume.destination, url.origin));
}
