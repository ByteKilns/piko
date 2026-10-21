import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";

import { db } from "@/db/client";
import { expenses, savingsDeposits, savingsItems, savingsPotPlans, savingsPots } from "@/db/schema";


export async function listSavingsPots(householdId: string) {
  return db.select().from(savingsPots).where(eq(savingsPots.householdId, householdId)).orderBy(asc(savingsPots.createdAt));
}

export async function potIdsOf(householdId: string) {
  return (await listSavingsPots(householdId)).map((pot) => pot.id);
}

export async function listSavingsPotPlans(householdId: string) {
  const potIds = await potIdsOf(householdId);
  if (potIds.length === 0) return [];
  return db.select().from(savingsPotPlans).where(inArray(savingsPotPlans.potId, potIds));
}

export async function listSavingsItems(householdId: string) {
  const potIds = await potIdsOf(householdId);
  if (potIds.length === 0) return [];
  return db.select().from(savingsItems).where(inArray(savingsItems.potId, potIds)).orderBy(asc(savingsItems.position));
}

export async function listSavingsDeposits(householdId: string) {
  const potIds = await potIdsOf(householdId);
  if (potIds.length === 0) return [];
  return db
    .select()
    .from(savingsDeposits)
    .where(inArray(savingsDeposits.potId, potIds))
    .orderBy(desc(savingsDeposits.date), desc(savingsDeposits.createdAt));
}

// Every expense ever paid from a pot: for pot balances and finished items.
export async function listSavingsExpenses(householdId: string) {
  return db
    .select({
      amount: expenses.amount,
      date: expenses.date,
      id: expenses.id,
      savingsItemId: expenses.savingsItemId,
      savingsPotId: expenses.savingsPotId,
    })
    .from(expenses)
    .where(and(eq(expenses.householdId, householdId), isNotNull(expenses.savingsPotId)));
}
