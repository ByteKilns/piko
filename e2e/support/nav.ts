import { expect, type Page } from "@playwright/test";

// The error boundary (src/components/ErrorState.tsx) renders this text, so its
// presence means a page render threw (e.g. a server/DB error).
export async function expectNoErrorBoundary(page: Page): Promise<void> {
  await expect(page.getByText("Something went wrong")).toHaveCount(0);
}

// Navigates to an app route and asserts we landed there without a server error.
export async function gotoRoute(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page).toHaveURL((url) => url.pathname === path);
  await expectNoErrorBoundary(page);
}
