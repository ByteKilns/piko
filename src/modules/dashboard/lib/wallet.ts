// Money that left each person's own wallet. Spending counts against whoever
// paid it, not who it was for: the two members keep separate money, and
// paying for each other is generosity, not debt. The exception is an expense
// ticked "to be paid back": that part counts against the other person, since
// they're the one who'll end up paying for it.
export type WalletExpense = { amount: number; paidByMemberId: string; payBackAmount: null | number };

export function walletSpentByMember(expenses: WalletExpense[], memberIds: string[]): Map<string, number> {
  const totals = new Map(memberIds.map((id) => [id, 0]));
  for (const expense of expenses) {
    const payer = expense.paidByMemberId;
    const other = memberIds.length === 2 ? memberIds.find((id) => id !== payer) : undefined;
    const repay = other && expense.payBackAmount ? Math.min(expense.payBackAmount, expense.amount) : 0;
    totals.set(payer, (totals.get(payer) ?? 0) + expense.amount - repay);
    if (other && repay > 0) totals.set(other, (totals.get(other) ?? 0) + repay);
  }
  return totals;
}
