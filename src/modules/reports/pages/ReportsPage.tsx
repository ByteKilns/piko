import { getDateFormatPref } from "@/lib/date-format-cookie";
import { nextMonth, parseMonthParam, previousMonth } from "@/lib/month-nav";
import { currentPeriodYearMonth, formatPeriodLabel, MAX_NAVIGABLE_YEAR, MIN_NAVIGABLE_YEAR, resolvePeriod } from "@/lib/month-period";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { getBudgetItemsForMonth, getIncomesForMonth, listAllIncomes } from "@/modules/budget/api/budget.actions";
import { listCategories } from "@/modules/categories/api/categories";
import { dailyCashFlowPoints, dhukuCashFlow, loanPaymentCashFlow } from "@/modules/dashboard/lib/cash-flow";
import { pctOfIncome } from "@/modules/dashboard/lib/format";
import { listDhukuEntries } from "@/modules/dhuku/api/dhuku.actions";
import { listExpensesForMonth, listExpensesForRange } from "@/modules/expenses/api/expenses.actions";
import { ownerBreakdown } from "@/modules/expenses/lib/expense-breakdown";
import { roleForOwner } from "@/modules/expenses/lib/member-tone";
import { listLoanPayments, listLoans } from "@/modules/loans/api/loans.actions";
import { ReportsHeader } from "@/modules/reports/components/ReportsHeader";
import { ReportsTabs } from "@/modules/reports/components/ReportsTabs";
import {
  budgetVsActual,
  categoryBreakdown,
  categoryChanges,
  dailySpendingPace,
  monthlyIncomeExpenseTrend,
  spendingInsight,
  topExpenses,
} from "@/modules/reports/lib/reports-stats";
import { listSavingsContributions, listSavingsGoals } from "@/modules/savings-goals/api/savings-goals.actions";
import { buildContributionEntries, buildGoalCards, monthlyTotals, savingsOverviewStats } from "@/modules/savings-goals/lib/savings-stats";

type Props = { searchParams: Promise<{ month?: string; year?: string }> };

export async function ReportsPage({ searchParams }: Props) {
  const { householdId, memberId } = await getCurrentMember();
  const dateFormat = await getDateFormatPref(householdId);
  const params = await searchParams;
  const { year: currentYear, month: currentMonth } = currentPeriodYearMonth(dateFormat);
  const year = parseMonthParam(params.year, currentYear, MAX_NAVIGABLE_YEAR[dateFormat], MIN_NAVIGABLE_YEAR[dateFormat]);
  const month = parseMonthParam(params.month, currentMonth, 12);
  const prev = previousMonth(year, month);
  const next = nextMonth(year, month);

  let rangeStartYm = { month, year };
  for (let i = 0; i < 5; i++) rangeStartYm = previousMonth(rangeStartYm.year, rangeStartYm.month);
  const rangeStart = resolvePeriod(rangeStartYm.year, rangeStartYm.month, dateFormat).startDate;
  const rangeEnd = resolvePeriod(year, month, dateFormat).endDate;

  const [
    members,
    categories,
    incomeRows,
    allIncomeRows,
    budgetItemRows,
    expenseRows,
    prevExpenseRows,
    rangeExpenseRows,
    goalRows,
    contributionRows,
    dhukuEntryRows,
    loanRows,
    loanPaymentRows,
  ] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    getIncomesForMonth(year, month),
    listAllIncomes(),
    getBudgetItemsForMonth(year, month),
    listExpensesForMonth(year, month, dateFormat),
    listExpensesForMonth(prev.year, prev.month, dateFormat),
    listExpensesForRange(rangeStart, rangeEnd),
    listSavingsGoals(householdId),
    listSavingsContributions(householdId),
    listDhukuEntries(householdId),
    listLoans(householdId),
    listLoanPayments(householdId),
  ]);

  const memberById = new Map(members.map((m) => [m.id, m]));
  const category = (id: string) => categories.find((c) => c.id === id);
  const categoryName = (id: string) => category(id)?.name ?? "Unknown";

  const expenses = expenseRows.map((e) => ({
    amount: Number(e.amount),
    categoryId: e.categoryId,
    ownerMemberId: e.ownerMemberId,
  }));
  const combinedIncome = incomeRows.reduce((s, i) => s + Number(i.amount), 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const prevTotalExpenses = prevExpenseRows.reduce((s, e) => s + Number(e.amount), 0);

  const budgetLines = budgetVsActual(
    budgetItemRows.map((b) => ({ categoryId: b.categoryId, plannedAmount: Number(b.plannedAmount) })),
    expenses,
    categories,
  );
  const changes = categoryChanges(
    expenses,
    prevExpenseRows.map((e) => ({ amount: Number(e.amount), categoryId: e.categoryId })),
    categories,
  );
  const largestExpenses = topExpenses(
    expenseRows.map((e) => ({
      amount: Number(e.amount),
      categoryName: categoryName(e.categoryId),
      date: e.date,
      groupName: category(e.categoryId)?.groupName ?? "Other",
      id: e.id,
      note: e.note,
    })),
  );

  const ownerSlices = ownerBreakdown(
    expenses,
    members.map((m) => ({ id: m.id, name: m.user.name })),
    memberId,
  );
  const expenseSlices = categoryBreakdown(expenses, categories);

  const rangeExpenses = rangeExpenseRows.map((e) => ({ amount: Number(e.amount), date: e.date }));
  const allIncomes = allIncomeRows.map((i) => ({ amount: Number(i.amount), month: i.month, year: i.year }));
  const trendPoints = monthlyIncomeExpenseTrend(allIncomes, rangeExpenses, { month, year }, 6, dateFormat);

  const insightMessage = spendingInsight(totalExpenses, prevTotalExpenses);
  const totalPlanned = budgetItemRows.reduce((s, b) => s + Number(b.plannedAmount), 0);
  const pacePoints = dailySpendingPace(
    expenseRows.map((e) => ({ amount: Number(e.amount), date: e.date })),
    year,
    month,
    totalPlanned,
    dateFormat,
  );
  const cashFlowEvents = [...dhukuCashFlow(dhukuEntryRows), ...loanPaymentCashFlow(loanPaymentRows, loanRows)];
  const dailyPoints = dailyCashFlowPoints(expenseRows, incomeRows, cashFlowEvents, year, month, dateFormat);

  const incomeSlices = members.map((m) => ({
    amount: incomeRows.filter((i) => i.memberId === m.id).reduce((s, i) => s + Number(i.amount), 0),
    key: (m.id === memberId ? "me" : "partner") as "me" | "partner",
    label: m.id === memberId ? "Me" : m.user.name,
    tone: (m.id === memberId ? "green" : "orange") as "green" | "orange",
  }));

  const contributions = contributionRows.map((c) => ({ amount: Number(c.amount), date: c.date, goalId: c.goalId }));
  const { goals, statusCounts } = buildGoalCards(goalRows, contributions, memberById);
  const savingsStats = savingsOverviewStats(
    goalRows.map((g) => ({
      createdAt: g.createdAt,
      id: g.id,
      targetAmount: g.targetAmount === null ? null : Number(g.targetAmount),
      targetDate: g.targetDate,
    })),
    contributions,
    year,
    month,
  );
  const savingsVsLastMonthPct =
    savingsStats.lastMonthContribution > 0
      ? Math.round(
          ((savingsStats.monthlyContribution - savingsStats.lastMonthContribution) / savingsStats.lastMonthContribution) * 100,
        )
      : null;
  const savingsPoints = monthlyTotals(contributions, 6, dateFormat);
  const recentContributions = buildContributionEntries(contributionRows, goalRows, memberById, memberId);

  const monthLabel = formatPeriodLabel(year, month, dateFormat);
  const exportRows = expenseRows.map((e) => ({
    amount: Number(e.amount),
    category: categoryName(e.categoryId),
    date: e.date,
    name: e.note ?? categoryName(e.categoryId),
    owner: e.ownerMemberId ? roleForOwner(e.ownerMemberId, memberId) : "shared",
  }));

  return (
    <>
      <ReportsHeader
        exportRows={exportRows}
        monthLabel={monthLabel}
        nextHref={`/reports?year=${next.year}&month=${next.month}`}
        prevHref={`/reports?year=${prev.year}&month=${prev.month}`}
      />

      <ReportsTabs
        budgetHref={`/budget?year=${year}&month=${month}`}
        budgetLines={budgetLines}
        categoryChanges={changes}
        combinedIncome={combinedIncome}
        dailyPoints={dailyPoints}
        dateFormat={dateFormat}
        expenseSlices={expenseSlices}
        goals={goals}
        goalStatusCounts={statusCounts}
        incomeSlices={incomeSlices}
        insightMessage={insightMessage}
        largestExpenses={largestExpenses}
        monthLabel={monthLabel}
        ownerSlices={ownerSlices}
        pacePoints={pacePoints}
        pctOfIncome={pctOfIncome(totalExpenses, combinedIncome)}
        previousLabel={formatPeriodLabel(prev.year, prev.month, dateFormat)}
        realMemberId={memberId}
        recentContributions={recentContributions}
        savingsAverageProgress={savingsStats.averageProgress}
        savingsMonthlyContribution={savingsStats.monthlyContribution}
        savingsPoints={savingsPoints}
        savingsVsLastMonthPct={savingsVsLastMonthPct}
        totalExpenses={totalExpenses}
        totalPlanned={totalPlanned}
        trendPoints={trendPoints}
      />
    </>
  );
}
