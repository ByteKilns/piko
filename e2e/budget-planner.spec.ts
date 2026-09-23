import { expect, test } from "@playwright/test";

import { gotoRoute } from "./support/nav";

// AI_BUDGET_PLANNER=mock is set for the webServer in playwright.config.ts, so
// the entry point and route are enabled here.
test.describe("budget planner", () => {
  test("is reachable from the budget page", async ({ page }) => {
    await gotoRoute(page, "/budget");

    await page.getByRole("link", { name: "Plan with AI" }).click();

    await expect(page).toHaveURL((url) => url.pathname === "/budget/plan");
    await expect(page.getByRole("heading", { name: "Budget planner", exact: true })).toBeVisible();
  });

  test("renders the planner without an error", async ({ page }) => {
    await gotoRoute(page, "/budget/plan");

    await expect(page.getByRole("heading", { name: "Budget planner", exact: true })).toBeVisible();
  });

  // Exercises the full flow against the seeded e2e database (mock provider).
  test("generates a plan and applies a row", async ({ page }) => {
    await gotoRoute(page, "/budget/plan");

    await page.getByRole("button", { name: "Generate plan" }).click();
    await expect(page.getByText(/Suggested budget/)).toBeVisible();

    await page.getByRole("button", { name: "Apply", exact: true }).first().click();
    await expect(page.getByRole("button", { name: "Applied", exact: true }).first()).toBeVisible();
  });
});
