"use server";

import { and, eq, isNull, ne, not, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { budgetItems, incomes, monthlyBudgets } from "@/db/schema";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { listCategories } from "@/modules/categories/api/categories";

import { type SetBudgetItemInput, setBudgetItemSchema } from "../schemas/budget-item.schema";
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

export async function getBudgetItemsForMonth(year: number, month: number) {
  const { householdId } = await getCurrentMember();
  const budget = await getOrCreateMonthlyBudget(householdId, year, month);
  return db.select().from(budgetItems).where(eq(budgetItems.monthlyBudgetId, budget.id));
}

export async function setBudgetItemAction(input: SetBudgetItemInput) {
  const { householdId } = await getCurrentMember();
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

  // The UI shows exactly one row per category (with an owner dropdown), which
  // implies "each category has at most one current owner/allocation per
  // month." Enforce that invariant here: before writing the row for the
  // owner being saved, remove any other row for this category/month whose
  // owner differs — otherwise switching a category's owner (e.g. Shared ->
  // a specific member) would leave the old row behind as an orphaned,
  // hidden duplicate that `budgetItems.find()` on the page may or may not
  // surface. Wrapped in the same transaction as the upsert so the
  // delete+write is atomic.
  await db.transaction(async (tx) => {
    await tx
      .delete(budgetItems)
      .where(
        and(
          eq(budgetItems.monthlyBudgetId, budget.id),
          eq(budgetItems.categoryId, parsed.categoryId),
          parsed.ownerMemberId === null
            ? not(isNull(budgetItems.ownerMemberId))
            : or(isNull(budgetItems.ownerMemberId), ne(budgetItems.ownerMemberId, parsed.ownerMemberId)),
        ),
      );

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
        await tx
          .update(budgetItems)
          .set({ plannedAmount: String(parsed.plannedAmount) })
          .where(eq(budgetItems.id, existing.id));
      } else {
        await tx.insert(budgetItems).values({
          monthlyBudgetId: budget.id,
          categoryId: parsed.categoryId,
          ownerMemberId: null,
          plannedAmount: String(parsed.plannedAmount),
        });
      }
    } else {
      // For a non-null owner, the composite unique constraint does detect
      // conflicts correctly, so the atomic upsert is safe here.
      await tx
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
        });
    }
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
  const { householdId } = await getCurrentMember();
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
    await db.insert(budgetItems).values(toInsert);
  }

  revalidatePath("/budget");
  revalidatePath("/dashboard");
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
  const { householdId } = await getCurrentMember();
  const parsed = setIncomeSchema.parse(input);

  const members = await getHouseholdMembers(householdId);
  if (!members.some((m) => m.id === parsed.memberId)) {
    throw new Error("Member does not belong to this household");
  }

  await db
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
    });

  revalidatePath("/budget");
  revalidatePath("/dashboard");
}
