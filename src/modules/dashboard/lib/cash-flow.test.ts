// src/modules/dashboard/lib/cash-flow.test.ts
import { describe, expect, it } from "vitest";

import { resolvePeriod } from "@/lib/month-period";

import {
  allowanceSpentByDay,
  type CashFlowEvent,
  dailyCashFlowPoints,
  daysLeftInMonth,
  dhukuCashFlow,
  loanNetFlowByOwner,
  loanPaymentCashFlow,
  netMonthlyOutflow,
  safeToSpendToday,
} from "./cash-flow";

describe("dhukuCashFlow", () => {
  it("treats a contribution as outgoing and a payout as incoming", () => {
    const events = dhukuCashFlow([
      { amount: "1000", date: "2026-02-05", type: "contribution" },
      { amount: "13000", date: "2026-02-20", type: "payout" },
    ]);

    expect(events).toEqual([
      { amount: 1000, date: "2026-02-05", direction: "out" },
      { amount: 13000, date: "2026-02-20", direction: "in" },
    ]);
  });
});

describe("loanPaymentCashFlow", () => {
  it("treats a payment on a 'taken' loan as outgoing", () => {
    const events = loanPaymentCashFlow(
      [{ amount: "500", date: "2026-02-10", loanId: "l1" }],
      [{ direction: "taken", id: "l1" }],
    );
    expect(events).toEqual([{ amount: 500, date: "2026-02-10", direction: "out" }]);
  });

  it("treats a payment on a 'given' loan as incoming", () => {
    const events = loanPaymentCashFlow(
      [{ amount: "500", date: "2026-02-10", loanId: "l1" }],
      [{ direction: "given", id: "l1" }],
    );
    expect(events).toEqual([{ amount: 500, date: "2026-02-10", direction: "in" }]);
  });

  it("skips payments whose loan isn't in the provided list", () => {
    const events = loanPaymentCashFlow([{ amount: "500", date: "2026-02-10", loanId: "missing" }], []);
    expect(events).toEqual([]);
  });
});

describe("loanNetFlowByOwner", () => {
  it("attributes a 'taken' loan payment as a positive (outflow) amount to the loan's owner", () => {
    const totals = loanNetFlowByOwner(
      [{ amount: "500", date: "2026-02-10", loanId: "l1" }],
      [{ direction: "taken", id: "l1", ownerMemberId: "m1" }],
      2026,
      2,
      "english",
    );
    expect(totals.get("m1")).toBe(500);
  });

  it("attributes a 'given' loan payment as a negative (inflow) amount", () => {
    const totals = loanNetFlowByOwner(
      [{ amount: "500", date: "2026-02-10", loanId: "l1" }],
      [{ direction: "given", id: "l1", ownerMemberId: "m1" }],
      2026,
      2,
      "english",
    );
    expect(totals.get("m1")).toBe(-500);
  });

  it("groups a null ownerMemberId (shared loan) under the null key", () => {
    const totals = loanNetFlowByOwner(
      [{ amount: "200", date: "2026-02-10", loanId: "l1" }],
      [{ direction: "taken", id: "l1", ownerMemberId: null }],
      2026,
      2,
      "english",
    );
    expect(totals.get(null)).toBe(200);
  });

  it("excludes payments outside the given month", () => {
    const totals = loanNetFlowByOwner(
      [{ amount: "500", date: "2026-03-01", loanId: "l1" }],
      [{ direction: "taken", id: "l1", ownerMemberId: "m1" }],
      2026,
      2,
      "english",
    );
    expect(totals.size).toBe(0);
  });
});

describe("dailyCashFlowPoints", () => {
  it("buckets expenses and events by day, and places income on day 1", () => {
    const expenseRows = [
      { amount: "200", date: "2026-02-03" },
      { amount: "150", date: "2026-02-03" },
      { amount: "1000", date: "2026-01-15" }, // different month, excluded
    ];
    const incomeRows = [{ amount: "50000" }, { amount: "10000" }];
    const events: CashFlowEvent[] = [
      { amount: 1000, date: "2026-02-05", direction: "out" },
      { amount: 13000, date: "2026-02-20", direction: "in" },
      { amount: 999, date: "2026-03-01", direction: "out" }, // different month, excluded
    ];

    const points = dailyCashFlowPoints(expenseRows, incomeRows, events, 2026, 2, "english");

    expect(points).toHaveLength(28); // Feb 2026 is not a leap year
    expect(points[0]).toEqual({ date: "2026-02-01", day: 1, in: 60000, out: 0 });
    expect(points[2]).toEqual({ date: "2026-02-03", day: 3, in: 0, out: 350 });
    expect(points[4]).toEqual({ date: "2026-02-05", day: 5, in: 0, out: 1000 });
    expect(points[19]).toEqual({ date: "2026-02-20", day: 20, in: 13000, out: 0 });
  });

  it("returns a zeroed point for every day even with no data", () => {
    const points = dailyCashFlowPoints([], [], [], 2026, 4, "english");
    expect(points).toHaveLength(30);
    expect(points.every((p) => p.in === 0 && p.out === 0)).toBe(true);
  });
});

describe("netMonthlyOutflow", () => {
  it("sums outgoing minus incoming for the given month only", () => {
    const events: CashFlowEvent[] = [
      { amount: 1000, date: "2026-02-05", direction: "out" },
      { amount: 500, date: "2026-02-10", direction: "out" },
      { amount: 13000, date: "2026-02-20", direction: "in" },
      { amount: 999, date: "2026-03-01", direction: "out" },
    ];

    expect(netMonthlyOutflow(events, 2026, 2, "english")).toBe(1000 + 500 - 13000);
  });

  it("returns 0 for a month with no events", () => {
    expect(netMonthlyOutflow([], 2026, 2, "english")).toBe(0);
  });
});

describe("daysLeftInMonth", () => {
  it("returns the full day count for a month that isn't the current one", () => {
    expect(daysLeftInMonth(2020, 2, "english")).toBe(29); // Feb 2020 is a leap year
  });

  it("returns the full day count for a 30-day past month", () => {
    expect(daysLeftInMonth(2020, 4, "english")).toBe(30);
  });
});

describe("safeToSpendToday", () => {
  it("divides remaining budget by the full day count for a past month", () => {
    expect(safeToSpendToday(3000, 1000, 2020, 4, "english")).toBe(Math.round(2000 / 30));
  });

  it("clamps to 0 when already over budget", () => {
    expect(safeToSpendToday(1000, 5000, 2020, 4, "english")).toBe(0);
  });
});

describe("allowanceSpentByDay", () => {
  const fixedCategoryIds = new Set(["rent"]);

  it("adds up non-fixed expenses by day and leaves fixed ones out", () => {
    const spent = allowanceSpentByDay(
      [
        { amount: "200", categoryId: "groceries", date: "2026-02-03" },
        { amount: "150.50", categoryId: "petrol", date: "2026-02-03" },
        { amount: "25000", categoryId: "rent", date: "2026-02-02" },
      ],
      fixedCategoryIds,
      2026,
      2,
      "english",
    );

    expect(spent).toHaveLength(28); // Feb 2026 is not a leap year
    expect(spent[1]).toBe(0); // rent on day 2 is a fixed bill, so it doesn't count
    expect(spent[2]).toBe(350.5);
    expect(spent.reduce((sum, value) => sum + value, 0)).toBe(350.5);
  });

  it("still counts an expense whose category isn't known to be fixed", () => {
    const spent = allowanceSpentByDay(
      [{ amount: "500", categoryId: "archived-category", date: "2026-02-10" }],
      fixedCategoryIds,
      2026,
      2,
      "english",
    );

    expect(spent[9]).toBe(500);
  });

  it("ignores expenses outside the month", () => {
    const spent = allowanceSpentByDay(
      [
        { amount: "1000", categoryId: "groceries", date: "2026-01-31" },
        { amount: "1000", categoryId: "groceries", date: "2026-03-01" },
      ],
      fixedCategoryIds,
      2026,
      2,
      "english",
    );

    expect(spent.every((value) => value === 0)).toBe(true);
  });

  it("uses the Nepali month's own days when the household uses BS dates", () => {
    const period = resolvePeriod(2083, 6, "nepali");
    const spent = allowanceSpentByDay(
      [
        { amount: "100", categoryId: "groceries", date: period.startDate },
        { amount: "300", categoryId: "groceries", date: period.endDate },
      ],
      fixedCategoryIds,
      2083,
      6,
      "nepali",
    );

    expect(spent).toHaveLength(period.daysInPeriod);
    expect(spent[0]).toBe(100);
    expect(spent[period.daysInPeriod - 1]).toBe(300);
  });
});
