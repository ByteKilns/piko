"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { budgetItems, incomes, monthlyBudgets, recurringExpenses } from "@/db/schema";
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { resolvePeriod } from "@/lib/month-period";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { activityActor, loadActivityFormatters, logActivities, logActivity } from "@/modules/activity/api/activity";
import { listCategories } from "@/modules/categories/api/categories";

import { budgetItemChanges, budgetItemSummary, incomeChanges, incomeSummary } from "../lib/budget-activity";
import { recurringBudgetLines } from "../lib/recurring-budget";
import { type RemoveBudgetItemInput, removeBudgetItemSchema, type SetBudgetItemInput, setBudgetItemSchema } from "../schemas/budget-item.schema";
import { type SetIncomeInput, setIncomeSchema } from "../schemas/income.schema";

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

export async function getBudgetItemsForMonth(year: number, month: number) {
  const { householdId } = await getCurrentMember();
  const budget = await getOrCreateMonthlyBudget(householdId, year, month);
  return db.select().from(budgetItems).where(eq(budgetItems.monthlyBudgetId, budget.id));
}

export async function setBudgetItemAction(input: SetBudgetItemInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = setBudgetItemSchema.parse(input);

  const categories = await listCategories(householdId);
  if (!categories.some((c) => c.id === parsed.categoryId)) {
    throw new Error("Category does not belong to this household");
  }

  if (parsed.ownerMemberId !== null) {
    const members = await getHouseholdMembers(householdId);
    if (!members.some((m) => m.id === parsed.ownerMemberId)) {
      throw new Error("Member does not belong to this household");
    }
  }

  const budget = await getOrCreateMonthlyBudget(householdId, parsed.year, parsed.month);

  // Each person's line is their own, so a save only ever touches this owner's
  // line. The one exception is moving a line: editing it with a different
  // "For" removes the old owner's line in the same transaction.
  const movedFrom =
    parsed.replacesOwnerMemberId !== undefined && parsed.replacesOwnerMemberId !== parsed.ownerMemberId ? parsed.replacesOwnerMemberId : undefined;

  // What the log diffs against: the line being moved, or this owner's line.
  const [before] = await db
    .select()
    .from(budgetItems)
    .where(
      and(
        eq(budgetItems.monthlyBudgetId, budget.id),
        eq(budgetItems.categoryId, parsed.categoryId),
        ownerIs(movedFrom === undefined ? parsed.ownerMemberId : movedFrom),
      ),
    );

  const item = await db.transaction(async (tx) => {
    if (movedFrom !== undefined) {
      await tx
        .delete(budgetItems)
        .where(and(eq(budgetItems.monthlyBudgetId, budget.id), eq(budgetItems.categoryId, parsed.categoryId), ownerIs(movedFrom)));
    }

    if (parsed.ownerMemberId === null) {
      // The unique constraint on budget_items is a plain multi-column UNIQUE
      // (monthly_budget_id, category_id, owner_member_id), not a partial unique
      // index. Postgres never treats two NULLs as equal for uniqueness purposes,
      // so `ON CONFLICT (monthly_budget_id, category_id, owner_member_id)` never
      // fires when owner_member_id is NULL — two "shared" inserts for the same
      // category/month would each succeed and create a duplicate row instead of
      // updating in place. Verified empirically against the live DB. So for the
      // shared (null-owner) case we must select-then-branch inside the
      // transaction instead of relying on onConflictDoUpdate.
      const [existing] = await tx
        .select()
        .from(budgetItems)
        .where(
          and(
            eq(budgetItems.monthlyBudgetId, budget.id),
            eq(budgetItems.categoryId, parsed.categoryId),
            isNull(budgetItems.ownerMemberId),
          ),
        )
        .for("update");

      if (existing) {
        const [updated] = await tx
          .update(budgetItems)
          .set({ plannedAmount: String(parsed.plannedAmount) })
          .where(eq(budgetItems.id, existing.id))
          .returning();
        return updated;
      }
      const [inserted] = await tx
        .insert(budgetItems)
        .values({
          monthlyBudgetId: budget.id,
          categoryId: parsed.categoryId,
          ownerMemberId: null,
          plannedAmount: String(parsed.plannedAmount),
        })
        .returning();
      return inserted;
    } else {
      // For a non-null owner, the composite unique constraint does detect
      // conflicts correctly, so the atomic upsert is safe here.
      const [upserted] = await tx
        .insert(budgetItems)
        .values({
          monthlyBudgetId: budget.id,
          categoryId: parsed.categoryId,
          ownerMemberId: parsed.ownerMemberId,
          plannedAmount: String(parsed.plannedAmount),
        })
        .onConflictDoUpdate({
          target: [budgetItems.monthlyBudgetId, budgetItems.categoryId, budgetItems.ownerMemberId],
          set: { plannedAmount: String(parsed.plannedAmount) },
        })
        .returning();
      return upserted;
    }
  });

  const itemId = item.id;
  const f = await loadActivityFormatters(householdId);
  const after = { categoryId: parsed.categoryId, ownerMemberId: parsed.ownerMemberId, plannedAmount: parsed.plannedAmount };
  const summary = budgetItemSummary(f, after, { month: parsed.month, year: parsed.year });
  await logActivity(
    activityActor(member),
    before
      ? { action: "updated", after: item, before, changes: budgetItemChanges(f, before, after), entityId: itemId, entityType: "budget_item", summary }
      : { action: "created", after: item, before: null, entityId: itemId, entityType: "budget_item", summary },
  );

  revalidatePath("/budget");
  revalidatePath("/dashboard");
}

export async function removeBudgetItemAction(input: RemoveBudgetItemInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = removeBudgetItemSchema.parse(input);

  const budget = await getOrCreateMonthlyBudget(householdId, parsed.year, parsed.month);
  const [before] = await db
    .select()
    .from(budgetItems)
    .where(
      and(
        eq(budgetItems.monthlyBudgetId, budget.id),
        eq(budgetItems.categoryId, parsed.categoryId),
        ownerIs(parsed.ownerMemberId),
      ),
    );
  if (!before) return;

  await db.delete(budgetItems).where(eq(budgetItems.id, before.id));

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "deleted",
    before,
    entityId: before.id,
    entityType: "budget_item",
    summary: budgetItemSummary(f, before, { month: parsed.month, year: parsed.year }),
  });

  revalidatePath("/budget");
  revalidatePath("/dashboard");
}

function previousMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

// Non-destructive: only fills in categories/owners that don't already have a
// budget_items row for the target month, so re-running this (or copying into
// a month you've already partly filled out) never clobbers anything.
export async function copyPreviousMonthBudgetAction(year: number, month: number) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const prev = previousMonth(year, month);

  const [prevBudget] = await db
    .select()
    .from(monthlyBudgets)
    .where(and(eq(monthlyBudgets.householdId, householdId), eq(monthlyBudgets.year, prev.year), eq(monthlyBudgets.month, prev.month)));
  if (!prevBudget) {
    revalidatePath("/budget");
    return;
  }

  const prevItems = await db.select().from(budgetItems).where(eq(budgetItems.monthlyBudgetId, prevBudget.id));
  if (prevItems.length === 0) {
    revalidatePath("/budget");
    return;
  }

  const budget = await getOrCreateMonthlyBudget(householdId, year, month);
  const existingItems = await db.select().from(budgetItems).where(eq(budgetItems.monthlyBudgetId, budget.id));
  const existingKeys = new Set(existingItems.map((i) => `${i.categoryId}::${i.ownerMemberId ?? "shared"}`));

  const toInsert = prevItems
    .filter((i) => !existingKeys.has(`${i.categoryId}::${i.ownerMemberId ?? "shared"}`))
    .map((i) => ({
      categoryId: i.categoryId,
      monthlyBudgetId: budget.id,
      ownerMemberId: i.ownerMemberId,
      plannedAmount: i.plannedAmount,
    }));

  if (toInsert.length > 0) {
    const inserted = await db.insert(budgetItems).values(toInsert).returning();
    const f = await loadActivityFormatters(householdId);
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
}

// Adds a budget line for each category and owner with recurring bills due this
// month. Lines that already exist are left alone, the same as copying last
// month. Returns how many lines it added.
export async function fillBudgetFromRecurringAction(year: number, month: number): Promise<number> {
  const member = await getCurrentMember();
  const { householdId } = member;
  const dateFormat = await getDateFormatPref(householdId);
  const period = resolvePeriod(year, month, dateFormat);

  const bills = await db.select().from(recurringExpenses).where(eq(recurringExpenses.householdId, householdId));
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

  const budget = await getOrCreateMonthlyBudget(householdId, year, month);
  const existingItems = await db.select().from(budgetItems).where(eq(budgetItems.monthlyBudgetId, budget.id));
  const existingKeys = new Set(existingItems.map((i) => `${i.categoryId}::${i.ownerMemberId ?? "shared"}`));
  const toInsert = lines
    .filter((line) => !existingKeys.has(`${line.categoryId}::${line.ownerMemberId ?? "shared"}`))
    .map((line) => ({
      categoryId: line.categoryId,
      monthlyBudgetId: budget.id,
      ownerMemberId: line.ownerMemberId,
      plannedAmount: String(line.plannedAmount),
    }));

  if (toInsert.length > 0) {
    const inserted = await db.insert(budgetItems).values(toInsert).returning();
    const f = await loadActivityFormatters(householdId);
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
