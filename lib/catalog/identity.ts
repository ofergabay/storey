export function sellerHandleFromEmail(email: string, userId: string): string {
  const local = email.toLowerCase().split("@")[0] ?? "";
  const cleaned = local.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24);
  return cleaned || userId.replace(/-/g, "").slice(0, 8);
}

export function listingSlug(sku: string): string {
  return sku.toLowerCase();
}

export const CLOUD_NINE_SKU = "CLOUD-NINE-12";
