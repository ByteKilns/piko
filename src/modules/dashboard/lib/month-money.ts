import { type IncomeRow, monthIncome, type MonthIncome } from "@/modules/budget/lib/income";
import { fundSetAsides } from "@/modules/budget/lib/set-aside";
import { payRows } from "@/modules/expenses/lib/pay-amount";

import { movedThisMonth, type MovedThisMonth } from "./moved";
import { walletShares } from "./wallet";

type ExpenseRow = {
  amount: string;
  categoryId: string;
  date: string;
  fundAmount: null | string;
  paidByMemberId: string;
  payBackAmount: null | string;
  savingsPotId: null | string;
};

export type MonthMoneyInput = {
  deposits: { amount: number; date: string; kind: string; memberId: null | string }[];
  dhukuEntries: { amount: number; date: string; dhukuId: string; type: string }[];
  dhukus: { id: string; ownerMemberId: null | string }[];
  // The month's expenses.
  expenses: ExpenseRow[];
  fundData: {
    funds: { archived: boolean; id: string; name: string; ownerMemberId: string; startMonth: number; startYear: number }[];
    plans: { fromMonth: number; fromYear: number; fundId: string; monthlyAmount: number }[];
    topUps: { amount: number; fundId: string; month: number; year: number }[];
  };
  incomeRows: IncomeRow[];
  loanPayments: { amount: number; date: string; loanId: string; memberId: string }[];
  loans: { direction: "given" | "taken"; id: string }[];
  memberId: string;
  memberIds: string[];
  month: { month: number; year: number };
  period: { endDate: string; startDate: string };
};

export type MonthMoney = {
  income: MonthIncome;
  moved: MovedThisMonth;
  // What left this person's own wallet from pay, expense by expense.
  spending: { amount: number; categoryId: string; date: string }[];
  spent: number;
  // Pay and extra less spent and moved: Home's Unallocated, and at month end
  // the amount left to decide on (negative when the month went over).
  unallocated: number;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

// One person's month: their pay and extra, what left their own wallet from
// pay, and what they moved to their own piles. Home and closing a month both
// use it, so the amount to decide on is always Home's Unallocated.
export function personMonthMoney(input: MonthMoneyInput): MonthMoney {
  const { memberId } = input;
  const spending = payRows(input.expenses).flatMap((e) =>
    walletShares(
      { amount: Number(e.amount), paidByMemberId: e.paidByMemberId, payBackAmount: e.payBackAmount === null ? null : Number(e.payBackAmount) },
      input.memberIds,
    ).flatMap((share) => (share.memberId === memberId ? [{ amount: share.amount, categoryId: e.categoryId, date: e.date }] : [])),
  );
  const spent = round2(spending.reduce((s, e) => s + e.amount, 0));
  const income = monthIncome(input.incomeRows, memberId, input.month);

  // What went into their funds this month: the set-asides plus money added.
  const ownFunds = input.fundData.funds.filter((f) => f.ownerMemberId === memberId && !f.archived);
  const intoFunds =
    fundSetAsides({ funds: ownFunds, memberId, month: input.month, plans: input.fundData.plans }).reduce((s, r) => s + r.planned, 0) +
    input.fundData.topUps
      .filter((t) => t.month === input.month.month && t.year === input.month.year && ownFunds.some((f) => f.id === t.fundId))
      .reduce((s, t) => s + t.amount, 0);

  const ownDhukuIds = new Set(input.dhukus.filter((d) => d.ownerMemberId === memberId).map((d) => d.id));
  const moved = movedThisMonth({
    deposits: input.deposits.filter((d) => d.memberId === memberId),
    dhukuEntries: input.dhukuEntries.filter((e) => ownDhukuIds.has(e.dhukuId)),
    endDate: input.period.endDate,
    funds: intoFunds,
    loanPayments: input.loanPayments.flatMap((p) => {
      const loan = input.loans.find((l) => l.id === p.loanId);
      return loan && p.memberId === memberId ? [{ amount: p.amount, date: p.date, direction: loan.direction }] : [];
    }),
    startDate: input.period.startDate,
  });

  return { income, moved, spending, spent, unallocated: round2(income.pay + income.extra - spent - moved.total) };
}
