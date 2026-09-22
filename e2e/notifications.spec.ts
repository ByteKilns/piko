import { expect, test } from "@playwright/test";

import { gotoRoute } from "./support/nav";

test.describe("notifications", () => {
  test.beforeEach(async ({ page }) => {
    await gotoRoute(page, "/notifications");
  });

  test("shows the notification feed with filters", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Notifications", exact: true })).toBeVisible();
    await expect(page.getByText("Stay up to date with your financial activity")).toBeVisible();
    await expect(page.getByRole("button", { name: "Unread" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark all as read" })).toBeVisible();
  });
});
