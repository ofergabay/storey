import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { home, pathnameOf, roles, signInAs, trackPageErrors } from "./role";

const pricing = "/catalog/PARTY-01";
const listing = "/s/creator/party-01";
const checkout = `${listing}/checkout`;
const fulfillment = ["ליקוט", "אריזה", "מדבקה", "שליחה"] as const;

test.describe.configure({ mode: "serial" });

test("sandbox order moves from creator pricing through supplier fulfillment to admin finance", async ({ page, browser }) => {
  const errors = trackPageErrors(page);
  await signInAs(page, "creator");
  await page.goto(pricing);
  await expect(page).toHaveURL((url) => pathnameOf(url.toString()) === pricing);

  const stock = await page.getByText(/במלאי:|עדיין אין ספירת|המכירה נעצרה/).first().textContent();
  const sellable = stock?.match(/במלאי:\s*(\d+)/);
  if (!sellable || Number(sellable[1]) < 1) {
    throw new Error(`PARTY-01 at PILOT-01 has no sellable stock (${stock ?? "missing label"}). The journey needs at least 1.`);
  }

  const published = await readPublishedShekels(page);
  let livePrice = published;
  if (published === null) {
    await page.getByRole("button", { name: "פרסום וקבלת קישור" }).click();
    await expect(page.getByText(/עמוד המכירה פעיל|המחיר עודכן/)).toBeVisible();
    livePrice = await readPublishedShekels(page);
    if (livePrice === null) throw new Error("Publishing PARTY-01 did not leave a live price.");
  } else {
    const draft = published + 20;
    const draftLabel = shekelLabel(draft);
    const liveLabel = shekelLabel(published);
    await page.locator("#catalog-retail").fill(String(draft));
    await expect.poll(async () => page.locator("body").innerText()).toContain(`בטיוטה ${draftLabel}`);
    await expect.poll(async () => page.locator("body").innerText()).toContain("המחיר החדש נשמר בטיוטה");
    await page.locator("#catalog-retail").fill(String(published));
    await expect(page.getByText("עמוד המכירה פעיל")).toBeVisible();
    livePrice = published;
    await page.goto(listing);
    await expect(page.locator(".selling-price")).toContainText(liveLabel);
    await expect(page.locator("body")).not.toContainText(draftLabel);
  }

  const liveLabel = shekelLabel(livePrice);
  await page.goto(listing);
  await expect(page.locator(".selling-price")).toContainText(liveLabel);

  await signInAs(page, "supplier");
  await page.goto(pricing);
  await expect(page).toHaveURL((url) => pathnameOf(url.toString()) === home.supplier);

  await signInAs(page, "admin");
  await page.goto(pricing);
  await expect(page).toHaveURL((url) => pathnameOf(url.toString()) === pricing);
  await expect(page.getByRole("button", { name: /פרסום/ })).toBeVisible();

  for (const role of roles) {
    await test.step(`${role} can see checkout and does not start it`, async () => {
      await signInAs(page, role);
      await page.goto(checkout);
      await expect(page.getByRole("heading", { name: "הצעת מחיר" })).toBeVisible();
      await expect(page.locator("body")).toContainText(liveLabel);
      await expect(page.getByRole("button", { name: "התחלת קופה" })).toBeVisible();
      await expect(page).toHaveURL((url) => pathnameOf(url.toString()) === checkout);
    });
  }

  const buyerContext = await browser.newContext({ locale: "he-IL" });
  const buyer = await buyerContext.newPage();
  let token = "";
  try {
    await buyer.goto(checkout);
    await buyer.getByRole("button", { name: "התחלת קופה" }).click();
    await expect(buyer).toHaveURL(/\/track\/tok-|hold=stock/);
    if (buyer.url().includes("hold=stock")) {
      throw new Error("PARTY-01 at PILOT-01 has no sellable stock. The journey needs at least 1.");
    }
    token = pathnameOf(buyer.url()).split("/").pop() ?? "";
    await buyer.getByRole("button", { name: "רכישת ארגז פיתוח" }).click();
    await expect(buyer.getByText("רכישת ארגז פיתוח נקלטה. אין חיוב.")).toBeVisible();
  } finally {
    await buyerContext.close();
  }

  const orderId = orderIdForToken(token);

  await signInAs(page, "creator");
  await page.goto("/orders");
  await expect(page.locator(`a[href="/track/${token}"]`)).toBeVisible();

  await signInAs(page, "supplier");
  await page.goto("/supplier");
  const card = page.locator("article.card").filter({ has: page.locator(`input[name="id"][value="${orderId}"]`) });
  await expect(card).toBeVisible();
  await expect(card).toContainText("פתק משלוח");
  await expect(card).not.toContainText("₪");

  await signInAs(page, "admin");
  await page.goto("/supplier");
  await expect(page).toHaveURL((url) => pathnameOf(url.toString()) === home.admin);
  await expect(page.getByRole("button", { name: "ליקוט", exact: true })).toHaveCount(0);

  await signInAs(page, "supplier");
  await page.goto("/supplier");
  for (const label of fulfillment) {
    const form = page.locator("form").filter({ has: page.locator(`input[name="id"][value="${orderId}"]`) });
    await form.getByRole("button", { name: label, exact: true }).click();
  }

  await page.goto(`/track/${token}`);
  await expect(page.getByText(`SBX-${orderId}`)).toBeVisible();

  await signInAs(page, "admin");
  await page.goto("/admin/finance");
  await expect(page.getByRole("heading", { level: 1, name: "כספים והתאמה" })).toBeVisible();
  await expect(page.getByText(`הזמנה ${orderId}`)).toBeVisible();

  await signInAs(page, "creator");
  await page.goto("/earnings");
  await expectNoBankPayout(page);

  await signInAs(page, "supplier");
  await page.goto("/supplier/settlements");
  await expect(page.getByRole("heading", { level: 1, name: "התחשבנות ספק" })).toBeVisible();
  await expectNoBankPayout(page);
  expect(errors).toEqual([]);
});

async function readPublishedShekels(page: Page): Promise<number | null> {
  const body = await page.locator("body").innerText();
  if (body.includes("טרם פורסמה")) return null;
  const shown = body.match(/בעמוד המכירה(?: עדיין מוצג)? ₪(\d+(?:\.\d+)?)/);
  if (shown) return Number(shown[1]);
  const input = await page.locator("#catalog-retail").inputValue();
  const value = Number(input);
  return Number.isFinite(value) ? value : null;
}

function shekelLabel(value: number): string {
  return Number.isInteger(value) ? `₪${value}` : `₪${value.toFixed(2)}`;
}

function orderIdForToken(token: string): string {
  const file = path.join(process.cwd(), "data", "dev-workspace.json");
  const workspace = JSON.parse(readFileSync(file, "utf8")) as { orders: { id: string; token: string }[] };
  const order = workspace.orders.find((item) => item.token === token);
  if (!order) throw new Error(`No saved order for tracking token ${token}.`);
  return order.id;
}

async function expectNoBankPayout(page: Page) {
  await expect(page.getByRole("button", { name: /סיום מדומה|אישור בנק|העברה מדומה|הרצת תשלום שבועי/ })).toHaveCount(0);
}
