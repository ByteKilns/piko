export type PayBackExpense = { amount: number; paidByMemberId: string; payBackAmount: number };
export type Payback = { amount: number; fromMemberId: string; toMemberId: string };
export type PaybackBalance = { amount: number; creditorId: string; debtorId: string };

// One running balance between the two members, like a shop's credit book:
// expenses ticked "to be paid back" add to it, paybacks of any amount take it
// down, and amounts owed in both directions cancel out. null = square.
export function paybackBalance(expenses: PayBackExpense[], paybacks: Payback[], [a, b]: [string, string]): null | PaybackBalance {
  let aOwesB = 0;
  for (const expense of expenses) {
    const owed = Math.min(expense.payBackAmount, expense.amount);
    if (expense.paidByMemberId === b) aOwesB += owed;
    else if (expense.paidByMemberId === a) aOwesB -= owed;
  }
  for (const payback of paybacks) {
    if (payback.fromMemberId === a && payback.toMemberId === b) aOwesB -= payback.amount;
    else if (payback.fromMemberId === b && payback.toMemberId === a) aOwesB += payback.amount;
  }
  const rounded = Math.round(aOwesB * 100) / 100;
  if (rounded === 0) return null;
  return rounded > 0 ? { amount: rounded, creditorId: b, debtorId: a } : { amount: -rounded, creditorId: a, debtorId: b };
}
