import { describe, expect, it } from "vitest";

import { resolvePeriod } from "@/lib/month-period";
import { buildPersonPlan } from "@/modules/budget/lib/budget-view";

import { viewerPacing, weekdayOf } from "./home-pacing";

// April 2026 (AD): 30 days from Wednesday 1 April. Rs 3,000 of lunches is
// can-cut money (Rs 490 a week, with a buffer held back for the last week);
// Rs 10,000 rent is fixed.
const PERIOD = resolvePeriod(2026, 4, "english");
const CATEGORIES = [
  { budgetType: "flexible" as const, id: "lunch", name: "Lunch" },
  { budgetType: "fixed" as const, id: "rent", name: "Rent" },
];
const LINES = [
  { categoryId: "lunch", inherited: false, kind: "can_cut" as const, plannedAmount: 3000 },
  { categoryId: "rent", inherited: false, kind: "fixed" as const, plannedAmount: 10000 },
];

type Spend = { amount: number; categoryId: string; date: string };

// Day 3 (Friday 3 April) of the month.
function pacingOn(spending: Spend[], lines = LINES) {
  const plan = buildPersonPlan({ categories: CATEGORIES, lines, spending });
  return viewerPacing({ dateFormat: "english", dayOfPeriod: 3, month: 4, period: PERIOD, plan, spending, year: 2026 });
}

describe("viewerPacing", () => {
  it("spreads what's left of this week's can-cut allowance over the days left in it", () => {
    expect(pacingOn([{ amount: 100, categoryId: "lunch", date: "2026-04-02" }])).toEqual({
      carryIn: 0,
      nextWeekAllowance: 490,
      nextWeekday: "Wednesday",
      over: false,
      overrunNote: null,
      safeToday: 78,
      weekLeft: 390,
      weeklyAllowance: 490,
    });
  });

  it("is over once this week's allowance is spent, and says when the next one starts", () => {
    expect(pacingOn([{ amount: 3000, categoryId: "lunch", date: "2026-04-02" }])).toMatchObject({
      nextWeekAllowance: 490,
      nextWeekday: "Wednesday",
      over: true,
      safeToday: 0,
      weekLeft: 0,
    });
  });

  it("takes another line's overrun out of the can-cut money and says so", () => {
    expect(
      pacingOn([
        { amount: 100, categoryId: "lunch", date: "2026-04-02" },
        { amount: 10500, categoryId: "rent", date: "2026-04-01" },
      ]),
    ).toMatchObject({
      overrunNote: "Rent went Rs 500.00 over, taken from your spending money.",
      safeToday: 62,
      weeklyAllowance: 408,
    });
  });

  it("is null without can-cut lines", () => {
    expect(pacingOn([], [LINES[1]])).toBeNull();
  });
});

describe("weekdayOf", () => {
  it("names the weekday of a day in the period", () => {
    expect(weekdayOf("2026-04-01", 1)).toBe("Wednesday");
    expect(weekdayOf("2026-04-01", 8)).toBe("Wednesday");
    expect(weekdayOf("2026-04-01", 5)).toBe("Sunday");
  });
});
