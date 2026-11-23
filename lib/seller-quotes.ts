import { formatShekels } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export type SellerQuoteView = {
  id: string;
  createdLabel: string;
  quantity: number;
  unitRetailAgorot: number;
  unitLabel: string;
  totalLabel: string;
  recipientName: string;
  phone: string;
  city: string;
  street: string;
};

export type SellerQuoteList =
  | { status: "ready"; items: SellerQuoteView[] }
  | { status: "missing" }
  | { status: "error" };

const quoteTime = new Intl.DateTimeFormat("he-IL", {
  timeZone: "Asia/Jerusalem",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export async function readSellerQuotes(): Promise<SellerQuoteList> {
  const supabase = await createClient();
  if (!supabase) return { status: "error" };

  const { data, error } = await supabase.rpc("list_cloud_nine_quotes");
  if (error) return { status: isMissingQuoteList(error) ? "missing" : "error" };
  const items = parseQuoteList(data);
  if (!items) return { status: "error" };
  return { status: "ready", items };
}

function parseQuoteList(value: unknown): SellerQuoteView[] | null {
  if (!Array.isArray(value)) return null;
  const items: SellerQuoteView[] = [];
  for (const entry of value) {
    const view = parseQuote(entry);
    if (!view) return null;
    items.push(view);
  }
  return items;
}

function parseQuote(value: unknown): SellerQuoteView | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if ("net_wholesale_agorot" in row || "draft_retail_agorot" in row || "owner_id" in row) return null;
  const id = row.id;
  const createdAt = row.created_at;
  const quantity = row.quantity;
  const unitRetailAgorot = row.unit_retail_agorot;
  const merchandiseAgorot = row.merchandise_agorot;
  const recipientName = row.recipient_name;
  const phone = row.phone;
  const city = row.city;
  const street = row.street;
  if (typeof id !== "string" || typeof createdAt !== "string") return null;
  if (typeof quantity !== "number" || quantity < 1 || quantity > 20) return null;
  if (typeof unitRetailAgorot !== "number" || typeof merchandiseAgorot !== "number") return null;
  if (unitRetailAgorot <= 0 || merchandiseAgorot !== unitRetailAgorot * quantity) return null;
  if (
    typeof recipientName !== "string" ||
    typeof phone !== "string" ||
    typeof city !== "string" ||
    typeof street !== "string"
  ) {
    return null;
  }
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;
  return {
    id,
    createdLabel: quoteTime.format(created),
    quantity,
    unitRetailAgorot,
    unitLabel: formatShekels(unitRetailAgorot),
    totalLabel: formatShekels(merchandiseAgorot),
    recipientName,
    phone,
    city,
    street,
  };
}

function isMissingQuoteList(error: { code?: string; message?: string }): boolean {
  const code = error.code ?? "";
  const message = error.message ?? "";
  return code === "PGRST202" || code === "42883" || /could not find the function|does not exist/i.test(message);
}
