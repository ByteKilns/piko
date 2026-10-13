// A fund is a named pile inside one person's everyday account for an
// occasional cost. Nothing moves at the bank: each month the plan sets an
// amount aside, money can be added by hand, and expenses paid from the fund
// take from it.

export type YearMonth = { month: number; year: number };

// The monthly set-aside from a month on. A change adds a plan from the month
// it's made, so earlier months keep the amount they had.
export type FundPlan = { fromMonth: number; fromYear: number; monthlyAmount: number };

const monthOrder = (ym: YearMonth) => ym.year * 12 + ym.month;

// The set-aside in force for a month: the latest plan starting on or before it.
export function setAsideFor(plans: FundPlan[], ym: YearMonth): number {
  let current: FundPlan | null = null;
  for (const plan of plans) {
    const from = monthOrder({ month: plan.fromMonth, year: plan.fromYear });
    if (from > monthOrder(ym)) continue;
    if (current === null || from > monthOrder({ month: current.fromMonth, year: current.fromYear })) current = plan;
  }
  return current?.monthlyAmount ?? 0;
}

// Everything set aside from the fund's first month through `through`, at the
// amount in force each month. A month's set-aside counts from its first day.
export function totalSetAside(plans: FundPlan[], start: YearMonth, through: YearMonth): number {
  let total = 0;
  for (let order = monthOrder(start); order <= monthOrder(through); order++) {
    const year = Math.floor((order - 1) / 12);
    const month = order - year * 12;
    total += setAsideFor(plans, { month, year });
  }
  return total;
}

export function fundBalance(input: { plans: FundPlan[]; spent: number; start: YearMonth; through: YearMonth; topUps: number }): number {
  return totalSetAside(input.plans, input.start, input.through) + input.topUps - input.spent;
}

// For a fund with a target and a due month: what to set aside each month from
// next month through the due month to have it in time. 0 when it's already
// covered; the whole shortfall when it's due this month or overdue; null
// without a target or due month.
export function suggestedMonthly(input: { balance: number; due: null | YearMonth; now: YearMonth; target: null | number }): null | number {
  if (input.target === null || input.due === null) return null;
  const shortfall = input.target - input.balance;
  if (shortfall <= 0) return 0;
  const monthsLeft = monthOrder(input.due) - monthOrder(input.now);
  return monthsLeft <= 0 ? shortfall : Math.ceil(shortfall / monthsLeft);
}

// Each fund's balance through a month, from rows as they come out of the
// database (amounts already numbers). Money added counts from the month it
// was added for; what expenses took counts whenever they were paid.
export function fundBalances(input: {
  funds: { id: string; startMonth: number; startYear: number }[];
  plans: (FundPlan & { fundId: string })[];
  spends: { amount: number; fundId: string }[];
  through: YearMonth;
  topUps: { amount: number; fundId: string; month: number; year: number }[];
}): Map<string, number> {
  return new Map(
    input.funds.map((fund) => [
      fund.id,
      fundBalance({
        plans: input.plans.filter((p) => p.fundId === fund.id),
        spent: input.spends.filter((s) => s.fundId === fund.id).reduce((sum, s) => sum + s.amount, 0),
        start: { month: fund.startMonth, year: fund.startYear },
        through: input.through,
        topUps: input.topUps
          .filter((t) => t.fundId === fund.id && monthOrder(t) <= monthOrder(input.through))
          .reduce((sum, t) => sum + t.amount, 0),
      }),
    ]),
  );
}

// How much of an expense a fund pays: up to its balance. Anything above that
// counts as the month's normal spending.
export function fundShare(amount: number, balance: number): number {
  return Math.max(0, Math.min(amount, balance));
}
