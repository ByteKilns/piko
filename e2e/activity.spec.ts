import { expect, type Page, test } from "@playwright/test";

import { gotoRoute } from "./support/nav";

async function chooseFilter(page: Page, filter: string, option: string) {
  await page.getByRole("combobox", { name: filter }).click();
  await page.getByRole("option", { exact: true, name: option }).click();
}

test.describe("activity", () => {
  test("shows the activity page with its filters", async ({ page }) => {
    await gotoRoute(page, "/activity");

    await expect(page.getByRole("heading", { exact: true, name: "Activity" })).toBeVisible();
    await expect(page.getByPlaceholder("Search activity...")).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Section" })).toBeVisible();
  });

  // Writes to the seeded e2e database; the unique note keeps this test's
  // entries separate from anything other specs log in parallel.
  test("records an expense being added, edited and deleted", async ({ page }) => {
    const note = `activity-e2e-${Date.now()}`;

    await gotoRoute(page, "/expenses");
    await page.getByRole("complementary").getByRole("button", { exact: true, name: "+ Add Expense" }).click();
    const addDialog = page.getByRole("dialog");
    await addDialog.getByLabel("Amount").fill("1234");
    await addDialog.getByLabel("Note (optional)").fill(note);
    await addDialog.getByRole("button", { name: "Add Expense" }).click();
    await expect(addDialog).toBeHidden();

    await page.getByPlaceholder("Search expenses...").fill(note);
    const expenseRow = page.getByRole("row").filter({ hasText: note });
    await expenseRow.getByRole("button", { name: "Row actions" }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    const editDialog = page.getByRole("dialog");
    await editDialog.getByLabel("Amount").fill("4321");
    await editDialog.getByRole("button", { name: "Save changes" }).click();
    await expect(editDialog).toBeHidden();

    page.once("dialog", (dialog) => dialog.accept());
    await expenseRow.getByRole("button", { name: "Row actions" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await expect(expenseRow).toHaveCount(0);

    await gotoRoute(page, "/activity");
    await page.getByPlaceholder("Search activity...").fill(note);
    await page.getByPlaceholder("Search activity...").press("Enter");
    await expect(page).toHaveURL(/q=activity-e2e/);

    const entries = page.getByRole("listitem").filter({ hasText: note });
    await expect(entries).toHaveCount(3);
    await expect(entries.filter({ hasText: "added an expense" })).toHaveCount(1);
    await expect(entries.filter({ hasText: "deleted an expense" })).toHaveCount(1);

    const edited = entries.filter({ hasText: "edited an expense" });
    await edited.getByText("Show changes (1)").click();
    await expect(edited).toContainText("Amount");
    await expect(edited).toContainText("RS 1,234");
    await expect(edited).toContainText("RS 4,321");

    await chooseFilter(page, "Section", "Expenses");
    await chooseFilter(page, "Action", "Deleted");
    await expect(page).toHaveURL(/action=deleted/);
    await expect(entries).toHaveCount(1);
    await expect(entries).toContainText("deleted an expense");

    await chooseFilter(page, "Section", "Loans");
    await expect(page.getByText("No activity matches these filters.")).toBeVisible();

    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/activity" && url.search === "");
  });
});
