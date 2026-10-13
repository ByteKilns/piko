import { formatMoney } from "@/lib/money";

// Closing a month: how a person splits what was left (or covers what went
// over), and the cushion that's left in their everyday account. The amount
// to decide on is the month's Unallocated (personMonthMoney).

const round2 = (value: number) => Math.round(value * 100) / 100;
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

export type SettlementParts = {
  cushion: number;
  funds: { amount: number; fundId: string }[];
  loans: { amount: number; loanId: string }[];
  savings: { amount: number; potId: string }[];
};

// null when the split is fine, otherwise what's wrong with it. Extra money is
// split exactly, with no part below zero; a month that went over is settled
// whole from the cushion.
export function checkSplit(amount: number, parts: SettlementParts): null | string {
  const others = [...parts.funds, ...parts.loans, ...parts.savings];
  if (amount < 0) {
    return others.length === 0 && round2(parts.cushion) === round2(amount) ? null : "A month that went over comes from the cushion";
  }
  if (parts.cushion < 0 || others.some((p) => p.amount < 0)) return "No part can be below zero";
  const total = round2(parts.cushion + sum(others.map((p) => p.amount)));
  if (total !== round2(amount)) return `The parts add up to ${formatMoney(total)}, not ${formatMoney(amount)}`;
  return null;
}

// The cushion is only ever what its entries add up to.
export function cushionBalance(entries: { amount: number }[]): number {
  return round2(sum(entries.map((e) => e.amount)));
}
