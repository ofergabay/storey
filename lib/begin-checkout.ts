"use server";

import { revalidatePath } from "next/cache";
import { parseSavedQuote, type SavedQuote } from "@/lib/checkout-quote";
import { createClient } from "@/lib/supabase/server";

export type BeginCheckoutResult = { ok: true; quote: SavedQuote } | { ok: false; message: string };

export async function beginCloudNineCheckout(quoteId: string): Promise<BeginCheckoutResult> {
  if (!/^[0-9a-f-]{36}$/i.test(quoteId)) return { ok: false, message: "ההצעה לא נמצאה." };

  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "שמירת המלאי לא הושלמה. ההצעה נשמרה, ומארזים לא נשמרו." };

  const { data, error } = await supabase.rpc("begin_cloud_nine_checkout", { quote_id: quoteId });
  if (error) return { ok: false, message: holdError(error) };
  const quote = parseSavedQuote(data);
  if (!quote?.holdExpiresAt) return { ok: false, message: "שמירת המלאי לא הושלמה. ההצעה נשמרה, ומארזים לא נשמרו." };

  revalidatePath("/");
  return { ok: true, quote };
}

function holdError(error: { code?: string; message?: string }): string {
  const code = error.code ?? "";
  const message = error.message ?? "";
  if (code === "PGRST202" || code === "42883" || /could not find the function|does not exist/i.test(message)) {
    return "שמירת המלאי עדיין לא מותקנת במסד. ההצעה נשמרה, ומארזים לא נשמרו.";
  }
  if (/stock changed/i.test(message)) return "אין מספיק מארזים פנויים. ההצעה נשמרה, ומארזים לא נשמרו.";
  if (/hold ended/i.test(message)) return "זמן שמירת המארזים הסתיים. ההצעה נשמרה בלי מלאי.";
  if (/quote missing/i.test(message)) return "ההצעה לא נמצאה.";
  return "שמירת המלאי לא הושלמה. ההצעה נשמרה, ומארזים לא נשמרו.";
}
