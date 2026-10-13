// Pure row-shaping helper: reshapes raw expense rows (with numeric-as-string
// amounts) into plain numbers for the dashboard page.

export function toExpenseInputs(
  rows: { amount: string; categoryId: string; ownerMemberId: string | null; }[],
) {
  return rows.map((e) => ({
    categoryId: e.categoryId,
    ownerMemberId: e.ownerMemberId,
    amount: Number(e.amount),
  }));
}
