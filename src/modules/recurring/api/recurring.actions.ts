"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { expenses, recurringExpenses } from "@/db/schema";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { activityActor, loadActivityFormatters, logActivities, logActivity } from "@/modules/activity/api/activity";
import { listCategories } from "@/modules/categories/api/categories";
import { expenseSummary } from "@/modules/expenses/lib/expense-activity";
import { recurringChanges, recurringSummary } from "@/modules/recurring/lib/recurring-activity";
import { type RecurringExpenseInput, recurringExpenseSchema } from "@/modules/recurring/schemas/recurring.schema";

function revalidateRecurringPaths() {
  revalidatePath("/recurring");
  revalidatePath("/expenses");
  revalidatePath("/budget");
  revalidatePath("/dashboard");
}

async function assertMemberInHousehold(householdId: string, memberId: string) {
  const members = await getHouseholdMembers(householdId);
  if (!members.some((m) => m.id === memberId)) {
    throw new Error("Member does not belong to this household");
  }
}

async function assertCategoryInHousehold(householdId: string, categoryId: string) {
  const categories = await listCategories(householdId, { includeArchived: true });
  if (!categories.some((c) => c.id === categoryId)) {
    throw new Error("Category does not belong to this household");
  }
}

export async function listRecurringExpenses(householdId: string) {
  return db
    .select()
    .from(recurringExpenses)
    .where(eq(recurringExpenses.householdId, householdId))
    .orderBy(recurringExpenses.nextDueDate);
}

async function findRecurringInHousehold(householdId: string, id: string) {
  const [item] = await db
    .select()
    .from(recurringExpenses)
    .where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.householdId, householdId)));
  return item;
}

export async function createRecurringExpenseAction(input: RecurringExpenseInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = recurringExpenseSchema.parse(input);
  await assertCategoryInHousehold(householdId, parsed.categoryId);
  if (parsed.ownerMemberId) {
    await assertMemberInHousehold(householdId, parsed.ownerMemberId);
  }

  const [created] = await db.insert(recurringExpenses).values({
    amount: String(parsed.amount),
    categoryId: parsed.categoryId,
    endDate: parsed.endDate,
    frequency: parsed.frequency,
    householdId,
    icon: parsed.icon,
    name: parsed.name,
    nextDueDate: parsed.nextDueDate,
    ownerMemberId: parsed.ownerMemberId,
    vendor: parsed.vendor?.trim() || null,
  }).returning();

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "created",
    after: created,
    entityId: created.id,
    entityType: "recurring_expense",
    summary: recurringSummary(f, created),
  });

  revalidateRecurringPaths();
}

export async function updateRecurringExpenseAction(id: string, input: RecurringExpenseInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = recurringExpenseSchema.parse(input);
  await assertCategoryInHousehold(householdId, parsed.categoryId);
  if (parsed.ownerMemberId) {
    await assertMemberInHousehold(householdId, parsed.ownerMemberId);
  }

  const before = await findRecurringInHousehold(householdId, id);
  if (!before) return;

  const [updated] = await db
    .update(recurringExpenses)
    .set({
      amount: String(parsed.amount),
      categoryId: parsed.categoryId,
      endDate: parsed.endDate,
      frequency: parsed.frequency,
      icon: parsed.icon,
      name: parsed.name,
      nextDueDate: parsed.nextDueDate,
      ownerMemberId: parsed.ownerMemberId,
      vendor: parsed.vendor?.trim() || null,
    })
    .where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.householdId, householdId)))
    .returning();

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "updated",
    after: updated,
    before,
    changes: recurringChanges(f, before, parsed),
    entityId: id,
    entityType: "recurring_expense",
    summary: recurringSummary(f, parsed),
  });

  revalidateRecurringPaths();
}

export async function deleteRecurringExpenseAction(id: string) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const before = await findRecurringInHousehold(householdId, id);
  if (!before) return;

  const linked = await db
    .select({ id: expenses.id })
    .from(expenses)
    .where(and(eq(expenses.recurringExpenseId, id), eq(expenses.householdId, householdId)));

  await db
    .delete(recurringExpenses)
    .where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.householdId, householdId)));

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "deleted",
    before,
    entityId: id,
    entityType: "recurring_expense",
    related: { linkedExpenseIds: linked },
    summary: recurringSummary(f, before),
  });

  revalidateRecurringPaths();
}

async function setRecurringStatus(
  id: string,
  status: "active" | "completed" | "paused",
  action: "completed" | "paused" | "resumed",
) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const before = await findRecurringInHousehold(householdId, id);
  if (!before || before.status === status) return;

  const [updated] = await db
    .update(recurringExpenses)
    .set({ status })
    .where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.householdId, householdId)))
    .returning();

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action,
    after: updated,
    before,
    entityId: id,
    entityType: "recurring_expense",
    summary: recurringSummary(f, before),
  });

  revalidateRecurringPaths();
}

export async function pauseRecurringExpenseAction(id: string) {
  await setRecurringStatus(id, "paused", "paused");
}

export async function resumeRecurringExpenseAction(id: string) {
  await setRecurringStatus(id, "active", "resumed");
}

export async function completeRecurringExpenseAction(id: string) {
  await setRecurringStatus(id, "completed", "completed");
}

function advanceDueDate(dueDate: string, frequency: "monthly" | "yearly"): string {
  const next = new Date(`${dueDate}T00:00:00`);
  if (frequency === "monthly") {
    next.setMonth(next.getMonth() + 1);
  } else {
    next.setFullYear(next.getFullYear() + 1);
  }
  return next.toISOString().slice(0, 10);
}

// Marking a recurring item paid logs a real expense against it (so it shows
// up in Budget actuals and Dashboard totals like any other expense) and
// rolls its next due date forward by one cycle.
export async function markRecurringExpensePaidAction(id: string) {
  const member = await getCurrentMember();
  const { householdId, memberId } = member;

  const item = await findRecurringInHousehold(householdId, id);
  if (!item) {
    throw new Error("Recurring expense not found");
  }

  const nextDueDate = advanceDueDate(item.nextDueDate, item.frequency);
  // Once the next cycle would fall after the item's end date, there's no
  // further occurrence to track — mark it completed instead of leaving an
  // "active" item whose due date will never actually come due.
  const isLastOccurrence = item.endDate !== null && nextDueDate > item.endDate;

  const { bill, expense: createdExpense } = await db.transaction(async (tx) => {
    const [expense] = await tx
      .insert(expenses)
      .values({
        amount: item.amount,
        categoryId: item.categoryId,
        date: item.nextDueDate,
        householdId,
        note: item.name,
        ownerMemberId: item.ownerMemberId,
        paidByMemberId: item.ownerMemberId ?? memberId,
        recurringExpenseId: item.id,
      })
      .returning();

    const [bill] = await tx
      .update(recurringExpenses)
      .set({ nextDueDate, status: isLastOccurrence ? "completed" : item.status })
      .where(eq(recurringExpenses.id, id))
      .returning();

    return { bill, expense };
  });

  // Two entries: the bill being marked paid, and the real expense it created
  // (so the expense also shows up under the Expenses section filter).
  const f = await loadActivityFormatters(householdId);
  await logActivities(activityActor(member), [
    {
      action: "paid",
      after: bill,
      before: item,
      entityId: item.id,
      entityType: "recurring_expense",
      related: { createdExpense: [createdExpense] },
      summary: `${recurringSummary(f, item)} · for ${f.date(item.nextDueDate)}`,
    },
    {
      action: "created",
      after: createdExpense,
      entityId: createdExpense.id,
      entityType: "expense",
      summary: expenseSummary(f, createdExpense),
    },
  ]);

  revalidateRecurringPaths();
}
