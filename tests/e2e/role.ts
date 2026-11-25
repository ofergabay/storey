import { expect, type Page } from "@playwright/test";

export const roles = ["creator", "supplier", "admin"] as const;
export type Role = (typeof roles)[number];

export const home: Record<Role, string> = {
  creator: "/earnings",
  supplier: "/supplier",
  admin: "/admin/staging",
};

const roleButton: Record<Role, string> = {
  creator: "יוצר/ת",
  supplier: "ספק",
  admin: "ניהול מערכת",
};

export const navLabels: Record<Role, string[]> = {
  creator: ["סקירה ורווחים", "קטלוג מוצרים", "הלינקים והמארזים שלי", "חנות ממותגת", "מלאי לקמפיין", "הזמנות והחזרות", "תשלומים וחשבוניות"],
  supplier: ["תור ליקוט ואריזה", "המלאי והקטלוג שלי", "מלאי ייעודי (שותפות)", "החזרות ובקרת איכות", "התחשבנות ותשלומים", "הגדרות מחסן ותעריפים"],
  admin: ["ייבוא מוצרים ומלאי", "תור בדיקה", "משתמשים, יוצרים וספקים", "מסלולים ועמלות", "הזמנות, מחלוקות והחזרות", "קטלוג שפורסם", "כספים", "ביקורת", "שאלות נפוצות", "הרשאות ותפקידים"],
};

export const menus: Record<Role, string[]> = {
  creator: ["/earnings", "/catalog", "/listings", "/storefront", "/campaigns", "/orders", "/account"],
  supplier: ["/supplier", "/supplier/catalog", "/supplier/stock", "/supplier/returns", "/supplier/settlements", "/supplier/settings"],
  admin: ["/admin", "/admin/staging", "/admin/approvals", "/admin/plans", "/admin/orders", "/admin/catalog", "/admin/finance", "/admin/audit", "/admin/faq"],
};

const absentNav: Record<Role, string[]> = {
  creator: ["תור ליקוט ואריזה", "ייבוא מוצרים ומלאי"],
  supplier: ["סקירה ורווחים", "ייבוא מוצרים ומלאי"],
  admin: ["סקירה ורווחים", "תור ליקוט ואריזה"],
};

export function trackPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

export async function signInAs(page: Page, role: Role) {
  await page.goto("/dev");
  await page.getByRole("button", { name: roleButton[role], exact: true }).click();
  await page.waitForURL((url) => url.pathname === home[role]);
}

export async function expectRtl(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
}

export async function expectSingleHeading(page: Page) {
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveCount(1);
  await expect(heading).toBeVisible();
}

export async function expectAllowed(page: Page) {
  await expect(page.getByText("אין הרשאה למסך הזה.")).toHaveCount(0);
}

export async function expectRoleNav(page: Page, role: Role) {
  const nav = page.getByRole("navigation", { name: "ניווט" });
  for (const label of navLabels[role]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }
  for (const label of absentNav[role]) {
    await expect(nav.getByRole("link", { name: label })).toHaveCount(0);
  }
}

export async function expectRoleShell(page: Page, role: Role) {
  await expectRtl(page);
  await expectSingleHeading(page);
  await expectAllowed(page);
  await expectRoleNav(page, role);
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const main = document.querySelector("main");
    const nodes = [document.documentElement, document.body, main].filter((node): node is Element => node !== null);
    return nodes.some((node) => node.scrollWidth > node.clientWidth + 1);
  });
  expect(overflow).toBe(false);
}

export function pathnameOf(url: string): string {
  return new URL(url).pathname;
}
