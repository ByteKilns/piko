import { describe, expect, it } from "vitest";

import { forecastPot, monthAfter } from "./savings-forecast";

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
