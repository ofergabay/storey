import { developmentPlanView, planCodeFromName, type SellerPlanView } from "@/lib/commerce/plans";
import { createClient } from "@/lib/supabase/server";

export async function readSellerPlan(): Promise<SellerPlanView> {
  const fallback = developmentPlanView();
  const supabase = await createClient();
  if (!supabase) return { ...fallback, canPublish: false };

  const { data, error } = await supabase.rpc("seller_plan_status");
  if (error && isMissingPlan(error)) return fallback;
  if (error || !data || typeof data !== "object") {
    return { ...fallback, installed: true, canPublish: false };
  }

  const row = data as Record<string, unknown>;
  const canPublish = row.can_publish === true && row.price_agorot === 0;
  const nameHe = typeof row.plan_name_he === "string" ? row.plan_name_he : fallback.nameHe;
  const code = planCodeFromName(nameHe);
  const organizationName = typeof row.organization_name === "string" ? row.organization_name : null;
  const priceAgorot = typeof row.price_agorot === "number" ? row.price_agorot : row.price_agorot === null ? null : 0;
  return { installed: true, canPublish, code, nameHe, priceAgorot, organizationName };
}

function isMissingPlan(error: { code?: string; message?: string }): boolean {
  const code = error.code ?? "";
  const message = error.message ?? "";
  return code === "PGRST202" || code === "42883" || /could not find the function|does not exist/i.test(message);
}
