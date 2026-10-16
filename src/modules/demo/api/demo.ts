import { randomBytes, randomUUID } from "node:crypto";

import bcrypt from "bcryptjs";
import { and, count, eq, gt, inArray, isNotNull, like, lt, type SQL } from "drizzle-orm";

import { db } from "@/db/client";
import {
  budgetItems,
  categories,
  dhukuEntries,
  dhukus,
  expenses,
  fundPlans,
  funds,
  fundTopUps,
  householdMembers,
  households,
  incomes,
  loanPayments,
  loans,
  monthlyBudgets,
  paybacks,
  recurringExpenses,
  savingsDeposits,
  savingsItems,
  savingsPotPlans,
  savingsPots,
  users,
} from "@/db/schema";
import { DEMO_EMAIL_DOMAIN } from "@/lib/demo-account";
import { todayISO } from "@/lib/today";

import { demoExpiry } from "../lib/demo-constants";
import { buildDemoFixture } from "../lib/demo-fixture";

function secret(): string {
  return randomBytes(24).toString("base64url");
}

// Creates a visitor's private copy of Aarav & Sita's household, all or
// nothing, and returns Aarav's sign-in. The password exists only in memory
// for the sign-in that follows; Sita's is random and never used.
export async function createDemoHousehold(now: Date): Promise<{ email: string; password: string }> {
  const householdId = randomUUID();
  const aarav = { memberId: randomUUID(), userId: randomUUID() };
  const sita = { memberId: randomUUID(), userId: randomUUID() };
  const email = `aarav.${householdId}@${DEMO_EMAIL_DOMAIN}`;
  const password = secret();
  const [aaravHash, sitaHash] = await Promise.all([bcrypt.hash(password, 10), bcrypt.hash(secret(), 10)]);
  const fixture = buildDemoFixture({
    aaravId: aarav.memberId,
    householdId,
    newId: randomUUID,
    sitaId: sita.memberId,
    today: todayISO(now),
  });

  await db.transaction(async (tx) => {
    await tx.insert(households).values({ dateFormat: "nepali", demoExpiresAt: demoExpiry(now), id: householdId, name: "Aarav & Sita" });
    await tx.insert(users).values([
      { email, id: aarav.userId, name: "Aarav", passwordHash: aaravHash },
      { email: `sita.${householdId}@${DEMO_EMAIL_DOMAIN}`, id: sita.userId, name: "Sita", passwordHash: sitaHash },
    ]);
    await tx.insert(householdMembers).values([
      { householdId, id: aarav.memberId, userId: aarav.userId },
      { householdId, id: sita.memberId, userId: sita.userId },
    ]);
    // Parents before the rows that point at them.
    await tx.insert(categories).values(fixture.categories);
    await tx.insert(recurringExpenses).values(fixture.recurringExpenses);
    await tx.insert(savingsPots).values(fixture.savingsPots);
    await tx.insert(savingsPotPlans).values(fixture.savingsPotPlans);
    await tx.insert(savingsItems).values(fixture.savingsItems);
    await tx.insert(savingsDeposits).values(fixture.savingsDeposits);
    await tx.insert(expenses).values(fixture.expenses);
    await tx.insert(incomes).values(fixture.incomes);
    await tx.insert(monthlyBudgets).values(fixture.monthlyBudgets);
    await tx.insert(budgetItems).values(fixture.budgetItems);
    await tx.insert(dhukus).values(fixture.dhukus);
    await tx.insert(dhukuEntries).values(fixture.dhukuEntries);
    await tx.insert(loans).values(fixture.loans);
    await tx.insert(loanPayments).values(fixture.loanPayments);
    await tx.insert(funds).values(fixture.funds);
    await tx.insert(fundPlans).values(fixture.fundPlans);
    await tx.insert(fundTopUps).values(fixture.fundTopUps);
    await tx.insert(paybacks).values(fixture.paybacks);
  });

  return { email, password };
}

export async function countLiveDemos(now: Date): Promise<number> {
  const [row] = await db.select({ live: count() }).from(households).where(gt(households.demoExpiresAt, now));
  return row?.live ?? 0;
}

export async function hasHousehold(userId: string): Promise<boolean> {
  const member = await db.query.householdMembers.findFirst({ where: eq(householdMembers.userId, userId) });
  return member !== undefined;
}

// Deletes demo households and their accounts. Two guards must both hold, so a
// mistake here can never reach a real household:
//   1. only households with demo_expires_at set (real ones have none), and
//   2. only accounts that belonged to them AND are on the demo email domain.
// Deleting a household deletes all of its data (every table cascades from it).
async function deleteDemos(which: SQL | undefined): Promise<void> {
  await db.transaction(async (tx) => {
    const doomed = await tx
      .select({ id: households.id })
      .from(households)
      .where(and(isNotNull(households.demoExpiresAt), which));
    if (doomed.length === 0) return;
    const householdIds = doomed.map((h) => h.id);
    const members = await tx
      .select({ userId: householdMembers.userId })
      .from(householdMembers)
      .where(inArray(householdMembers.householdId, householdIds));

    await tx.delete(households).where(and(isNotNull(households.demoExpiresAt), inArray(households.id, householdIds)));
    if (members.length > 0) {
      await tx.delete(users).where(
        and(
          inArray(
            users.id,
            members.map((m) => m.userId),
          ),
          like(users.email, `%@${DEMO_EMAIL_DOMAIN}`),
        ),
      );
    }
  });
}

export async function deleteExpiredDemos(now: Date): Promise<void> {
  await deleteDemos(lt(households.demoExpiresAt, now));
}

export async function deleteDemoHousehold(householdId: string): Promise<void> {
  await deleteDemos(eq(households.id, householdId));
}
