import { formatShortDate } from "@/lib/date-format";
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { buildMonthNav, parseMonthParam, previousMonth } from "@/lib/month-nav";
import {
  currentPeriodYearMonth,
  daysElapsedInPeriod,
  formatPeriodLabel,
  MAX_NAVIGABLE_YEAR,
  MIN_NAVIGABLE_YEAR,
  resolvePeriod,
} from "@/lib/month-period";
import { getEffectiveMember, getHouseholdMembers } from "@/lib/session";
import { todayISO } from "@/lib/today";
import { getBudgetItemsForMonth, getIncomesForMonth } from "@/modules/budget/api/budget.actions";
import { dashboardSummary } from "@/modules/budget/lib/calculations";
import { listCategories } from "@/modules/categories/api/categories";
import { type HomeGoal, type HomeOwnerRow, type HomePacing, type HomeRecentGroup, HomeView } from "@/modules/dashboard/components/HomeView";
import { allowanceSpentByDay, daysLeftInMonth } from "@/modules/dashboard/lib/cash-flow";
import { toExpenseInputs, toIncomeInputs } from "@/modules/dashboard/lib/map-rows";
import { buildPacingSchedule, currentWeekPacing } from "@/modules/dashboard/lib/pacing";
import { walletSpentByMember } from "@/modules/dashboard/lib/wallet";
import { listExpensesForMonth, listRecentExpenses } from "@/modules/expenses/api/expenses.actions";
import { groupByDay } from "@/modules/expenses/lib/expense-view";
import { checkBudgetReminder } from "@/modules/notifications/api/notifications.actions";
import { listPayBackExpenses, listPaybacks } from "@/modules/paybacks/api/paybacks.actions";
import { paybackBalance } from "@/modules/paybacks/lib/payback-balance";
import { listSavingsContributions, listSavingsGoals } from "@/modules/savings-goals/api/savings-goals.actions";
import { savedAmountForGoal, savingsOverviewStats } from "@/modules/savings-goals/lib/savings-stats";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const GOALS_SHOWN = 3;
const PAYBACKS_SHOWN = 3;

function trendPct(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function percent(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

function weekdayOf(startDate: string, dayOfPeriod: number): string {
  const [year, month, day] = startDate.split("-").map(Number);
  return WEEKDAYS[new Date(year, month - 1, day + dayOfPeriod - 1).getDay()];
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
  const isCurrentMonth = year === currentYear && month === currentMonth;

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
    paybackRows,
    payBackExpenseRows,
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
    listPaybacks(householdId),
    listPayBackExpenses(householdId),
  ]);

  if (isCurrentMonth) {
    await checkBudgetReminder(householdId, year, month, budgetItemRows.length);
  }

  const incomes = toIncomeInputs(incomeRows);
  const expenses = toExpenseInputs(expenseRows);
  const summary = dashboardSummary(incomes, expenses);

  const prevIncomes = toIncomeInputs(prevIncomeRows);
  const prevExpensesList = toExpenseInputs(prevExpenseRows);
  const prevSummary = dashboardSummary(prevIncomes, prevExpensesList);

  const category = (id: string) => categories.find((c) => c.id === id);
  const memberName = (id: string) => members.find((m) => m.id === id)?.user.name ?? "Member";

  // Each person's Spent is what left their own wallet: counted by who paid,
  // with any "to be paid back" part moved onto the other person. Shared
  // expenses get their own row, for information only.
  const wallet = walletSpentByMember(
    expenseRows.map((e) => ({
      amount: Number(e.amount),
      paidByMemberId: e.paidByMemberId,
      payBackAmount: e.payBackAmount === null ? null : Number(e.payBackAmount),
    })),
    members.map((m) => m.id),
  );
  const ownerSpent = (ownerId: null | string) =>
    ownerId === null ? expenses.filter((e) => e.ownerMemberId === null).reduce((s, e) => s + e.amount, 0) : (wallet.get(ownerId) ?? 0);
  const ownerIncome = (id: string) => incomes.find((i) => i.memberId === id)?.amount ?? 0;
  const prevOwnerIncome = (id: string) => prevIncomes.find((i) => i.memberId === id)?.amount ?? 0;

  const partner = members.find((m) => m.id !== memberId);
  const meMonogram = { name: memberName(memberId), role: "me" as const };
  const partnerMonogram = partner ? { name: partner.user.name, role: "partner" as const } : null;

  const meIncome = ownerIncome(memberId);
  const meSpent = ownerSpent(memberId);
  const meLeft = meIncome - meSpent;
  const partnerIncome = partner ? ownerIncome(partner.id) : 0;
  const partnerSpent = partner ? ownerSpent(partner.id) : 0;
  const partnerLeft = partnerIncome - partnerSpent;

  const owners: HomeOwnerRow[] = [
    {
      income: meIncome,
      incomeTrendPct: trendPct(meIncome, prevOwnerIncome(memberId)),
      incomeUsedPct: percent(meSpent, meIncome),
      incomeUsedRatio: meIncome > 0 ? meSpent / meIncome : meSpent > 0 ? Number.POSITIVE_INFINITY : 0,
      key: "me",
      label: "Me",
      left: meLeft,
      leftNote: meLeft < 0 ? "over income" : `${percent(meSpent, meIncome) ?? 0}% of income`,
      monogram: [meMonogram],
      spent: meSpent,
    },
    ...(partner
      ? [
          {
            income: partnerIncome,
            incomeTrendPct: trendPct(partnerIncome, prevOwnerIncome(partner.id)),
            incomeUsedPct: percent(partnerSpent, partnerIncome),
            incomeUsedRatio: partnerIncome > 0 ? partnerSpent / partnerIncome : partnerSpent > 0 ? Number.POSITIVE_INFINITY : 0,
            key: "partner" as const,
            label: partner.user.name,
            left: partnerLeft,
            leftNote: partnerLeft < 0 ? "over income" : `${percent(partnerSpent, partnerIncome) ?? 0}% of income`,
            monogram: partnerMonogram ? [partnerMonogram] : [],
            spent: partnerSpent,
          },
        ]
      : []),
    {
      income: null,
      incomeTrendPct: null,
      incomeUsedPct: null,
      incomeUsedRatio: null,
      key: "shared",
      label: "Spent on us",
      left: null,
      leftNote: null,
      monogram: partnerMonogram ? [meMonogram, partnerMonogram] : [meMonogram],
      spent: ownerSpent(null),
    },
  ];

  // Weekly pacing over the flexible part of the budget (fixed commitments are
  // already spoken for): the hero's safe-to-spend figure and its carry-over.
  // Fixed-category expenses don't count against it, for the same reason.
  const period = resolvePeriod(year, month, dateFormat);
  const flexiblePlanned = budgetItemRows
    .filter((b) => category(b.categoryId)?.budgetType === "flexible")
    .reduce((s, b) => s + Number(b.plannedAmount), 0);
  const pacingSchedule =
    flexiblePlanned > 0 ? buildPacingSchedule({ daysInPeriod: period.daysInPeriod, flexibleTotal: flexiblePlanned }) : null;
  const dayOfPeriod = isCurrentMonth ? daysElapsedInPeriod(period) : period.daysInPeriod;
  const fixedCategoryIds = new Set(categories.filter((c) => c.budgetType === "fixed").map((c) => c.id));
  const spentByDay = allowanceSpentByDay(expenseRows, fixedCategoryIds, year, month, dateFormat);
  const weekPacing = pacingSchedule ? currentWeekPacing(pacingSchedule, dayOfPeriod, spentByDay) : null;
  const pacing: HomePacing | null = weekPacing
    ? {
        carryIn: weekPacing.carryIn,
        nextWeekAllowance: pacingSchedule!.weeks[weekPacing.index + 1]?.allowance ?? weekPacing.allowance,
        nextWeekday: weekdayOf(period.startDate, weekPacing.nextWeekStartDay),
        over: weekPacing.remaining <= 0,
        safeToday: weekPacing.safeToday,
        weekLeft: weekPacing.remaining,
        weeklyAllowance: weekPacing.allowance,
      }
    : null;

  // The "pay back later" balance between the two members, across all months.
  const payback = partner
    ? paybackBalance(
        payBackExpenseRows.flatMap((e) =>
          e.payBackAmount === null
            ? []
            : [{ amount: Number(e.amount), paidByMemberId: e.paidByMemberId, payBackAmount: Number(e.payBackAmount) }],
        ),
        paybackRows.map((p) => ({ amount: Number(p.amount), fromMemberId: p.fromMemberId, toMemberId: p.toMemberId })),
        [memberId, partner.id],
      )
    : null;
  const recentPaybacks = paybackRows.slice(0, PAYBACKS_SHOWN).map((p) => ({
    amount: Number(p.amount),
    dateLabel: formatShortDate(p.date, dateFormat),
    fromName: memberName(p.fromMemberId),
    id: p.id,
    toName: memberName(p.toMemberId),
  }));

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

  const contributions = contributionRows.map((c) => ({ amount: Number(c.amount), date: c.date, goalId: c.goalId }));
  const goals: HomeGoal[] = goalRows.slice(0, GOALS_SHOWN).map((g) => {
    const targetAmount = g.targetAmount === null ? null : Number(g.targetAmount);
    const saved = savedAmountForGoal(g.id, contributions);
    return {
      id: g.id,
      name: g.name,
      pct: targetAmount !== null && targetAmount > 0 ? Math.round((saved / targetAmount) * 100) : null,
      saved,
      targetAmount,
    };
  });

  const savingsBudgetAmount = budgetItemRows
    .filter((b) => category(b.categoryId)?.name === "Savings")
    .reduce((s, b) => s + Number(b.plannedAmount), 0);

  const categoryName = (id: string) => category(id)?.name ?? "Unknown";
  const recent: HomeRecentGroup[] = groupByDay(
    recentExpenseRows.map((e) => ({
      amount: Number(e.amount),
      categoryId: e.categoryId,
      categoryName: categoryName(e.categoryId),
      date: e.date,
      id: e.id,
      note: e.note,
      ownerMemberId: e.ownerMemberId,
      paidByMemberId: e.paidByMemberId,
    })),
    { dateFormat, today: todayISO() },
  ).map((group) => ({
    key: group.date,
    label: group.label,
    rows: group.rows.map((row) => ({
      amount: row.amount,
      categoryGroupName: category(row.categoryId)?.groupName ?? "",
      categoryIcon: category(row.categoryId)?.icon ?? null,
      categoryName: row.categoryName,
      id: row.id,
      note: row.note,
    })),
    sub: group.sub,
    total: group.total,
  }));

  const monthLabel = formatPeriodLabel(year, month, dateFormat);
  const saved = savingsStats.monthlyContribution;

  return (
    <HomeView
      currentMemberId={memberId}
      daysLeft={daysLeftInMonth(year, month, dateFormat)}
      goals={goals}
      incomes={Object.fromEntries(incomes.map((i) => [i.memberId, i.amount]))}
      ledger={{
        income: summary.combinedIncome,
        incomeTrendPct: trendPct(summary.combinedIncome, prevSummary.combinedIncome),
        saved,
        savedNote: saved === 0 ? "Nothing set aside yet" : "Saved this month",
        spent: summary.totalExpenses,
        spentMeterRatio: summary.combinedIncome > 0 ? summary.totalExpenses / summary.combinedIncome : 0,
        spentPctOfIncome: percent(summary.totalExpenses, summary.combinedIncome),
        spentTrendPct: trendPct(summary.totalExpenses, prevSummary.totalExpenses),
        unallocated: summary.unallocated,
      }}
      members={members.map((m) => ({ id: m.id, name: m.user.name }))}
      month={month}
      monthNav={buildMonthNav({ basePath: "/dashboard", current: { month: currentMonth, year: currentYear }, dateFormat, selected: { month, year } })}
      owners={owners}
      pacing={pacing}
      payback={payback}
      prevMonthName={formatPeriodLabel(prev.year, prev.month, dateFormat).split(" ")[0]}
      recent={recent}
      recentPaybacks={recentPaybacks}
      savingsBudgetAmount={savingsBudgetAmount > 0 ? savingsBudgetAmount : null}
      spentMonthName={monthLabel.split(" ")[0]}
      year={year}
    />
  );
}
