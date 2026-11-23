import { createClient } from "@/lib/supabase/server";

export type PublicCard = {
  title: string;
  summary: string;
  packLabel: string;
  packSize: number;
  packUnit: string;
  sellerName: string;
  sellerHandle: string;
  sellerInitials: string;
  publishedRetailAgorot: number | null;
};

export type OwnerListing = {
  wholesaleAgorot: number;
  draftAgorot: number | null;
  publishedAgorot: number | null;
};

export type OwnerAccess =
  | { status: "unlinked" }
  | { status: "missing" }
  | { status: "error" }
  | { status: "ready"; listing: OwnerListing };

type PublicRow = {
  title: string;
  summary: string;
  pack_label: string;
  pack_size: number;
  pack_unit: string;
  display_name: string;
  handle: string;
  initials: string;
  published_retail_agorot: number | null;
};

type OwnerRow = {
  offer_id: string;
  draft_retail_agorot: number | null;
  published_retail_agorot: number | null;
};

export async function readPublicCard(): Promise<PublicCard | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("listing_cards")
    .select(
      "title, summary, pack_label, pack_size, pack_unit, display_name, handle, initials, published_retail_agorot",
    )
    .eq("seller_slug", "maya")
    .eq("listing_slug", "cloud-nine")
    .maybeSingle();

  if (error || !data) return null;
  const row = data as PublicRow;
  return {
    title: row.title,
    summary: row.summary,
    packLabel: row.pack_label,
    packSize: row.pack_size,
    packUnit: row.pack_unit,
    sellerName: row.display_name,
    sellerHandle: row.handle,
    sellerInitials: row.initials,
    publishedRetailAgorot: row.published_retail_agorot,
  };
}

export async function readOwnerListing(): Promise<OwnerAccess> {
  const supabase = await createClient();
  if (!supabase) return { status: "error" };

  const { data, error } = await supabase
    .from("seller_listings")
    .select("offer_id, draft_retail_agorot, published_retail_agorot")
    .eq("slug", "cloud-nine")
    .maybeSingle();

  if (error) return { status: isMissingSchema(error) ? "missing" : "error" };
  if (!data) return { status: "unlinked" };
  const listing = data as OwnerRow;

  const { data: offer, error: offerError } = await supabase
    .from("supplier_offers")
    .select("net_wholesale_agorot")
    .eq("id", listing.offer_id)
    .maybeSingle();

  if (offerError) return { status: isMissingSchema(offerError) ? "missing" : "error" };
  if (!offer) return { status: "error" };
  return {
    status: "ready",
    listing: {
      wholesaleAgorot: (offer as { net_wholesale_agorot: number }).net_wholesale_agorot,
      draftAgorot: listing.draft_retail_agorot,
      publishedAgorot: listing.published_retail_agorot,
    },
  };
}

function isMissingSchema(error: { code?: string; message?: string }): boolean {
  const code = error.code ?? "";
  const message = error.message ?? "";
  return (
    code === "42P01" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    /does not exist|schema cache/i.test(message)
  );
}
