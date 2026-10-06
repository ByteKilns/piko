import { describe, expect, it } from "vitest";

import { budgetVsActual, categoryChanges, topExpenses } from "@/modules/reports/lib/reports-stats";

const categories = [
  { groupName: "Household", id: "groceries", name: "Groceries" },
  { groupName: "Transport", id: "transport", name: "Transport" },
  { groupName: "Lifestyle", id: "eating", name: "Eating out" },
  { groupName: "Lifestyle", id: "shopping", name: "Shopping" },
];

describe("budgetVsActual", () => {
  it("sums budget lines and spending per category, overspent first by how much", () => {
    const lines = budgetVsActual(
      [
        { categoryId: "groceries", plannedAmount: 6000 },
        { categoryId: "groceries", plannedAmount: 4000 }, // a second owner's line
        { categoryId: "transport", plannedAmount: 6000 },
        { categoryId: "eating", plannedAmount: 3000 },
      ],
      [
        { amount: 12_400, categoryId: "groceries" },
        { amount: 4100, categoryId: "transport" },
        { amount: 3500, categoryId: "eating" },
      ],
      categories,
    );

    expect(lines.map((l) => [l.name, l.planned, l.spent])).toEqual([
      ["Groceries", 10_000, 12_400],
      ["Eating out", 3000, 3500],
      ["Transport", 6000, 4100],
    ]);
  });

  it("lists spending with no budget after real overspends, and budgets with no spending last", () => {
    const lines = budgetVsActual(
      [
        { categoryId: "transport", plannedAmount: 5000 },
        { categoryId: "eating", plannedAmount: 1000 },
      ],
      [
        { amount: 9000, categoryId: "shopping" },
        { amount: 1200, categoryId: "eating" },
      ],
      categories,
    );

    expect(lines.map((l) => [l.name, l.planned, l.spent])).toEqual([
      ["Eating out", 1000, 1200],
      ["Shopping", 0, 9000],
      ["Transport", 5000, 0],
    ]);
  });
});

describe("categoryChanges", () => {
  it("ranks categories by the size of their change vs last month, ignoring unchanged ones", () => {
    const changes = categoryChanges(
      [
        { amount: 5900, categoryId: "eating" },
        { amount: 4200, categoryId: "transport" },
        { amount: 1000, categoryId: "groceries" },
      ],
      [
        { amount: 3600, categoryId: "eating" },
        { amount: 6000, categoryId: "transport" },
        { amount: 1000, categoryId: "groceries" },
        { amount: 950, categoryId: "shopping" },
      ],
      categories,
    );

    expect(changes.map((c) => [c.name, c.delta, c.pct])).toEqual([
      ["Eating out", 2300, 64],
      ["Transport", -1800, -30],
      ["Shopping", -950, -100],
    ]);
  });

  it("has no percentage for a category new this month", () => {
    const [change] = categoryChanges([{ amount: 500, categoryId: "shopping" }], [], categories);
    expect([change.delta, change.pct]).toEqual([500, null]);
  });

  it("keeps only the biggest `limit` changes", () => {
    const current = categories.map((c, i) => ({ amount: (i + 1) * 100, categoryId: c.id }));
    expect(categoryChanges(current, [], categories, 2).map((c) => c.name)).toEqual(["Shopping", "Eating out"]);
  });
});

describe("topExpenses", () => {
  it("returns the largest expenses first", () => {
    const rows = [5, 50, 20, 40, 10, 30].map((amount, i) => ({ amount, id: String(i) }));
    expect(topExpenses(rows, 3).map((r) => r.amount)).toEqual([50, 40, 30]);
  });
});
