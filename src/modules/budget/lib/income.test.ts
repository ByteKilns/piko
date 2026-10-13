import { describe, expect, it } from "vitest";

import { incomeByMonth, type IncomeRow, monthIncome } from "./income";

const ME = "me";
const HER = "her";

function row(overrides: Partial<IncomeRow>): IncomeRow {
  return { amount: 62000, id: "i1", kind: "pay", memberId: ME, month: 6, note: null, year: 2083, ...overrides };
}

describe("monthIncome", () => {
  it("uses the month's own pay entry", () => {
    const rows = [row({ amount: 60000, id: "bhadra", month: 5 }), row({ id: "asoj", month: 6 })];

    expect(monthIncome(rows, ME, { month: 6, year: 2083 })).toEqual({ extra: 0, extras: [], pay: 62000, payCarriedFrom: null, total: 62000 });
  });

  it("carries the latest earlier pay into a month without one", () => {
    const rows = [row({ amount: 60000, id: "bhadra", month: 5 }), row({ id: "asoj", month: 6 })];

    const income = monthIncome(rows, ME, { month: 8, year: 2083 });

    expect(income.pay).toBe(62000);
    expect(income.payCarriedFrom).toEqual({ month: 6, year: 2083 });
  });

  it("carries pay across a year end", () => {
    expect(monthIncome([row({ month: 12, year: 2083 })], ME, { month: 2, year: 2084 }).pay).toBe(62000);
  });

  it("never uses a later month's pay", () => {
    expect(monthIncome([row({ month: 9 })], ME, { month: 8, year: 2083 })).toMatchObject({ pay: 0, payCarriedFrom: null, total: 0 });
  });

  it("adds extra income only in its own month", () => {
    const rows = [
      row({ id: "pay", month: 6 }),
      row({ amount: 38000, id: "bonus", kind: "extra", month: 7, note: "Dashain bonus" }),
      row({ amount: 2000, id: "refund", kind: "extra", month: 7, note: null }),
    ];

    expect(monthIncome(rows, ME, { month: 7, year: 2083 })).toEqual({
      extra: 40000,
      extras: [
        { amount: 38000, id: "bonus", note: "Dashain bonus" },
        { amount: 2000, id: "refund", note: null },
      ],
      pay: 62000,
      payCarriedFrom: { month: 6, year: 2083 },
      total: 102000,
    });
    expect(monthIncome(rows, ME, { month: 8, year: 2083 }).extra).toBe(0);
  });

  it("keeps each person's income apart", () => {
    const rows = [row({ id: "mine" }), row({ amount: 93600, id: "hers", memberId: HER })];

    expect(monthIncome(rows, HER, { month: 6, year: 2083 }).pay).toBe(93600);
  });
});

describe("incomeByMonth", () => {
  it("totals everyone's income per month with pay carried forward", () => {
    const rows = [
      row({ id: "mine", month: 5 }),
      row({ amount: 90000, id: "hers", memberId: HER, month: 5 }),
      row({ amount: 5000, id: "bonus", kind: "extra", month: 6 }),
    ];

    expect(
      incomeByMonth(rows, [ME, HER], [
        { month: 5, year: 2083 },
        { month: 6, year: 2083 },
      ]),
    ).toEqual([
      { amount: 152000, month: 5, year: 2083 },
      { amount: 157000, month: 6, year: 2083 },
    ]);
  });
});
