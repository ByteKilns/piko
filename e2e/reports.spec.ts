import { expect, test } from "@playwright/test";

import { gotoRoute } from "./support/nav";

test.describe("reports", () => {
  test.beforeEach(async ({ page }) => {
    await gotoRoute(page, "/reports");
  });

  test("shows the reports header and expense tab", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Reports", exact: true })).toBeVisible();
    await expect(page.getByText("Understand your money, make better decisions")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Expenses" })).toBeVisible();
    await expect(page.getByText("Expense Breakdown").first()).toBeVisible();
  });

  test("switches between report tabs", async ({ page }) => {
    await page.getByRole("tab", { name: "Income" }).click();
    await expect(page.getByText(/Total income this month:/)).toBeVisible();

    await page.getByRole("tab", { name: "Savings" }).click();
    await expect(page.getByText("Savings Overview").first()).toBeVisible();
  });
});
