import { describe, expect, it } from "vitest";

import { incomeAnchor, incomeVariability, savingsTarget } from "./income-anchor";

describe("incomeAnchor", () => {
  it("uses the lower median of recorded income", () => {
    expect(incomeAnchor([100000, 50000, 80000])).toEqual({
      amount: 80000,
      confidence: "medium",
      method: "median",
      monthsUsed: 3,
    });
  });

  it("uses the lower of the two middles for an even count", () => {
    expect(incomeAnchor([100000, 60000]).amount).toBe(60000);
  });

  it("ignores unrecorded (zero) months", () => {
    expect(incomeAnchor([0, 90000, 0]).monthsUsed).toBe(1);
  });

  it("prefers an explicit override", () => {
    expect(incomeAnchor([100000], 70000)).toMatchObject({ amount: 70000, method: "override" });
  });

  it("returns zero with no recorded income", () => {
    expect(incomeAnchor([0, 0])).toEqual({ amount: 0, confidence: "low", method: "median", monthsUsed: 0 });
  });

  it("marks confidence high at five recorded months", () => {
    expect(incomeAnchor([100, 100, 100, 100, 100]).confidence).toBe("high");
  });
});

describe("incomeVariability", () => {
  it("is unknown with fewer than two months", () => {
    expect(incomeVariability([100000])).toEqual({ band: "unknown", cv: null });
  });

  it("bands low, medium and high from the coefficient of variation", () => {
    expect(incomeVariability([100, 100]).band).toBe("low");
    expect(incomeVariability([100, 130]).band).toBe("medium");
    expect(incomeVariability([100, 300]).band).toBe("high");
  });
});

describe("savingsTarget", () => {
  it("reserves the median observed saving as a share of the anchor", () => {
    const target = savingsTarget(
      [
        { income: 100000, spend: 80000 },
        { income: 100000, spend: 70000 },
      ],
      100000,
    );

    expect(target).toEqual({ amount: 20000, method: "observed", share: 0.2 });
  });

  it("clamps to zero when spending exceeds income", () => {
    expect(savingsTarget([{ income: 100000, spend: 120000 }], 100000)).toEqual({
      amount: 0,
      method: "observed",
      share: 0,
    });
  });

  it("caps the reserved share at 60%", () => {
    expect(savingsTarget([{ income: 100000, spend: 10000 }], 100000).share).toBe(0.6);
  });

  it("returns zero when there is no anchor", () => {
    expect(savingsTarget([{ income: 0, spend: 0 }], 0).share).toBe(0);
  });
});
