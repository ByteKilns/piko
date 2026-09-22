import { expect, test } from "@playwright/test";

import { gotoRoute } from "./support/nav";

test.describe("savings goals", () => {
  test.beforeEach(async ({ page }) => {
    await gotoRoute(page, "/savings-goals");
  });

  test("shows savings stats and tabs", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Savings Goals", exact: true })).toBeVisible();
    await expect(page.getByText("Save for what matters most")).toBeVisible();
    await expect(page.getByText("Total Saved").first()).toBeVisible();
    await expect(page.getByRole("tab", { name: "All Goals" })).toBeVisible();
  });

  test("opens the create-goal dialog", async ({ page }) => {
    await page.getByRole("button", { name: "Add Goal" }).first().click();

    await expect(page.getByRole("dialog").getByRole("heading", { name: "Create savings goal" })).toBeVisible();
  });
});
