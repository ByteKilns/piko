import { expect, test } from "@playwright/test";

import { gotoRoute } from "./support/nav";

test.describe("savings goals", () => {
  test.beforeEach(async ({ page }) => {
    await gotoRoute(page, "/savings-goals");
  });

  test("shows savings stats and goals", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Savings goals", exact: true })).toBeVisible();
    await expect(page.getByText("Saved toward goals", { exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "All" })).toBeVisible();
    await expect(page.getByText("Emergency fund").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent contributions" })).toBeVisible();
  });

  test("opens the create-goal dialog", async ({ page }) => {
    await page.getByRole("button", { name: "New goal" }).first().click();

    await expect(page.getByRole("dialog").getByRole("heading", { name: "New savings goal" })).toBeVisible();
  });
});
