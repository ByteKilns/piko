import { getDateFormatPref } from "@/lib/date-format-cookie";
import { currentPeriodYearMonth, daysElapsedInPeriod, resolvePeriod } from "@/lib/month-period";
import { getHouseholdMembers } from "@/lib/session";
import { listPlanLines } from "@/modules/budget/api/budget";
import { buildPersonPlan } from "@/modules/budget/lib/budget-view";
import { listCategories } from "@/modules/categories/api/categories";
import { listHouseholdExpensesForMonth } from "@/modules/expenses/api/expenses-by-month";

import { type HomePacing, viewerPacing } from "../lib/home-pacing";
import { personSpending } from "../lib/month-money";

// One person's Safe to spend today, for the phone's Home: this month in the
// household's calendar, worked out exactly as the website's Home does.
export async function loadViewerPacing(householdId: string, memberId: string): Promise<HomePacing | null> {
  const dateFormat = await getDateFormatPref(householdId);
  const { month, year } = currentPeriodYearMonth(dateFormat);
  const period = resolvePeriod(year, month, dateFormat);
  const [members, categories, planLines, expenses] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    listPlanLines(householdId, year, month),
    listHouseholdExpensesForMonth(householdId, year, month, dateFormat),
  ]);

  const spending = personSpending({ expenses, memberId, memberIds: members.map((m) => m.id) });
  const plan = buildPersonPlan({
    categories: categories.map((c) => ({ budgetType: c.budgetType, id: c.id, name: c.name })),
    lines: planLines.filter((l) => l.ownerMemberId === memberId),
    spending,
  });
  return viewerPacing({ dateFormat, dayOfPeriod: daysElapsedInPeriod(period), month, period, plan, spending, year });
}
