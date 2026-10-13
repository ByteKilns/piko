// Money that left each person's own wallet. Spending counts against whoever
// paid it, not who it was for: the two members keep separate money, and
// paying for each other is generosity, not debt. The exception is an expense
// ticked "to be paid back": that part counts against the other person, since
// they're the one who'll end up paying for it.
export type WalletExpense = { amount: number; paidByMemberId: string; payBackAmount: null | number };

export type WalletShare = { amount: number; memberId: string };

// How one expense splits between wallets: the payer's part, and the other
// person's part when some of it is to be paid back.
export function walletShares(expense: WalletExpense, memberIds: string[]): WalletShare[] {
  const payer = expense.paidByMemberId;
  const other = memberIds.length === 2 ? memberIds.find((id) => id !== payer) : undefined;
  const repay = other && expense.payBackAmount ? Math.min(expense.payBackAmount, expense.amount) : 0;
  const shares = [{ amount: expense.amount - repay, memberId: payer }];
  if (other && repay > 0) shares.push({ amount: repay, memberId: other });
  return shares;
}

export function walletSpentByMember(expenses: WalletExpense[], memberIds: string[]): Map<string, number> {
  const totals = new Map(memberIds.map((id) => [id, 0]));
  for (const expense of expenses) {
    for (const share of walletShares(expense, memberIds)) {
      totals.set(share.memberId, (totals.get(share.memberId) ?? 0) + share.amount);
    }
  }
  return totals;
}
