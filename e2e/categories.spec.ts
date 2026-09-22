import { expect, test } from "@playwright/test";

import { gotoRoute } from "./support/nav";

test.describe("categories", () => {
  test.beforeEach(async ({ page }) => {
    await gotoRoute(page, "/categories");
  });

  test("shows active and archived tabs", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Categories", exact: true })).toBeVisible();
    await expect(page.getByText("Manage the categories used across expenses and budgets")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Active" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Archived" })).toBeVisible();
  });

  test("opens the add-category dialog", async ({ page }) => {
    await page.getByRole("button", { name: "Add Category" }).click();

    await expect(page.getByRole("dialog").getByRole("heading", { name: "Add category" })).toBeVisible();
  });
});
