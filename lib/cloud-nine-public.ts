export const LISTING_PATH = "/s/maya/cloud-nine";

export const PUBLIC_LISTING = {
  title: "Cloud Nine",
  summary: "תערובת בלונים בגוון לילך לבוקר יום הולדת.",
  packLabel: "מארז בלונים",
  packSize: 12,
  packUnit: "יחידות",
  sellerName: "מאיה לוי",
  sellerHandle: "@maya.makes",
  sellerInitials: "ML",
} as const;

export function publicMetaDescription(input: {
  summary: string;
  packLabel: string;
  packSize: number;
  packUnit: string;
  sellingPrice: string | null;
}): string {
  const pack = `${input.packLabel}, ${input.packSize} ${input.packUnit}`;
  if (!input.sellingPrice) return `${input.summary} ${pack}.`;
  return `${input.summary} ${pack}. מחיר ${input.sellingPrice}.`;
}
