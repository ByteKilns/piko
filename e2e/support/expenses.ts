import { expect, type Locator, type Page } from "@playwright/test";

// A row on the Expenses page (rows are grid rows, not table rows).
export function expenseRow(page: Page, text: string): Locator {
  return page.locator('[data-slot="row"]').filter({ hasText: text });
}

export async function searchExpenses(page: Page, text: string): Promise<void> {
  await page.getByLabel("Search expenses").fill(text);
}

// The Add/Edit dialog starts with no category; pick the first one the way a
// person would — focus the picker and press Enter.
export async function pickFirstCategory(page: Page, dialog: Locator): Promise<void> {
  await dialog.getByLabel("Category").click();
  await page.keyboard.press("Enter");
}

export async function addExpenseFromSidebar(page: Page, { amount, note }: { amount: string; note: string }): Promise<void> {
  await page.getByRole("complementary").getByRole("button", { exact: true, name: "Add expense" }).click();
  const dialog = page.getByRole("dialog", { name: "Add expense" });
  await dialog.getByLabel("Amount").fill(amount);
  await pickFirstCategory(page, dialog);
  await dialog.getByLabel("Note").fill(note);
  await dialog.getByRole("button", { name: "Add expense" }).click();
  await expect(dialog).toBeHidden();
}

export async function openRowMenu(page: Page, text: string): Promise<void> {
  await expenseRow(page, text).getByRole("button", { name: "More actions" }).click();
}
