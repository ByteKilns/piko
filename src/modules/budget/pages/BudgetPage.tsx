import { getDateFormatPref } from "@/lib/date-format-cookie";
import { formatMoney } from "@/lib/money";
import { buildMonthNav, parseMonthParam } from "@/lib/month-nav";
import { currentPeriodYearMonth, formatPeriodLabel, MAX_NAVIGABLE_YEAR, MIN_NAVIGABLE_YEAR, resolvePeriod } from "@/lib/month-period";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { listDatedLines, listIncomeRows, listPlanLines } from "@/modules/budget/api/budget";
import { BudgetView, type PersonView } from "@/modules/budget/components/BudgetView";
import { buildBudgetLead, buildPersonPlan, overBudgetRows, sharedRows } from "@/modules/budget/lib/budget-view";
import { monthIncome } from "@/modules/budget/lib/income";
import { lastKindByCategory } from "@/modules/budget/lib/plan-lines";
import { dhukuSetAsides, loanSetAsides, savingsSetAsides } from "@/modules/budget/lib/set-aside";
import { listCategories } from "@/modules/categories/api/categories";
import { walletShares } from "@/modules/dashboard/lib/wallet";
import { listDhukuEntries, listDhukus } from "@/modules/dhuku/api/dhuku.actions";
import { listExpensesForMonth } from "@/modules/expenses/api/expenses.actions";
import { listLoanPayments, listLoans } from "@/modules/loans/api/loans.actions";
import { checkBudgetReminder } from "@/modules/notifications/api/notifications.actions";
import { listSavingsDeposits, listSavingsPotPlans, listSavingsPots } from "@/modules/savings/api/savings.actions";

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

type Props = { searchParams: Promise<{ month?: string; year?: string }> };

export async function BudgetPage({ searchParams }: Props) {
  const { householdId, memberId } = await getCurrentMember();
  const dateFormat = await getDateFormatPref(householdId);
  const params = await searchParams;
  const { year: currentYear, month: currentMonth } = currentPeriodYearMonth(dateFormat);
  const year = parseMonthParam(params.year, currentYear, MAX_NAVIGABLE_YEAR[dateFormat], MIN_NAVIGABLE_YEAR[dateFormat]);
  const month = parseMonthParam(params.month, currentMonth, 12);
  const isCurrentMonth = year === currentYear && month === currentMonth;
  const period = resolvePeriod(year, month, dateFormat);

  const [
    members,
    categories,
    incomeRows,
    planLines,
    datedLines,
    expenseRows,
    potRows,
    planRows,
    depositRows,
    dhukuRows,
    dhukuEntryRows,
    loanRows,
    loanPaymentRows,
  ] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    listIncomeRows(householdId),
    listPlanLines(householdId, year, month),
    listDatedLines(householdId, { month, year }),
    listExpensesForMonth(year, month, dateFormat),
    listSavingsPots(householdId),
    listSavingsPotPlans(householdId),
    listSavingsDeposits(householdId),
    listDhukus(householdId),
    listDhukuEntries(householdId),
    listLoans(householdId),
    listLoanPayments(householdId),
  ]);

  if (isCurrentMonth) {
    await checkBudgetReminder(householdId, year, month, planLines.length);
  }

  const memberIds = members.map((m) => m.id);
  const categoryList = categories.map((c) => ({ budgetType: c.budgetType, groupName: c.groupName, id: c.id, name: c.name }));

  // Each person's spending is what left their own wallet, the same as Home.
  // Expenses paid from savings were saved for in earlier months, so they don't
  // count against this month's budget.
  const shares = expenseRows
    .filter((e) => e.savingsPotId === null)
    .flatMap((e) =>
      walletShares(
        { amount: Number(e.amount), paidByMemberId: e.paidByMemberId, payBackAmount: e.payBackAmount === null ? null : Number(e.payBackAmount) },
        memberIds,
      ).map((share) => ({ ...share, categoryId: e.categoryId })),
    );

  const deposits = depositRows.map((d) => ({ amount: Number(d.amount), date: d.date, kind: d.kind, memberId: d.memberId, potId: d.potId }));
  const plans = planRows.map((p) => ({ memberId: p.memberId, monthlyAmount: Number(p.monthlyAmount), potId: p.potId }));
  const dhukus = dhukuRows.map((d) => ({
    completedAt: d.completedAt,
    id: d.id,
    interestPerMonth: d.interestPerMonth === null ? null : Number(d.interestPerMonth),
    monthlyContribution: Number(d.monthlyContribution),
    name: d.name,
    ownerMemberId: d.ownerMemberId,
    totalMembers: d.totalMembers,
  }));
  const dhukuEntries = dhukuEntryRows.map((e) => ({ amount: Number(e.amount), date: e.date, dhukuId: e.dhukuId, type: e.type }));
  const loans = loanRows.map((l) => ({
    counterpartyName: l.counterpartyName,
    direction: l.direction,
    id: l.id,
    installmentAmount: l.installmentAmount === null ? null : Number(l.installmentAmount),
    installmentFrequency: l.installmentFrequency,
    ownerMemberId: l.ownerMemberId,
    principalAmount: Number(l.principalAmount),
  }));
  const payments = loanPaymentRows.map((p) => ({ amount: Number(p.amount), date: p.date, loanId: p.loanId }));

  const ordered = [...members.filter((m) => m.id === memberId), ...members.filter((m) => m.id !== memberId)];
  const people: PersonView[] = ordered.map((member) => {
    const lines = planLines.filter((l) => l.ownerMemberId === member.id);
    const spending = shares.filter((s) => s.memberId === member.id);
    const plan = buildPersonPlan({ categories: categoryList, lines, spending });
    const income = monthIncome(incomeRows, member.id, { month, year });

    const setAsideRows = [
      ...savingsSetAsides({ deposits, memberId: member.id, period, plans, pots: potRows }),
      ...dhukuSetAsides({ dhukus, entries: dhukuEntries, memberId: member.id, period }),
      ...loanSetAsides({ loans, memberId: member.id, payments, period }),
    ];
    const setAside = setAsideRows.reduce((sum, row) => sum + row.planned, 0);
    // The plan runs on pay only: extra income never makes room in it.
    const unplanned = income.pay - setAside - plan.budgeted;
    const carried = lines.find((l) => l.inherited);
    const payCarriedFrom = income.payCarriedFrom ? formatPeriodLabel(income.payCarriedFrom.year, income.payCarriedFrom.month, dateFormat) : null;

    return {
      carriedFrom: carried ? formatPeriodLabel(carried.year, carried.month, dateFormat) : null,
      key: member.id === memberId ? ("me" as const) : ("partner" as const),
      lastKinds: lastKindByCategory(datedLines, member.id),
      lead: buildBudgetLead({
        allSpent: plan.totalSpent,
        budgeted: plan.budgeted,
        income: income.pay,
        outside: plan.unbudgetedTotal,
        overBudget: overBudgetRows(plan),
      }),
      ledger: {
        budgeted: plan.budgeted,
        budgetedSub: `${percent(plan.budgeted, income.pay)}% of pay`,
        pay: income.pay,
        paySub: income.extra > 0 ? `+ ${formatMoney(income.extra)} extra` : payCarriedFrom ? `Carried over from ${payCarriedFrom}` : null,
        plannedRatio: income.pay > 0 ? (setAside + plan.budgeted) / income.pay : 0,
        setAside,
        setAsideSub: setAsideRows.length > 0 ? `${setAsideRows.length} ${setAsideRows.length === 1 ? "item" : "items"}` : "Nothing set aside",
        unplanned,
        unplannedSub: unplanned < 0 ? "The plan is bigger than pay" : `${percent(unplanned, income.pay)}% of pay not planned yet`,
      },
      memberId: member.id,
      name: member.user.name,
      pay: { amount: income.pay, carriedFrom: payCarriedFrom, extras: income.extras },
      plan,
      setAside: {
        done: setAsideRows.reduce((sum, row) => sum + row.done, 0),
        planned: setAside,
        rows: setAsideRows,
      },
      spentByCategory: Object.fromEntries(
        [...new Set(spending.map((s) => s.categoryId))].map((id) => [id, spending.filter((s) => s.categoryId === id).reduce((sum, s) => sum + s.amount, 0)]),
      ),
    };
  });

  return (
    <BudgetView
      categories={categoryList}
      month={month}
      monthLabel={formatPeriodLabel(year, month, dateFormat)}
      monthNav={buildMonthNav({
        allowFuture: true,
        basePath: "/budget",
        current: { month: currentMonth, year: currentYear },
        dateFormat,
        selected: { month, year },
      })}
      people={people}
      shared={sharedRows(planLines, categoryList)}
      year={year}
    />
  );
}
