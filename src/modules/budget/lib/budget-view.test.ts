import { describe, expect, it } from "vitest";

import { buildBudgetLead, buildPersonPlan, overBudgetRows, sharedRows } from "./budget-view";

const CATEGORIES = [
  { budgetType: "flexible" as const, id: "food", name: "Groceries" },
  { budgetType: "fixed" as const, id: "rent", name: "Rent" },
  { budgetType: "flexible" as const, id: "lunch", name: "Lunch" },
  { budgetType: "flexible" as const, id: "fun", name: "Fun" },
];

describe("buildPersonPlan", () => {
  it("groups lines by kind in the order fixed, essential, can cut", () => {
    const plan = buildPersonPlan({
      categories: CATEGORIES,
      lines: [
        { categoryId: "lunch", inherited: false, kind: "can_cut", plannedAmount: 3000 },
        { categoryId: "food", inherited: false, kind: null, plannedAmount: 5000 },
        { categoryId: "rent", inherited: false, kind: null, plannedAmount: 20000 },
      ],
      spending: [],
    });

    expect(plan.groups.map((g) => [g.label, g.planned])).toEqual([
      ["Fixed", 20000],
      ["Essential", 5000],
      ["Can cut", 3000],
    ]);
    expect(plan.budgeted).toBe(28000);
  });

  it("counts spending against the line for its category", () => {
    const plan = buildPersonPlan({
      categories: CATEGORIES,
      lines: [{ categoryId: "food", inherited: false, kind: "essential", plannedAmount: 5000 }],
      spending: [
        { amount: 1200, categoryId: "food" },
        { amount: 800, categoryId: "food" },
      ],
    });

    expect(plan.groups[0].rows[0]).toMatchObject({ categoryName: "Groceries", planned: 5000, spent: 2000 });
    expect(plan.spentInLines).toBe(2000);
  });

  it("lists spending in categories without a line, biggest first", () => {
    const plan = buildPersonPlan({
      categories: CATEGORIES,
      lines: [{ categoryId: "food", inherited: false, kind: "essential", plannedAmount: 5000 }],
      spending: [
        { amount: 300, categoryId: "lunch" },
        { amount: 900, categoryId: "fun" },
        { amount: 1000, categoryId: "food" },
      ],
    });

    expect(plan.unbudgeted).toEqual([
      { categoryId: "fun", categoryName: "Fun", spent: 900 },
      { categoryId: "lunch", categoryName: "Lunch", spent: 300 },
    ]);
    expect(plan.unbudgetedTotal).toBe(1200);
    expect(plan.totalSpent).toBe(2200);
  });

  it("treats a zero line as no line", () => {
    const plan = buildPersonPlan({
      categories: CATEGORIES,
      lines: [{ categoryId: "lunch", inherited: false, kind: "can_cut", plannedAmount: 0 }],
      spending: [{ amount: 400, categoryId: "lunch" }],
    });

    expect(plan.groups).toEqual([]);
    expect(plan.unbudgeted).toEqual([{ categoryId: "lunch", categoryName: "Lunch", spent: 400 }]);
  });

  it("sorts rows in a group by how much of the line is used", () => {
    const plan = buildPersonPlan({
      categories: CATEGORIES,
      lines: [
        { categoryId: "food", inherited: false, kind: "essential", plannedAmount: 1000 },
        { categoryId: "fun", inherited: false, kind: "essential", plannedAmount: 1000 },
      ],
      spending: [
        { amount: 500, categoryId: "food" },
        { amount: 900, categoryId: "fun" },
      ],
    });

    expect(plan.groups[0].rows.map((r) => r.categoryName)).toEqual(["Fun", "Groceries"]);
  });

  it("keeps whether a line was carried over", () => {
    const plan = buildPersonPlan({
      categories: CATEGORIES,
      lines: [{ categoryId: "food", inherited: true, kind: null, plannedAmount: 5000 }],
      spending: [],
    });

    expect(plan.groups[0].rows[0].inherited).toBe(true);
  });
});

describe("sharedRows", () => {
  it("keeps only shared lines with an amount", () => {
    expect(
      sharedRows(
        [
          { categoryId: "food", ownerMemberId: null, plannedAmount: 1500 },
          { categoryId: "fun", ownerMemberId: null, plannedAmount: 0 },
          { categoryId: "lunch", ownerMemberId: "me", plannedAmount: 3000 },
        ],
        CATEGORIES,
      ),
    ).toEqual([{ categoryId: "food", categoryName: "Groceries", planned: 1500 }]);
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
    const plan = buildPersonPlan({
      categories: CATEGORIES,
      lines: [
        { categoryId: "food", inherited: false, kind: "essential", plannedAmount: 1000 },
        { categoryId: "fun", inherited: false, kind: "can_cut", plannedAmount: 1000 },
      ],
      spending: [
        { amount: 1500, categoryId: "food" },
        { amount: 400, categoryId: "fun" },
      ],
    });
    expect(overBudgetRows(plan)).toEqual([{ categoryName: "Groceries", over: 500 }]);
  });
});
