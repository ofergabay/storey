import { CLOUD_NINE_SELLER } from "@/lib/cloud-nine-seller";

export type ShowcaseMotif = "balloon" | "party" | "gift" | "home" | "beauty" | "fitness" | "camp";

export type ShowcaseItem = {
  id: string;
  titleHe: string;
  titleEn: string;
  categoryHe: string;
  categoryEn: string;
  wholesaleAgorot: number | null;
  retailAgorot: number | null;
  motif: ShowcaseMotif;
};

export const showcaseItems: ShowcaseItem[] = [
  {
    id: "cloud-nine",
    titleHe: "Cloud Nine",
    titleEn: "Cloud Nine",
    categoryHe: "מארזי אירוח ומתנות",
    categoryEn: "Hosting and gift packs",
    wholesaleAgorot: CLOUD_NINE_SELLER.wholesaleAgorot,
    retailAgorot: CLOUD_NINE_SELLER.defaultRetailAgorot,
    motif: "balloon",
  },
  {
    id: "party-01",
    titleHe: "קונספט למסיבה",
    titleEn: "Party concept",
    categoryHe: "מארזי אירוח ומתנות",
    categoryEn: "Hosting and gift packs",
    wholesaleAgorot: 3200,
    retailAgorot: null,
    motif: "party",
  },
  {
    id: "gifts",
    titleHe: "מארזי אירוח ומתנות",
    titleEn: "Hosting and gift packs",
    categoryHe: "אירוח",
    categoryEn: "Hosting",
    wholesaleAgorot: null,
    retailAgorot: null,
    motif: "gift",
  },
  {
    id: "home",
    titleHe: "גאדג'טים חכמים לבית",
    titleEn: "Smart home gadgets",
    categoryHe: "בית",
    categoryEn: "Home",
    wholesaleAgorot: null,
    retailAgorot: null,
    motif: "home",
  },
  {
    id: "beauty",
    titleHe: "מוצרי טיפוח וביוטי",
    titleEn: "Care and beauty",
    categoryHe: "טיפוח",
    categoryEn: "Beauty",
    wholesaleAgorot: null,
    retailAgorot: null,
    motif: "beauty",
  },
  {
    id: "fitness",
    titleHe: "אביזרי כושר ולייף-סטייל",
    titleEn: "Fitness and lifestyle",
    categoryHe: "כושר",
    categoryEn: "Fitness",
    wholesaleAgorot: null,
    retailAgorot: null,
    motif: "fitness",
  },
  {
    id: "camp",
    titleHe: "ציוד קמפינג וטיולים",
    titleEn: "Camping and outdoors",
    categoryHe: "שטח",
    categoryEn: "Outdoors",
    wholesaleAgorot: null,
    retailAgorot: null,
    motif: "camp",
  },
];

export function showcaseProfit(item: ShowcaseItem): number | null {
  if (item.wholesaleAgorot === null || item.retailAgorot === null) return null;
  if (item.retailAgorot < item.wholesaleAgorot) return null;
  return item.retailAgorot - item.wholesaleAgorot;
}
