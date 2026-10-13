export type IncomeKind = "extra" | "pay";

export type IncomeRow = { amount: number; id: string; kind: IncomeKind; memberId: string; month: number; note: null | string; year: number };

export type ExtraIncome = { amount: number; id: string; note: null | string };

export type MonthIncome = {
  extra: number;
  extras: ExtraIncome[];
  pay: number;
  // The month the pay was carried over from, when this month has no pay entry of its own.
  payCarriedFrom: null | { month: number; year: number };
  total: number;
};

const monthOrder = (year: number, month: number) => year * 12 + month;

// One person's income for a month. Pay carries forward: a month without its
// own pay entry uses the latest earlier one, so base pay is entered once.
// Extra income (a bonus, a refund) only ever counts in its own month.
export function monthIncome(rows: IncomeRow[], memberId: string, target: { month: number; year: number }): MonthIncome {
  const targetOrder = monthOrder(target.year, target.month);
  const own = rows.filter((r) => r.memberId === memberId);

  const pays = own.filter((r) => r.kind === "pay" && monthOrder(r.year, r.month) <= targetOrder);
  const latestPay = pays.reduce<IncomeRow | null>(
    (latest, r) => (latest === null || monthOrder(r.year, r.month) > monthOrder(latest.year, latest.month) ? r : latest),
    null,
  );
  const pay = latestPay?.amount ?? 0;
  const payCarriedFrom =
    latestPay && monthOrder(latestPay.year, latestPay.month) !== targetOrder ? { month: latestPay.month, year: latestPay.year } : null;

  const extras = own
    .filter((r) => r.kind === "extra" && monthOrder(r.year, r.month) === targetOrder)
    .map((r) => ({ amount: r.amount, id: r.id, note: r.note }));
  const extra = extras.reduce((sum, e) => sum + e.amount, 0);

  return { extra, extras, pay, payCarriedFrom, total: pay + extra };
}

// The household's total income for each of the given months, with pay
// carried forward the same way.
export function incomeByMonth(rows: IncomeRow[], memberIds: string[], months: { month: number; year: number }[]) {
  return months.map((m) => ({
    amount: memberIds.reduce((sum, id) => sum + monthIncome(rows, id, m).total, 0),
    month: m.month,
    year: m.year,
  }));
}
