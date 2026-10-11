export type RecurringBill = {
  amount: number;
  categoryId: string;
  frequency: "monthly" | "quarterly" | "yearly";
  nextDueDate: string;
  ownerMemberId: null | string;
  status: "active" | "completed" | "paused";
};

export type RecurringBudgetLine = { categoryId: string; ownerMemberId: null | string; plannedAmount: number };

// Budget lines for a month from the recurring bills due in it: every active
// monthly bill, plus quarterly or yearly ones whose next due date falls in the
// month. Bills that share a category and owner are added together.
export function recurringBudgetLines(bills: RecurringBill[], period: { endDate: string; startDate: string }): RecurringBudgetLine[] {
  const lines = new Map<string, RecurringBudgetLine>();
  for (const bill of bills) {
    if (bill.status !== "active") continue;
    const dueThisMonth = bill.frequency === "monthly" || (bill.nextDueDate >= period.startDate && bill.nextDueDate <= period.endDate);
    if (!dueThisMonth) continue;
    const key = `${bill.categoryId}::${bill.ownerMemberId ?? "shared"}`;
    const line = lines.get(key) ?? { categoryId: bill.categoryId, ownerMemberId: bill.ownerMemberId, plannedAmount: 0 };
    line.plannedAmount += bill.amount;
    lines.set(key, line);
  }
  return [...lines.values()];
}
