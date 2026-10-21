import { and, desc, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db/client";
import { expenses, paybacks } from "@/db/schema";


export async function listPaybacks(householdId: string) {
  return db
    .select()
    .from(paybacks)
    .where(eq(paybacks.householdId, householdId))
    .orderBy(desc(paybacks.date), desc(paybacks.createdAt));
}

// Every expense ever ticked "to be paid back": the running balance spans all
// months, like a shop's credit book.
export async function listPayBackExpenses(householdId: string) {
  return db
    .select({ amount: expenses.amount, paidByMemberId: expenses.paidByMemberId, payBackAmount: expenses.payBackAmount })
    .from(expenses)
    .where(and(eq(expenses.householdId, householdId), isNotNull(expenses.payBackAmount)));
}
