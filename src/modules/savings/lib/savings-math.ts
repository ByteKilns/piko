export type DepositRow = { amount: number; date: string; kind: "deposit" | "interest" | "opening"; memberId: null | string; potId: string };
export type SavingsSpend = { amount: number; savingsPotId: string };

// Everything that went in (opening balance, deposits, bank interest), less the
// expenses paid from the pot.
export function potBalance(potId: string, deposits: DepositRow[], spends: SavingsSpend[]): number {
  const moneyIn = deposits.filter((d) => d.potId === potId).reduce((sum, d) => sum + d.amount, 0);
  const moneyOut = spends.filter((s) => s.savingsPotId === potId).reduce((sum, s) => sum + s.amount, 0);
  return Math.round((moneyIn - moneyOut) * 100) / 100;
}

// What people actually put in between two dates (inclusive). Only real
// deposits count, not the opening balance or bank interest.
export function putInBetween(potId: string, deposits: DepositRow[], startDate: string, endDate: string): number {
  return deposits
    .filter((d) => d.potId === potId && d.kind === "deposit" && d.date >= startDate && d.date <= endDate)
    .reduce((sum, d) => sum + d.amount, 0);
}
