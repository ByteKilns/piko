import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { households } from "@/db/schema";

export const DATE_FORMATS = ["nepali", "english"] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

export const DEFAULT_DATE_FORMAT: DateFormat = "nepali";

export function isDateFormat(value: string): value is DateFormat {
  return (DATE_FORMATS as readonly string[]).includes(value);
}

// Shared per household (not per browser) — same convention as every other
// per-household fetch in this app (listCategories(householdId),
// listDhukus(householdId), etc.). Threaded into every date formatter call
// site across the app (pages, server actions, and — via props — the client
// hooks/components that render dates on the client).
export async function getDateFormatPref(householdId: string): Promise<DateFormat> {
  const [household] = await db.select().from(households).where(eq(households.id, householdId));
  return household?.dateFormat ?? DEFAULT_DATE_FORMAT;
}

// Household-wide opt-in for the AI budget planner. The deployment gate
// (AI_BUDGET_PLANNER) must also be on for the feature to appear; this is the
// per-household consent layer on top of it.
export async function getPlannerEnabledPref(householdId: string): Promise<boolean> {
  const [household] = await db.select().from(households).where(eq(households.id, householdId));
  return household?.plannerEnabled ?? false;
}
