import { getDateFormatPref } from "@/lib/date-format-cookie";
import { formatMoney } from "@/lib/money";
import { buildMonthNav, parseMonthParam, previousMonth } from "@/lib/month-nav";
import { currentPeriodYearMonth, formatPeriodLabel, MAX_NAVIGABLE_YEAR, MIN_NAVIGABLE_YEAR, resolvePeriod } from "@/lib/month-period";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { getBudgetItemsForMonth, getIncomesForMonth } from "@/modules/budget/api/budget.actions";
import { BudgetView } from "@/modules/budget/components/BudgetView";
import { buildBudgetGroups, buildBudgetLead, overBudgetRows } from "@/modules/budget/lib/budget-view";
import { listCategories } from "@/modules/categories/api/categories";
import { listExpensesForMonth } from "@/modules/expenses/api/expenses.actions";
import { checkBudgetReminder } from "@/modules/notifications/api/notifications.actions";
import { listSavingsDeposits, listSavingsPotPlans, listSavingsPots } from "@/modules/savings/api/savings.actions";
import { putInBetween } from "@/modules/savings/lib/savings-math";

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
  const prev = previousMonth(year, month);
  const isCurrentMonth = year === currentYear && month === currentMonth;
  const period = resolvePeriod(year, month, dateFormat);

  const [members, categories, incomes, budgetItems, expenseRows, prevBudgetItems, potRows, planRows, depositRows] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    getIncomesForMonth(year, month),
    getBudgetItemsForMonth(year, month),
    listExpensesForMonth(year, month, dateFormat),
    getBudgetItemsForMonth(prev.year, prev.month),
    listSavingsPots(householdId),
    listSavingsPotPlans(householdId),
    listSavingsDeposits(householdId),
  ]);

  if (isCurrentMonth) {
    await checkBudgetReminder(householdId, year, month, budgetItems.length);
  }

  // Expenses paid from savings were saved for in earlier months, so they don't
  // count against this month's budget.
  const payExpenseRows = expenseRows.filter((e) => e.savingsPotId === null);

  const memberList = members.map((m) => ({ id: m.id, name: m.user.name }));
  const partner = members.find((m) => m.id !== memberId) ?? null;
  const categoryList = categories.map((c) => ({ budgetType: c.budgetType, groupName: c.groupName, id: c.id, name: c.name }));

  const groups = buildBudgetGroups({
    budgetItems: budgetItems.map((b) => ({ categoryId: b.categoryId, ownerMemberId: b.ownerMemberId, plannedAmount: Number(b.plannedAmount) })),
    categories: categoryList,
    expenses: payExpenseRows.map((e) => ({ amount: Number(e.amount), categoryId: e.categoryId, ownerMemberId: e.ownerMemberId })),
    meId: memberId,
    partnerId: partner?.id ?? null,
    partnerName: partner?.user.name ?? null,
  });

  const income = incomes.reduce((sum, i) => sum + Number(i.amount), 0);
  const budgeted = groups.reduce((sum, g) => sum + g.budgeted, 0);
  const spentIn = groups.reduce((sum, g) => sum + g.spent, 0);
  const allSpent = payExpenseRows.reduce((sum, e) => sum + Number(e.amount), 0);
  const outside = allSpent - spentIn;

  const lead = buildBudgetLead({ allSpent, budgeted, income, outside, overBudget: overBudgetRows(groups) });

  const spentByKey: Record<string, number> = {};
  for (const e of payExpenseRows) {
    const ownerKey = e.ownerMemberId === null ? "shared" : e.ownerMemberId === memberId ? "me" : "partner";
    const key = `${e.categoryId}::${ownerKey}`;
    spentByKey[key] = (spentByKey[key] ?? 0) + Number(e.amount);
  }

  // Savings comes from the pots' monthly plans now, not from a budget category.
  const deposits = depositRows.map((d) => ({ amount: Number(d.amount), date: d.date, kind: d.kind, memberId: d.memberId, potId: d.potId }));
  const savingsPots = potRows.map((pot) => ({
    id: pot.id,
    name: pot.name,
    planned: planRows.filter((p) => p.potId === pot.id).reduce((sum, p) => sum + Number(p.monthlyAmount), 0),
    putIn: putInBetween(pot.id, deposits, period.startDate, period.endDate),
  }));
  const plannedSavings = savingsPots.reduce((sum, pot) => sum + pot.planned, 0);
  const unplanned = income - budgeted - plannedSavings;

  return (
    <BudgetView
      canCopy={prevBudgetItems.length > 0}
      categories={categoryList}
      currentMemberId={memberId}
      groups={groups}
      income={income}
      incomes={Object.fromEntries(incomes.map((i) => [i.memberId, Number(i.amount)]))}
      lead={lead}
      ledger={{
        budgeted,
        budgetedRatio: income > 0 ? budgeted / income : 0,
        budgetedSub: `${percent(budgeted, income)}% of Rs ${formatMoney(income, { currency: false })} income`,
        outside,
        outsideSub: `${percent(outside, allSpent)}% of all spending`,
        spentIn,
        spentInSub: budgeted > 0 ? `${percent(spentIn, budgeted)}% of what's budgeted` : "Nothing budgeted yet",
        unplanned,
        unplannedSub:
          plannedSavings > 0
            ? `${percent(unplanned, income)}% of income, after ${formatMoney(plannedSavings)} planned savings`
            : `${percent(unplanned, income)}% of income`,
      }}
      members={memberList}
      month={month}
      monthNav={buildMonthNav({
        allowFuture: true,
        basePath: "/budget",
        current: { month: currentMonth, year: currentYear },
        dateFormat,
        selected: { month, year },
      })}
      prevMonthName={formatPeriodLabel(prev.year, prev.month, dateFormat).split(" ")[0]}
      savings={{ planned: plannedSavings, pots: savingsPots, putIn: savingsPots.reduce((sum, pot) => sum + pot.putIn, 0) }}
      spentByKey={spentByKey}
      year={year}
    />
  );
}
