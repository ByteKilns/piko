import { describe, expect, it } from "vitest";

import { categoryChanges, categorySummary } from "./category-activity";

const category = { budgetType: "flexible", groupName: "Household", name: "Groceries" };

describe("category activity", () => {
  it("summarises a category", () => {
    expect(categorySummary(category)).toBe("Groceries · Household · Flexible");
  });

  it("diffs name, group and type", () => {
    expect(categoryChanges(category, { ...category, budgetType: "fixed", name: "Food" })).toEqual([
      { field: "Name", from: "Groceries", to: "Food" },
      { field: "Type", from: "Flexible", to: "Fixed" },
    ]);
  });
});
