import { getDateFormatPref } from "@/lib/date-format-cookie";
import { nextMonth, parseMonthParam, previousMonth } from "@/lib/month-nav";
import {
  currentPeriodYearMonth,
  dayNumberInPeriod,
  daysElapsedInPeriod,
  formatPeriodLabel,
  MAX_NAVIGABLE_YEAR,
  MIN_NAVIGABLE_YEAR,
  resolvePeriod,
} from "@/lib/month-period";
import { getEffectiveMember, getHouseholdMembers } from "@/lib/session";
import { buildPacingSchedule, currentWeekPacing } from "@/modules/budget-planner/lib/pacing";
import {
  getBudgetItemsForMonth,
  getIncomesForMonth,
} from "@/modules/budget/api/budget.actions";
import { dashboardSummary } from "@/modules/budget/lib/calculations";
import { listCategories } from "@/modules/categories/api/categories";
import { DashboardHeader } from "@/modules/dashboard/components/DashboardHeader";
import { DashboardPanel } from "@/modules/dashboard/components/DashboardPanel";
import { DashboardSavingsCard } from "@/modules/dashboard/components/DashboardSavingsCard";
import { OwnerComparison } from "@/modules/dashboard/components/OwnerComparison";
import { RecentExpenses } from "@/modules/dashboard/components/RecentExpenses";
import { SummaryCards } from "@/modules/dashboard/components/SummaryCards";
import { daysLeftInMonth, dhukuCashFlow, loanNetFlowByOwner, loanPaymentCashFlow, netMonthlyOutflow, safeToSpendToday } from "@/modules/dashboard/lib/cash-flow";
import { toBudgetItemInputs, toExpenseInputs, toIncomeInputs } from "@/modules/dashboard/lib/map-rows";
import { classifyOwnerLabel } from "@/modules/dashboard/lib/owner-label";
import { listDhukuEntries } from "@/modules/dhuku/api/dhuku.actions";
import { listExpensesForMonth, listRecentExpenses } from "@/modules/expenses/api/expenses.actions";
import { listLoanPayments, listLoans } from "@/modules/loans/api/loans.actions";
import {
  checkBudgetReminder,
  countUnreadNotifications,
  listRecentNotifications,
} from "@/modules/notifications/api/notifications.actions";
import { SafeToSpendCard } from "@/modules/reports/components/SafeToSpendCard";
import { listSavingsContributions, listSavingsGoals } from "@/modules/savings-goals/api/savings-goals.actions";
import { savingsOverviewStats } from "@/modules/savings-goals/lib/savings-stats";

function trendPct(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

type Props = { searchParams: Promise<{ month?: string; year?: string }> };

export async function DashboardPage({ searchParams }: Props) {
  const { householdId, memberId } = await getEffectiveMember();
  const dateFormat = await getDateFormatPref(householdId);
  const params = await searchParams;
  const { year: currentYear, month: currentMonth } = currentPeriodYearMonth(dateFormat);
  const year = parseMonthParam(params.year, currentYear, MAX_NAVIGABLE_YEAR[dateFormat], MIN_NAVIGABLE_YEAR[dateFormat]);
  const month = parseMonthParam(params.month, currentMonth, 12);
  const prev = previousMonth(year, month);
  const next = nextMonth(year, month);

  const [
    members,
    categories,
    incomeRows,
    budgetItemRows,
    expenseRows,
    prevIncomeRows,
    prevExpenseRows,
    recentExpenseRows,
    goalRows,
    contributionRows,
    unreadNotifications,
    recentNotifications,
    dhukuEntryRows,
    loanRows,
    loanPaymentRows,
  ] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    getIncomesForMonth(year, month),
    getBudgetItemsForMonth(year, month),
    listExpensesForMonth(year, month, dateFormat),
    getIncomesForMonth(prev.year, prev.month),
    listExpensesForMonth(prev.year, prev.month, dateFormat),
    listRecentExpenses(5),
    listSavingsGoals(householdId),
    listSavingsContributions(householdId),
    countUnreadNotifications(householdId),
    listRecentNotifications(householdId, 5),
    listDhukuEntries(householdId),
    listLoans(householdId),
    listLoanPayments(householdId),
  ]);

  if (year === currentYear && month === currentMonth) {
    await checkBudgetReminder(householdId, year, month, budgetItemRows.length);
  }

  const incomes = toIncomeInputs(incomeRows);
  const expenses = toExpenseInputs(expenseRows);
  const budgetItems = toBudgetItemInputs(budgetItemRows);

  const summary = dashboardSummary(incomes, expenses);

  // Previous-month budget-vs-actual is deliberately NOT computed here — only
  // dashboardSummary (for the trend lines above). Nothing on this page shows
  // a previous-month budget-vs-actual breakdown, so there's no need to fetch
  // budget items for the previous month at all.
  const prevIncomes = toIncomeInputs(prevIncomeRows);
  const prevExpensesList = toExpenseInputs(prevExpenseRows);
  const prevSummary = dashboardSummary(prevIncomes, prevExpensesList);

  // Loan payments live in their own table, separate from `expenses`, so
  // dashboardSummary never sees them. Fold their net cash flow into the
  // Total Expenses / Unallocated figures (and the per-owner Overview cards
  // below) the same way it's already folded into Safe to Spend's
  // totalActual via netMonthlyOutflow, so a recorded loan payment actually
  // reduces what's shown as available.
  const loanFlowByOwner = loanNetFlowByOwner(loanPaymentRows, loanRows, year, month, dateFormat);
  const prevLoanFlowByOwner = loanNetFlowByOwner(loanPaymentRows, loanRows, prev.year, prev.month, dateFormat);
  const loanNetTotal = [...loanFlowByOwner.values()].reduce((s, v) => s + v, 0);
  const prevLoanNetTotal = [...prevLoanFlowByOwner.values()].reduce((s, v) => s + v, 0);
  const totalExpensesWithLoans = summary.totalExpenses + loanNetTotal;
  const prevTotalExpensesWithLoans = prevSummary.totalExpenses + prevLoanNetTotal;
  const unallocatedWithLoans = summary.combinedIncome - totalExpensesWithLoans;

  const category = (id: string) => categories.find((c) => c.id === id);
  const categoryName = (id: string) => category(id)?.name ?? "Unknown";

  const ownerLabel = (id: string | null) => classifyOwnerLabel(id, memberId, members);

  const partner = members.find((m) => m.id !== memberId);
  const ownerViews = [
    {
      key: "me",
      label: "Me",
      income: incomes.find((i) => i.memberId === memberId)?.amount ?? 0,
      prevIncome: prevIncomes.find((i) => i.memberId === memberId)?.amount ?? 0,
      expenses: expenses
        .filter((e) => e.ownerMemberId === memberId)
        .reduce((s, e) => s + e.amount, 0) + (loanFlowByOwner.get(memberId) ?? 0),
      prevExpenses: prevExpensesList
        .filter((e) => e.ownerMemberId === memberId)
        .reduce((s, e) => s + e.amount, 0) + (prevLoanFlowByOwner.get(memberId) ?? 0),
      remaining: 0,
    },
    ...(partner
      ? [
          {
            key: "partner",
            label: partner.user.name,
            income: incomes.find((i) => i.memberId === partner.id)?.amount ?? 0,
            prevIncome: prevIncomes.find((i) => i.memberId === partner.id)?.amount ?? 0,
            expenses: expenses
              .filter((e) => e.ownerMemberId === partner.id)
              .reduce((s, e) => s + e.amount, 0) + (loanFlowByOwner.get(partner.id) ?? 0),
            prevExpenses: prevExpensesList
              .filter((e) => e.ownerMemberId === partner.id)
              .reduce((s, e) => s + e.amount, 0) + (prevLoanFlowByOwner.get(partner.id) ?? 0),
            remaining: 0,
          },
        ]
      : []),
    {
      key: "shared",
      label: "Shared",
      income: 0,
      prevIncome: 0,
      expenses: expenses.filter((e) => e.ownerMemberId === null).reduce((s, e) => s + e.amount, 0) + (loanFlowByOwner.get(null) ?? 0),
      prevExpenses: prevExpensesList.filter((e) => e.ownerMemberId === null).reduce((s, e) => s + e.amount, 0) + (prevLoanFlowByOwner.get(null) ?? 0),
      remaining: 0,
    },
  ].map((v) => ({
    ...v,
    remaining: v.income - v.expenses,
    incomeTrendPct: trendPct(v.income, v.prevIncome),
    expenseTrendPct: trendPct(v.expenses, v.prevExpenses),
  }));

  const monthLabel = formatPeriodLabel(year, month, dateFormat);
  const currentMemberName = members.find((m) => m.id === memberId)?.user.name ?? "there";

  const cashFlowEvents = [...dhukuCashFlow(dhukuEntryRows), ...loanPaymentCashFlow(loanPaymentRows, loanRows)];
  const netOutflow = netMonthlyOutflow(cashFlowEvents, year, month, dateFormat);

  const totalPlanned = budgetItems.reduce((s, b) => s + b.plannedAmount, 0);
  const safeToSpend = safeToSpendToday(totalPlanned, summary.totalExpenses + netOutflow, year, month, dateFormat);
  const daysLeft = daysLeftInMonth(year, month, dateFormat);

  // Weekly pacing over the flexible part of the budget (fixed commitments are
  // already spoken for). Surfaced on SafeToSpendCard as "this week".
  const period = resolvePeriod(year, month, dateFormat);
  const flexiblePlanned = budgetItemRows
    .filter((b) => category(b.categoryId)?.budgetType === "flexible")
    .reduce((s, b) => s + Number(b.plannedAmount), 0);
  const pacingSchedule =
    flexiblePlanned > 0 ? buildPacingSchedule({ daysInPeriod: period.daysInPeriod, flexibleTotal: flexiblePlanned }) : null;
  const dayOfPeriod =
    year === currentYear && month === currentMonth ? daysElapsedInPeriod(period) : period.daysInPeriod;
  const spentByDay = new Array<number>(period.daysInPeriod).fill(0);
  for (const expense of expenseRows) {
    const day = dayNumberInPeriod(expense.date, year, month, dateFormat);
    if (day !== null) spentByDay[day - 1] += Number(expense.amount);
  }
  const weekPacing = pacingSchedule ? currentWeekPacing(pacingSchedule, dayOfPeriod, spentByDay) : null;

  const savingsStats = savingsOverviewStats(
    goalRows.map((g) => ({
      createdAt: g.createdAt,
      id: g.id,
      targetAmount: g.targetAmount === null ? null : Number(g.targetAmount),
      targetDate: g.targetDate,
    })),
    contributionRows.map((c) => ({ amount: Number(c.amount), date: c.date, goalId: c.goalId })),
    year,
    month,
  );

  return (
    <>
      <DashboardHeader
        dateFormat={dateFormat}
        monthLabel={monthLabel}
        name={currentMemberName}
        nextHref={`/dashboard?year=${next.year}&month=${next.month}`}
        notifications={recentNotifications}
        prevHref={`/dashboard?year=${prev.year}&month=${prev.month}`}
        unreadNotifications={unreadNotifications}
      />

      <SafeToSpendCard
        daysLeft={daysLeft}
        monthLabel={monthLabel}
        pacing={pacingSchedule && weekPacing ? { schedule: pacingSchedule, week: weekPacing } : null}
        safeToSpend={safeToSpend}
        totalActual={summary.totalExpenses + netOutflow}
        totalPlanned={totalPlanned}
      />

      <SummaryCards
        combinedIncome={summary.combinedIncome}
        expenseTrendPct={trendPct(
          totalExpensesWithLoans,
          prevTotalExpensesWithLoans,
        )}
        incomeTrendPct={trendPct(
          summary.combinedIncome,
          prevSummary.combinedIncome,
        )}
        monthlySavings={savingsStats.monthlyContribution}
        totalExpenses={totalExpensesWithLoans}
        unallocated={unallocatedWithLoans}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DashboardPanel className="min-h-full" title="Overview">
            <OwnerComparison views={ownerViews} />
          </DashboardPanel>
        </div>

        <div className="space-y-6">
          <RecentExpenses
            dateFormat={dateFormat}
            rows={recentExpenseRows.map((e) => ({
              id: e.id,
              categoryName: categoryName(e.categoryId),
              categoryGroupName: category(e.categoryId)?.groupName ?? "",
              ownerLabel: ownerLabel(e.ownerMemberId),
              amount: Number(e.amount),
              date: e.date,
            }))}
          />

          <DashboardSavingsCard
            averageProgress={savingsStats.averageProgress}
            monthlyContribution={savingsStats.monthlyContribution}
            totalGoals={savingsStats.totalGoals}
          />
        </div>
      </div>
    </>
  );
}
