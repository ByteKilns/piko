import { formatShortDate } from "@/lib/date-format";
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { buildMonthNav, parseMonthParam, previousMonth } from "@/lib/month-nav";
import {
  currentPeriodYearMonth,
  dayNumberInPeriod,
  daysElapsedInPeriod,
  formatPeriodLabel,
  MAX_NAVIGABLE_YEAR,
  MIN_NAVIGABLE_YEAR,
  resolvePeriod,
} from "@/lib/month-period";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { listIncomeRows, listPlanLines } from "@/modules/budget/api/budget";
import { incomeByMonth, monthIncome } from "@/modules/budget/lib/income";
import { listCategories } from "@/modules/categories/api/categories";
import { pctOfIncome } from "@/modules/dashboard/lib/format";
import { listExpensesForMonth, listExpensesForRange } from "@/modules/expenses/api/expenses.actions";
import { roleForOwner } from "@/modules/expenses/lib/member-tone";
import { payRows } from "@/modules/expenses/lib/pay-amount";
import { ReportsView } from "@/modules/reports/components/ReportsView";
import {
  budgetVsActual,
  categoryBreakdown,
  categoryChanges,
  dailySpendingPace,
  monthlyIncomeExpenseTrend,
  topExpenses,
  trendPct,
} from "@/modules/reports/lib/reports-stats";
import { expenseLead } from "@/modules/reports/lib/reports-view";
import { listSavingsDeposits, listSavingsExpenses, listSavingsPots } from "@/modules/savings/api/savings.actions";
import { potBalance, putInBetween } from "@/modules/savings/lib/savings-math";

type Props = { searchParams: Promise<{ month?: string; year?: string }> };

export async function ReportsPage({ searchParams }: Props) {
  const { householdId, memberId } = await getCurrentMember();
  const dateFormat = await getDateFormatPref(householdId);
  const params = await searchParams;
  const { year: currentYear, month: currentMonth } = currentPeriodYearMonth(dateFormat);
  const year = parseMonthParam(params.year, currentYear, MAX_NAVIGABLE_YEAR[dateFormat], MIN_NAVIGABLE_YEAR[dateFormat]);
  const month = parseMonthParam(params.month, currentMonth, 12);
  const prev = previousMonth(year, month);
  const period = resolvePeriod(year, month, dateFormat);
  const isCurrent = year === currentYear && month === currentMonth;

  // The six months the trend chart covers, oldest first.
  const trendMonths = [{ month, year }];
  for (let i = 0; i < 5; i++) trendMonths.unshift(previousMonth(trendMonths[0].year, trendMonths[0].month));
  const rangeStart = resolvePeriod(trendMonths[0].year, trendMonths[0].month, dateFormat).startDate;

  const [
    members,
    categories,
    incomeRows,
    budgetItemRows,
    expenseRows,
    prevExpenseRows,
    rangeExpenseRows,
    potRows,
    depositRows,
    savingsSpendRows,
  ] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    listIncomeRows(householdId),
    listPlanLines(householdId, year, month),
    listExpensesForMonth(year, month, dateFormat),
    listExpensesForMonth(prev.year, prev.month, dateFormat),
    listExpensesForRange(rangeStart, period.endDate),
    listSavingsPots(householdId),
    listSavingsDeposits(householdId),
    listSavingsExpenses(householdId),
  ]);

  // Spending from pay only, the same Spent as Home and Budget: the part a
  // fund paid is left out. Expenses paid from savings are listed on the
  // Savings tab instead.
  const payExpenseRows = payRows(expenseRows);
  const payPrevExpenseRows = payRows(prevExpenseRows);
  const payRangeExpenseRows = payRows(rangeExpenseRows);

  const memberById = new Map(members.map((m) => [m.id, m]));
  const category = (id: string) => categories.find((c) => c.id === id);
  const categoryName = (id: string) => category(id)?.name ?? "Unknown";

  const expenses = payExpenseRows.map((e) => ({ amount: Number(e.amount), categoryId: e.categoryId, ownerMemberId: e.ownerMemberId }));
  // Pay carries forward from earlier months; extra income counts in its own month.
  const memberIncome = (id: string, ym: { month: number; year: number }) => monthIncome(incomeRows, id, ym).total;
  const combinedIncome = members.reduce((s, m) => s + memberIncome(m.id, { month, year }), 0);
  const prevIncome = members.reduce((s, m) => s + memberIncome(m.id, prev), 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const prevTotalExpenses = payPrevExpenseRows.reduce((s, e) => s + Number(e.amount), 0);

  const budgetLines = budgetVsActual(
    budgetItemRows.map((b) => ({ categoryId: b.categoryId, plannedAmount: Number(b.plannedAmount) })),
    expenses,
    categories,
  );
  const changes = categoryChanges(
    expenses,
    payPrevExpenseRows.map((e) => ({ amount: Number(e.amount), categoryId: e.categoryId })),
    categories,
  );
  const slices = categoryBreakdown(expenses, categories);
  const largest = topExpenses(
    payExpenseRows.map((e) => ({
      amount: Number(e.amount),
      categoryName: categoryName(e.categoryId),
      date: e.date,
      groupName: category(e.categoryId)?.groupName ?? "Other",
      id: e.id,
      note: e.note,
    })),
  ).map((row) => ({
    amount: row.amount,
    categoryName: row.categoryName,
    dateLabel: formatShortDate(row.date, dateFormat),
    id: row.id,
    name: row.note ?? row.categoryName,
  }));

  const ownerSlice = (ownerId: null | string) =>
    expenses.filter((e) => e.ownerMemberId === ownerId).reduce((s, e) => s + e.amount, 0);
  const partner = members.find((m) => m.id !== memberId) ?? null;
  const ownerSlices = [
    { amount: ownerSlice(memberId), key: "me" as const, label: "Me" },
    ...(partner ? [{ amount: ownerSlice(partner.id), key: "partner" as const, label: partner.user.name }] : []),
    { amount: ownerSlice(null), key: "shared" as const, label: "Shared" },
  ].map((slice) => ({ ...slice, pct: totalExpenses > 0 ? Math.round((slice.amount / totalExpenses) * 100) : 0 }));

  const totalPlanned = budgetItemRows.reduce((s, b) => s + Number(b.plannedAmount), 0);
  const pacePoints = dailySpendingPace(
    payExpenseRows.map((e) => ({ amount: Number(e.amount), date: e.date })),
    year,
    month,
    totalPlanned,
    dateFormat,
  );
  const daily = new Array<number>(period.daysInPeriod).fill(0);
  const topCategoryByDay = new Array<null | string>(period.daysInPeriod).fill(null);
  const topCountByDay = new Array<number>(period.daysInPeriod).fill(0);
  for (const e of payExpenseRows) {
    const day = dayNumberInPeriod(e.date, year, month, dateFormat);
    if (day === null) continue;
    daily[day - 1] += Number(e.amount);
    topCategoryByDay[day - 1] = categoryName(e.categoryId);
    topCountByDay[day - 1] += 1;
  }
  const biggestDay = daily.reduce((best, amount, i) => (amount > daily[best] ? i : best), 0);
  const annotation =
    daily[biggestDay] > 0
      ? {
          amount: daily[biggestDay],
          day: biggestDay + 1,
          label: `${topCategoryByDay[biggestDay] ?? "Spending"}${topCountByDay[biggestDay] > 1 ? ` × ${topCountByDay[biggestDay]}` : ""}`,
        }
      : null;

  const unbudgetedLines = budgetLines.filter((l) => l.planned === 0 && l.spent > 0);
  const unbudgeted = unbudgetedLines.length > 0 ? { count: unbudgetedLines.length, names: unbudgetedLines.slice(0, 4).map((l) => l.name) } : null;

  const prevMonthName = formatPeriodLabel(prev.year, prev.month, dateFormat).split(" ")[0];
  const lead = expenseLead({ budgetLines, changes, current: totalExpenses, prevMonthName, previous: prevTotalExpenses });

  const trendPoints = monthlyIncomeExpenseTrend(
    incomeByMonth(
      incomeRows,
      members.map((m) => m.id),
      trendMonths,
    ),
    payRangeExpenseRows.map((e) => ({ amount: Number(e.amount), date: e.date })),
    { month, year },
    6,
    dateFormat,
  );

  const incomeMembers = [
    { amount: memberIncome(memberId, { month, year }), id: memberId, key: "me" as const, label: "Me" },
    ...(partner ? [{ amount: memberIncome(partner.id, { month, year }), id: partner.id, key: "partner" as const, label: partner.user.name }] : []),
  ].map(({ id, ...member }) => ({ ...member, trendPct: trendPct(member.amount, memberIncome(id, prev)) }));

  // Savings tab: money put into each pot this month, and what was paid from savings.
  const deposits = depositRows.map((d) => ({ amount: Number(d.amount), date: d.date, id: d.id, kind: d.kind, memberId: d.memberId, potId: d.potId }));
  const spends = savingsSpendRows.flatMap((e) => (e.savingsPotId ? [{ amount: Number(e.amount), savingsPotId: e.savingsPotId }] : []));
  const potName = (id: null | string) => potRows.find((p) => p.id === id)?.name ?? "Savings";
  const monthDeposits = deposits.filter((d) => d.kind === "deposit" && d.date >= period.startDate && d.date <= period.endDate);
  const putInBy = (id: string) => monthDeposits.filter((d) => d.memberId === id).reduce((s, d) => s + d.amount, 0);

  const monthLabel = formatPeriodLabel(year, month, dateFormat);
  const exportRows = expenseRows.map((e) => ({
    amount: Number(e.amount),
    category: categoryName(e.categoryId),
    date: e.date,
    name: e.note ?? categoryName(e.categoryId),
    owner: e.ownerMemberId ? roleForOwner(e.ownerMemberId, memberId) : "shared",
  }));

  return (
    <ReportsView
      budgetHref={`/budget?year=${year}&month=${month}`}
      expenses={{
        budgetLines,
        changes,
        largest,
        lead,
        ownerSlices,
        pace: {
          annotation,
          daily,
          daysInPeriod: period.daysInPeriod,
          isCurrent,
          points: pacePoints,
          todayDay: isCurrent ? daysElapsedInPeriod(period) : period.daysInPeriod,
          totalPlanned,
        },
        slices,
        spent: totalExpenses,
        spentPctOfIncome: pctOfIncome(totalExpenses, combinedIncome),
        spentTrendPct: trendPct(totalExpenses, prevTotalExpenses),
        unbudgeted,
      }}
      exportRows={exportRows}
      income={{
        months: trendPoints.map((p) => ({ income: p.income, label: p.label, left: p.income - p.expenses, spent: p.expenses })),
        members: incomeMembers,
        overspend: Math.max(0, totalExpenses - combinedIncome),
        spentPct: pctOfIncome(totalExpenses, combinedIncome),
        total: combinedIncome,
        trendPct: trendPct(combinedIncome, prevIncome),
      }}
      monthLabel={monthLabel}
      monthNav={buildMonthNav({ basePath: "/reports", current: { month: currentMonth, year: currentYear }, dateFormat, selected: { month, year } })}
      prevMonthName={prevMonthName}
      savings={{
        deposits: monthDeposits.map((d) => ({
          amount: d.amount,
          byLabel: memberById.get(d.memberId ?? "")?.user.name ?? "Former member",
          dateLabel: formatShortDate(d.date, dateFormat),
          id: d.id,
          potName: potName(d.potId),
        })),
        paidFromSavings: expenseRows
          .filter((e) => e.savingsPotId !== null)
          .map((e) => ({
            amount: Number(e.amount),
            categoryName: categoryName(e.categoryId),
            dateLabel: formatShortDate(e.date, dateFormat),
            id: e.id,
            name: e.note ?? categoryName(e.categoryId),
            potName: potName(e.savingsPotId),
          })),
        pots: potRows.map((pot) => ({
          balance: potBalance(pot.id, deposits, spends),
          id: pot.id,
          name: pot.name,
          putIn: putInBetween(pot.id, deposits, period.startDate, period.endDate),
        })),
        putIn: monthDeposits.reduce((s, d) => s + d.amount, 0),
        putInByPerson: [
          { amount: putInBy(memberId), label: "Me" },
          ...(partner ? [{ amount: putInBy(partner.id), label: partner.user.name }] : []),
        ],
      }}
    />
  );
}
