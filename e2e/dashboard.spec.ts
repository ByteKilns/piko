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

  test("exposes previous/next month navigation", async ({ page }) => {
    await expect(page.getByLabel("Previous month")).toBeVisible();
    await expect(page.getByLabel("Next month")).toBeVisible();
  });

  test("shows the person breakdown and side panels", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "By person" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent expenses" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Savings goals" })).toBeVisible();
  });
});
