import { getDateFormatPref } from "@/lib/date-format-cookie";
import { nextMonth, parseMonthParam, previousMonth } from "@/lib/month-nav";
import { currentPeriodYearMonth, formatPeriodLabel, MAX_NAVIGABLE_YEAR, MIN_NAVIGABLE_YEAR } from "@/lib/month-period";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { getBudgetItemsForMonth, getIncomesForMonth } from "@/modules/budget/api/budget.actions";
import { AllocationSummaryCard } from "@/modules/budget/components/AllocationSummaryCard";
import { BudgetGroups } from "@/modules/budget/components/BudgetGroups";
import { BudgetHeader } from "@/modules/budget/components/BudgetHeader";
import { BudgetHealthCard } from "@/modules/budget/components/BudgetHealthCard";
import { BudgetSummaryCards } from "@/modules/budget/components/BudgetSummaryCards";
import { TopBudgetCategoriesCard } from "@/modules/budget/components/TopBudgetCategoriesCard";
import { budgetGroups, topBudgetCategories } from "@/modules/budget/lib/budget-groups";
import { budgetVsActual } from "@/modules/budget/lib/calculations";
import { listCategories } from "@/modules/categories/api/categories";
import { listExpensesForMonth } from "@/modules/expenses/api/expenses.actions";
import { checkBudgetReminder } from "@/modules/notifications/api/notifications.actions";

type Props = { searchParams: Promise<{ month?: string; year?: string }> };

export async function BudgetPage({ searchParams }: Props) {
  const { householdId, memberId } = await getCurrentMember();
  const dateFormat = await getDateFormatPref(householdId);
  const params = await searchParams;
  const { year: currentYear, month: currentMonth } = currentPeriodYearMonth(dateFormat);
  const year = parseMonthParam(params.year, currentYear, MAX_NAVIGABLE_YEAR[dateFormat], MIN_NAVIGABLE_YEAR[dateFormat]);
  const month = parseMonthParam(params.month, currentMonth, 12);
  const prev = previousMonth(year, month);
  const next = nextMonth(year, month);

  const [members, categories, incomes, budgetItems, expenseRows, prevBudgetItems] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    getIncomesForMonth(year, month),
    getBudgetItemsForMonth(year, month),
    listExpensesForMonth(year, month, dateFormat),
    getBudgetItemsForMonth(prev.year, prev.month),
  ]);

  if (year === currentYear && month === currentMonth) {
    await checkBudgetReminder(householdId, year, month, budgetItems.length);
  }

  const memberList = members.map((m) => ({ id: m.id, name: m.user.name }));
  const combinedIncome = incomes.reduce((s, i) => s + Number(i.amount), 0);

  const vsActual = budgetVsActual(
    budgetItems.map((b) => ({
      categoryId: b.categoryId,
      ownerMemberId: b.ownerMemberId,
      plannedAmount: Number(b.plannedAmount),
    })),
    expenseRows.map((e) => ({
      amount: Number(e.amount),
      categoryId: e.categoryId,
      ownerMemberId: e.ownerMemberId,
    })),
  );

  const groups = budgetGroups(vsActual, categories, memberList, memberId);
  const topCategories = topBudgetCategories(groups, 5);

  const totalBudget = groups.reduce((s, g) => s + g.totalPlanned, 0);
  const allocated = totalBudget;
  const unallocated = combinedIncome - allocated;

  const incomesByMember = Object.fromEntries(incomes.map((i) => [i.memberId, Number(i.amount)]));
  const itemsByCategory: Record<string, Record<string, number>> = {};
  for (const b of budgetItems) {
    const ownerKey = b.ownerMemberId ?? "shared";
    itemsByCategory[b.categoryId] ??= {};
    itemsByCategory[b.categoryId][ownerKey] = Number(b.plannedAmount);
  }

  const monthLabel = formatPeriodLabel(year, month, dateFormat);

  return (
    <>
      <BudgetHeader
        canCopyPreviousMonth={prevBudgetItems.length > 0}
        month={month}
        monthLabel={monthLabel}
        nextHref={`/budget?year=${next.year}&month=${next.month}`}
        prevHref={`/budget?year=${prev.year}&month=${prev.month}`}
        year={year}
      />

      <BudgetSummaryCards
        allocated={allocated}
        combinedIncome={combinedIncome}
        totalBudget={totalBudget}
        unallocated={unallocated}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <BudgetGroups
            categories={categories}
            groups={groups}
            incomesByMember={incomesByMember}
            itemsByCategory={itemsByCategory}
            members={memberList}
            month={month}
            realMemberId={memberId}
            year={year}
          />
        </div>

        <div className="space-y-6">
          <BudgetHealthCard allocated={allocated} combinedIncome={combinedIncome} unallocated={unallocated} />
          <AllocationSummaryCard groups={groups} />
          <TopBudgetCategoriesCard categories={topCategories} />
        </div>
      </div>
    </>
  );
}
