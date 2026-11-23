"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readOwnerListing } from "@/lib/listing-records";
import { createClient } from "@/lib/supabase/server";

export async function claimDemoSeller(): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "חסר חיבור ל-Supabase." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "צריך להתחבר קודם." };

  const { error } = await supabase.rpc("claim_demo_seller");
  if (error) {
    const taken = /already claimed/i.test(error.message);
    return {
      ok: false,
      message: taken
        ? "מאיה כבר מחוברת לחשבון אחר. עדכנו את owner_id ב-SQL Editor."
        : "חיבור החשבון למאיה נכשל. הריצו את הפקודה למטה ב-SQL Editor ואז רעננו את הדף.",
    };
  }

  const access = await readOwnerListing();
  if (access.status !== "ready") {
    return {
      ok: false,
      message: "החשבון לא חובר למאיה. הריצו את הפקודה למטה ב-SQL Editor ואז רעננו את הדף.",
    };
  }

  revalidatePath("/");
  revalidatePath("/studio");
  redirect("/studio");
}

export async function signOutSeller() {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}
