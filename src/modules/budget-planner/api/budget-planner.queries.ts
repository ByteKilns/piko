import { getDateFormatPref } from "@/lib/date-format-cookie";
import { currentPeriodYearMonth } from "@/lib/month-period";
import { listAllIncomes } from "@/modules/budget/api/budget.actions";
import { listCategories } from "@/modules/categories/api/categories";
import { listDhukuEntries, listDhukus } from "@/modules/dhuku/api/dhuku.actions";
import { listExpensesForRange } from "@/modules/expenses/api/expenses.actions";
import { listLoans } from "@/modules/loans/api/loans.actions";
import { listRecurringExpenses } from "@/modules/recurring/api/recurring.actions";

import { fixedFloor } from "../lib/fixed-floor";
import { buildMaskedContext } from "../lib/mask-financial-context";
import { periodBounds, recentCompletedPeriods } from "../lib/periods";
import { buildProfile, type FinancialProfile } from "../lib/profile";
import type { MaskedFinancialContext } from "../schemas/masked-context.schema";

// Completed months of history the plan is inferred from. Two recorded months
// is the floor for a meaningful median; three keeps it honest without reaching
// back so far that old habits dominate.
export const HISTORY_MONTHS = 3;

export type PlannerPreview =
  | { ok: false; reason: "no_history" | "no_income" }
  | {
      categoryNameById: Map<string, string>;
      masked: MaskedFinancialContext;
      ok: true;
      profile: FinancialProfile;
    };

// Loads the household's rows and derives both the local profile (real amounts,
// for the envelope display) and the masked payload (shares, for the AI). The
// two never mix: only `masked` may leave the app.
export async function buildPlannerPreview(householdId: string): Promise<PlannerPreview> {
  const dateFormat = await getDateFormatPref(householdId);
  const planningPeriod = currentPeriodYearMonth(dateFormat);
  const periods = recentCompletedPeriods(planningPeriod, HISTORY_MONTHS);
  const bounds = periods.map((p) => periodBounds(p, dateFormat));
  const startDate = bounds[0].startDate;
  const endDate = bounds[bounds.length - 1].endDate;

  const [categories, expenses, incomes, recurring, loans, dhukus, dhukuEntries] = await Promise.all([
    listCategories(householdId, { includeArchived: true }),
    listExpensesForRange(startDate, endDate),
    listAllIncomes(),
    listRecurringExpenses(householdId),
    listLoans(householdId),
    listDhukus(householdId),
    listDhukuEntries(householdId),
  ]);

  const profile = buildProfile({
    categories,
    dateFormat,
    expenses,
    fixedFloor: fixedFloor(planningPeriod, dateFormat, { dhukuEntries, dhukus, loans, recurring }),
    incomes,
    periods,
    planningPeriod,
  });

  if (profile.incomeAnchor.amount <= 0) return { ok: false, reason: "no_income" };
  if (profile.spendByPeriod.every((s) => s === 0)) return { ok: false, reason: "no_history" };

  // Real names for local display only — never part of the masked payload.
  return {
    categoryNameById: new Map(categories.map((c) => [c.id, c.name])),
    masked: buildMaskedContext(profile),
    ok: true,
    profile,
  };
}
