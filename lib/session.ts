import { createClient } from "@/lib/supabase/server";

export async function readSession(): Promise<{ email: string | null; userId: string | null }> {
  const supabase = await createClient();
  if (!supabase) return { email: null, userId: null };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { email: user?.email ?? null, userId: user?.id ?? null };
}
