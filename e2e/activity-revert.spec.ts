import { expect, type Locator, type Page, test } from "@playwright/test";

import { gotoRoute } from "./support/nav";

async function openActivity(page: Page, query: string) {
  await gotoRoute(page, "/activity");
  await page.getByPlaceholder("Search activity...").fill(query);
  await page.getByPlaceholder("Search activity...").press("Enter");
  await expect(page).toHaveURL(/q=/);
}

async function editExpense(page: Page, query: string, fill: (dialog: Locator) => Promise<void>) {
  await gotoRoute(page, "/expenses");
  await page.getByPlaceholder("Search expenses...").fill(query);
  await page.getByRole("row").filter({ hasText: query }).getByRole("button", { name: "Row actions" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog");
  await fill(dialog);
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toBeHidden();
}

test("reverts edits both ways and brings back a deleted expense", async ({ page }) => {
  test.setTimeout(90_000);
  const token = `revert-e2e-${Date.now()}`;

  // Add, then edit the amount (the "2pm" edit), then the note (the "3pm" edit).
  await gotoRoute(page, "/expenses");
  await page.getByRole("complementary").getByRole("button", { exact: true, name: "+ Add Expense" }).click();
  const add = page.getByRole("dialog");
  await add.getByLabel("Amount").fill("1234");
  await add.getByLabel("Note (optional)").fill(`${token}-a`);
  await add.getByRole("button", { name: "Add Expense" }).click();
  await expect(add).toBeHidden();
  await editExpense(page, token, (d) => d.getByLabel("Amount").fill("4321"));
  await editExpense(page, token, (d) => d.getByLabel("Note (optional)").fill(`${token}-b`));

  // Undo only the amount edit: amount back to 1,234, note stays -b.
  await openActivity(page, token);
  const entries = page.getByRole("listitem").filter({ hasText: token });
  const amountEdit = entries.filter({ hasText: "edited an expense" }).filter({ hasNotText: `${token}-b` });
  await amountEdit.getByRole("button", { name: "Revert" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("radio", { name: /Undo only this change/ })).toBeChecked();
  await expect(dialog).toContainText("Amount");
  await expect(dialog).toContainText("RS 4,321");
  await expect(dialog).toContainText("RS 1,234");
  await dialog.getByRole("button", { exact: true, name: "Revert" }).click();
  await expect(dialog).toBeHidden();
  const reverts = entries.filter({ hasText: "reverted a change to an expense" });
  await expect(reverts.first()).toContainText(`RS 1,234`);
  await expect(reverts.first()).toContainText(`${token}-b`);

  // Restore to before the note edit: both fields go back, with an override warning.
  const noteEdit = entries.filter({ hasText: "edited an expense" }).filter({ hasText: `${token}-b` });
  await noteEdit.getByRole("button", { name: "Revert" }).click();
  await dialog.getByRole("radio", { name: /Restore to before this change/ }).check();
  await expect(dialog).toContainText("This also overrides a later change to Amount");
  await expect(dialog).toContainText(`${token}-a`);
  await dialog.getByRole("button", { exact: true, name: "Revert" }).click();
  await expect(dialog).toBeHidden();
  await expect(reverts).toHaveCount(2);
  await expect(reverts.first()).toContainText("RS 4,321");
  await expect(reverts.first()).toContainText(`${token}-a`);

  // Delete it, then revert the delete.
  await gotoRoute(page, "/expenses");
  await page.getByPlaceholder("Search expenses...").fill(token);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("row").filter({ hasText: token }).getByRole("button", { name: "Row actions" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.getByRole("row").filter({ hasText: token })).toHaveCount(0);

  await openActivity(page, token);
  await entries.filter({ hasText: "deleted an expense" }).getByRole("button", { name: "Revert" }).click();
  await expect(dialog).toContainText(`${token}-a`);
  await dialog.getByRole("button", { exact: true, name: "Revert" }).click();
  await expect(dialog).toBeHidden();

  await gotoRoute(page, "/expenses");
  await page.getByPlaceholder("Search expenses...").fill(token);
  await expect(page.getByRole("row").filter({ hasText: token })).toHaveCount(1);
});
