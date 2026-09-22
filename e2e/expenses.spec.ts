import { expect, test } from "@playwright/test";

import { gotoRoute } from "./support/nav";

test.describe("expenses", () => {
  test.beforeEach(async ({ page }) => {
    await gotoRoute(page, "/expenses");
  });

  test("shows the list with search, filters and tabs", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Expenses", exact: true })).toBeVisible();
    await expect(page.getByText("Track where your money goes")).toBeVisible();
    await expect(page.getByPlaceholder("Search expenses...")).toBeVisible();
    await expect(page.getByRole("tab", { name: "All" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Shared" })).toBeVisible();
  });

  test("opens the add-expense dialog from the sidebar", async ({ page }) => {
    await page.getByRole("complementary").getByRole("button", { name: "+ Add Expense", exact: true }).click();

    await expect(page.getByRole("dialog").getByRole("heading", { name: "Add Expense" })).toBeVisible();
  });

  test("opens the bulk-add dialog", async ({ page }) => {
    await page.getByRole("button", { name: "Bulk add" }).click();

    await expect(page.getByRole("dialog").getByRole("heading", { name: "Add Expenses in Bulk" })).toBeVisible();
  });
});
