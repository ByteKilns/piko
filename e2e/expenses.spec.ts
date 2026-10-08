import { expect, test } from "@playwright/test";

import { formatShortDate } from "../src/lib/date-format";
import { bsToAd, NEPALI_MONTHS } from "../src/lib/nepali-date";
import { expenseRow, openRowMenu, pickFirstCategory, searchExpenses } from "./support/expenses";
import { expectNoErrorBoundary, gotoRoute } from "./support/nav";

test.describe("expenses", () => {
  test.beforeEach(async ({ page }) => {
    await gotoRoute(page, "/expenses");
  });

  test("shows the headline figures, search and filters", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Expenses", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^All expenses/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /^Shared/ })).toBeVisible();
    await expect(page.getByPlaceholder("Search notes or categories")).toBeVisible();
    for (const filter of ["Category", "Paid by", "Dates"]) {
      await expect(page.getByRole("button", { exact: true, name: filter })).toBeVisible();
    }
  });

  test("filters the list by person from the headline figures", async ({ page }) => {
    await page.getByRole("button", { name: /^Shared/ }).click();
    await expect(page.getByRole("button", { name: /^Shared/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /^All expenses/ })).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("button", { exact: true, name: "Clear" })).toBeVisible();
  });

  test("opens the add-expense dialog from the sidebar", async ({ page }) => {
    await page.getByRole("complementary").getByRole("button", { name: "Add expense", exact: true }).click();

    await expect(page.getByRole("dialog").getByRole("heading", { name: "Add expense" })).toBeVisible();
  });

  test("asks for an amount and a category before saving", async ({ page }) => {
    await page.getByRole("complementary").getByRole("button", { name: "Add expense", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add expense" });
    await dialog.getByRole("button", { name: "Add expense" }).click();

    await expect(dialog.getByText("Enter an amount to continue")).toBeVisible();
    await expect(dialog.getByText("Choose a category")).toBeVisible();
  });

  // The BS picker must save exactly the AD day the clicked BS day maps to, and
  // show that same BS day again when the saved expense is reopened.
  test("saves the BS date picked in the date picker", async ({ page }) => {
    const note = `bs-date-e2e-${Date.now()}`;

    await page.getByRole("complementary").getByRole("button", { name: "Add expense", exact: true }).click();
    const addDialog = page.getByRole("dialog", { name: "Add expense" });
    await addDialog.getByLabel("Amount").fill("250");
    await pickFirstCategory(page, addDialog);
    await addDialog.getByLabel("Note").fill(note);

    await addDialog.getByLabel("Date").click();
    const picker = page.locator('[data-slot="popover-content"]');
    await picker.getByRole("button", { name: "Previous month" }).click();
    const monthTitle = await picker.getByText(/^[A-Za-z]+ \d{4}$/).textContent();
    const [monthName, bsYear] = monthTitle!.split(" ");
    const picked = `15 ${monthName} ${bsYear}`;
    await picker.getByRole("button", { exact: true, name: picked }).click();
    await expect(addDialog.getByLabel("Date")).toHaveText(picked);

    await addDialog.getByRole("button", { name: "Add expense" }).click();
    await expect(addDialog).toBeHidden();

    const ad = bsToAd(Number(bsYear), NEPALI_MONTHS.indexOf(monthName as (typeof NEPALI_MONTHS)[number]) + 1, 15);
    const [adYear, adMonth] = ad.split("-").map(Number);
    await page.goto(`/expenses?year=${adYear}&month=${adMonth}`);
    await expectNoErrorBoundary(page);
    await searchExpenses(page, note);
    await expect(expenseRow(page, note)).toHaveCount(1);
    await expect(page.getByText(formatShortDate(ad, "english")).first()).toBeVisible();

    await openRowMenu(page, note);
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await expect(page.getByRole("dialog").getByLabel("Date")).toHaveText(picked);
  });

  test("repeats an expense for today from its menu", async ({ page }) => {
    const note = `repeat-e2e-${Date.now()}`;

    await page.getByRole("complementary").getByRole("button", { name: "Add expense", exact: true }).click();
    const addDialog = page.getByRole("dialog", { name: "Add expense" });
    await addDialog.getByLabel("Amount").fill("75");
    await pickFirstCategory(page, addDialog);
    await addDialog.getByLabel("Note").fill(note);
    await addDialog.getByRole("button", { name: "Add expense" }).click();
    await expect(addDialog).toBeHidden();

    await searchExpenses(page, note);
    await expect(expenseRow(page, note)).toHaveCount(1);
    await openRowMenu(page, note);
    await page.getByRole("menuitem", { name: "Repeat today" }).click();
    await expect(expenseRow(page, note)).toHaveCount(2);
  });

  test("opens the bulk-add dialog", async ({ page }) => {
    await page.getByRole("button", { name: "Bulk add" }).click();

    await expect(page.getByRole("dialog").getByRole("heading", { name: "Add in bulk" })).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
