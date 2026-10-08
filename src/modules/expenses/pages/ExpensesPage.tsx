import { getDateFormatPref } from "@/lib/date-format-cookie";
import { buildMonthNav, parseMonthParam } from "@/lib/month-nav";
import { currentPeriodYearMonth, formatPeriodLabel, MAX_NAVIGABLE_YEAR, MIN_NAVIGABLE_YEAR, resolvePeriod } from "@/lib/month-period";
import { getEffectiveMember, getHouseholdMembers } from "@/lib/session";
import { todayISO } from "@/lib/today";
import { getIncomesForMonth } from "@/modules/budget/api/budget.actions";
import { listCategories } from "@/modules/categories/api/categories";
import { daysLeftInMonth } from "@/modules/dashboard/lib/cash-flow";
import { listExpensesForMonth } from "@/modules/expenses/api/expenses.actions";
import { ExpensesView, type UpcomingBill } from "@/modules/expenses/components/ExpensesView";
import { topCategoryIds } from "@/modules/expenses/lib/expense-view";
import { roleForOwner } from "@/modules/expenses/lib/member-tone";
import { listRecurringExpenses } from "@/modules/recurring/api/recurring.actions";

type Props = { searchParams: Promise<{ month?: string; year?: string }> };

export async function ExpensesPage({ searchParams }: Props) {
  const { householdId, memberId } = await getEffectiveMember();
  const dateFormat = await getDateFormatPref(householdId);
  const params = await searchParams;
  const current = currentPeriodYearMonth(dateFormat);
  const year = parseMonthParam(params.year, current.year, MAX_NAVIGABLE_YEAR[dateFormat], MIN_NAVIGABLE_YEAR[dateFormat]);
  const month = parseMonthParam(params.month, current.month, 12);
  const isCurrentMonth = year === current.year && month === current.month;
  const period = resolvePeriod(year, month, dateFormat);

  const [members, categories, expenseRows, incomeRows, recurringItems] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    listExpensesForMonth(year, month, dateFormat),
    getIncomesForMonth(year, month),
    listRecurringExpenses(householdId),
  ]);

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? "Unknown";
  const expenses = expenseRows.map((e) => ({
    amount: Number(e.amount),
    categoryId: e.categoryId,
    date: e.date,
    id: e.id,
    note: e.note,
    ownerMemberId: e.ownerMemberId,
    paidByMemberId: e.paidByMemberId,
    recurringExpenseId: e.recurringExpenseId,
  }));

  // Bills still to pay this month: active, not yet paid in this period, and
  // due by its end (overdue ones included). Only the current month shows them.
  const paidBillIds = new Set(expenseRows.flatMap((e) => (e.recurringExpenseId ? [e.recurringExpenseId] : [])));
  const upcoming: UpcomingBill[] = isCurrentMonth
    ? recurringItems
        .filter((r) => r.status === "active" && !paidBillIds.has(r.id) && r.nextDueDate <= period.endDate)
        .map((r) => ({
          amount: Number(r.amount),
          categoryId: r.categoryId,
          frequency: r.frequency,
          id: r.id,
          name: r.name,
          nextDueDate: r.nextDueDate,
          ownerMemberId: r.ownerMemberId,
        }))
    : [];

  const exportRows = expenseRows.map((e) => ({
    amount: Number(e.amount),
    category: categoryName(e.categoryId),
    date: e.date,
    name: e.note ?? categoryName(e.categoryId),
    owner: e.ownerMemberId ? roleForOwner(e.ownerMemberId, memberId) : "shared",
  }));

  const monthLabel = formatPeriodLabel(year, month, dateFormat);

  return (
    <ExpensesView
      categories={categories.map((c) => ({ groupName: c.groupName, id: c.id, name: c.name }))}
      currentMemberId={memberId}
      dateFormat={dateFormat}
      daysLeft={isCurrentMonth ? daysLeftInMonth(year, month, dateFormat) : null}
      expenses={expenses}
      exportRows={exportRows}
      income={incomeRows.reduce((sum, i) => sum + Number(i.amount), 0)}
      members={members.map((m) => ({ id: m.id, name: m.user.name }))}
      monthLabel={monthLabel}
      monthNav={buildMonthNav({ basePath: "/expenses", current, dateFormat, selected: { month, year } })}
      quickCategoryIds={topCategoryIds(expenses, 5)}
      recurringFrequencies={Object.fromEntries(recurringItems.map((r) => [r.id, r.frequency]))}
      today={todayISO()}
      upcoming={upcoming}
    />
  );
}
