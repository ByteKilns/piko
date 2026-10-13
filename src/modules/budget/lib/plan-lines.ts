export type BudgetLineKind = "can_cut" | "essential" | "fixed";

export const LINE_KINDS: { label: string; value: BudgetLineKind }[] = [
  { label: "Fixed", value: "fixed" },
  { label: "Essential", value: "essential" },
  { label: "Can cut", value: "can_cut" },
];

// A line's own kind, or the one its category suggests when none was chosen.
export function kindOf(kind: BudgetLineKind | null, categoryBudgetType: "fixed" | "flexible" | undefined): BudgetLineKind {
  if (kind !== null) return kind;
  return categoryBudgetType === "fixed" ? "fixed" : "essential";
}

// A budget line with the month it was set in.
export type DatedLine = {
  categoryId: string;
  id: string;
  kind: BudgetLineKind | null;
  month: number;
  ownerMemberId: null | string;
  plannedAmount: number;
  year: number;
};

// inherited = carried over from an earlier month, not set in this one.
export type PlanLine = DatedLine & { inherited: boolean };

const monthOrder = (year: number, month: number) => year * 12 + month;

// The lines that make up a month's plan. Each person's plan is their own lines
// in that month. A month where they have none carries over their lines from
// the latest earlier month that has some (leaving out archived categories),
// so a plan only needs entering once. Shared lines (no owner) are from before
// per-person plans and never carry over.
export function planLinesForMonth(
  lines: DatedLine[],
  target: { month: number; year: number },
  archivedCategoryIds: ReadonlySet<string>,
): PlanLine[] {
  const targetOrder = monthOrder(target.year, target.month);
  const plan: PlanLine[] = lines
    .filter((l) => l.ownerMemberId === null && monthOrder(l.year, l.month) === targetOrder)
    .map((l) => ({ ...l, inherited: false }));

  const owners = new Set(lines.flatMap((l) => (l.ownerMemberId === null ? [] : [l.ownerMemberId])));
  for (const owner of owners) {
    const own = lines.filter((l) => l.ownerMemberId === owner && monthOrder(l.year, l.month) <= targetOrder);
    if (own.length === 0) continue;
    const latest = Math.max(...own.map((l) => monthOrder(l.year, l.month)));
    const inherited = latest !== targetOrder;
    for (const l of own) {
      if (monthOrder(l.year, l.month) !== latest) continue;
      if (inherited && archivedCategoryIds.has(l.categoryId)) continue;
      plan.push({ ...l, inherited });
    }
  }
  return plan;
}

// The kind a person last chose for each category, so a new line for that
// category starts the same way.
export function lastKindByCategory(lines: DatedLine[], ownerMemberId: string): Record<string, BudgetLineKind> {
  const chosen = lines
    .flatMap((l) => (l.ownerMemberId === ownerMemberId && l.kind !== null ? [{ ...l, kind: l.kind }] : []))
    .sort((a, b) => monthOrder(a.year, a.month) - monthOrder(b.year, b.month));
  const result: Record<string, BudgetLineKind> = {};
  for (const l of chosen) result[l.categoryId] = l.kind;
  return result;
}
