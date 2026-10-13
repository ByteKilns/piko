import { formatShortDate } from "@/lib/date-format";
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { formatMoney } from "@/lib/money";
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
import { listIncomeRows, listPlanLines } from "@/modules/budget/api/budget";
import { buildPersonPlan, overrunFromPlan, overrunNote } from "@/modules/budget/lib/budget-view";
import { monthIncome } from "@/modules/budget/lib/income";
import { listCategories } from "@/modules/categories/api/categories";
import {
  type HomeBalanceRow,
  type HomeEssential,
  type HomeOwnerRow,
  type HomePacing,
  type HomeRecentGroup,
  type HomeSavingsPot,
  HomeView,
} from "@/modules/dashboard/components/HomeView";
import { daysLeftInMonth, spentByDayIn } from "@/modules/dashboard/lib/cash-flow";
import { toExpenseInputs } from "@/modules/dashboard/lib/map-rows";
import { movedThisMonth } from "@/modules/dashboard/lib/moved";
import { buildPacingSchedule, currentWeekPacing, weekIndexOf, withOverrun } from "@/modules/dashboard/lib/pacing";
import { walletShares, walletSpentByMember } from "@/modules/dashboard/lib/wallet";
import { listDhukuEntries, listDhukus } from "@/modules/dhuku/api/dhuku.actions";
import { dhukuPosition } from "@/modules/dhuku/lib/dhuku-money";
import { listExpensesForMonth, listRecentExpenses } from "@/modules/expenses/api/expenses.actions";
import { groupByDay } from "@/modules/expenses/lib/expense-view";
import { listLoanPayments, listLoans } from "@/modules/loans/api/loans.actions";
import { buildLoanCards, loanOverviewStats } from "@/modules/loans/lib/loan-stats";
import { checkBudgetReminder } from "@/modules/notifications/api/notifications.actions";
import { listPayBackExpenses, listPaybacks } from "@/modules/paybacks/api/paybacks.actions";
import { paybackBalance } from "@/modules/paybacks/lib/payback-balance";
import {
  listSavingsDeposits,
  listSavingsExpenses,
  listSavingsItems,
  listSavingsPotPlans,
  listSavingsPots,
} from "@/modules/savings/api/savings.actions";
import { forecastPot, monthAfter } from "@/modules/savings/lib/savings-forecast";
import { potBalance } from "@/modules/savings/lib/savings-math";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
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
    planLines,
    expenseRows,
    prevExpenseRows,
    recentExpenseRows,
    paybackRows,
    payBackExpenseRows,
    potRows,
    planRows,
    itemRows,
    depositRows,
    savingsSpendRows,
    dhukuRows,
    dhukuEntryRows,
    loanRows,
    loanPaymentRows,
  ] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    listIncomeRows(householdId),
    listPlanLines(householdId, year, month),
    listExpensesForMonth(year, month, dateFormat),
    listExpensesForMonth(prev.year, prev.month, dateFormat),
    listRecentExpenses(5),
    listPaybacks(householdId),
    listPayBackExpenses(householdId),
    listSavingsPots(householdId),
    listSavingsPotPlans(householdId),
    listSavingsItems(householdId),
    listSavingsDeposits(householdId),
    listSavingsExpenses(householdId),
    listDhukus(householdId),
    listDhukuEntries(householdId),
    listLoans(householdId),
    listLoanPayments(householdId),
  ]);

  if (isCurrentMonth) {
    await checkBudgetReminder(householdId, year, month, planLines.length);
  }

  // Expenses paid from a savings pot came out of money set aside over many
  // months, not this month's pay. Spent, Left and the weekly allowance leave
  // them out; Home shows the viewer's on their own.
  const payExpenseRows = expenseRows.filter((e) => e.savingsPotId === null);
  const paidFromSavings = expenseRows
    .filter((e) => e.savingsPotId !== null && e.paidByMemberId === memberId)
    .reduce((s, e) => s + Number(e.amount), 0);

  // Pay carries forward from earlier months; extra income counts in its own month.
  const incomes = members.map((m) => ({ amount: monthIncome(incomeRows, m.id, { month, year }).total, memberId: m.id }));
  const expenses = toExpenseInputs(payExpenseRows);
  const prevIncomes = members.map((m) => ({ amount: monthIncome(incomeRows, m.id, prev).total, memberId: m.id }));

  const category = (id: string) => categories.find((c) => c.id === id);
  const memberName = (id: string) => members.find((m) => m.id === id)?.user.name ?? "Member";

  // Each person's Spent is what left their own wallet: counted by who paid,
  // with any "to be paid back" part moved onto the other person. Shared
  // expenses get their own row, for information only.
  const wallet = walletSpentByMember(
    payExpenseRows.map((e) => ({
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

  // Home's figures and hero follow the person viewing it: their Spent is what
  // left their own wallet, and their plan is their own lines.
  const period = resolvePeriod(year, month, dateFormat);
  const memberIds = members.map((m) => m.id);
  const viewerShares = (rows: typeof expenseRows) =>
    rows
      .filter((e) => e.savingsPotId === null)
      .flatMap((e) =>
        walletShares(
          { amount: Number(e.amount), paidByMemberId: e.paidByMemberId, payBackAmount: e.payBackAmount === null ? null : Number(e.payBackAmount) },
          memberIds,
        ).flatMap((share) => (share.memberId === memberId ? [{ amount: share.amount, categoryId: e.categoryId, date: e.date }] : [])),
      );
  const viewerSpending = viewerShares(expenseRows);
  const viewerSpent = viewerSpending.reduce((s, e) => s + e.amount, 0);
  const viewerPrevSpent = viewerShares(prevExpenseRows).reduce((s, e) => s + e.amount, 0);
  const viewerIncome = monthIncome(incomeRows, memberId, { month, year });
  const payCarriedFrom = viewerIncome.payCarriedFrom
    ? formatPeriodLabel(viewerIncome.payCarriedFrom.year, viewerIncome.payCarriedFrom.month, dateFormat)
    : null;
  const viewerPlan = buildPersonPlan({
    categories: categories.map((c) => ({ budgetType: c.budgetType, id: c.id, name: c.name })),
    lines: planLines.filter((l) => l.ownerMemberId === memberId),
    spending: viewerSpending,
  });

  // Weekly pacing over the can-cut lines: the hero's safe-to-spend figure and
  // its carry-over. Only can-cut spending counts against it, and whatever went
  // over elsewhere comes out of what's left, from this week on.
  const canCut = viewerPlan.groups.find((g) => g.kind === "can_cut");
  const canCutIds = new Set(canCut?.rows.map((r) => r.categoryId) ?? []);
  const overrun = overrunFromPlan(viewerPlan);
  const dayOfPeriod = isCurrentMonth ? daysElapsedInPeriod(period) : period.daysInPeriod;
  const baseSchedule = canCut ? buildPacingSchedule({ daysInPeriod: period.daysInPeriod, flexibleTotal: canCut.planned }) : null;
  const pacingSchedule = baseSchedule ? withOverrun(baseSchedule, weekIndexOf(baseSchedule, dayOfPeriod), overrun.total) : null;
  const spentByDay = spentByDayIn(viewerSpending, canCutIds, year, month, dateFormat);
  const weekPacing = pacingSchedule ? currentWeekPacing(pacingSchedule, dayOfPeriod, spentByDay) : null;
  const pacing: HomePacing | null =
    pacingSchedule && weekPacing
      ? {
          carryIn: weekPacing.carryIn,
          nextWeekAllowance: pacingSchedule.weeks[weekPacing.index + 1]?.allowance ?? weekPacing.allowance,
          nextWeekday: weekdayOf(period.startDate, weekPacing.nextWeekStartDay),
          over: weekPacing.remaining <= 0,
          overrunNote: overrunNote(overrun),
          safeToday: weekPacing.safeToday,
          weekLeft: weekPacing.remaining,
          weeklyAllowance: weekPacing.allowance,
        }
      : null;
  const essentials: HomeEssential[] =
    viewerPlan.groups
      .find((g) => g.kind === "essential")
      ?.rows.map((r) => ({ categoryName: r.categoryName, planned: r.planned, spent: r.spent })) ?? [];

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

  // Savings pots: balance, whether the reserve is full, and the next thing on
  // the list with when it becomes affordable (counted from this month).
  const deposits = depositRows.map((d) => ({ amount: Number(d.amount), date: d.date, kind: d.kind, memberId: d.memberId, potId: d.potId }));
  const spends = savingsSpendRows.flatMap((e) =>
    e.savingsPotId ? [{ amount: Number(e.amount), savingsItemId: e.savingsItemId, savingsPotId: e.savingsPotId }] : [],
  );
  const doneItemIds = new Set(spends.flatMap((s) => (s.savingsItemId ? [s.savingsItemId] : [])));
  const whenAffordable = (months: null | number) => {
    if (months === null) return "not on the current plan";
    if (months === 0) return "affordable now";
    const when = monthAfter(currentYear, currentMonth, months);
    return `in ${formatPeriodLabel(when.year, when.month, dateFormat)}`;
  };
  const savings: HomeSavingsPot[] = potRows.map((pot) => {
    const balance = potBalance(pot.id, deposits, spends);
    const reserveMinimum = Number(pot.reserveMinimum);
    const planned = planRows.filter((p) => p.potId === pot.id).reduce((s, p) => s + Number(p.monthlyAmount), 0);
    const open = itemRows.filter((i) => i.potId === pot.id && !doneItemIds.has(i.id));
    const forecast = forecastPot({ balance, items: open.map((i) => ({ cost: Number(i.cost), id: i.id })), monthlyInflow: planned, reserveMinimum });
    return {
      balance,
      id: pot.id,
      name: pot.name,
      next: open.length > 0 ? `Next: ${open[0].name}, ${whenAffordable(forecast.items[0].monthsFromNow)}` : null,
      reserveFull: balance >= reserveMinimum,
    };
  });
  // Money the viewer moved into their own piles this month: their savings
  // deposits, their dhukus' payments and their repayments on loans they took.
  // Unallocated takes it off too, since it's no longer free to spend.
  const viewerDhukuIds = new Set(dhukuRows.filter((d) => d.ownerMemberId === memberId).map((d) => d.id));
  const moved = movedThisMonth({
    deposits: deposits.filter((d) => d.memberId === memberId),
    dhukuEntries: dhukuEntryRows
      .filter((e) => viewerDhukuIds.has(e.dhukuId))
      .map((e) => ({ amount: Number(e.amount), date: e.date, type: e.type })),
    endDate: period.endDate,
    loanPayments: loanPaymentRows.flatMap((p) => {
      const loan = loanRows.find((l) => l.id === p.loanId);
      return loan && p.memberId === memberId ? [{ amount: Number(p.amount), date: p.date, direction: loan.direction }] : [];
    }),
    startDate: period.startDate,
  });
  const unallocated = viewerIncome.pay + viewerIncome.extra - viewerSpent - moved.total;

  // Balances: where each pile stands, apart from this month's spending.
  // Positive = yours, or owed to you; negative = you owe it.
  const loanStats = loanOverviewStats(
    buildLoanCards(
      loanRows,
      loanPaymentRows.map((p) => ({ amount: Number(p.amount), loanId: p.loanId })),
      new Map(members.map((m) => [m.id, m])),
    ),
  );
  const dhukuBalances: HomeBalanceRow[] = dhukuRows.flatMap((dhuku) => {
    const entries = dhukuEntryRows.filter((e) => e.dhukuId === dhuku.id).map((e) => ({ amount: Number(e.amount), type: e.type }));
    const contributions = entries.filter((e) => e.type === "contribution").length;
    if (dhuku.completedAt !== null || contributions >= dhuku.totalMembers) return [];
    const position = dhukuPosition(
      {
        monthlyContribution: Number(dhuku.monthlyContribution),
        potDeduction: dhuku.potDeduction === null ? null : Number(dhuku.potDeduction),
        totalMembers: dhuku.totalMembers,
      },
      entries,
    );
    return [{ amount: position, id: `dhuku:${dhuku.id}`, label: dhuku.name, sub: position >= 0 ? "Dhuku · the group owes you" : "Dhuku · you owe the group" }];
  });
  const balances: HomeBalanceRow[] = [
    ...savings.map((pot) => ({ amount: pot.balance, id: `pot:${pot.id}`, label: pot.name, sub: "Savings" })),
    ...dhukuBalances,
    ...(loanStats.outstandingToReceive > 0
      ? [{ amount: loanStats.outstandingToReceive, id: "loans:owed", label: "Loans owed to you", sub: "Still to be paid back" }]
      : []),
    ...(loanStats.outstandingToPay > 0 ? [{ amount: -loanStats.outstandingToPay, id: "loans:owe", label: "Loans you owe", sub: "Still to pay" }] : []),
    ...(payback
      ? [
          payback.debtorId === memberId
            ? { amount: -payback.amount, id: "payback", label: `You owe ${memberName(payback.creditorId)}`, sub: "Pay back later" }
            : { amount: payback.amount, id: "payback", label: `${memberName(payback.debtorId)} owes you`, sub: "Pay back later" },
        ]
      : []),
  ];

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

  return (
    <HomeView
      balances={balances}
      currentMemberId={memberId}
      daysLeft={daysLeftInMonth(year, month, dateFormat)}

      essentials={essentials}
      ledger={{
        moved,
        paidFromSavings,
        pay: viewerIncome.pay,
        payNote: viewerIncome.extra > 0 ? `+ ${formatMoney(viewerIncome.extra)} extra` : payCarriedFrom ? `Carried over from ${payCarriedFrom}` : null,
        spent: viewerSpent,
        spentMeterRatio: viewerIncome.pay > 0 ? viewerSpent / viewerIncome.pay : 0,
        spentPctOfPay: percent(viewerSpent, viewerIncome.pay),
        spentTrendPct: trendPct(viewerSpent, viewerPrevSpent),
        unallocated,
      }}
      members={members.map((m) => ({ id: m.id, name: m.user.name }))}
      month={month}
      monthNav={buildMonthNav({ basePath: "/dashboard", current: { month: currentMonth, year: currentYear }, dateFormat, selected: { month, year } })}
      owners={owners}
      pacing={pacing}
      pay={{
        amount: viewerIncome.pay,
        carriedFrom: payCarriedFrom,
        extras: viewerIncome.extras,
      }}
      payback={payback}
      prevMonthName={formatPeriodLabel(prev.year, prev.month, dateFormat).split(" ")[0]}
      recent={recent}
      recentPaybacks={recentPaybacks}
      savings={savings}
      spentMonthName={monthLabel.split(" ")[0]}
      year={year}
    />
  );
}
