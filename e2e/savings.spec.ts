import { expect, test } from "@playwright/test";

import { gotoRoute } from "./support/nav";

test.describe("savings", () => {
  test.beforeEach(async ({ page }) => {
    await gotoRoute(page, "/savings");
  });

  test("shows the shared pot and its priority list", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Savings", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Shared savings" })).toBeVisible();
    await expect(page.getByText("Emergency reserve").first()).toBeVisible();
    await expect(page.getByText("Surgery", { exact: true })).toBeVisible();
  });

  test("opens the add-money dialog", async ({ page }) => {
    await page.getByRole("button", { name: "Add money" }).first().click();

    await expect(page.getByRole("dialog").getByRole("heading", { name: "Add money" })).toBeVisible();
  });
});
