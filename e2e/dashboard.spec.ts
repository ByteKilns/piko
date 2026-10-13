import { expect, test } from "@playwright/test";

import { gotoRoute } from "./support/nav";

test.describe("dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await gotoRoute(page, "/dashboard");
  });

  test("shows the month overview", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible();
    await expect(page.getByText("Safe to spend today")).toBeVisible();
    await expect(page.getByText("Spent in")).toBeVisible();
    await expect(page.getByText("Unallocated").first()).toBeVisible();
  });

  test("follows the viewer's own plan: essentials and what went over", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Essentials" })).toBeVisible();
    await expect(page.getByText("Pay", { exact: true })).toBeVisible();
    // The seed has spending outside any line, which comes out of the can-cut money.
    await expect(page.getByText(/taken from your spending money\.$/)).toBeVisible();
  });

  test("asks about last month's leftover until it's decided", async ({ page }) => {
    test.slow();
    // The seed leaves member 1 money over in the previous month.
    const card = page.getByRole("region", { name: /to decide$/ });
    await expect(card).toBeVisible();

    await card.getByRole("button", { name: "Done" }).click();

    await expect(card).toBeHidden({ timeout: 20_000 });
    await expect(page.getByText("Cushion", { exact: true })).toBeVisible();

    // A decided month isn't asked about again.
    await page.reload();
    await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible();
    await expect(card).toHaveCount(0);
  });

  test("exposes previous/next month navigation", async ({ page }) => {
    await expect(page.getByLabel("Previous month")).toBeVisible();
    await expect(page.getByLabel("Next month")).toBeVisible();
  });

  test("shows the person breakdown and side panels", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "By person" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent expenses" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Savings", exact: true })).toBeVisible();
  });
});
