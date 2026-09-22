import { expect, test } from "@playwright/test";

import { gotoRoute } from "./support/nav";

test.describe("budget", () => {
  test.beforeEach(async ({ page }) => {
    await gotoRoute(page, "/budget");
  });

  test("shows the month's budget summary", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Budget", exact: true })).toBeVisible();
    await expect(page.getByText("Plan your money for the month")).toBeVisible();
    await expect(page.getByText("Total Budget").first()).toBeVisible();
    await expect(page.getByText("Unbudgeted").first()).toBeVisible();
  });

  test("opens the budget editor", async ({ page }) => {
    await page.getByRole("button", { name: "Add Budget" }).first().click();

    await expect(page.getByRole("dialog").getByRole("heading", { name: "Edit budget" })).toBeVisible();
  });
});
