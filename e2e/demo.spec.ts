import { expect, test } from "@playwright/test";

import { queryE2e } from "./support/db";
import { householdExists, liveDemoCount, newestDemoHouseholdId, SIGNED_OUT, startDemo } from "./support/demo";
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
    await expect(page.getByText(/^Deleted in /)).toBeVisible();
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

  test("locks the password, and the server refuses it even when forced", async ({ page }) => {
    await startDemo(page);
    await gotoRoute(page, "/settings");
    await expect(page.getByRole("button", { name: "Change Password" })).toBeDisabled();
    await expect(page.getByText("Not available in the demo.").first()).toBeVisible();

    await page.locator("fieldset[disabled]").evaluateAll((sets) => sets.forEach((set) => set.removeAttribute("disabled")));
    await page.getByLabel("Current password").fill("anything-at-all");
    await page.getByLabel("New password", { exact: true }).fill("new-password-123");
    await page.getByLabel("Confirm new password").fill("new-password-123");
    await page.getByRole("button", { name: "Change Password" }).click();
    await expect(page.locator("[data-sonner-toast][data-type='error']")).toBeVisible();
    await expect(page.getByText("Password changed")).toHaveCount(0);
  });

  test("Exit demo deletes the copy and returns to /demo", async ({ page }) => {
    await startDemo(page);
    const householdId = await newestDemoHouseholdId();

    await page.getByRole("button", { name: "Exit demo" }).click();
    await page.waitForURL(/\/demo\?bye=1/);
    await expect(page.getByText("Thanks for trying Piko.")).toBeVisible();
    expect(await householdExists(householdId)).toBe(false);
  });

  test("the phone adds an expense by voice, and the website shows it too", async ({ page }) => {
    await startDemo(page);
    await page.getByRole("button", { name: "Phone" }).click();
    const phone = page.getByRole("region", { name: "Demo phone" });
    await expect(phone.getByRole("heading", { name: "Recent expenses" })).toBeVisible();

    await phone.getByRole("button", { name: "Add by voice" }).click();
    await phone.getByRole("button", { name: "Momo with Sita, 450 rupees" }).click();
    await expect(phone.getByRole("heading", { name: "Add expense" })).toBeVisible({ timeout: 10_000 });
    await expect(phone.getByLabel("Amount", { exact: true })).toHaveValue("450");
    await phone.getByRole("button", { name: "Save" }).click();

    // Saving goes through the real action and refreshes the page: allow for a slow database.
    await expect(phone.getByRole("heading", { name: "Recent expenses" })).toBeVisible({ timeout: 20_000 });
    await expect(phone.getByText("Momo with Sita")).toBeVisible();
    await expect(page.locator("main").getByText("Momo with Sita")).toBeVisible();
  });

  test("on a phone-sized screen the phone opens full screen and closes", async ({ page }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await startDemo(page);
    await page.getByRole("button", { name: "Phone" }).click();
    const phone = page.getByRole("region", { name: "Demo phone" });
    await expect(phone.getByRole("heading", { name: "Recent expenses" })).toBeVisible();

    await phone.getByRole("button", { exact: true, name: "Close" }).click();
    await expect(phone).toHaveCount(0);
  });

  test("the phone's Settings screen opens from Home", async ({ page }) => {
    await startDemo(page);
    await page.getByRole("button", { name: "Phone" }).click();
    const phone = page.getByRole("region", { name: "Demo phone" });
    await phone.getByRole("button", { name: "Settings" }).click();
    await expect(phone.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(phone.getByText("https://piko-kn.vercel.app")).toBeVisible();

    await phone.getByRole("button", { name: "Back" }).click();
    await expect(phone.getByRole("heading", { name: "Recent expenses" })).toBeVisible();
  });

  test("the Home tour runs once; Skip all tours stops the rest; Tour this page replays", async ({ page }) => {
    await startDemo(page, { tours: true });
    const popover = page.locator(".driver-popover");
    const title = popover.locator(".driver-popover-title");
    await expect(title).toHaveText("Welcome to Piko");
    await popover.getByRole("button", { name: "Next" }).click();
    await expect(title).toHaveText("Safe to spend today");
    await popover.getByRole("button", { name: "Skip all tours" }).click();
    await expect(popover).toHaveCount(0);

    await gotoRoute(page, "/budget");
    await expect(page.getByRole("button", { name: "Tour this page" })).toBeVisible();
    await page.waitForTimeout(1000);
    await expect(popover).toHaveCount(0);

    await page.getByRole("button", { name: "Tour this page" }).click();
    await expect(title).toHaveText("Whose plan");
  });

  test("a page's tour runs by itself the first time it's opened, then not again", async ({ page }) => {
    await startDemo(page, { tours: true });
    const popover = page.locator(".driver-popover");
    const title = popover.locator(".driver-popover-title");
    await expect(title).toHaveText("Welcome to Piko");
    await page.keyboard.press("Escape");
    await expect(popover).toHaveCount(0);

    await gotoRoute(page, "/savings");
    await expect(title).toHaveText("The pot");
    await popover.getByRole("button", { name: "Next" }).click();
    await popover.getByRole("button", { name: "Next" }).click();
    await expect(title).toHaveText("Add money");
    await popover.getByRole("button", { name: "Done" }).click();
    await expect(popover).toHaveCount(0);

    await gotoRoute(page, "/savings");
    await page.waitForTimeout(1000);
    await expect(popover).toHaveCount(0);
  });

  test("on a phone-sized screen the Home tour finds all eight of its sections", async ({ page }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await startDemo(page, { tours: true });
    const popover = page.locator(".driver-popover");
    await expect(popover.locator(".driver-popover-title")).toHaveText("Welcome to Piko");
    await expect(popover.locator(".driver-popover-progress-text")).toHaveText("1 of 8");
  });

  test("cleanup deletes an expired demo and leaves the real household alone", async ({ browser }) => {
    const first = await browser.newPage();
    await startDemo(first);
    const householdId = await newestDemoHouseholdId();
    const userIds = await queryE2e(async (sql) => {
      const members = await sql`select user_id from household_members where household_id = ${householdId}`;
      // The app's clock, not the database's now(): the column has no time zone
      // and the app stores UTC, so now() (or a Date, which the driver converts
      // to the database time zone) is off by the database's offset.
      await sql`update households set demo_expires_at = ${new Date(Date.now() - 60_000).toISOString()} where id = ${householdId}`;
      return members.map((m) => m.user_id as string);
    });

    // Starting another demo runs the cleanup.
    const second = await browser.newPage();
    await startDemo(second);

    const left = await queryE2e(async (sql) => {
      const [demoUsers] = await sql`select count(*)::int as n from users where id in ${sql(userIds)}`;
      const [real] = await sql`
        select count(distinct m.user_id)::int as n
        from households h join household_members m on m.household_id = h.id join users u on u.id = m.user_id
        where h.name = 'E2E Household' and h.demo_expires_at is null`;
      return { demoUsers: demoUsers.n, realUsers: real.n };
    });
    expect(await householdExists(householdId)).toBe(false);
    expect(left).toEqual({ demoUsers: 0, realUsers: 2 });

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

test("a real account sees no demo banner and no tour", async ({ page }) => {
  await gotoRoute(page, "/dashboard");
  await expect(page.getByRole("button", { name: "Exit demo" })).toHaveCount(0);
  await page.waitForTimeout(1000);
  await expect(page.locator(".driver-popover")).toHaveCount(0);
  await gotoRoute(page, "/settings");
  await expect(page.getByRole("button", { name: "Change Password" })).toBeEnabled();
});
