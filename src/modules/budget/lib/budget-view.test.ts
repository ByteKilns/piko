import { describe, expect, it } from "vitest";

import { buildBudgetGroups, buildBudgetLead, overBudgetRows } from "./budget-view";

const CATEGORIES = [
  { budgetType: "flexible" as const, id: "cat-food", name: "Groceries" },
  { budgetType: "fixed" as const, id: "cat-rent", name: "Rent" },
  { budgetType: "flexible" as const, id: "cat-fun", name: "Fun" },
];

describe("buildBudgetGroups", () => {
  it("splits budgeted rows from unbudgeted spend per owner", () => {
    const groups = buildBudgetGroups({
      budgetItems: [{ categoryId: "cat-food", ownerMemberId: null, plannedAmount: "8000" }],
      categories: CATEGORIES,
      expenses: [
        { amount: 3000, categoryId: "cat-food", ownerMemberId: null },
        { amount: 500, categoryId: "cat-fun", ownerMemberId: null },
      ],
      meId: "m1",
      partnerId: "m2",
      partnerName: "Karuna",
    });

    const shared = groups.find((g) => g.key === "shared")!;
    expect(shared.budgeted).toBe(8000);
    expect(shared.spent).toBe(3000);
    expect(shared.rows).toHaveLength(1);
    expect(shared.unbudgeted).toEqual([{ categoryId: "cat-fun", categoryName: "Fun", spent: 500 }]);
    expect(shared.unbudgetedTotal).toBe(500);
    expect(shared.totalSpent).toBe(3500);
  });

  it("attributes spend to the owning member and names the partner group", () => {
    const groups = buildBudgetGroups({
      budgetItems: [{ categoryId: "cat-rent", ownerMemberId: "m2", plannedAmount: "20000" }],
      categories: CATEGORIES,
      expenses: [{ amount: 21000, categoryId: "cat-rent", ownerMemberId: "m2" }],
      meId: "m1",
      partnerId: "m2",
      partnerName: "Karuna",
    });

    const partner = groups.find((g) => g.key === "partner")!;
    expect(partner.name).toBe("Karuna");
    expect(partner.rows[0]).toMatchObject({ categoryName: "Rent", planned: 20000, spent: 21000 });
    expect(groups.find((g) => g.key === "me")!.rows).toHaveLength(0);
  });

  it("sorts budgeted rows by used ratio descending", () => {
    const groups = buildBudgetGroups({
      budgetItems: [
        { categoryId: "cat-food", ownerMemberId: null, plannedAmount: "1000" },
        { categoryId: "cat-fun", ownerMemberId: null, plannedAmount: "1000" },
      ],
      categories: CATEGORIES,
      expenses: [
        { amount: 500, categoryId: "cat-food", ownerMemberId: null },
        { amount: 900, categoryId: "cat-fun", ownerMemberId: null },
      ],
      meId: "m1",
      partnerId: null,
      partnerName: null,
    });

    expect(groups.map((g) => g.key)).toEqual(["me", "shared"]);
    expect(groups.find((g) => g.key === "shared")!.rows.map((r) => r.categoryName)).toEqual(["Fun", "Groceries"]);
  });
});

describe("buildBudgetLead", () => {
  it("names a single over-budget category", () => {
    expect(
      buildBudgetLead({
        allSpent: 10000,
        budgeted: 8000,
        income: 10000,
        outside: 1000,
        overBudget: [{ categoryName: "Rent", over: 500 }],
      }),
    ).toEqual({ outside: "10%", planned: "80%", rest: " is Rs 500.00 over.", strong: "Rent" });
  });

  it("counts multiple over-budget categories", () => {
    const lead = buildBudgetLead({
      allSpent: 10000,
      budgeted: 8000,
      income: 10000,
      outside: 0,
      overBudget: [
        { categoryName: "Rent", over: 500 },
        { categoryName: "Fun", over: 200 },
      ],
    });
    expect(lead.strong).toBe("2 categories");
    expect(lead.rest).toBe(" are over budget.");
  });

  it("celebrates an in-plan budget", () => {
    const lead = buildBudgetLead({ allSpent: 0, budgeted: 0, income: 0, outside: 0, overBudget: [] });
    expect(lead).toMatchObject({ outside: "0%", planned: "0%", strong: "" });
    expect(lead.rest).toBe("Every budget is within plan.");
  });
});

describe("overBudgetRows", () => {
  it("collects only rows that spent more than planned", () => {
    const groups = buildBudgetGroups({
      budgetItems: [
        { categoryId: "cat-food", ownerMemberId: null, plannedAmount: "1000" },
        { categoryId: "cat-fun", ownerMemberId: null, plannedAmount: "1000" },
      ],
      categories: CATEGORIES,
      expenses: [
        { amount: 1500, categoryId: "cat-food", ownerMemberId: null },
        { amount: 400, categoryId: "cat-fun", ownerMemberId: null },
      ],
      meId: "m1",
      partnerId: null,
      partnerName: null,
    });
    expect(overBudgetRows(groups)).toEqual([{ categoryName: "Groceries", over: 500 }]);
  });
});
