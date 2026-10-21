import { and, desc, eq, gte, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { expenses, savingsItems, savingsPots } from "@/db/schema";
import { type DateFormat, getDateFormatPref } from "@/lib/date-format-cookie";
import { currentPeriodYearMonth } from "@/lib/month-period";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { type ActivityActor, loadActivityFormatters, logActivity } from "@/modules/activity/api/activity";
import { listCategories } from "@/modules/categories/api/categories";
import { formatNPR } from "@/modules/dashboard/lib/format";
import { listFundData } from "@/modules/funds/api/funds";
import { fundBalances, fundShare } from "@/modules/funds/lib/fund-math";
import { checkBudgetThreshold, insertNotification } from "@/modules/notifications/api/notifications";

import { expenseSummary } from "../lib/expense-activity";
import { type ExpenseInput, expenseSchema } from "../schemas/expense.schema";
import { ExpenseValidationError } from "./expense-errors";
import { listHouseholdExpensesForMonth } from "./expenses-by-month";

export async function assertMemberInHousehold(householdId: string, memberId: string) {
  const members = await getHouseholdMembers(householdId);
  if (!members.some((m) => m.id === memberId)) {
    throw new ExpenseValidationError("Member does not belong to this household");
  }
}

export async function assertCategoryInHousehold(householdId: string, categoryId: string) {
  const categories = await listCategories(householdId);
  if (!categories.some((c) => c.id === categoryId)) {
    throw new ExpenseValidationError("Category does not belong to this household");
  }
}

// "Pay back later" moves part of an expense onto the other member, so it
// only makes sense in a two-person household.
export async function assertCanPayBack(householdId: string, payBackAmount: null | number | undefined) {
  if (payBackAmount == null) return;
  const members = await getHouseholdMembers(householdId);
  if (members.length !== 2) {
    throw new ExpenseValidationError("Pay back later needs exactly two people in the household");
  }
}

// A pot must be this household's, and a list item must be on that pot.
export async function assertSavingsLink(householdId: string, savingsPotId: null | string, savingsItemId: null | string) {
  if (savingsPotId === null) return;
  const [pot] = await db
    .select({ id: savingsPots.id })
    .from(savingsPots)
    .where(and(eq(savingsPots.id, savingsPotId), eq(savingsPots.householdId, householdId)));
  if (!pot) throw new ExpenseValidationError("Savings pot does not belong to this household");
  if (savingsItemId === null) return;
  const [item] = await db
    .select({ id: savingsItems.id })
    .from(savingsItems)
    .where(and(eq(savingsItems.id, savingsItemId), eq(savingsItems.potId, savingsPotId)));
  if (!item) throw new ExpenseValidationError("That list item isn't in this savings pot");
}

// What a fund pays towards an expense: up to its balance today (leaving out
// this expense's own earlier share when it's being edited). The rest counts as
// the month's normal spending. A fund only pays for its owner's expenses.
export async function fundPayment(
  householdId: string,
  fundId: null | string,
  paidByMemberId: string,
  amount: number,
  editingId?: string,
): Promise<{ fundAmount: null | string; fundId: null | string }> {
  if (fundId === null) return { fundAmount: null, fundId: null };
  const data = await listFundData(householdId);
  const fund = data.funds.find((f) => f.id === fundId);
  if (!fund || fund.archived) throw new ExpenseValidationError("That fund isn't available");
  if (fund.ownerMemberId !== paidByMemberId) throw new ExpenseValidationError("A fund can only pay for its owner's expenses");

  const now = currentPeriodYearMonth(await getDateFormatPref(householdId));
  const balance =
    fundBalances({ ...data, funds: [fund], spends: data.spends.filter((s) => s.expenseId !== editingId), through: now }).get(fund.id) ?? 0;
  const share = fundShare(amount, balance);
  if (share <= 0) throw new ExpenseValidationError("That fund is empty");
  return { fundAmount: String(share), fundId };
}

export async function findExpenseInHousehold(householdId: string, id: string) {
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
  await assertCanPayBack(householdId, parsed.payBackAmount);
  const savingsPotId = parsed.savingsPotId ?? null;
  const savingsItemId = savingsPotId === null ? null : (parsed.savingsItemId ?? null);
  await assertSavingsLink(householdId, savingsPotId, savingsItemId);
  const fund = await fundPayment(householdId, parsed.fundId ?? null, parsed.paidByMemberId, parsed.amount);

  const [created] = await db
    .insert(expenses)
    .values({
      householdId,
      amount: String(parsed.amount),
      fundAmount: fund.fundAmount,
      fundId: fund.fundId,
      categoryId: parsed.categoryId,
      ownerMemberId: parsed.ownerMemberId,
      paidByMemberId: parsed.paidByMemberId,
      date: parsed.date,
      note: parsed.note,
      payBackAmount: parsed.payBackAmount == null ? null : String(parsed.payBackAmount),
      savingsItemId,
      savingsPotId,
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
  await checkBudgetThreshold(householdId, parsed.categoryId, parsed.paidByMemberId, parsed.date);

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

export async function listExpensesForMonth(year: number, month: number, dateFormat: DateFormat) {
  const { householdId } = await getCurrentMember();
  return listHouseholdExpensesForMonth(householdId, year, month, dateFormat);
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
