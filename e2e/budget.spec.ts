import { expect, type Page, test } from "@playwright/test";

import { expectNoErrorBoundary, gotoRoute } from "./support/nav";

const PARTNER = process.env.SEED_USER2_NAME ?? "Partner";

// Next month, so these writes never change the current month's figures that
// other specs read.
async function gotoNextMonth(page: Page): Promise<void> {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  await page.goto(`/budget?year=${next.getFullYear()}&month=${next.getMonth() + 1}`);
  await expectNoErrorBoundary(page);
}

async function saveBudget(page: Page, { amount, category, owner }: { amount: string; category?: string; owner: string }) {
  const dialog = page.getByRole("dialog");
  if (category) {
    await dialog.getByRole("combobox", { name: "Category" }).fill(category);
    await page.keyboard.press("Enter");
  }
  await dialog.getByRole("radiogroup", { name: "For" }).getByText(owner, { exact: true }).click();
  await dialog.getByLabel("Monthly budget").fill(amount);
  await dialog.getByRole("button", { name: "Save budget" }).click();
  await expect(dialog).toBeHidden();
}

function budgetRow(page: Page, category: string) {
  return page.locator('[data-slot="row"]').filter({ hasText: category });
}

test.describe("budget lines per person", () => {
  // Several saves, each a server round trip and a refresh.
  test.beforeEach(() => test.slow());

  test("one person's line doesn't replace the other person's line for the same category", async ({ page }) => {
    await gotoNextMonth(page);

    await page.getByRole("button", { name: "Add budget" }).click();
    await saveBudget(page, { amount: "1111", category: "Petrol", owner: "Me" });
    await page.getByRole("button", { name: "Add budget" }).click();
    await saveBudget(page, { amount: "2222", category: "Petrol", owner: PARTNER });
    // Read what was saved, not a page that may still be refreshing.
    await page.reload();

    await expect(budgetRow(page, "Petrol")).toHaveCount(2);
    await expect(budgetRow(page, "Petrol").filter({ hasText: "1,111" })).toHaveCount(1);
    await expect(budgetRow(page, "Petrol").filter({ hasText: "2,222" })).toHaveCount(1);
  });

  test("moving a line to the other person takes it off the first person", async ({ page }) => {
    await gotoNextMonth(page);

    await page.getByRole("button", { name: "Add budget" }).click();
    await saveBudget(page, { amount: "3333", category: "Shopping", owner: "Me" });
    await budgetRow(page, "Shopping").click();
    await saveBudget(page, { amount: "3333", owner: PARTNER });
    await page.reload();

    await page.getByRole("tab", { exact: true, name: "Me" }).click();
    await expect(budgetRow(page, "Shopping")).toHaveCount(0);
    await page.getByRole("tab", { exact: true, name: PARTNER }).click();
    await expect(budgetRow(page, "Shopping")).toHaveCount(1);
  });
});

test.describe("budget", () => {
  test.beforeEach(async ({ page }) => {
    await gotoRoute(page, "/budget");
  });

  test("shows the month's plan", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Budget", exact: true })).toBeVisible();
    await expect(page.getByText("Budgeted", { exact: true })).toBeVisible();
    await expect(page.getByText("Spent in budgets", { exact: true })).toBeVisible();
    await expect(page.getByText("Click a row to change its budget")).toBeVisible();
  });

  test("opens the budget editor", async ({ page }) => {
    await page.getByRole("button", { name: "Add budget" }).click();

    await expect(page.getByRole("dialog").getByRole("heading", { name: "Set a budget" })).toBeVisible();
  });

  test("opens the set-income dialog", async ({ page }) => {
    await page.getByRole("button", { name: "Set income" }).click();

    await expect(page.getByRole("dialog").getByRole("heading", { name: "Set income" })).toBeVisible();
  });
});
