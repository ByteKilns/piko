import { describe, expect, it } from "vitest";

import { DEFAULT_CATEGORIES, isDefaultCategory } from "./default-categories";

describe("DEFAULT_CATEGORIES", () => {
  it("has no duplicate name+group pairs", () => {
    const keys = DEFAULT_CATEGORIES.map((c) => `${c.group}::${c.name}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("isDefaultCategory", () => {
  it("matches a known default", () => {
    expect(isDefaultCategory("Groceries", "Household")).toBe(true);
  });

  it("rejects a custom name", () => {
    expect(isDefaultCategory("Loan for Rajesh", "Personal")).toBe(false);
  });

  it("requires the group to match as well as the name", () => {
    expect(isDefaultCategory("Groceries", "Personal")).toBe(false);
  });
});
