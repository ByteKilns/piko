"use server";

import { and, desc, eq, gte, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { expenses } from "@/db/schema";
import type { DateFormat } from "@/lib/date-format-cookie";
import { resolvePeriod } from "@/lib/month-period";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { type ActivityActor, activityActor, loadActivityFormatters, logActivities, logActivity } from "@/modules/activity/api/activity";
import { listCategories } from "@/modules/categories/api/categories";
import { formatNPR } from "@/modules/dashboard/lib/format";
import { checkBudgetThreshold, insertNotification } from "@/modules/notifications/api/notifications.actions";

import { expenseChanges, expenseSummary } from "../lib/expense-activity";
import { type ExpenseInput, expenseSchema } from "../schemas/expense.schema";
import { ExpenseValidationError } from "./expense-errors";

async function assertMemberInHousehold(householdId: string, memberId: string) {
  const members = await getHouseholdMembers(householdId);
  if (!members.some((m) => m.id === memberId)) {
    throw new ExpenseValidationError("Member does not belong to this household");
  }
}

async function assertCategoryInHousehold(householdId: string, categoryId: string) {
  const categories = await listCategories(householdId);
  if (!categories.some((c) => c.id === categoryId)) {
    throw new ExpenseValidationError("Category does not belong to this household");
  }
}

async function findExpenseInHousehold(householdId: string, id: string) {
  const [row] = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.householdId, householdId)));
  return row;
}

export async function createExpenseForHousehold(input: ExpenseInput, actor: ActivityActor) {
  const { householdId, name: actorName } = actor;
  const parsed = expenseSchema.parse(input);
  const categories = await listCategories(householdId);
  if (!categories.some((c) => c.id === parsed.categoryId)) {
    throw new ExpenseValidationError("Category does not belong to this household");
  }
  await assertMemberInHousehold(householdId, parsed.paidByMemberId);
  if (parsed.ownerMemberId) {
    await assertMemberInHousehold(householdId, parsed.ownerMemberId);
  }

  const [created] = await db
    .insert(expenses)
    .values({
      householdId,
      amount: String(parsed.amount),
      categoryId: parsed.categoryId,
      ownerMemberId: parsed.ownerMemberId,
      paidByMemberId: parsed.paidByMemberId,
      date: parsed.date,
      note: parsed.note,
    })
    .returning();

  const categoryName = categories.find((c) => c.id === parsed.categoryId)?.name ?? "Unknown";

  if (parsed.ownerMemberId === null) {
    await insertNotification({
      body: `${actorName} added ${categoryName} · ${formatNPR(parsed.amount)} to shared expenses.`,
      category: "shared",
      dedupeKey: `expense:${created.id}`,
      householdId,
      severity: "info",
      title: "New shared expense added",
    });
  }
  await checkBudgetThreshold(householdId, parsed.categoryId, parsed.ownerMemberId, parsed.date);

  const f = await loadActivityFormatters(householdId);
  await logActivity(actor, {
    action: "created",
    after: created,
    entityId: created.id,
    entityType: "expense",
    summary: expenseSummary(f, created),
  });

  revalidatePath("/expenses");
  revalidatePath("/dashboard");

  return created;
}

export async function createExpenseAction(input: ExpenseInput) {
  await createExpenseForHousehold(input, activityActor(await getCurrentMember()));
}

// Inserts every row in one batch and fires at most one summary notification
// (only for the shared rows, matching createExpenseAction's own
// shared-only privacy rule) instead of one per row — a 20-row bulk entry
// shouldn't flood the household's notification feed.
export async function createExpensesBulkAction(inputs: ExpenseInput[]) {
  if (inputs.length === 0) return;

  const member = await getCurrentMember();
  const { householdId, name: actorName } = member;
  const parsedList = inputs.map((input) => expenseSchema.parse(input));

  const categories = await listCategories(householdId);
  const categoryIds = new Set(categories.map((c) => c.id));
  const members = await getHouseholdMembers(householdId);
  const memberIds = new Set(members.map((m) => m.id));

  for (const parsed of parsedList) {
    if (!categoryIds.has(parsed.categoryId)) throw new Error("Category does not belong to this household");
    if (!memberIds.has(parsed.paidByMemberId)) throw new Error("Member does not belong to this household");
    if (parsed.ownerMemberId && !memberIds.has(parsed.ownerMemberId)) {
      throw new Error("Member does not belong to this household");
    }
  }

  const created = await db
    .insert(expenses)
    .values(
      parsedList.map((parsed) => ({
        amount: String(parsed.amount),
        categoryId: parsed.categoryId,
        date: parsed.date,
        householdId,
        note: parsed.note,
        ownerMemberId: parsed.ownerMemberId,
        paidByMemberId: parsed.paidByMemberId,
      })),
    )
    .returning();

  const sharedRows = parsedList.filter((p) => p.ownerMemberId === null);
  if (sharedRows.length > 0) {
    const sharedTotal = sharedRows.reduce((s, p) => s + p.amount, 0);
    await insertNotification({
      body: `${actorName} added ${sharedRows.length} shared expense${sharedRows.length === 1 ? "" : "s"} totaling ${formatNPR(sharedTotal)}.`,
      category: "shared",
      dedupeKey: `expenses-bulk:${created[0].id}`,
      householdId,
      severity: "info",
      title: "New shared expenses added",
    });
  }

  // One threshold check per distinct category+owner+month combo touched by
  // this batch, rather than one per row — checkBudgetThreshold recomputes
  // the whole month's spend anyway, so repeating it per row would just be
  // redundant work for the same dedupeKey.
  const seenBudgetKeys = new Set<string>();
  for (const parsed of parsedList) {
    const key = `${parsed.categoryId}:${parsed.ownerMemberId ?? "shared"}:${parsed.date.slice(0, 7)}`;
    if (seenBudgetKeys.has(key)) continue;
    seenBudgetKeys.add(key);
    await checkBudgetThreshold(householdId, parsed.categoryId, parsed.ownerMemberId, parsed.date);
  }

  const f = await loadActivityFormatters(householdId);
  await logActivities(
    activityActor(member),
    created.map((row) => ({
      action: "created" as const,
      after: row,
      entityId: row.id,
      entityType: "expense" as const,
      summary: expenseSummary(f, row),
    })),
  );

  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}

export async function updateExpenseAction(id: string, input: ExpenseInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = expenseSchema.parse(input);
  await assertCategoryInHousehold(householdId, parsed.categoryId);
  await assertMemberInHousehold(householdId, parsed.paidByMemberId);
  if (parsed.ownerMemberId) {
    await assertMemberInHousehold(householdId, parsed.ownerMemberId);
  }

  const before = await findExpenseInHousehold(householdId, id);
  if (!before) return;

  const [updated] = await db
    .update(expenses)
    .set({
      amount: String(parsed.amount),
      categoryId: parsed.categoryId,
      ownerMemberId: parsed.ownerMemberId,
      paidByMemberId: parsed.paidByMemberId,
      date: parsed.date,
      note: parsed.note ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(expenses.id, id), eq(expenses.householdId, householdId)))
    .returning();

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "updated",
    after: updated,
    before,
    changes: expenseChanges(f, before, parsed),
    entityId: id,
    entityType: "expense",
    summary: expenseSummary(f, parsed),
  });

  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}

export async function deleteExpenseAction(id: string) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const before = await findExpenseInHousehold(householdId, id);
  if (!before) return;

  await db
    .delete(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.householdId, householdId)));

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "deleted",
    before,
    entityId: id,
    entityType: "expense",
    summary: expenseSummary(f, before),
  });

  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}

export async function listExpensesForMonth(year: number, month: number, dateFormat: DateFormat) {
  const { householdId } = await getCurrentMember();
  const period = resolvePeriod(year, month, dateFormat);

  return db
    .select()
    .from(expenses)
    .where(
      and(eq(expenses.householdId, householdId), gte(expenses.date, period.startDate), lte(expenses.date, period.endDate)),
    )
    .orderBy(desc(expenses.date), desc(expenses.createdAt));
}

export async function listExpensesForRange(startDate: string, endDate: string) {
  const { householdId } = await getCurrentMember();
  return db
    .select()
    .from(expenses)
    .where(and(eq(expenses.householdId, householdId), gte(expenses.date, startDate), lte(expenses.date, endDate)))
    .orderBy(desc(expenses.date), desc(expenses.createdAt));
}

export async function listRecentExpensesForHousehold(householdId: string, limit: number) {
  return db
    .select()
    .from(expenses)
    .where(eq(expenses.householdId, householdId))
    .orderBy(desc(expenses.date), desc(expenses.createdAt))
    .limit(limit);
}

export async function listRecentExpenses(limit: number) {
  const { householdId } = await getCurrentMember();
  return listRecentExpensesForHousehold(householdId, limit);
}
