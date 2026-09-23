import { describe, expect, it } from "vitest";

import type { FixedFloor } from "./fixed-floor";
import { buildMaskedContext } from "./mask-financial-context";
import { mockPlan } from "./mock-plan";
import { buildProfile, type ProfileCategoryRow, type ProfileExpenseRow } from "./profile";

const categories: ProfileCategoryRow[] = [
  { archived: false, budgetType: "fixed", groupName: "Obligations", id: "cat-emi", name: "EMI" },
  { archived: false, budgetType: "flexible", groupName: "Household", id: "cat-a", name: "Groceries" },
  { archived: false, budgetType: "flexible", groupName: "Lifestyle", id: "cat-b", name: "Fun" },
];

const noFixedFloor: FixedFloor = { byCategory: [], byOwner: [], total: 0 };

const expenses: ProfileExpenseRow[] = [
  { amount: "2000", categoryId: "cat-a", date: "2026-01-10", ownerMemberId: "m-1" },
  { amount: "1000", categoryId: "cat-b", date: "2026-01-12", ownerMemberId: null },
];

const masked = buildMaskedContext(
  buildProfile({
    categories,
    dateFormat: "english",
    expenses,
    fixedFloor: noFixedFloor,
    incomes: [{ amount: "10000", month: 1, year: 2026 }],
    periods: [{ month: 1, year: 2026 }],
    planningPeriod: { month: 2, year: 2026 },
  }),
);

describe("mockPlan", () => {
  it("is deterministic", () => {
    expect(mockPlan(masked)).toEqual(mockPlan(masked));
  });

  it("uses only known category and owner tokens", () => {
    const validTokens = new Set(masked.categories.map((c) => c.token));
    const validOwners = new Set(masked.owners);
    for (const allocation of mockPlan(masked).allocations) {
      expect(validTokens.has(allocation.token)).toBe(true);
      expect(validOwners.has(allocation.owner)).toBe(true);
    }
  });

  it("stays within the flexible pool", () => {
    const total = mockPlan(masked).allocations.reduce((s, a) => s + a.shareOfEnvelope, 0);
    expect(total).toBeLessThanOrEqual(masked.envelope.flexibleShare + 0.01);
  });

  it("allocates something to every flexible category and skips fixed ones", () => {
    const tokens = mockPlan(masked).allocations.map((a) => a.token).sort();
    const flexibleTokens = masked.categories.filter((c) => c.budgetType === "flexible").map((c) => c.token).sort();
    expect(tokens).toEqual(flexibleTokens);
  });
});
