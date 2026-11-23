"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { LISTING_PATH } from "@/lib/cloud-nine-public";
import { readOwnerListing } from "@/lib/listing-records";
import { LISTING_COOKIE } from "@/lib/published-price";
import { parseRetailDraft } from "@/lib/pricing";
import { readSellerPlan } from "@/lib/seller-plan";
import { createClient } from "@/lib/supabase/server";

export type PublishResult =
  | { ok: true; agorot: number }
  | { ok: false; reason: "invalid" | "below-cost" | "auth" | "plan" | "save" };

export async function publishDemoListing(rawRetail: string): Promise<PublishResult> {
  const parsed = parseRetailDraft(rawRetail);
  if (parsed.status !== "priced") return { ok: false, reason: "invalid" };

  const access = await readOwnerListing();
  if (access.status === "unlinked") return { ok: false, reason: "auth" };
  if (access.status !== "ready") return { ok: false, reason: "save" };
  if (parsed.agorot < access.listing.wholesaleAgorot) return { ok: false, reason: "below-cost" };

  const plan = await readSellerPlan();
  if (plan.installed && !plan.canPublish) return { ok: false, reason: "plan" };

  const supabase = await createClient();
  if (!supabase) return { ok: false, reason: "save" };

  const { data, error } = await supabase.rpc("publish_listing", {
    retail_agorot: parsed.agorot,
  });
  if (error) {
    if (/plan required/i.test(error.message)) return { ok: false, reason: "plan" };
    return { ok: false, reason: "save" };
  }
  if (typeof data !== "number") return { ok: false, reason: "save" };

  const headerList = await headers();
  const proto = headerList.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "http";
  const jar = await cookies();
  jar.set(LISTING_COOKIE, String(data), {
    httpOnly: true,
    sameSite: "lax",
    secure: proto === "https",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
  revalidatePath("/");
  revalidatePath(LISTING_PATH);
  return { ok: true, agorot: data };
}
