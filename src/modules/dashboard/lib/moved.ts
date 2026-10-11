export type MovedThisMonth = { dhuku: number; loans: number; savings: number; total: number };

// Money that left this month's pay for your own piles rather than being
// spent: savings deposits, dhuku payments, and repayments on loans you took.
// Dhuku payments count in full here because their cost part (food, interest,
// fines) isn't in Spent; the Dhuku page shows that cost. Money coming back (a
// payout, a loan repaid to you) isn't subtracted.
export function movedThisMonth(input: {
  deposits: { amount: number; date: string; kind: string }[];
  dhukuEntries: { amount: number; date: string; type: string }[];
  endDate: string;
  loanPayments: { amount: number; date: string; direction: "given" | "taken" }[];
  startDate: string;
}): MovedThisMonth {
  const inMonth = (date: string) => date >= input.startDate && date <= input.endDate;
  const sum = (values: number[]) => Math.round(values.reduce((total, value) => total + value, 0) * 100) / 100;
  const savings = sum(input.deposits.filter((d) => d.kind === "deposit" && inMonth(d.date)).map((d) => d.amount));
  const dhuku = sum(input.dhukuEntries.filter((e) => e.type !== "payout" && inMonth(e.date)).map((e) => e.amount));
  const loans = sum(input.loanPayments.filter((p) => p.direction === "taken" && inMonth(p.date)).map((p) => p.amount));
  return { dhuku, loans, savings, total: sum([savings, dhuku, loans]) };
}
