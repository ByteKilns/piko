import { expect, test } from "@playwright/test";

import { gotoRoute } from "./support/nav";

test.describe("budget", () => {
  test.beforeEach(async ({ page }) => {
    await gotoRoute(page, "/budget");
  });

  test("shows the month's plan", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Budget", exact: true })).toBeVisible();
    await expect(page.getByText("Budgeted", { exact: true })).toBeVisible();
    await expect(page.getByText("Spent in budgets", { exact: true })).toBeVisible();
    await expect(page.getByText("Click a row to change its budget")).toBeVisible();
  });

  test("opens the budget editor", async ({ page }) => {
    await page.getByRole("button", { name: "Add budget" }).click();

    await expect(page.getByRole("dialog").getByRole("heading", { name: "Set a budget" })).toBeVisible();
  });
});
