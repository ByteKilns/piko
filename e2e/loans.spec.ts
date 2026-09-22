import { expect, test } from "@playwright/test";

import { gotoRoute } from "./support/nav";

test.describe("loans", () => {
  test.beforeEach(async ({ page }) => {
    await gotoRoute(page, "/loans");
  });

  test("shows loan stats and tabs", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Loans", exact: true })).toBeVisible();
    await expect(page.getByText("Track money lent out and borrowed")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Lent Out" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Borrowed" })).toBeVisible();
  });

  test("opens the add-loan dialog", async ({ page }) => {
    await page.getByRole("button", { name: "Add Loan" }).first().click();

    await expect(page.getByRole("dialog").getByRole("heading", { name: "Add a loan" })).toBeVisible();
  });
});
