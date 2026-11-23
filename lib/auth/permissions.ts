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

export function creatorAccess(plan: PlanCode, capability: Capability): AccessLevel {
  if (capability === "creator.orders") return plan === "scale" ? "FULL_ACCESS" : "MASKED_PII";
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
  { href: "/earnings", label: "סקירה ורווחים" },
  { href: "/catalog", label: "קטלוג מוצרים", capability: "creator.catalog" },
  { href: "/listings", label: "הלינקים והמארזים שלי", capability: "creator.links" },
  { href: "/storefront", label: "חנות ממותגת", capability: "creator.storefront" },
  { href: "/campaigns", label: "מלאי לקמפיין", capability: "creator.campaign" },
  { href: "/orders", label: "הזמנות והחזרות", capability: "creator.orders" },
  { href: "/account", label: "תשלומים וחשבוניות", capability: "creator.payouts" },
];

const supplierMenu: NavItem[] = [
  { href: "/supplier", label: "תור ליקוט ואריזה" },
  { href: "/supplier/catalog", label: "המלאי והקטלוג שלי" },
  { href: "/supplier/stock", label: "מלאי ייעודי (שותפות)" },
  { href: "/supplier/returns", label: "החזרות ובקרת איכות" },
  { href: "/supplier/settlements", label: "התחשבנות ותשלומים" },
];

const warehouseMenu: NavItem[] = [
  { href: "/supplier", label: "תור ליקוט ואריזה" },
  { href: "/supplier/stock", label: "המלאי והקטלוג שלי" },
  { href: "/supplier/returns", label: "החזרות ובקרת איכות" },
];

const adminMenu: NavItem[] = [
  { href: "/admin/staging", label: "ייבוא קטלוג וסטודיו AI" },
  { href: "/admin/approvals", label: "משתמשים, יוצרים וספקים" },
  { href: "/admin/plans", label: "מסלולים ועמלות" },
  { href: "/admin/orders", label: "הזמנות, מחלוקות והחזרות" },
];

const guestMenu: NavItem[] = [{ href: "/plans", label: "תוכניות" }];

export function navigationFor(role: AppRole, includePermissions: boolean): NavItem[] {
  if (role === "creator") return creatorMenu;
  if (role === "supplier") return supplierMenu;
  if (role === "warehouse") return warehouseMenu;
  if (role === "admin") {
    return includePermissions ? [...adminMenu, { href: "/dev", label: "הרשאות ותפקידים" }] : adminMenu;
  }
  return guestMenu;
}
