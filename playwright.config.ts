import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

// e2e runs against the app in .env.local (local DB, seeded via `npm run db:seed`).
loadEnv({ path: ".env.local" });

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  projects: [
    // Signs in once and saves the session cookie, so specs don't each log in.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      dependencies: ["setup"],
      name: "chromium",
      testIgnore: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/user.json" },
    },
  ],
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  retries: process.env.CI ? 2 : 0,
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    reuseExistingServer: !process.env.CI,
    stderr: "pipe",
    stdout: "pipe",
    timeout: 180_000,
    url: baseURL,
  },
});
