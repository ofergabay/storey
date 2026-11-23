import { parseSavedQuote, type SavedQuote } from "@/lib/checkout-quote";
import { createClient } from "@/lib/supabase/server";

export async function readCheckoutQuote(quoteId: string): Promise<SavedQuote | null> {
  if (!/^[0-9a-f-]{36}$/i.test(quoteId)) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("read_cloud_nine_quote", { quote_id: quoteId });
  if (error || data == null) return null;
  return parseSavedQuote(data);
}
