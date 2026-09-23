import { describe, expect, it } from "vitest";

import type { FixedFloor } from "./fixed-floor";
import { buildMaskedContext } from "./mask-financial-context";
import { buildPlanPrompt } from "./plan-prompt";
import { buildProfile, type ProfileCategoryRow, type ProfileExpenseRow } from "./profile";

const categories: ProfileCategoryRow[] = [
  { archived: false, budgetType: "flexible", groupName: "Household", id: "cat-a", name: "Groceries" },
  { archived: false, budgetType: "flexible", groupName: "Lifestyle", id: "cat-b", name: "Loan for Rajesh" },
];

const noFixedFloor: FixedFloor = { byCategory: [], byOwner: [], total: 0 };

const expenses: ProfileExpenseRow[] = [
  { amount: "987654", categoryId: "cat-a", date: "2026-01-10", ownerMemberId: "m-1" },
];

const masked = buildMaskedContext(
  buildProfile({
    categories,
    dateFormat: "english",
    expenses,
    fixedFloor: noFixedFloor,
    incomes: [{ amount: "1000000", month: 1, year: 2026 }],
    periods: [{ month: 1, year: 2026 }],
    planningPeriod: { month: 2, year: 2026 },
  }),
);

const prompt = buildPlanPrompt(masked);

describe("buildPlanPrompt", () => {
  it("lists every category token and owner token", () => {
    for (const category of masked.categories) expect(prompt).toContain(category.token);
    for (const owner of masked.owners) expect(prompt).toContain(owner);
  });

  it("states the flexible pool share", () => {
    expect(prompt).toContain(`flexible pool ${masked.envelope.flexibleShare}`);
  });

  it("carries no raw amounts or custom names", () => {
    expect(prompt).not.toContain("987654");
    expect(prompt).not.toContain("1000000");
    expect(prompt).not.toContain("Rajesh");
  });
});
