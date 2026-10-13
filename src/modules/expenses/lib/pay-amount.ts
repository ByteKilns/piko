type PaidFrom = { amount: number | string; fundAmount: null | number | string; savingsPotId: null | string };

// The part of an expense paid from this month's pay: nothing when it was paid
// from savings, and what's left after a fund's share when paid from a fund.
// Only this part is Spent.
export function payAmount(expense: PaidFrom): number {
  if (expense.savingsPotId !== null) return 0;
  return Number(expense.amount) - Number(expense.fundAmount ?? 0);
}

// Expense rows cut down to the part paid from pay, dropping rows paid wholly
// from savings or a fund. Each row keeps its shape, with `amount` replaced,
// so a page's sums read `amount` as before.
export function payRows<T extends { amount: string; fundAmount: null | string; savingsPotId: null | string }>(rows: T[]): T[] {
  return rows.flatMap((row) => {
    const amount = payAmount(row);
    return amount > 0 ? [{ ...row, amount: String(amount) }] : [];
  });
}
