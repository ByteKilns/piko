"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { budgetItems, incomes, monthlyBudgets, recurringExpenses } from "@/db/schema";
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { resolvePeriod } from "@/lib/month-period";
import { type CurrentMember, getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { activityActor, loadActivityFormatters, logActivities, logActivity } from "@/modules/activity/api/activity";
import type { ActivityFormatters } from "@/modules/activity/lib/activity-values";
import { listCategories } from "@/modules/categories/api/categories";

import { budgetItemChanges, budgetItemSummary, incomeChanges, incomeSummary } from "../lib/budget-activity";
import { recurringBudgetLines } from "../lib/recurring-budget";
import { type RemoveBudgetItemInput, removeBudgetItemSchema, type SetBudgetItemInput, setBudgetItemSchema } from "../schemas/budget-item.schema";
import { type SetIncomeInput, setIncomeSchema } from "../schemas/income.schema";
import { listPlanLines } from "./budget";

// Insert-or-get in one statement. A select-then-insert would race when two
// requests hit a not-yet-created month at the same time (both see nothing,
// both insert, one hits the unique constraint and 500s). The no-op update on
// conflict makes the concurrent case return the existing row instead.
async function getOrCreateMonthlyBudget(householdId: string, year: number, month: number) {
  const [budget] = await db
    .insert(monthlyBudgets)
    .values({ householdId, year, month })
    .onConflictDoUpdate({
      set: { householdId },
      target: [monthlyBudgets.householdId, monthlyBudgets.year, monthlyBudgets.month],
    })
    .returning();
  return budget;
}

// null = shared. A plain eq() never matches NULL in SQL.
function ownerIs(ownerMemberId: null | string) {
  return ownerMemberId === null ? isNull(budgetItems.ownerMemberId) : eq(budgetItems.ownerMemberId, ownerMemberId);
}

async function assertMemberInHousehold(householdId: string, memberId: string) {
  const members = await getHouseholdMembers(householdId);
  if (!members.some((m) => m.id === memberId)) {
    throw new Error("Member does not belong to this household");
  }
}

// A month where a person has no lines of their own shows their last month's
// plan. The first change to such a month copies that plan in for real, so the
// change lands on the copy and the rest of the plan stays as it was.
async function materializeMonth(member: CurrentMember, f: ActivityFormatters, ownerMemberId: string, year: number, month: number) {
  const { householdId } = member;
  const [budget, plan] = await Promise.all([getOrCreateMonthlyBudget(householdId, year, month), listPlanLines(householdId, year, month)]);
  const carried = plan.filter((l) => l.ownerMemberId === ownerMemberId && l.inherited);
  if (carried.length === 0) return budget;

  const inserted = await db
    .insert(budgetItems)
    .values(
      carried.map((l) => ({
        categoryId: l.categoryId,
        kind: l.kind,
        monthlyBudgetId: budget.id,
        ownerMemberId,
        plannedAmount: String(l.plannedAmount),
      })),
    )
    .onConflictDoNothing()
    .returning();
  await logActivities(
    activityActor(member),
    inserted.map((item) => ({
      action: "created" as const,
      after: item,
      entityId: item.id,
      entityType: "budget_item" as const,
      summary: budgetItemSummary(f, item, { month, year }),
    })),
  );
  return budget;
}

export async function setBudgetItemAction(input: SetBudgetItemInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = setBudgetItemSchema.parse(input);

  const [categories, f] = await Promise.all([listCategories(householdId), loadActivityFormatters(householdId)]);
  if (!categories.some((c) => c.id === parsed.categoryId)) {
    throw new Error("Category does not belong to this household");
  }
  await assertMemberInHousehold(householdId, parsed.ownerMemberId);

  const budget = await materializeMonth(member, f, parsed.ownerMemberId, parsed.year, parsed.month);

  // Only ever this person's own line: the other person's plan is theirs.
  const [before] = await db
    .select()
    .from(budgetItems)
    .where(
      and(
        eq(budgetItems.monthlyBudgetId, budget.id),
        eq(budgetItems.categoryId, parsed.categoryId),
        eq(budgetItems.ownerMemberId, parsed.ownerMemberId),
      ),
    );
  const [item] = await db
    .insert(budgetItems)
    .values({
      categoryId: parsed.categoryId,
      kind: parsed.kind,
      monthlyBudgetId: budget.id,
      ownerMemberId: parsed.ownerMemberId,
      plannedAmount: String(parsed.plannedAmount),
    })
    .onConflictDoUpdate({
      set: { kind: parsed.kind, plannedAmount: String(parsed.plannedAmount) },
      target: [budgetItems.monthlyBudgetId, budgetItems.categoryId, budgetItems.ownerMemberId],
    })
    .returning();

  const after = { categoryId: parsed.categoryId, kind: parsed.kind, ownerMemberId: parsed.ownerMemberId, plannedAmount: parsed.plannedAmount };
  const summary = budgetItemSummary(f, after, { month: parsed.month, year: parsed.year });
  await logActivity(
    activityActor(member),
    before
      ? { action: "updated", after: item, before, changes: budgetItemChanges(f, before, after), entityId: item.id, entityType: "budget_item", summary }
      : { action: "created", after: item, before: null, entityId: item.id, entityType: "budget_item", summary },
  );

  revalidatePath("/budget");
  revalidatePath("/dashboard");
}

export async function removeBudgetItemAction(input: RemoveBudgetItemInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = removeBudgetItemSchema.parse(input);
  const f = await loadActivityFormatters(householdId);

  let budget;
  if (parsed.ownerMemberId === null) {
    budget = await getOrCreateMonthlyBudget(householdId, parsed.year, parsed.month);
  } else {
    await assertMemberInHousehold(householdId, parsed.ownerMemberId);
    budget = await materializeMonth(member, f, parsed.ownerMemberId, parsed.year, parsed.month);
  }

  const own = await db
    .select()
    .from(budgetItems)
    .where(and(eq(budgetItems.monthlyBudgetId, budget.id), ownerIs(parsed.ownerMemberId)));
  const before = own.find((l) => l.categoryId === parsed.categoryId);
  if (!before) return;

  const summary = budgetItemSummary(f, before, { month: parsed.month, year: parsed.year });
  if (parsed.ownerMemberId !== null && own.length === 1) {
    // Removing a person's last line would leave the month empty, and an empty
    // month shows the previous month's plan again. Keep it at zero instead.
    const [after] = await db.update(budgetItems).set({ plannedAmount: "0" }).where(eq(budgetItems.id, before.id)).returning();
    await logActivity(activityActor(member), {
      action: "updated",
      after,
      before,
      changes: budgetItemChanges(f, before, after),
      entityId: before.id,
      entityType: "budget_item",
      summary,
    });
  } else {
    await db.delete(budgetItems).where(eq(budgetItems.id, before.id));
    await logActivity(activityActor(member), { action: "deleted", before, entityId: before.id, entityType: "budget_item", summary });
  }

  revalidatePath("/budget");
  revalidatePath("/dashboard");
}

// Adds a line to one person's plan for each category with their recurring
// bills due this month. Lines they already have are left alone. Returns how
// many lines it added.
export async function fillBudgetFromRecurringAction(year: number, month: number, ownerMemberId: string): Promise<number> {
  const member = await getCurrentMember();
  const { householdId } = member;
  await assertMemberInHousehold(householdId, ownerMemberId);
  const dateFormat = await getDateFormatPref(householdId);
  const period = resolvePeriod(year, month, dateFormat);

  // A person's plan only takes their own bills.
  const bills = await db
    .select()
    .from(recurringExpenses)
    .where(and(eq(recurringExpenses.householdId, householdId), eq(recurringExpenses.ownerMemberId, ownerMemberId)));
  const lines = recurringBudgetLines(
    bills.map((b) => ({
      amount: Number(b.amount),
      categoryId: b.categoryId,
      frequency: b.frequency,
      nextDueDate: b.nextDueDate,
      ownerMemberId: b.ownerMemberId,
      status: b.status,
    })),
    period,
  );
  if (lines.length === 0) return 0;

  const f = await loadActivityFormatters(householdId);
  const budget = await materializeMonth(member, f, ownerMemberId, year, month);
  const existing = await db
    .select()
    .from(budgetItems)
    .where(and(eq(budgetItems.monthlyBudgetId, budget.id), eq(budgetItems.ownerMemberId, ownerMemberId)));
  const existingCategoryIds = new Set(existing.map((i) => i.categoryId));
  const toInsert = lines
    .filter((line) => !existingCategoryIds.has(line.categoryId))
    .map((line) => ({
      categoryId: line.categoryId,
      kind: "fixed" as const,
      monthlyBudgetId: budget.id,
      ownerMemberId,
      plannedAmount: String(line.plannedAmount),
    }));

  if (toInsert.length > 0) {
    const inserted = await db.insert(budgetItems).values(toInsert).returning();
    await logActivities(
      activityActor(member),
      inserted.map((item) => ({
        action: "created" as const,
        after: item,
        entityId: item.id,
        entityType: "budget_item" as const,
        summary: budgetItemSummary(f, item, { month, year }),
      })),
    );
  }

  revalidatePath("/budget");
  revalidatePath("/dashboard");
  return toInsert.length;
}

export async function getIncomesForMonth(year: number, month: number) {
  const { householdId } = await getCurrentMember();
  return db
    .select()
    .from(incomes)
    .where(and(eq(incomes.householdId, householdId), eq(incomes.year, year), eq(incomes.month, month)));
}

export async function listAllIncomes() {
  const { householdId } = await getCurrentMember();
  return db.select().from(incomes).where(eq(incomes.householdId, householdId));
}

export async function setIncomeAction(input: SetIncomeInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = setIncomeSchema.parse(input);

  const members = await getHouseholdMembers(householdId);
  if (!members.some((m) => m.id === parsed.memberId)) {
    throw new Error("Member does not belong to this household");
  }

  const [before] = await db
    .select()
    .from(incomes)
    .where(
      and(
        eq(incomes.householdId, householdId),
        eq(incomes.memberId, parsed.memberId),
        eq(incomes.year, parsed.year),
        eq(incomes.month, parsed.month),
      ),
    );

  const [saved] = await db
    .insert(incomes)
    .values({
      householdId,
      memberId: parsed.memberId,
      year: parsed.year,
      month: parsed.month,
      amount: String(parsed.amount),
      note: parsed.note,
    })
    .onConflictDoUpdate({
      target: [incomes.memberId, incomes.year, incomes.month],
      set: { amount: String(parsed.amount), note: parsed.note ?? null },
    })
    .returning();

  const f = await loadActivityFormatters(householdId);
  const after = { amount: parsed.amount, memberId: parsed.memberId, month: parsed.month, note: parsed.note, year: parsed.year };
  await logActivity(
    activityActor(member),
    before
      ? { action: "updated", after: saved, before, changes: incomeChanges(f, before, after), entityId: saved.id, entityType: "income", summary: incomeSummary(f, after) }
      : { action: "created", after: saved, before: null, entityId: saved.id, entityType: "income", summary: incomeSummary(f, after) },
  );

  revalidatePath("/budget");
  revalidatePath("/dashboard");
}
