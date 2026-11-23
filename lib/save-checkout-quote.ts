"use server";

import { revalidatePath } from "next/cache";
import { quoteDetails, quoteFieldError, parseSavedQuote, type CheckoutDraft, type SavedQuote } from "@/lib/checkout-quote";
import { confirmIsraelAddress } from "@/lib/israel-places";
import { createClient } from "@/lib/supabase/server";

export type SaveQuoteResult = { ok: true; quote: SavedQuote } | { ok: false; message: string };

export async function saveCheckoutQuote(draft: CheckoutDraft): Promise<SaveQuoteResult> {
  const problem = quoteFieldError(draft);
  const details = problem ? null : quoteDetails(draft);
  if (!details) {
    return { ok: false, message: problem ?? "בדקו את הכמות, השם, הטלפון, העיר והרחוב." };
  }
  const confirmed = await confirmIsraelAddress(details.cityCode, details.city, details.streetName);
  if (!confirmed.ok) return confirmed;
  const street = `${confirmed.streetName} ${details.houseNumber}`;

  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "ההצעה לא נשמרה. הפרטים נשארו בטופס ואפשר לנסות שוב." };

  const { data, error } = await supabase.rpc("create_cloud_nine_quote", {
    quantity: details.quantity,
    recipient_name: details.recipientName,
    phone: details.phone,
    city: confirmed.city,
    street,
  });

  if (error) return { ok: false, message: quoteSaveError(error.message) };
  const quote = parseSavedQuote(data);
  if (!quote) return { ok: false, message: "ההצעה לא נשמרה. הפרטים נשארו בטופס ואפשר לנסות שוב." };
  revalidatePath("/");
  return { ok: true, quote };
}

function quoteSaveError(message: string): string {
  if (/listing inactive/i.test(message)) return "המודעה לא פעילה, אז אי אפשר לשמור הצעה.";
  if (/invalid quantity/i.test(message)) return "הזינו כמות מארזים בין 1 ל-20.";
  if (/invalid details/i.test(message)) {
    return "בדקו את הכמות, השם, הטלפון, העיר והרחוב. הכמות היא בין 1 ל-20 מארזים.";
  }
  return "ההצעה לא נשמרה. הפרטים נשארו בטופס ואפשר לנסות שוב.";
}
