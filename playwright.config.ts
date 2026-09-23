import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

// e2e credentials (SEED_USER*) come from .env.local.
loadEnv({ path: ".env.local" });

// A dedicated port so e2e never reuses (or fights over) a manually-run dev
// server on 3000 — reusing one would silently miss the env below.
const port = process.env.PLAYWRIGHT_PORT ?? "3100";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;

// e2e runs against its own database (reset + seeded by scripts/seed-e2e.ts),
// so tests can write freely without touching the dev DB. Defaults to the
// .env.local DATABASE_URL with the database name swapped for "piko_e2e".
function withDatabaseName(url: string | undefined, name: string): string | undefined {
  if (!url) return undefined;
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}
const e2eDatabaseUrl = process.env.E2E_DATABASE_URL ?? withDatabaseName(process.env.DATABASE_URL, "piko_e2e");

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
    // Production server, not `next dev`: Next 16 refuses a second dev server
    // for the same directory, so `next dev` here would fail whenever a manual
    // dev server is running. This also exercises the real build.
    command: "npm run e2e:serve",
    // AUTH_TRUST_HOST: next-auth v5 rejects a non-Vercel host unless trusted;
    // e2e runs a local `next start`, so it needs this. Test-only.
    // DATABASE_URL points the server (and the seeder) at the e2e database.
    env: {
      AI_BUDGET_PLANNER: "mock",
      AUTH_TRUST_HOST: "true",
      ...(e2eDatabaseUrl ? { DATABASE_URL: e2eDatabaseUrl } : {}),
    },
    reuseExistingServer: !process.env.CI,
    stderr: "pipe",
    stdout: "pipe",
    timeout: 180_000,
    url: baseURL,
  },
});
