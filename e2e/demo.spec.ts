import { expect, test } from "@playwright/test";

import { queryE2e } from "./support/db";
import { liveDemoCount, newestDemoHouseholdId, SIGNED_OUT, startDemo } from "./support/demo";
import { expectNoErrorBoundary, gotoRoute } from "./support/nav";

// One demo at a time, so "the newest demo household" is always this file's.
// Each test creates a household on the (remote) e2e database, so allow more
// than the default 30s.
test.describe.configure({ mode: "serial", timeout: 90_000 });

test.describe("public demo", () => {
  test.use({ storageState: SIGNED_OUT });

  test("opens signed out and starts on Aarav & Sita's Home", async ({ page }) => {
    await page.goto("/demo");
    await expect(page.getByRole("heading", { name: "Try Piko" })).toBeVisible();

    await startDemo(page);
    await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible();
    await expect(page.getByText("Birthday dinner").first()).toBeVisible();
    await expectNoErrorBoundary(page);
  });

  test("every page opens on the demo data", async ({ page }) => {
    await startDemo(page);
    for (const path of ["/expenses", "/budget", "/recurring", "/savings", "/loans", "/dhuku", "/reports", "/categories", "/activity", "/settings"]) {
      await gotoRoute(page, path);
    }
    await gotoRoute(page, "/savings");
    await expect(page.getByText("Home fund").first()).toBeVisible();
    await gotoRoute(page, "/dhuku");
    await expect(page.getByText("Office dhuku").first()).toBeVisible();
  });

  test("opening /demo, as a link preview does, creates nothing", async ({ page }) => {
    const before = await liveDemoCount();
    await page.goto("/demo");
    await page.reload();
    expect(await liveDemoCount()).toBe(before);
  });

  test("starting again while a demo is running goes back to it", async ({ page }) => {
    await startDemo(page);
    const householdId = await newestDemoHouseholdId();
    await page.goto("/demo");
    await page.getByRole("button", { name: "Start the demo" }).click();
    await page.waitForURL("**/dashboard", { timeout: 60_000 });
    expect(await newestDemoHouseholdId()).toBe(householdId);
  });

  test("past 100 live demos, visitors are asked to come back later", async ({ page }) => {
    const fillers = Math.max(0, 100 - (await liveDemoCount()));
    await queryE2e((sql) => sql`insert into households (name, demo_expires_at) select 'Busy filler', now() + interval '1 hour' from generate_series(1, ${fillers})`);
    try {
      await page.goto("/demo");
      await page.getByRole("button", { name: "Start the demo" }).click();
      await expect(page.getByText("The demo is busy, try again later.")).toBeVisible({ timeout: 30_000 });
    } finally {
      await queryE2e((sql) => sql`delete from households where name = 'Busy filler' and demo_expires_at is not null`);
    }
  });

  test("a demo account can't sign in to the mobile app", async ({ request }) => {
    const response = await request.post("/api/mobile/login", { data: { email: "aarav.test@demo.piko.invalid", password: "anything" } });
    expect(response.status()).toBe(403);
  });

  test("cleanup deletes an expired demo and leaves the real household alone", async ({ browser }) => {
    const first = await browser.newPage();
    await startDemo(first);
    const { householdId, userIds } = await queryE2e(async (sql) => {
      const [household] = await sql`select id from households where demo_expires_at is not null order by created_at desc limit 1`;
      const members = await sql`select user_id from household_members where household_id = ${household.id}`;
      await sql`update households set demo_expires_at = now() - interval '1 minute' where id = ${household.id}`;
      return { householdId: household.id as string, userIds: members.map((m) => m.user_id as string) };
    });

    // Starting another demo runs the cleanup.
    const second = await browser.newPage();
    await startDemo(second);

    const left = await queryE2e(async (sql) => {
      const [demo] = await sql`select count(*)::int as n from households where id = ${householdId}`;
      const [demoUsers] = await sql`select count(*)::int as n from users where id in ${sql(userIds)}`;
      const [real] = await sql`
        select count(distinct m.user_id)::int as n
        from households h join household_members m on m.household_id = h.id join users u on u.id = m.user_id
        where h.name = 'E2E Household' and h.demo_expires_at is null`;
      return { demo: demo.n, demoUsers: demoUsers.n, realUsers: real.n };
    });
    expect(left).toEqual({ demo: 0, demoUsers: 0, realUsers: 2 });

    // The first visitor's session outlived its household: back to /demo, not an error.
    await first.goto("/dashboard");
    await expect(first).toHaveURL(/\/demo\?expired=1/);
    await expect(first.getByText("Your demo expired. Start a new one.")).toBeVisible();
  });
});

test("a signed-in owner can open /demo and is told it signs them out", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "Try Piko" })).toBeVisible();
  await expect(page.getByText("Starting the demo signs you out of your own household.")).toBeVisible();
});
