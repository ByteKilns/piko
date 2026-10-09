import { expect, test } from "@playwright/test";

import { gotoRoute } from "./support/nav";

test.describe("dhuku", () => {
  test.beforeEach(async ({ page }) => {
    await gotoRoute(page, "/dhuku");
  });

  test("shows dhuku stats and tabs", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Dhuku", exact: true })).toBeVisible();
    await expect(page.getByText("Rotating savings groups you're part of")).toBeVisible();
    await expect(page.getByText("Due this month", { exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Active" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Completed" })).toBeVisible();
  });

  test("opens the add-dhuku dialog", async ({ page }) => {
    await page.getByRole("button", { name: "Add dhuku" }).first().click();

    await expect(page.getByRole("dialog").getByRole("heading", { name: "Add a dhuku" })).toBeVisible();
  });
});
