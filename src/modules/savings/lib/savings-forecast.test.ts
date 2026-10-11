import { describe, expect, it } from "vitest";

import { resolvePeriod } from "@/lib/month-period";

import { forecastPot, monthAfter, monthsBetween, neededByCheck, periodOfDate, whatIfFirst } from "./savings-forecast";

// The owner's example: reserve already full, Rs 15,000 a month going in,
// surgery first and a vacation second.
const SURGERY_THEN_VACATION = {
  balance: 100000,
  items: [
    { cost: 300000, id: "surgery" },
    { cost: 60000, id: "vacation" },
  ],
  monthlyInflow: 15000,
  reserveMinimum: 100000,
};

describe("forecastPot", () => {
  it("fills the emergency reserve before anything on the list", () => {
    const forecast = forecastPot({ balance: 15000, items: [{ cost: 60000, id: "trip" }], monthlyInflow: 15000, reserveMinimum: 100000 });

    expect(forecast.reserveFullInMonths).toBe(6);
    // (100,000 reserve + 60,000 trip − 15,000 already in) ÷ 15,000 a month = 9.67, so 10 months.
    expect(forecast.items[0].monthsFromNow).toBe(10);
  });

  it("pays for the list strictly in order", () => {
    const forecast = forecastPot({
      balance: 100000,
      items: [
        { cost: 300000, id: "surgery" },
        { cost: 60000, id: "vacation" },
      ],
      monthlyInflow: 15000,
      reserveMinimum: 100000,
    });

    expect(forecast.items.map((item) => item.monthsFromNow)).toEqual([20, 24]);
    expect(forecast.items.map((item) => item.cumulativeCost)).toEqual([300000, 360000]);
  });

  it("says affordable now when the pot already covers it", () => {
    const forecast = forecastPot({ balance: 200000, items: [{ cost: 50000, id: "phone" }], monthlyInflow: 0, reserveMinimum: 100000 });

    expect(forecast.reserveFullInMonths).toBe(0);
    expect(forecast.items[0].monthsFromNow).toBe(0);
  });

  it("gives no date when nothing is planned going in", () => {
    const forecast = forecastPot({ balance: 10000, items: [{ cost: 50000, id: "phone" }], monthlyInflow: 0, reserveMinimum: 100000 });

    expect(forecast.reserveFullInMonths).toBeNull();
    expect(forecast.items[0].monthsFromNow).toBeNull();
  });
});

describe("monthAfter", () => {
  it("rolls over into the next year", () => {
    expect(monthAfter(2083, 11, 3)).toEqual({ month: 2, year: 2084 });
  });

  it("returns the same month for zero", () => {
    expect(monthAfter(2083, 6, 0)).toEqual({ month: 6, year: 2083 });
  });
});

describe("whatIfFirst", () => {
  it("says when an item would be affordable if it went first, and how far it pushes the others", () => {
    expect(whatIfFirst(SURGERY_THEN_VACATION, "vacation")).toEqual({ delays: [{ id: "surgery", months: 4 }], monthsFromNow: 4 });
  });

  it("has nothing to say for the item already at the top", () => {
    expect(whatIfFirst(SURGERY_THEN_VACATION, "surgery")).toBeNull();
  });
});

describe("neededByCheck", () => {
  it("is quiet when the item will be affordable in time", () => {
    expect(
      neededByCheck({ balance: 100000, cumulativeCost: 300000, monthlyInflow: 15000, monthsFromNow: 20, monthsUntilNeeded: 24, reserveMinimum: 100000 }),
    ).toBeNull();
  });

  it("says how late it is, and how much more a month would make it", () => {
    // Needed in 18 months, affordable in 20: Rs 300,000 short over 18 months
    // is Rs 16,667 a month, Rs 1,667 more than the Rs 15,000 planned.
    expect(
      neededByCheck({ balance: 100000, cumulativeCost: 300000, monthlyInflow: 15000, monthsFromNow: 20, monthsUntilNeeded: 18, reserveMinimum: 100000 }),
    ).toEqual({ extraPerMonth: 1667, monthsLate: 2 });
  });

  it("asks for the whole shortfall when it's needed this month", () => {
    expect(
      neededByCheck({ balance: 100000, cumulativeCost: 50000, monthlyInflow: 15000, monthsFromNow: 4, monthsUntilNeeded: 0, reserveMinimum: 100000 }),
    ).toEqual({ extraPerMonth: 50000, monthsLate: 4 });
  });
});

describe("periodOfDate and monthsBetween", () => {
  it("finds the month a date falls in, in either calendar", () => {
    expect(periodOfDate("2026-10-15", "english")).toEqual({ month: 10, year: 2026 });
    const asoj = resolvePeriod(2083, 6, "nepali");
    expect(periodOfDate(asoj.startDate, "nepali")).toEqual({ month: 6, year: 2083 });
    expect(periodOfDate(asoj.endDate, "nepali")).toEqual({ month: 6, year: 2083 });
  });

  it("counts whole months between two months", () => {
    expect(monthsBetween({ month: 6, year: 2083 }, { month: 2, year: 2084 })).toBe(8);
    expect(monthsBetween({ month: 6, year: 2083 }, { month: 6, year: 2083 })).toBe(0);
  });
});
