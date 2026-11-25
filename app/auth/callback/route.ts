import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isDevelopmentAdmin } from "@/lib/auth/admin";
import { completeGoogleCallback, creatorAccountFacts, type SessionCookie } from "@/lib/auth/callback";
import { readCatalog } from "@/lib/catalog/store";
import { supabaseEnv } from "@/lib/supabase/env";
import { readWorkspace } from "@/lib/workspace/store";

export async function GET(request: Request) {
  const jar = await cookies();
  const env = supabaseEnv();
  const pending: SessionCookie[] = [];
  let saveProfile: (profile: { userId: string; role: string }) => Promise<void> = async () => undefined;
  return completeGoogleCallback(request, {
    cookie: (name) => jar.get(name)?.value,
    now: () => Date.now(),
    products: () => readCatalog().products.map((product) => ({ sku: product.sku })),
    listings: () => readCatalog().listings.map((listing) => ({ sku: listing.sku, slug: listing.slug })),
    exchange: async (code) => {
      if (!env) return { user: null, error: true, cookies: pending };
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
      if (exchanged.error || !user?.email) return { user: null, error: true, cookies: pending };
      saveProfile = async (profile) => {
        await supabase.from("profiles").upsert({ user_id: profile.userId, active_workspace: profile.role }, { onConflict: "user_id" });
      };
      return {
        user: { id: user.id, email: user.email, created_at: user.created_at ?? null },
        error: false,
        cookies: pending,
      };
    },
    accountFacts: (user) =>
      creatorAccountFacts({
        email: user.email,
        developmentAdmin: isDevelopmentAdmin(user.email),
        applications: readWorkspace().applications,
      }),
    saveProfile: (profile) => saveProfile(profile),
  });
}
