import { describe, expect, it } from "vitest";

import type { RawPlan } from "../schemas/budget-plan.schema";
import { buildPlan } from "./build-plan";
import type { FixedFloor } from "./fixed-floor";
import { buildProfile, type ProfileCategoryRow, type ProfileExpenseRow } from "./profile";

const categories: ProfileCategoryRow[] = [
  { archived: false, budgetType: "flexible", groupName: "Household", id: "cat-a", name: "Groceries" },
  { archived: false, budgetType: "flexible", groupName: "Lifestyle", id: "cat-b", name: "Fun" },
];

const noFixedFloor: FixedFloor = { byCategory: [], byOwner: [], total: 0 };

const expenses: ProfileExpenseRow[] = [
  { amount: "2000", categoryId: "cat-a", date: "2026-01-10", ownerMemberId: "m-1" },
  { amount: "1000", categoryId: "cat-b", date: "2026-01-12", ownerMemberId: null },
];

// Income 10000, spend 3000 -> savings target 6000 (capped 60%), flexible 4000.
const profile = buildProfile({
  categories,
  dateFormat: "english",
  expenses,
  fixedFloor: noFixedFloor,
  incomes: [{ amount: "10000", month: 1, year: 2026 }],
  periods: [{ month: 1, year: 2026 }],
  planningPeriod: { month: 2, year: 2026 },
});

const categoryNameById = new Map([
  ["cat-a", "Groceries"],
  ["cat-b", "Fun"],
]);
const ownerNameById = new Map([["m-1", "Nirjal"]]);

function raw(allocations: RawPlan["allocations"]): RawPlan {
  return { allocations, summary: "test" };
}

describe("buildPlan", () => {
  it("converts shares to amounts and maps tokens and owners", () => {
    const result = buildPlan({
      categoryNameById,
      ownerNameById,
      profile,
      raw: raw([
        { owner: "m1", rationale: "r1", shareOfEnvelope: 0.2, token: "c1" },
        { owner: "shared", rationale: "r2", shareOfEnvelope: 0.1, token: "c2" },
      ]),
    });

    expect(result.rows).toEqual([
      {
        categoryId: "cat-a",
        categoryName: "Groceries",
        ownerMemberId: "m-1",
        ownerName: "Nirjal",
        plannedAmount: 2000,
        rationale: "r1",
        share: 0.2,
        token: "c1",
      },
      {
        categoryId: "cat-b",
        categoryName: "Fun",
        ownerMemberId: null,
        ownerName: "Shared",
        plannedAmount: 1000,
        rationale: "r2",
        share: 0.1,
        token: "c2",
      },
    ]);
    expect(result.totalPlanned).toBe(3000);
    expect(result.month).toBe(2);
    expect(result.year).toBe(2026);
  });

  it("drops unknown tokens and owners with a warning", () => {
    const result = buildPlan({
      categoryNameById,
      ownerNameById,
      profile,
      raw: raw([
        { owner: "m1", rationale: "r", shareOfEnvelope: 0.1, token: "c99" },
        { owner: "m9", rationale: "r", shareOfEnvelope: 0.1, token: "c1" },
      ]),
    });

    expect(result.rows).toHaveLength(0);
    expect(result.warnings.join(" ")).toContain("c99");
    expect(result.warnings.join(" ")).toContain("m9");
  });

  it("scales allocations back into the flexible pool", () => {
    const result = buildPlan({
      categoryNameById,
      ownerNameById,
      profile,
      raw: raw([
        { owner: "shared", rationale: "r", shareOfEnvelope: 0.5, token: "c1" },
        { owner: "shared", rationale: "r", shareOfEnvelope: 0.5, token: "c2" },
      ]),
    });

    expect(result.totalPlanned).toBe(4000);
    expect(result.rows.reduce((s, r) => s + r.share, 0)).toBeCloseTo(0.4, 5);
    expect(result.warnings.join(" ")).toContain("scaled down");
  });

  it("warns when a flexible category with history gets no allocation", () => {
    const result = buildPlan({
      categoryNameById,
      ownerNameById,
      profile,
      raw: raw([{ owner: "m1", rationale: "r", shareOfEnvelope: 0.2, token: "c1" }]),
    });

    expect(result.warnings.join(" ")).toContain("Fun");
  });

  it("ignores duplicate token+owner allocations", () => {
    const result = buildPlan({
      categoryNameById,
      ownerNameById,
      profile,
      raw: raw([
        { owner: "m1", rationale: "a", shareOfEnvelope: 0.1, token: "c1" },
        { owner: "m1", rationale: "b", shareOfEnvelope: 0.1, token: "c1" },
      ]),
    });

    expect(result.rows).toHaveLength(1);
  });
});
