import { and, desc, eq, gte, lte } from "drizzle-orm";

import { db } from "@/db/client";
import { expenses } from "@/db/schema";
import type { DateFormat } from "@/lib/date-format-cookie";
import { resolvePeriod } from "@/lib/month-period";

// One household's expenses in a month's period, newest first. The caller
// passes the household from its own sign-in (the website's session or the
// phone's token). It lives outside expenses.actions.ts on purpose: every
// export there is a Server Action the browser could call with any id.
export async function listHouseholdExpensesForMonth(householdId: string, year: number, month: number, dateFormat: DateFormat) {
  const period = resolvePeriod(year, month, dateFormat);

  return db
    .select()
    .from(expenses)
    .where(and(eq(expenses.householdId, householdId), gte(expenses.date, period.startDate), lte(expenses.date, period.endDate)))
    .orderBy(desc(expenses.date), desc(expenses.createdAt));
}
