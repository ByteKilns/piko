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
import { dhukuSetAsides, fundSetAsides, loanSetAsides, savingsSetAsides } from "@/modules/budget/lib/set-aside";
import { listCategories } from "@/modules/categories/api/categories";
import { walletShares } from "@/modules/dashboard/lib/wallet";
import { listDhukuEntries, listDhukus } from "@/modules/dhuku/api/dhuku.actions";
import { listExpensesForMonth } from "@/modules/expenses/api/expenses.actions";
import { payRows } from "@/modules/expenses/lib/pay-amount";
import { listFundData } from "@/modules/funds/api/funds";
import { fundBalances, setAsideFor, suggestedMonthly } from "@/modules/funds/lib/fund-math";
import { listLoanPayments, listLoans } from "@/modules/loans/api/loans.actions";
import { checkBudgetReminder } from "@/modules/notifications/api/notifications.actions";
import { listSavingsDeposits, listSavingsPotPlans, listSavingsPots } from "@/modules/savings/api/savings.actions";
import { monthAfter } from "@/modules/savings/lib/savings-forecast";

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
    fundData,
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
    listFundData(householdId),
  ]);

  if (isCurrentMonth) {
    await checkBudgetReminder(householdId, year, month, planLines.length);
  }

  const memberIds = members.map((m) => m.id);
  const categoryList = categories.map((c) => ({ budgetType: c.budgetType, groupName: c.groupName, id: c.id, name: c.name }));

  // Each person's spending is what left their own wallet, the same as Home.
  // Expenses paid from savings or a fund were saved for in earlier months, so
  // only the part paid from pay counts against this month's budget.
  const shares = payRows(expenseRows).flatMap((e) =>
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
  const thisMonth = { month, year };

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
      ...fundSetAsides({ funds: fundData.funds, memberId: member.id, month: thisMonth, plans: fundData.plans }),
    ];
    const setAside = setAsideRows.reduce((sum, row) => sum + row.planned, 0);
    // The plan runs on pay only: extra income never makes room in it.
    const unplanned = income.pay - setAside - plan.budgeted;
    const carried = lines.find((l) => l.inherited);
    const personFunds = fundData.funds.filter((f) => f.ownerMemberId === member.id && !f.archived);
    const fundBalance = fundBalances({ ...fundData, funds: personFunds, through: thisMonth });
    const payCarriedFrom = income.payCarriedFrom ? formatPeriodLabel(income.payCarriedFrom.year, income.payCarriedFrom.month, dateFormat) : null;

    return {
      carriedFrom: carried ? formatPeriodLabel(carried.year, carried.month, dateFormat) : null,
      funds: personFunds.map((fund) => {
        const balance = fundBalance.get(fund.id) ?? 0;
        const due = fund.dueYear !== null && fund.dueMonth !== null ? { month: fund.dueMonth, year: fund.dueYear } : null;
        return {
          balance,
          due,
          dueLabel: due ? formatPeriodLabel(due.year, due.month, dateFormat) : null,
          id: fund.id,
          monthlyAmount: setAsideFor(
            fundData.plans.filter((p) => p.fundId === fund.id),
            thisMonth,
          ),
          name: fund.name,
          suggested: suggestedMonthly({ balance, due, now: thisMonth, target: fund.target }),
          target: fund.target,
        };
      }),
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
      dueOptions={Array.from({ length: 36 }, (_, i) => monthAfter(currentYear, currentMonth, i)).map((ym) => ({
        label: formatPeriodLabel(ym.year, ym.month, dateFormat),
        value: `${ym.year}-${ym.month}`,
      }))}
      month={month}
      monthLabel={formatPeriodLabel(year, month, dateFormat)}
      monthNav={buildMonthNav({
        allowFuture: true,
        basePath: "/budget",
        current: { month: currentMonth, year: currentYear },
        dateFormat,
        selected: { month, year },
      })}
      now={thisMonth}
      people={people}
      shared={sharedRows(planLines, categoryList)}
      year={year}
    />
  );
}
