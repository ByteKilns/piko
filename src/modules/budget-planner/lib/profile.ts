import type { DateFormat } from "@/lib/date-format-cookie";
import { isDefaultCategory } from "@/modules/categories/lib/default-categories";

import type { FixedFloor } from "./fixed-floor";
import {
  incomeAnchor,
  type IncomeAnchor,
  incomeVariability,
  type IncomeVariability,
  savingsTarget,
  type SavingsTarget,
} from "./income-anchor";
import { periodBounds, type PeriodRef } from "./periods";
import { lowerMedian, roundTo, shareOf } from "./stats";

export type ProfileCategoryRow = {
  archived: boolean;
  budgetType: "fixed" | "flexible";
  groupName: string;
  id: string;
  name: string;
};

export type ProfileExpenseRow = {
  amount: string;
  categoryId: string;
  date: string;
  ownerMemberId: null | string;
};

export type ProfileIncomeRow = { amount: string; month: number; year: number };

export type CategoryProfile = {
  budgetType: "fixed" | "flexible";
  categoryId: string;
  groupName: string;
  // The real name only for canonical defaults; null for user-created
  // categories, whose names might contain personal details. Resolved here so
  // custom names never reach the masker at all.
  label: null | string;
  medianSpend: number;
  ownerSplit: { ownerMemberId: null | string; share: number }[];
  spendByPeriod: number[];
};

export type FinancialProfile = {
  categories: CategoryProfile[];
  dateFormat: DateFormat;
  envelope: { fixed: number; flexible: number; income: number; savings: number };
  fixedFloor: FixedFloor;
  incomeAnchor: IncomeAnchor;
  incomeByPeriod: number[];
  incomeVariability: IncomeVariability;
  periods: PeriodRef[];
  planningPeriod: PeriodRef;
  savingsTarget: SavingsTarget;
  spendByPeriod: number[];
};

export type ProfileInput = {
  categories: ProfileCategoryRow[];
  dateFormat: DateFormat;
  expenses: ProfileExpenseRow[];
  fixedFloor: FixedFloor;
  incomes: ProfileIncomeRow[];
  overrideIncome?: number;
  periods: PeriodRef[];
  planningPeriod: PeriodRef;
};

function sumInPeriod(
  rows: ProfileExpenseRow[],
  bounds: { endDate: string; startDate: string },
): number {
  return rows.filter((r) => r.date >= bounds.startDate && r.date <= bounds.endDate).reduce((s, r) => s + Number(r.amount), 0);
}

export function buildProfile(input: ProfileInput): FinancialProfile {
  const { categories, dateFormat, expenses, fixedFloor, incomes, periods, planningPeriod } = input;
  const bounds = periods.map((p) => periodBounds(p, dateFormat));

  const spendByPeriod = bounds.map((b) => sumInPeriod(expenses, b));

  const incomeByPeriod = periods.map((p) =>
    incomes.filter((i) => i.year === p.year && i.month === p.month).reduce((s, i) => s + Number(i.amount), 0),
  );

  const categoryProfiles: CategoryProfile[] = categories.map((category) => {
    const categoryExpenses = expenses.filter((e) => e.categoryId === category.id);
    const categorySpendByPeriod = bounds.map((b) => sumInPeriod(categoryExpenses, b));
    const totalSpend = categorySpendByPeriod.reduce((s, v) => s + v, 0);

    const ownerTotals = new Map<null | string, number>();
    for (const e of categoryExpenses) {
      ownerTotals.set(e.ownerMemberId, (ownerTotals.get(e.ownerMemberId) ?? 0) + Number(e.amount));
    }

    return {
      budgetType: category.budgetType,
      categoryId: category.id,
      groupName: category.groupName,
      label: isDefaultCategory(category.name, category.groupName) ? category.name : null,
      medianSpend: roundTo(lowerMedian(categorySpendByPeriod), 0),
      ownerSplit: [...ownerTotals.entries()]
        .map(([ownerMemberId, amount]) => ({ ownerMemberId, share: roundTo(shareOf(amount, totalSpend), 3) }))
        .sort((a, b) => String(a.ownerMemberId).localeCompare(String(b.ownerMemberId))),
      spendByPeriod: categorySpendByPeriod,
    };
  });

  const anchor = incomeAnchor(incomeByPeriod, input.overrideIncome);
  const variability = incomeVariability(incomeByPeriod);
  const savings = savingsTarget(
    periods.map((_, i) => ({ income: incomeByPeriod[i], spend: spendByPeriod[i] })),
    anchor.amount,
  );

  const fixed = fixedFloor.total;
  const flexible = Math.max(0, anchor.amount - fixed - savings.amount);

  return {
    categories: categoryProfiles,
    dateFormat,
    envelope: { fixed, flexible, income: anchor.amount, savings: savings.amount },
    fixedFloor,
    incomeAnchor: anchor,
    incomeByPeriod,
    incomeVariability: variability,
    periods,
    planningPeriod,
    savingsTarget: savings,
    spendByPeriod,
  };
}
