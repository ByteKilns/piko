import { formatMoney } from "@/lib/money";
import type { MemberRole } from "@/modules/expenses/lib/member-tone";

// Pure view logic for the Budget page: the per-owner groups (budgeted rows +
// "without a budget" spend), the headline figures, and the lead sentence.

export type BudgetViewRow = {
  budgetType: "fixed" | "flexible";
  categoryId: string;
  categoryName: string;
  planned: number;
  spent: number;
};

export type UnbudgetedRow = { categoryId: string; categoryName: string; spent: number };

export type BudgetOwnerGroup = {
  budgeted: number;
  key: MemberRole;
  name: string;
  rows: BudgetViewRow[];
  spent: number;
  totalSpent: number;
  unbudgeted: UnbudgetedRow[];
  unbudgetedTotal: number;
};

type ItemInput = { categoryId: string; ownerMemberId: null | string; plannedAmount: number | string };
type ExpenseInput = { amount: number | string; categoryId: string; ownerMemberId: null | string };
type CategoryInput = { budgetType: "fixed" | "flexible"; id: string; name: string };

function merged(
  budgetItems: ItemInput[],
  expenses: ExpenseInput[],
): Map<string, { planned: number; spent: number }> {
  const map = new Map<string, { planned: number; spent: number }>();
  const key = (categoryId: string, ownerMemberId: null | string) => `${categoryId}::${ownerMemberId ?? "shared"}`;
  const at = (k: string) => {
    const existing = map.get(k);
    if (existing) return existing;
    const created = { planned: 0, spent: 0 };
    map.set(k, created);
    return created;
  };

  for (const item of budgetItems) at(key(item.categoryId, item.ownerMemberId)).planned += Number(item.plannedAmount);
  for (const expense of expenses) at(key(expense.categoryId, expense.ownerMemberId)).spent += Number(expense.amount);
  return map;
}

export function buildBudgetGroups(input: {
  budgetItems: ItemInput[];
  categories: CategoryInput[];
  expenses: ExpenseInput[];
  meId: string;
  partnerId: null | string;
  partnerName: null | string;
}): BudgetOwnerGroup[] {
  const { budgetItems, categories, expenses, meId, partnerId, partnerName } = input;
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const combined = merged(budgetItems, expenses);

  const buckets: Record<MemberRole, BudgetViewRow[]> = { me: [], partner: [], shared: [] };
  const unbuckets: Record<MemberRole, UnbudgetedRow[]> = { me: [], partner: [], shared: [] };

  for (const [composite, totals] of combined) {
    const [categoryId, ownerKey] = composite.split("::");
    const category = categoryById.get(categoryId);
    if (!category) continue;
    const role = ownerKey === "shared" ? "shared" : ownerKey === meId ? "me" : "partner";
    if (totals.planned > 0) {
      buckets[role].push({
        budgetType: category.budgetType,
        categoryId,
        categoryName: category.name,
        planned: totals.planned,
        spent: totals.spent,
      });
    } else if (totals.spent > 0) {
      unbuckets[role].push({ categoryId, categoryName: category.name, spent: totals.spent });
    }
  }

  const base: { key: MemberRole; name: string }[] = [
    { key: "me", name: "Me" },
    ...(partnerId ? [{ key: "partner" as const, name: partnerName ?? "Partner" }] : []),
    { key: "shared", name: "Shared" },
  ];

  return base.map(({ key, name }) => {
    const rows = [...buckets[key]].sort((a, b) => b.spent / b.planned - a.spent / a.planned);
    const unbudgeted = [...unbuckets[key]].sort((a, b) => b.spent - a.spent);
    const spent = rows.reduce((sum, row) => sum + row.spent, 0);
    const unbudgetedTotal = unbudgeted.reduce((sum, row) => sum + row.spent, 0);
    return {
      budgeted: rows.reduce((sum, row) => sum + row.planned, 0),
      key,
      name,
      rows,
      spent,
      totalSpent: spent + unbudgetedTotal,
      unbudgeted,
      unbudgetedTotal,
    };
  });
}

export type BudgetLead = { outside: string; planned: string; rest: string; strong: string };

function share(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export function buildBudgetLead(input: {
  allSpent: number;
  budgeted: number;
  income: number;
  outside: number;
  overBudget: { categoryName: string; over: number }[];
}): BudgetLead {
  const { allSpent, budgeted, income, outside, overBudget } = input;

  let strong = "";
  let rest = "";
  if (overBudget.length === 1) {
    strong = overBudget[0].categoryName;
    rest = ` is Rs ${formatMoney(overBudget[0].over, { currency: false })} over.`;
  } else if (overBudget.length > 1) {
    strong = `${overBudget.length} categories`;
    rest = " are over budget.";
  } else {
    rest = "Every budget is within plan.";
  }

  return { outside: `${share(outside, allSpent)}%`, planned: `${share(budgeted, income)}%`, rest, strong };
}

export function overBudgetRows(groups: BudgetOwnerGroup[]): { categoryName: string; over: number }[] {
  return groups
    .flatMap((group) => group.rows)
    .filter((row) => row.spent > row.planned)
    .map((row) => ({ categoryName: row.categoryName, over: row.spent - row.planned }));
}
