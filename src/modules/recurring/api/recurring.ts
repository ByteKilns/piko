import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { recurringExpenses } from "@/db/schema";

export async function listRecurringExpenses(householdId: string) {
  return db
    .select()
    .from(recurringExpenses)
    .where(eq(recurringExpenses.householdId, householdId))
    .orderBy(recurringExpenses.nextDueDate);
}
