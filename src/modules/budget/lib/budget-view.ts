import { formatMoney } from "@/lib/money";

import { type BudgetLineKind, kindOf, LINE_KINDS } from "./plan-lines";

// Pure view logic for the Budget page: one person's plan (their lines grouped
// by kind, plus spending outside any line), the headline figures and the
// lead sentence.

export type PlanRow = {
  categoryId: string;
  categoryName: string;
  inherited: boolean;
  kind: BudgetLineKind;
  planned: number;
  spent: number;
};

export type KindGroup = { kind: BudgetLineKind; label: string; planned: number; rows: PlanRow[]; spent: number };

export type UnbudgetedRow = { categoryId: string; categoryName: string; spent: number };

export type PersonPlan = {
  budgeted: number;
  groups: KindGroup[];
  spentInLines: number;
  totalSpent: number;
  unbudgeted: UnbudgetedRow[];
  unbudgetedTotal: number;
};

type CategoryInput = { budgetType: "fixed" | "flexible"; id: string; name: string };
type LineInput = { categoryId: string; inherited: boolean; kind: BudgetLineKind | null; plannedAmount: number };
type SpendInput = { amount: number; categoryId: string };

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

// `lines` and `spending` are one person's: their plan lines, and the part of
// each expense that came out of their own wallet.
export function buildPersonPlan(input: { categories: CategoryInput[]; lines: LineInput[]; spending: SpendInput[] }): PersonPlan {
  const categoryById = new Map(input.categories.map((c) => [c.id, c]));
  const spentByCategory = new Map<string, number>();
  for (const s of input.spending) spentByCategory.set(s.categoryId, (spentByCategory.get(s.categoryId) ?? 0) + s.amount);

  const rows: PlanRow[] = input.lines.flatMap((line) => {
    const category = categoryById.get(line.categoryId);
    if (!category || line.plannedAmount <= 0) return [];
    return [
      {
        categoryId: line.categoryId,
        categoryName: category.name,
        inherited: line.inherited,
        kind: kindOf(line.kind, category.budgetType),
        planned: line.plannedAmount,
        spent: spentByCategory.get(line.categoryId) ?? 0,
      },
    ];
  });

  const groups = LINE_KINDS.flatMap(({ label, value }) => {
    const kindRows = rows.filter((r) => r.kind === value).sort((a, b) => b.spent / b.planned - a.spent / a.planned);
    if (kindRows.length === 0) return [];
    return [{ kind: value, label, planned: sum(kindRows.map((r) => r.planned)), rows: kindRows, spent: sum(kindRows.map((r) => r.spent)) }];
  });

  const planned = new Set(rows.map((r) => r.categoryId));
  const unbudgeted = [...spentByCategory]
    .filter(([categoryId, spent]) => !planned.has(categoryId) && spent > 0)
    .map(([categoryId, spent]) => ({ categoryId, categoryName: categoryById.get(categoryId)?.name ?? "Unknown", spent }))
    .sort((a, b) => b.spent - a.spent);

  const spentInLines = sum(rows.map((r) => r.spent));
  const unbudgetedTotal = sum(unbudgeted.map((r) => r.spent));
  return {
    budgeted: sum(rows.map((r) => r.planned)),
    groups,
    spentInLines,
    totalSpent: spentInLines + unbudgetedTotal,
    unbudgeted,
    unbudgetedTotal,
  };
}

// Lines set for both people before plans were per person. Spending now counts
// against whoever paid, so these only show what was planned.
export type SharedRow = { categoryId: string; categoryName: string; planned: number };

export function sharedRows(lines: { categoryId: string; ownerMemberId: null | string; plannedAmount: number }[], categories: CategoryInput[]): SharedRow[] {
  return lines.flatMap((line) => {
    const category = categories.find((c) => c.id === line.categoryId);
    if (line.ownerMemberId !== null || !category || line.plannedAmount <= 0) return [];
    return [{ categoryId: line.categoryId, categoryName: category.name, planned: line.plannedAmount }];
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

export function overBudgetRows(plan: PersonPlan): { categoryName: string; over: number }[] {
  return plan.groups
    .flatMap((group) => group.rows)
    .filter((row) => row.spent > row.planned)
    .map((row) => ({ categoryName: row.categoryName, over: row.spent - row.planned }));
}

// What went over plan outside the can-cut lines: another line spent past its
// amount (categoryName set), or spending in categories with no line at all
// (categoryName null). It comes out of the can-cut money that's left.
export type Overrun = { sources: { categoryName: null | string; over: number }[]; total: number };

export function overrunFromPlan(plan: PersonPlan): Overrun {
  const sources: Overrun["sources"] = plan.groups
    .filter((group) => group.kind !== "can_cut")
    .flatMap((group) => group.rows)
    .filter((row) => row.spent > row.planned)
    .map((row) => ({ categoryName: row.categoryName, over: row.spent - row.planned }));
  if (plan.unbudgetedTotal > 0) sources.push({ categoryName: null, over: plan.unbudgetedTotal });
  return { sources, total: sum(sources.map((s) => s.over)) };
}

// "Petrol went Rs 1,000.00 over and Rs 500.00 went outside a budget, taken
// from your spending money."
export function overrunNote(overrun: Overrun): null | string {
  if (overrun.total <= 0) return null;
  const parts = overrun.sources.map((s) =>
    s.categoryName === null ? `${formatMoney(s.over)} went outside a budget` : `${s.categoryName} went ${formatMoney(s.over)} over`,
  );
  const joined = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `${joined}, taken from your spending money.`;
}
