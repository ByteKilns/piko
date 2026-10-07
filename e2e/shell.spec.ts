import { expect, test } from "@playwright/test";

import { gotoRoute } from "./support/nav";

test.describe("app shell", () => {
  test("N opens Add expense from any page", async ({ page }) => {
    await gotoRoute(page, "/dashboard");
    await page.keyboard.press("n");
    await expect(page.getByRole("dialog", { name: "Add Expense" })).toBeVisible();
  });

  test("N types normally inside a field instead of opening Add expense", async ({ page }) => {
    await gotoRoute(page, "/settings");
    const field = page.getByLabel("Current password");
    await field.focus();
    await page.keyboard.press("n");
    await expect(field).toHaveValue("n");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("N inside an open dialog doesn't stack a second one", async ({ page }) => {
    await gotoRoute(page, "/dashboard");
    await page.getByRole("complementary").getByRole("button", { exact: true, name: "Add expense" }).click();
    const dialog = page.getByRole("dialog", { name: "Add Expense" });
    await expect(dialog).toBeVisible();
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

  test("the account menu offers Sign out", async ({ page }) => {
    await gotoRoute(page, "/dashboard");
    await page.getByRole("complementary").getByRole("button", { name: /^Account menu for / }).click();
    await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
  });
});
