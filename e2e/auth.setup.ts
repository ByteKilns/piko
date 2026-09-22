import { expect, test as setup } from "@playwright/test";

import { seedCredentials, storageStatePath } from "./support/config";

// Runs once (the "setup" project) and persists the session for every other spec.
setup("authenticate", async ({ page }) => {
  const { email, password } = seedCredentials();

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.waitForURL("**/dashboard");
  await expect(page.getByText("Here's your financial overview for")).toBeVisible();

  await page.context().storageState({ path: storageStatePath });
});
