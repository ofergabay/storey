import { expect, test } from "@playwright/test";
import { expectAllowed, expectRoleShell, expectSingleHeading, home, menus, pathnameOf, roles, signInAs, trackPageErrors } from "./role";

for (const role of roles) {
  test.describe(`${role} screens`, () => {
    let errors: string[] = [];

    test.beforeEach(async ({ page }) => {
      errors = trackPageErrors(page);
      await signInAs(page, role);
    });

    for (const owner of roles) {
      for (const href of menus[owner]) {
        test(`${owner} ${href}`, async ({ page }) => {
          await page.goto(href);
          await expect(page).toHaveURL((url) => pathnameOf(url.toString()) === (role === owner ? href : home[role]));
          if (role === owner) {
            await expectSingleHeading(page);
            await expectAllowed(page);
            await expectRoleShell(page, role);
          }
          expect(errors).toEqual([]);
        });
      }
    }
  });
}
