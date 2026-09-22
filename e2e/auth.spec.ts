import { expect, test } from "@playwright/test";

import { seedCredentials } from "./support/config";

// These two exercise the signed-out path, so start from a clean context.
test.use({ storageState: { cookies: [], origins: [] } });

test("redirects signed-out visitors to the login page", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("signs in with the seeded credentials", async ({ page }) => {
  const { email, password } = seedCredentials();

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
});
