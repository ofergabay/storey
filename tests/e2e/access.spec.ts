import { expect, test } from "@playwright/test";
import { expectRoleShell, home, pathnameOf, roles, signInAs, trackPageErrors } from "./role";

const listing = "/s/creator/party-01";

for (const role of roles) {
  test.describe(`${role} access`, () => {
    let errors: string[] = [];

    test.beforeEach(async ({ page }) => {
      errors = trackPageErrors(page);
      await signInAs(page, role);
    });

    test("lands on the role home with its own navigation", async ({ page }) => {
      await expect(page).toHaveURL((url) => pathnameOf(url.toString()) === home[role]);
      await expectRoleShell(page, role);
      expect(errors).toEqual([]);
    });

    test("finance stays on the admin screen", async ({ page }) => {
      await page.goto("/admin/finance");
      if (role === "admin") {
        await expect(page).toHaveURL((url) => pathnameOf(url.toString()) === "/admin/finance");
        await expect(page.getByRole("heading", { level: 1, name: "כספים והתאמה" })).toBeVisible();
        await expect(page.getByRole("button", { name: "תרחיש שני ספקים" })).toBeVisible();
      } else {
        await expect(page).toHaveURL((url) => pathnameOf(url.toString()) === home[role]);
        await expect(page.getByRole("button", { name: "תרחיש שני ספקים" })).toHaveCount(0);
      }
      expect(errors).toEqual([]);
    });

    test("public listing shows the selling price without cost", async ({ page }) => {
      await page.goto(listing);
      await expect(page.getByText("מחיר למארז")).toBeVisible();
      await expect(page.locator(".selling-price")).toContainText(/₪\d/);
      await expect(page.locator("body")).not.toContainText("עלות");
      await expect(page.locator("body")).not.toContainText(/wholesale/i);
      expect(errors).toEqual([]);
    });
  });
}

test.describe("admin inspection", () => {
  test("supplier queue is visible and fulfillment stays locked", async ({ page }) => {
    const errors = trackPageErrors(page);
    await signInAs(page, "admin");
    await page.goto("/supplier?inspect=1");
    await expect(page).toHaveURL((url) => pathnameOf(url.toString()) === "/supplier");
    await expect(page.getByRole("heading", { level: 1, name: "תור ליקוט ואריזה" })).toBeVisible();
    await expect(page.getByText("הפעולות נעולות")).toBeVisible();
    for (const label of ["ליקוט", "אריזה", "מדבקה", "שליחה"]) {
      await expect(page.getByRole("button", { name: label, exact: true })).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });
});
