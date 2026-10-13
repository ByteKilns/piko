import { expect, type Page, test } from "@playwright/test";

import { expectNoErrorBoundary, gotoRoute } from "./support/nav";

const PARTNER = process.env.SEED_USER2_NAME ?? "Partner";

// A month ahead, so these writes never change the current month's figures
// that other specs read.
async function gotoMonthAhead(page: Page, ahead: number): Promise<void> {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + ahead, 1);
  await page.goto(`/budget?year=${target.getFullYear()}&month=${target.getMonth() + 1}`);
  await expectNoErrorBoundary(page);
}

async function addBudget(page: Page, { amount, category }: { amount: string; category: string }) {
  await page.getByRole("button", { name: "Add budget" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Category" }).fill(category);
  await page.keyboard.press("Enter");
  await dialog.getByLabel("Monthly budget").fill(amount);
  await dialog.getByRole("button", { name: "Save budget" }).click();
  // The first change to a carried-over month copies the plan in first.
  await expect(dialog).toBeHidden({ timeout: 20_000 });
}

function budgetRow(page: Page, category: string) {
  return page.locator('[data-slot="row"]').filter({ hasText: category });
}

test.describe("budget plans per person", () => {
  // Several saves, each a server round trip and a refresh.
  test.beforeEach(() => test.slow());

  test("one person's line doesn't replace the other person's line for the same category", async ({ page }) => {
    await gotoMonthAhead(page, 1);

    await addBudget(page, { amount: "1111", category: "Petrol" });
    await page.getByRole("tab", { exact: true, name: PARTNER }).click();
    await addBudget(page, { amount: "2222", category: "Petrol" });
    // Read what was saved, not a page that may still be refreshing.
    await page.reload();

    await expect(budgetRow(page, "Petrol")).toContainText("1,111");
    await page.getByRole("tab", { exact: true, name: PARTNER }).click();
    await expect(budgetRow(page, "Petrol")).toContainText("2,222");
  });

  test("a month with no lines of its own carries over the last plan", async ({ page }) => {
    await gotoMonthAhead(page, 2);

    await expect(page.getByText(/^Carried over from/)).toBeVisible();
    await expect(page.getByText("Can cut", { exact: true })).toBeVisible();
    await expect(budgetRow(page, "Dining Out")).toHaveCount(1);
  });

  test("removing a line from a carried-over month makes the month its own", async ({ page }) => {
    await gotoMonthAhead(page, 4);
    await page.getByRole("tab", { exact: true, name: PARTNER }).click();

    await budgetRow(page, "Entertainment").click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Remove budget" }).click();
    await expect(dialog).toBeHidden({ timeout: 20_000 });
    await page.reload();
    await page.getByRole("tab", { exact: true, name: PARTNER }).click();

    // Even when it was the only line, the month doesn't fall back to the last plan.
    await expect(budgetRow(page, "Entertainment")).toHaveCount(0);
    await expect(page.getByText(/Changing a line makes this month's plan its own/)).toHaveCount(0);
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
