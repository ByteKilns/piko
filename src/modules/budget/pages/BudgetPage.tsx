import { getDateFormatPref } from "@/lib/date-format-cookie";
import { formatMoney } from "@/lib/money";
import { buildMonthNav, parseMonthParam } from "@/lib/month-nav";
import { currentPeriodYearMonth, formatPeriodLabel, MAX_NAVIGABLE_YEAR, MIN_NAVIGABLE_YEAR, resolvePeriod } from "@/lib/month-period";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { listDatedLines, listPlanLines } from "@/modules/budget/api/budget";
import { getIncomesForMonth } from "@/modules/budget/api/budget.actions";
import { BudgetView, type PersonView } from "@/modules/budget/components/BudgetView";
import { buildBudgetLead, buildPersonPlan, overBudgetRows, sharedRows } from "@/modules/budget/lib/budget-view";
import { lastKindByCategory } from "@/modules/budget/lib/plan-lines";
import { listCategories } from "@/modules/categories/api/categories";
import { walletShares } from "@/modules/dashboard/lib/wallet";
import { listExpensesForMonth } from "@/modules/expenses/api/expenses.actions";
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

  const [members, categories, incomes, planLines, datedLines, expenseRows, potRows, planRows, depositRows] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    getIncomesForMonth(year, month),
    listPlanLines(householdId, year, month),
    listDatedLines(householdId, { month, year }),
    listExpensesForMonth(year, month, dateFormat),
    listSavingsPots(householdId),
    listSavingsPotPlans(householdId),
    listSavingsDeposits(householdId),
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

  const ordered = [...members.filter((m) => m.id === memberId), ...members.filter((m) => m.id !== memberId)];
  const people: PersonView[] = ordered.map((member) => {
    const lines = planLines.filter((l) => l.ownerMemberId === member.id);
    const spending = shares.filter((s) => s.memberId === member.id);
    const plan = buildPersonPlan({ categories: categoryList, lines, spending });
    const income = incomes.filter((i) => i.memberId === member.id).reduce((sum, i) => sum + Number(i.amount), 0);

    // Savings comes from the pots' monthly plans: this person's share of each.
    const pots = potRows.flatMap((pot) => {
      const planned = planRows.filter((p) => p.potId === pot.id && p.memberId === member.id).reduce((sum, p) => sum + Number(p.monthlyAmount), 0);
      const putIn = depositRows
        .filter((d) => d.potId === pot.id && d.kind === "deposit" && d.memberId === member.id && d.date >= period.startDate && d.date <= period.endDate)
        .reduce((sum, d) => sum + Number(d.amount), 0);
      return planned > 0 || putIn > 0 ? [{ id: pot.id, name: pot.name, planned, putIn }] : [];
    });
    const plannedSavings = pots.reduce((sum, pot) => sum + pot.planned, 0);
    const unplanned = income - plan.budgeted - plannedSavings;
    const carried = lines.find((l) => l.inherited);

    return {
      carriedFrom: carried ? formatPeriodLabel(carried.year, carried.month, dateFormat) : null,
      key: member.id === memberId ? ("me" as const) : ("partner" as const),
      lastKinds: lastKindByCategory(datedLines, member.id),
      lead: buildBudgetLead({
        allSpent: plan.totalSpent,
        budgeted: plan.budgeted,
        income,
        outside: plan.unbudgetedTotal,
        overBudget: overBudgetRows(plan),
      }),
      ledger: {
        budgeted: plan.budgeted,
        budgetedRatio: income > 0 ? plan.budgeted / income : 0,
        budgetedSub: `${percent(plan.budgeted, income)}% of Rs ${formatMoney(income, { currency: false })} income`,
        outside: plan.unbudgetedTotal,
        outsideSub: `${percent(plan.unbudgetedTotal, plan.totalSpent)}% of all spending`,
        spentIn: plan.spentInLines,
        spentInSub: plan.budgeted > 0 ? `${percent(plan.spentInLines, plan.budgeted)}% of what's budgeted` : "Nothing budgeted yet",
        unplanned,
        unplannedSub:
          unplanned < 0
            ? "The plan is bigger than income"
            : plannedSavings > 0
              ? `${percent(unplanned, income)}% of income, after ${formatMoney(plannedSavings)} planned savings`
              : `${percent(unplanned, income)}% of income`,
      },
      memberId: member.id,
      name: member.user.name,
      plan,
      savings: { planned: plannedSavings, pots, putIn: pots.reduce((sum, pot) => sum + pot.putIn, 0) },
      spentByCategory: Object.fromEntries(
        [...new Set(spending.map((s) => s.categoryId))].map((id) => [id, spending.filter((s) => s.categoryId === id).reduce((sum, s) => sum + s.amount, 0)]),
      ),
    };
  });

  return (
    <BudgetView
      categories={categoryList}
      currentMemberId={memberId}
      incomes={Object.fromEntries(memberIds.map((id) => [id, incomes.filter((i) => i.memberId === id).reduce((sum, i) => sum + Number(i.amount), 0)]))}
      members={members.map((m) => ({ id: m.id, name: m.user.name }))}
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
