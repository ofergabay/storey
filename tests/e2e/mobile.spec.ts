import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, expectRoleShell, roles, signInAs, trackPageErrors } from "./role";

for (const role of roles) {
  test.describe(`${role} mobile shell`, () => {
    test("home and the public listing stay within the screen", async ({ page }) => {
      const errors = trackPageErrors(page);
      await signInAs(page, role);
      await expectRoleShell(page, role);
      await expectNoHorizontalOverflow(page);

      await page.goto("/s/creator/party-01");
      await expect(page.getByText("מחיר למארז")).toBeVisible();
      await expect(page.locator(".selling-price")).toContainText(/₪\d/);
      await expect(page.locator("body")).not.toContainText("עלות");
      await expect(page.locator("body")).not.toContainText(/wholesale/i);
      await expectNoHorizontalOverflow(page);
      expect(errors).toEqual([]);
    });
  });
}
