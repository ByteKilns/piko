import { setAsideFor } from "@/modules/funds/lib/fund-math";

// "Set aside first": money a person's plan takes off the top before any
// budget line, filled in from what Piko already knows (savings pot plans,
// dhukus, loan installments, funds) so it's never typed twice. None of it is
// spending: it's money moved to the person's own piles or paid back.

export type SetAsideKind = "dhuku" | "fund" | "loan" | "savings";

export type SetAsideRow = { done: number; id: string; kind: SetAsideKind; label: string; planned: number; sub: string };

type Period = { endDate: string; startDate: string };

const inPeriod = (date: string, period: Period) => date >= period.startDate && date <= period.endDate;
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

// This person's monthly plan for each savings pot, against what they put in
// this month.
export function savingsSetAsides(input: {
  deposits: { amount: number; date: string; kind: string; memberId: null | string; potId: string }[];
  memberId: string;
  period: Period;
  plans: { memberId: string; monthlyAmount: number; potId: string }[];
  pots: { id: string; name: string }[];
}): SetAsideRow[] {
  return input.pots.flatMap((pot) => {
    const planned = sum(input.plans.filter((p) => p.potId === pot.id && p.memberId === input.memberId).map((p) => p.monthlyAmount));
    if (planned <= 0) return [];
    const done = sum(
      input.deposits
        .filter((d) => d.potId === pot.id && d.kind === "deposit" && d.memberId === input.memberId && inPeriod(d.date, input.period))
        .map((d) => d.amount),
    );
    return [{ done, id: `savings:${pot.id}`, kind: "savings" as const, label: pot.name, planned, sub: "Savings" }];
  });
}

// Each active dhuku of this person: the monthly contribution, plus the
// monthly interest from the month after they took their payout.
export function dhukuSetAsides(input: {
  dhukus: {
    completedAt: unknown;
    id: string;
    interestPerMonth: null | number;
    monthlyContribution: number;
    name: string;
    ownerMemberId: null | string;
    totalMembers: number;
  }[];
  entries: { amount: number; date: string; dhukuId: string; type: string }[];
  memberId: string;
  period: Period;
}): SetAsideRow[] {
  return input.dhukus.flatMap((dhuku) => {
    if (dhuku.ownerMemberId !== input.memberId || dhuku.completedAt !== null) return [];
    const entries = input.entries.filter((e) => e.dhukuId === dhuku.id);
    const paidBefore = entries.filter((e) => e.type === "contribution" && e.date < input.period.startDate).length;
    if (paidBefore >= dhuku.totalMembers) return [];
    const tookPot = entries.some((e) => e.type === "payout" && e.date < input.period.startDate);
    const planned = dhuku.monthlyContribution + (tookPot ? (dhuku.interestPerMonth ?? 0) : 0);
    const done = sum(entries.filter((e) => e.type === "contribution" && inPeriod(e.date, input.period)).map((e) => e.amount));
    return [{ done, id: `dhuku:${dhuku.id}`, kind: "dhuku" as const, label: dhuku.name, planned, sub: tookPot ? "Dhuku, with interest" : "Dhuku" }];
  });
}

// Each of this person's funds in use: this month's set-aside. A fund only
// exists in Piko, so its set-aside always counts as done.
export function fundSetAsides(input: {
  funds: { archived: boolean; id: string; name: string; ownerMemberId: string; startMonth: number; startYear: number }[];
  memberId: string;
  month: { month: number; year: number };
  plans: { fromMonth: number; fromYear: number; fundId: string; monthlyAmount: number }[];
}): SetAsideRow[] {
  return input.funds.flatMap((fund) => {
    if (fund.ownerMemberId !== input.memberId || fund.archived) return [];
    if (fund.startYear * 12 + fund.startMonth > input.month.year * 12 + input.month.month) return [];
    const planned = setAsideFor(
      input.plans.filter((p) => p.fundId === fund.id),
      input.month,
    );
    if (planned <= 0) return [];
    return [{ done: planned, id: `fund:${fund.id}`, kind: "fund" as const, label: fund.name, planned, sub: "Fund" }];
  });
}

// Each loan this person took that has an installment and isn't paid off: the
// installment as a monthly amount, capped at what's still owed.
export function loanSetAsides(input: {
  loans: {
    counterpartyName: string;
    direction: "given" | "taken";
    id: string;
    installmentAmount: null | number;
    installmentFrequency: "monthly" | "weekly" | null;
    ownerMemberId: null | string;
    principalAmount: number;
  }[];
  memberId: string;
  payments: { amount: number; date: string; loanId: string }[];
  period: Period;
}): SetAsideRow[] {
  return input.loans.flatMap((loan) => {
    if (loan.ownerMemberId !== input.memberId || loan.direction !== "taken" || loan.installmentAmount === null) return [];
    const payments = input.payments.filter((p) => p.loanId === loan.id);
    const owedAtStart = loan.principalAmount - sum(payments.filter((p) => p.date < input.period.startDate).map((p) => p.amount));
    if (owedAtStart <= 0) return [];
    const monthly = loan.installmentFrequency === "weekly" ? Math.round((loan.installmentAmount * 52) / 12) : loan.installmentAmount;
    const done = sum(payments.filter((p) => inPeriod(p.date, input.period)).map((p) => p.amount));
    return [
      {
        done,
        id: `loan:${loan.id}`,
        kind: "loan" as const,
        label: loan.counterpartyName,
        planned: Math.min(monthly, owedAtStart),
        sub: "Loan repayment",
      },
    ];
  });
}
