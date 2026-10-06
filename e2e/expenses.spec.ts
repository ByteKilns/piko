import { expect, test } from "@playwright/test";

import { formatShortDate } from "../src/lib/date-format";
import { bsToAd, NEPALI_MONTHS } from "../src/lib/nepali-date";
import { expectNoErrorBoundary, gotoRoute } from "./support/nav";

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

  // The BS picker must save exactly the AD day the clicked BS day maps to, and
  // show that same BS day again when the saved expense is reopened.
  test("saves the BS date picked in the date picker", async ({ page }) => {
    const note = `bs-date-e2e-${Date.now()}`;

    await page.getByRole("complementary").getByRole("button", { name: "+ Add Expense", exact: true }).click();
    const addDialog = page.getByRole("dialog", { name: "Add Expense" });
    await addDialog.getByLabel("Amount").fill("250");
    await addDialog.getByLabel("Note (optional)").fill(note);

    await addDialog.getByLabel("Date").click();
    const picker = page.locator('[data-slot="popover-content"]');
    await picker.getByRole("button", { name: "Previous month" }).click();
    const monthTitle = await picker.getByText(/^[A-Za-z]+ \d{4}$/).textContent();
    const [monthName, bsYear] = monthTitle!.split(" ");
    const picked = `15 ${monthName} ${bsYear}`;
    await picker.getByRole("button", { exact: true, name: picked }).click();
    await expect(addDialog.getByLabel("Date")).toHaveText(picked);

    await addDialog.getByRole("button", { name: "Add Expense" }).click();
    await expect(addDialog).toBeHidden();

    const ad = bsToAd(Number(bsYear), NEPALI_MONTHS.indexOf(monthName as (typeof NEPALI_MONTHS)[number]) + 1, 15);
    const [adYear, adMonth] = ad.split("-").map(Number);
    await page.goto(`/expenses?year=${adYear}&month=${adMonth}`);
    await expectNoErrorBoundary(page);
    await page.getByPlaceholder("Search expenses...").fill(note);
    const row = page.getByRole("row").filter({ hasText: note });
    await expect(row).toContainText(formatShortDate(ad, "english"));

    await row.getByRole("button", { name: "Row actions" }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await expect(page.getByRole("dialog").getByLabel("Date")).toHaveText(picked);
  });

  test("opens the bulk-add dialog", async ({ page }) => {
    await page.getByRole("button", { name: "Bulk add" }).click();

    await expect(page.getByRole("dialog").getByRole("heading", { name: "Add Expenses in Bulk" })).toBeVisible();
  });
});
