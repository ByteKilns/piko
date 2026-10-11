import { describe, expect, it } from "vitest";

import { basePot, dhukuPosition, dhukuRealCost, expectedPot } from "./dhuku-money";

// The owner's real dhuku: 12 members, Rs 3,000 a month, Rs 3,000 taken out of
// every pot for the meeting's food, Rs 300 interest a month after taking it.
const TERMS = { monthlyContribution: 3000, potDeduction: 3000, totalMembers: 12 };
const INTEREST = 300;

const contributions = (count: number, amount: number) => Array.from({ length: count }, () => ({ amount, type: "contribution" as const }));

// Taking the pot at meeting 5: four meetings before, the payout meeting, then
// seven more paying the extra Rs 300.
const FULL_YEAR_TAKING_AT_5 = [
  ...contributions(5, 3000),
  { amount: 34200, type: "payout" as const },
  ...contributions(7, 3300),
];

describe("basePot", () => {
  it("is everyone's contribution less what's taken out of each pot", () => {
    expect(basePot(TERMS)).toBe(33000);
  });

  it("is the full amount when nothing is taken out", () => {
    expect(basePot({ ...TERMS, potDeduction: null })).toBe(36000);
  });
});

describe("expectedPot", () => {
  it("adds Rs 300 for every member who took the pot before this meeting", () => {
    expect(expectedPot(TERMS, INTEREST, 1)).toBe(33000);
    expect(expectedPot(TERMS, INTEREST, 5)).toBe(34200);
    expect(expectedPot(TERMS, INTEREST, 12)).toBe(36300);
  });

  it("treats no interest as zero", () => {
    expect(expectedPot(TERMS, null, 12)).toBe(33000);
  });
});

describe("dhukuRealCost", () => {
  it("is the food share plus interest paid, less the interest received in the pot", () => {
    expect(dhukuRealCost(TERMS, FULL_YEAR_TAKING_AT_5)).toEqual({
      finesPaid: 0,
      foodShare: 3000,
      interestPaid: 2100,
      received: 1200,
      total: 3900,
    });
  });

  it("adds fines on top", () => {
    const cost = dhukuRealCost(TERMS, [...FULL_YEAR_TAKING_AT_5, { amount: 100, type: "fine" }]);

    expect(cost.finesPaid).toBe(100);
    expect(cost.total).toBe(4000);
  });

  it("can come out ahead when you take the pot last", () => {
    const cost = dhukuRealCost(TERMS, [...contributions(12, 3000), { amount: 36300, type: "payout" }]);

    expect(cost.total).toBe(-300);
  });
});

describe("dhukuPosition", () => {
  it("grows with each contribution before the payout", () => {
    expect(dhukuPosition(TERMS, contributions(4, 3000))).toBe(11000);
  });

  it("flips to what you owe the group once you take the pot", () => {
    expect(dhukuPosition(TERMS, [...contributions(5, 3000), { amount: 34200, type: "payout" }])).toBe(-19250);
  });

  it("is back to zero at the end of the cycle", () => {
    expect(dhukuPosition(TERMS, FULL_YEAR_TAKING_AT_5)).toBe(0);
  });
});
