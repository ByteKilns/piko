import { expect, test } from "@playwright/test";

// Runs with the stored session from auth.setup.ts.
test("dashboard renders the month overview", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText("Here's your financial overview for")).toBeVisible();
});

test("navigates from the dashboard to expenses", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Expenses" }).first().click();

  await expect(page).toHaveURL(/\/expenses/);
  await expect(page.getByRole("heading", { name: "Expenses" })).toBeVisible();
});
