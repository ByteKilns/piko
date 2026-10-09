import { formatShortDate } from "@/lib/date-format";
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { buildMonthNav, parseMonthParam, previousMonth } from "@/lib/month-nav";
import {
  currentPeriodYearMonth,
  dayNumberInPeriod,
  MAX_NAVIGABLE_YEAR,
  MIN_NAVIGABLE_YEAR,
  resolvePeriod,
} from "@/lib/month-period";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { getBudgetItemsForMonth } from "@/modules/budget/api/budget.actions";
import { listCategories } from "@/modules/categories/api/categories";
import { listExpensesForRange } from "@/modules/expenses/api/expenses.actions";
import { listSavingsContributions, listSavingsGoals } from "@/modules/savings-goals/api/savings-goals.actions";
import { type ContributionModel, type GoalRowModel, SavingsGoalsView } from "@/modules/savings-goals/components/SavingsGoalsView";
import { buildGoalCards, savingsOverviewStats } from "@/modules/savings-goals/lib/savings-stats";
import { suggestedEmergencyTarget } from "@/modules/savings-goals/lib/savings-view";

type Props = { searchParams: Promise<{ month?: string; year?: string }> };

export async function SavingsGoalsPage({ searchParams }: Props) {
  const { householdId, memberId } = await getCurrentMember();
  const dateFormat = await getDateFormatPref(householdId);
  const params = await searchParams;
  const current = currentPeriodYearMonth(dateFormat);
  const year = parseMonthParam(params.year, current.year, MAX_NAVIGABLE_YEAR[dateFormat], MIN_NAVIGABLE_YEAR[dateFormat]);
  const month = parseMonthParam(params.month, current.month, 12);

  const p1 = previousMonth(year, month);
  const p2 = previousMonth(p1.year, p1.month);
  const p3 = previousMonth(p2.year, p2.month);

  const [members, categories, goalRows, contributionRows, budgetItems, prevExpenses] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    listSavingsGoals(householdId),
    listSavingsContributions(householdId),
    getBudgetItemsForMonth(year, month),
    listExpensesForRange(resolvePeriod(p3.year, p3.month, dateFormat).startDate, resolvePeriod(p1.year, p1.month, dateFormat).endDate),
  ]);

  const memberById = new Map(members.map((m) => [m.id, m]));
  const contributions = contributionRows.map((c) => ({ amount: Number(c.amount), date: c.date, goalId: c.goalId }));
  const { goals } = buildGoalCards(goalRows, contributions, memberById);

  const stats = savingsOverviewStats(
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

  const target = goalRows.reduce((sum, g) => sum + (g.targetAmount === null ? 0 : Number(g.targetAmount)), 0);
  const monthContributionCount = contributionRows.filter((c) => dayNumberInPeriod(c.date, year, month, dateFormat) !== null).length;

  const roleFor = (ownerMemberId: null | string): "me" | "partner" | "shared" =>
    ownerMemberId === null ? "shared" : ownerMemberId === memberId ? "me" : "partner";

  const goalModels: GoalRowModel[] = goals.map((goal) => ({
    by: goal.targetAmount === null ? "Ongoing" : goal.targetDate ? formatShortDate(goal.targetDate, dateFormat) : "No date",
    editing: {
      description: goal.description,
      id: goal.id,
      image: goal.image,
      name: goal.name,
      ownerKey: roleFor(goal.ownerMemberId),
      targetAmount: goal.targetAmount,
      targetDate: goal.targetDate,
    },
    id: goal.id,
    name: goal.name,
    ownerKey: roleFor(goal.ownerMemberId),
    pct: goal.pct,
    saved: goal.saved,
    target: goal.targetAmount,
  }));

  const contributionModels: ContributionModel[] = contributionRows.map((c) => ({
    amount: Number(c.amount),
    date: formatShortDate(c.date, dateFormat),
    goalName: goalRows.find((g) => g.id === c.goalId)?.name ?? "Unknown goal",
    id: c.id,
  }));

  const monthlySpends = [p3, p2, p1].map((p) =>
    prevExpenses.filter((e) => dayNumberInPeriod(e.date, p.year, p.month, dateFormat) !== null).reduce((sum, e) => sum + Number(e.amount), 0),
  );
  const emergencyTarget = suggestedEmergencyTarget(monthlySpends);

  const savingsBudgetAmount = budgetItems
    .filter((b) => categories.find((c) => c.id === b.categoryId)?.name === "Savings")
    .reduce((sum, b) => sum + Number(b.plannedAmount), 0);

  return (
    <SavingsGoalsView
      contributions={contributionModels}
      currentMemberId={memberId}
      emergencyTarget={emergencyTarget}
      goals={goalModels}
      ledger={{
        avg: goals.length ? `${stats.averageProgress}%` : "—",
        avgSub: goals.length ? "Toward each target" : "Shows once a goal exists",
        count: String(goals.length),
        countSub: goals.length ? "All active" : "Create your first below",
        month: stats.monthlyContribution,
        monthSub: monthContributionCount > 0 ? `${monthContributionCount} ${monthContributionCount === 1 ? "contribution" : "contributions"}` : "Nothing added yet",
        saved: stats.totalSaved,
        savedSub: goals.length ? `of Rs ${Math.round(target).toLocaleString("en-US")} across ${goals.length} ${goals.length === 1 ? "goal" : "goals"}` : "No goals yet",
        savedW: target > 0 ? Math.min(100, (stats.totalSaved / target) * 100) : 0,
      }}
      members={members.map((m) => ({ id: m.id, name: m.user.name }))}
      monthNav={buildMonthNav({
        basePath: "/savings-goals",
        current,
        dateFormat,
        selected: { month, year },
      })}
      savingsBudgetAmount={savingsBudgetAmount > 0 ? savingsBudgetAmount : null}
    />
  );
}
