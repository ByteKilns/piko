import { expect, type Page, test } from "@playwright/test";

import { gotoRoute } from "./support/nav";

// The shortcut listener attaches on hydration; a key pressed before that is
// lost (and React may reset a field typed into early). Pressing N until the
// dialog opens both waits for hydration and proves the shortcut works.
async function openAddExpenseWithShortcut(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Add Expense" });
  await expect(async () => {
    await page.keyboard.press("n");
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass();
  return dialog;
}

test.describe("app shell", () => {
  test("N opens Add expense from any page", async ({ page }) => {
    await gotoRoute(page, "/dashboard");
    await openAddExpenseWithShortcut(page);
  });

  test("N types normally inside a field instead of opening Add expense", async ({ page }) => {
    await gotoRoute(page, "/settings");
    await openAddExpenseWithShortcut(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const field = page.getByLabel("Current password");
    await field.focus();
    await page.keyboard.press("n");
    await expect(field).toHaveValue("n");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("N inside an open dialog doesn't stack a second one", async ({ page }) => {
    await gotoRoute(page, "/dashboard");
    const dialog = await openAddExpenseWithShortcut(page);
    await dialog.getByRole("button", { name: "Close" }).focus();
    await page.keyboard.press("n");
    await expect(page.getByRole("dialog")).toHaveCount(1);
  });

  test("a collapsed sidebar keeps links reachable and stays collapsed after reload", async ({ page }) => {
    await gotoRoute(page, "/dashboard");
    const sidebar = page.getByRole("complementary");
    await sidebar.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(sidebar.getByRole("link", { name: "Budget" })).toBeVisible();
    await page.reload();
    await expect(sidebar.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  });

  test("form fields stay at 16px on phones so iOS Safari doesn't zoom in on focus", async ({ page }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await gotoRoute(page, "/settings");
    const fontSize = await page.getByLabel("Current password").evaluate((field) => getComputedStyle(field).fontSize);
    expect(Number.parseFloat(fontSize)).toBeGreaterThanOrEqual(16);
  });

  test("the account menu offers Sign out", async ({ page }) => {
    await gotoRoute(page, "/dashboard");
    await page.getByRole("complementary").getByRole("button", { name: /^Account menu for / }).click();
    await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
  });
});
