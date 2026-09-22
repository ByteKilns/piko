import { expect, test } from "@playwright/test";

import { gotoRoute } from "./support/nav";

test.describe("dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await gotoRoute(page, "/dashboard");
  });

  test("shows the month overview", async ({ page }) => {
    await expect(page.getByText("Here's your financial overview for")).toBeVisible();
    await expect(page.getByText("Safe to spend today")).toBeVisible();
    await expect(page.getByText("Combined Income").first()).toBeVisible();
    await expect(page.getByText("Total Expenses").first()).toBeVisible();
  });

  test("exposes previous/next month navigation", async ({ page }) => {
    await expect(page.getByRole("link", { name: "Previous month" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Next month" })).toBeVisible();
  });

  test("shows the overview and recent-activity panels", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
    await expect(page.getByText("Recent Expenses").first()).toBeVisible();
    await expect(page.getByText("Savings Goals").first()).toBeVisible();
  });
});
