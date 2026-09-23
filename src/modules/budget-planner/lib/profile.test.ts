import { describe, expect, it } from "vitest";

import type { FixedFloor } from "./fixed-floor";
import { periodBounds } from "./periods";
import { buildProfile, type ProfileCategoryRow, type ProfileExpenseRow } from "./profile";

const categories: ProfileCategoryRow[] = [
  { archived: false, budgetType: "flexible", groupName: "Household", id: "cat-food", name: "Groceries" },
  { archived: false, budgetType: "flexible", groupName: "Lifestyle", id: "cat-fun", name: "My custom thing" },
];

const noFixedFloor: FixedFloor = { byCategory: [], byOwner: [], total: 0 };

describe("buildProfile (english)", () => {
  const expenses: ProfileExpenseRow[] = [
    { amount: "1000", categoryId: "cat-food", date: "2026-01-15", ownerMemberId: null },
    { amount: "2000", categoryId: "cat-food", date: "2026-02-15", ownerMemberId: null },
    { amount: "500", categoryId: "cat-fun", date: "2026-02-20", ownerMemberId: "m-1" },
  ];
  const profile = buildProfile({
    categories,
    dateFormat: "english",
    expenses,
    fixedFloor: noFixedFloor,
    incomes: [
      { amount: "10000", month: 1, year: 2026 },
      { amount: "10000", month: 2, year: 2026 },
    ],
    periods: [
      { month: 1, year: 2026 },
      { month: 2, year: 2026 },
    ],
    planningPeriod: { month: 3, year: 2026 },
  });

  it("buckets spend by period", () => {
    expect(profile.spendByPeriod).toEqual([1000, 2500]);
  });

  it("sums income by period", () => {
    expect(profile.incomeByPeriod).toEqual([10000, 10000]);
  });

  it("labels canonical defaults and nulls custom names", () => {
    expect(profile.categories.find((c) => c.categoryId === "cat-food")?.label).toBe("Groceries");
    expect(profile.categories.find((c) => c.categoryId === "cat-fun")?.label).toBeNull();
  });

  it("computes per-category medians and owner splits", () => {
    const fun = profile.categories.find((c) => c.categoryId === "cat-fun");
    expect(fun?.spendByPeriod).toEqual([0, 500]);
    expect(fun?.medianSpend).toBe(0);
    expect(fun?.ownerSplit).toEqual([{ ownerMemberId: "m-1", share: 1 }]);
  });

  it("builds the envelope from income, the fixed floor and savings", () => {
    expect(profile.envelope).toEqual({ fixed: 0, flexible: 4000, income: 10000, savings: 6000 });
  });
});

describe("buildProfile (nepali)", () => {
  it("buckets an AD-dated expense into its BS month", () => {
    const bounds = periodBounds({ month: 1, year: 2083 }, "nepali");
    const profile = buildProfile({
      categories,
      dateFormat: "nepali",
      expenses: [{ amount: "700", categoryId: "cat-food", date: bounds.startDate, ownerMemberId: null }],
      fixedFloor: noFixedFloor,
      incomes: [{ amount: "5000", month: 1, year: 2083 }],
      periods: [{ month: 1, year: 2083 }],
      planningPeriod: { month: 2, year: 2083 },
    });

    expect(profile.spendByPeriod).toEqual([700]);
  });
});

describe("buildProfile envelope", () => {
  it("subtracts fixed commitments and the savings target", () => {
    const fixed: FixedFloor = {
      byCategory: [{ amount: 4000, categoryId: "cat-food" }],
      byOwner: [{ amount: 4000, ownerMemberId: null }],
      total: 4000,
    };
    const profile = buildProfile({
      categories,
      dateFormat: "english",
      expenses: [{ amount: "8000", categoryId: "cat-food", date: "2026-01-10", ownerMemberId: null }],
      fixedFloor: fixed,
      incomes: [{ amount: "10000", month: 1, year: 2026 }],
      periods: [{ month: 1, year: 2026 }],
      planningPeriod: { month: 2, year: 2026 },
    });

    expect(profile.envelope).toEqual({ fixed: 4000, flexible: 4000, income: 10000, savings: 2000 });
  });

  it("honours an income override", () => {
    const profile = buildProfile({
      categories,
      dateFormat: "english",
      expenses: [],
      fixedFloor: noFixedFloor,
      incomes: [{ amount: "10000", month: 1, year: 2026 }],
      overrideIncome: 6000,
      periods: [{ month: 1, year: 2026 }],
      planningPeriod: { month: 2, year: 2026 },
    });

    expect(profile.envelope.income).toBe(6000);
  });
});
