import { expect, test } from "@playwright/test";

import { gotoRoute } from "./support/nav";

test.describe("settings", () => {
  test.beforeEach(async ({ page }) => {
    await gotoRoute(page, "/settings");
  });

  test("shows the appearance and account sections", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
    await expect(page.getByText("Manage your account and appearance")).toBeVisible();
    await expect(page.getByText("Theme").first()).toBeVisible();
    await expect(page.getByText("Date format").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Change Password" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  });

  test("shows the AI budget planner opt-in", async ({ page }) => {
    await expect(page.getByText("AI budget planner", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Use the AI budget planner")).toBeChecked();
  });
});
