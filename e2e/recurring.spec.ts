import { expect, test } from "@playwright/test";

import { gotoRoute } from "./support/nav";

test.describe("recurring", () => {
  test.beforeEach(async ({ page }) => {
    await gotoRoute(page, "/recurring");
  });

  test("shows the recurring summary with filters and tabs", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Recurring", exact: true })).toBeVisible();
    await expect(page.getByText("Manage your recurring and upcoming expenses")).toBeVisible();
    await expect(page.getByPlaceholder("Search recurring...")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Active" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Upcoming" })).toBeVisible();
  });

  test("opens the add-recurring dialog", async ({ page }) => {
    await page.getByRole("button", { name: "Add Recurring" }).click();

    await expect(page.getByRole("dialog").getByRole("heading", { name: "Add recurring expense" })).toBeVisible();
  });
});
