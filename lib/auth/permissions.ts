import type { AppRole } from "./access.ts";
import { developmentPlans, type PlanCode } from "../commerce/plans.ts";

export type AccessLevel = "FULL_ACCESS" | "TIER_GATED" | "VIEW_ONLY" | "MASKED_PII" | "NO_ACCESS";

export type Capability =
  | "creator.catalog"
  | "creator.links"
  | "creator.orders"
  | "creator.payouts"
  | "creator.storefront"
  | "creator.campaign"
  | "creator.dedicated"
  | "supplier.retail"
  | "supplier.otherCatalog"
  | "admin.settings";

export type NavItem = {
  href: string;
  label: string;
  labelEn?: string;
  capability?: Capability;
};

const social = developmentPlans[0];
const branded = developmentPlans[1];
const partnership = developmentPlans[2];

export const planNames = {
  social: social.nameHe,
  branded: branded.nameHe,
  partnership: partnership.nameHe,
} as const;

export function planLabel(code: PlanCode, locale: "he" | "en" = "he"): string {
  if (locale === "en") {
    if (code === "branded") return "Branded Store";
    if (code === "scale") return "Partnership";
    return "Social Selling";
  }
  if (code === "branded") return planNames.branded;
  if (code === "scale") return planNames.partnership;
  return planNames.social;
}

export function creatorAccess(plan: PlanCode, capability: Capability): AccessLevel {
  if (capability === "creator.orders") return "MASKED_PII";
  if (capability === "creator.dedicated") {
    if (plan === "scale") return "FULL_ACCESS";
    if (plan === "branded") return "TIER_GATED";
    return "NO_ACCESS";
  }
  if (capability === "creator.storefront" || capability === "creator.campaign") {
    return plan === "social" ? "TIER_GATED" : "FULL_ACCESS";
  }
  if (capability === "supplier.retail" || capability === "supplier.otherCatalog" || capability === "admin.settings") {
    return "NO_ACCESS";
  }
  return "FULL_ACCESS";
}

export function supplierAccess(capability: Capability): AccessLevel {
  if (capability === "supplier.retail" || capability === "supplier.otherCatalog" || capability === "admin.settings") return "NO_ACCESS";
  if (capability.startsWith("creator.")) return "NO_ACCESS";
  return "FULL_ACCESS";
}

const creatorMenu: NavItem[] = [
  { href: "/earnings", label: "סקירה ורווחים", labelEn: "Overview and earnings" },
  { href: "/catalog", label: "קטלוג מוצרים", labelEn: "Product catalog", capability: "creator.catalog" },
  { href: "/listings", label: "הלינקים והמארזים שלי", labelEn: "My links and packs", capability: "creator.links" },
  { href: "/storefront", label: "חנות ממותגת", labelEn: "Branded store", capability: "creator.storefront" },
  { href: "/campaigns", label: "מלאי לקמפיין", labelEn: "Campaign stock", capability: "creator.campaign" },
  { href: "/orders", label: "הזמנות והחזרות", labelEn: "Orders and returns", capability: "creator.orders" },
  { href: "/account", label: "תשלומים וחשבוניות", labelEn: "Payouts and invoices", capability: "creator.payouts" },
];

const supplierMenu: NavItem[] = [
  { href: "/supplier", label: "תור ליקוט ואריזה", labelEn: "Pick and pack queue" },
  { href: "/supplier/catalog", label: "המלאי והקטלוג שלי", labelEn: "My stock and catalog" },
  { href: "/supplier/stock", label: "מלאי ייעודי (שותפות)", labelEn: "Reserved stock (Partnership)" },
  { href: "/supplier/returns", label: "החזרות ובקרת איכות", labelEn: "Returns and inspection" },
  { href: "/supplier/settlements", label: "התחשבנות ותשלומים", labelEn: "Settlements" },
  { href: "/supplier/settings", label: "הגדרות מחסן ותעריפים", labelEn: "Warehouse and tariffs" },
];

const adminMenu: NavItem[] = [
  { href: "/admin", label: "ייבוא מוצרים ומלאי", labelEn: "Product and stock import" },
  { href: "/admin/staging", label: "תור בדיקה", labelEn: "Review queue" },
  { href: "/admin/approvals", label: "משתמשים, יוצרים וספקים", labelEn: "Users, creators, and suppliers" },
  { href: "/admin/plans", label: "מסלולים ועמלות", labelEn: "Plans and fees" },
  { href: "/admin/orders", label: "הזמנות, מחלוקות והחזרות", labelEn: "Orders, disputes, and returns" },
  { href: "/admin/catalog", label: "קטלוג שפורסם", labelEn: "Published catalog" },
  { href: "/admin/finance", label: "כספים", labelEn: "Finance" },
  { href: "/admin/audit", label: "ביקורת", labelEn: "Audit" },
  { href: "/admin/faq", label: "שאלות נפוצות", labelEn: "FAQ" },
];

const guestMenu: NavItem[] = [{ href: "/plans", label: "תוכניות", labelEn: "Plans" }];

export function navigationFor(role: AppRole, includePermissions: boolean): NavItem[] {
  if (role === "creator") return creatorMenu;
  if (role === "supplier") return supplierMenu;
  if (role === "admin") {
    return includePermissions ? [...adminMenu, { href: "/dev", label: "הרשאות ותפקידים", labelEn: "Roles and permissions" }] : adminMenu;
  }
  return guestMenu;
}

export function allowsOperational(role: AppRole, surface: "creator" | "supplier", inspect: boolean): boolean {
  if (role === surface) return true;
  return role === "admin" && inspect;
}

export function showNavItem(role: AppRole, plan: PlanCode | null, item: NavItem): boolean {
  if (role !== "creator" || !item.capability || !plan) return true;
  return creatorAccess(plan, item.capability) !== "NO_ACCESS";
}

export function navLocked(role: AppRole, plan: PlanCode | null, item: NavItem): boolean {
  if (role !== "creator" || !item.capability || !plan) return false;
  return creatorAccess(plan, item.capability) === "TIER_GATED";
}
