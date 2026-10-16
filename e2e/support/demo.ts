import type { Page } from "@playwright/test";

import { TOUR_STORAGE_KEY } from "../../src/modules/demo/tour/tour-memory";
import { queryE2e } from "./db";

// A browser with no session, for the public demo.
export const SIGNED_OUT = { cookies: [], origins: [] };

// Starts a demo from /demo and waits for its Home. Creating the household
// takes a few round trips to the database, hence the longer wait. Tours are
// off unless asked for, so their overlay doesn't cover what a test clicks.
export async function startDemo(page: Page, { tours = false } = {}): Promise<void> {
  if (!tours) {
    await page.addInitScript((key) => window.localStorage.setItem(key, JSON.stringify({ seen: [], skippedAll: true })), TOUR_STORAGE_KEY);
  }
  await page.goto("/demo");
  await page.getByRole("button", { name: "Start the demo" }).click();
  await page.waitForURL("**/dashboard", { timeout: 60_000 });
}

// demo.spec.ts runs serially, so the newest demo household is the one the
// test just started.
export async function newestDemoHouseholdId(): Promise<string> {
  return queryE2e(async (sql) => {
    const [household] = await sql`select id from households where demo_expires_at is not null order by created_at desc limit 1`;
    return household.id as string;
  });
}

export async function householdExists(id: string): Promise<boolean> {
  return queryE2e(async (sql) => {
    const [row] = await sql`select count(*)::int as n from households where id = ${id}`;
    return row.n === 1;
  });
}

export async function liveDemoCount(): Promise<number> {
  return queryE2e(async (sql) => {
    const [row] = await sql`select count(*)::int as n from households where demo_expires_at > now()`;
    return row.n as number;
  });
}
