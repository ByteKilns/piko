import { describe, expect, it } from "vitest";

import type { FixedFloor } from "./fixed-floor";
import { buildProfile, type ProfileCategoryRow, type ProfileExpenseRow } from "./profile";
import { tokenize } from "./tokens";

const categories: ProfileCategoryRow[] = [
  { archived: false, budgetType: "flexible", groupName: "Household", id: "cat-a", name: "Groceries" },
  { archived: false, budgetType: "flexible", groupName: "Lifestyle", id: "cat-b", name: "Fun" },
];

const expenses: ProfileExpenseRow[] = [
  { amount: "100", categoryId: "cat-a", date: "2026-01-10", ownerMemberId: null },
  { amount: "50", categoryId: "cat-b", date: "2026-01-11", ownerMemberId: "m-1" },
];

function profile(fixedOwner?: string) {
  const fixed: FixedFloor = {
    byCategory: [],
    byOwner: fixedOwner ? [{ amount: 200, ownerMemberId: fixedOwner }] : [],
    total: fixedOwner ? 200 : 0,
  };
  return buildProfile({
    categories,
    dateFormat: "english",
    expenses,
    fixedFloor: fixed,
    incomes: [{ amount: "1000", month: 1, year: 2026 }],
    periods: [{ month: 1, year: 2026 }],
    planningPeriod: { month: 2, year: 2026 },
  });
}

describe("tokenize", () => {
  it("assigns category tokens in group/name order", () => {
    const tokens = tokenize(profile());
    expect(tokens.categories.map((c) => c.token)).toEqual(["c1", "c2"]);
    expect(tokens.tokenByCategoryId.get("cat-a")).toBe("c1");
    expect(tokens.tokenByCategoryId.get("cat-b")).toBe("c2");
  });

  it("maps owners to member tokens plus shared", () => {
    const tokens = tokenize(profile());
    expect(tokens.owners).toEqual(["m1", "shared"]);
    expect(tokens.memberByToken.get("m1")).toBe("m-1");
    expect(tokens.tokenByOwnerKey.get("shared")).toBe("shared");
  });

  it("includes owners that only appear in the fixed floor", () => {
    const tokens = tokenize(profile("m-2"));
    expect(tokens.owners).toEqual(["m1", "m2", "shared"]);
    expect(tokens.memberByToken.get("m2")).toBe("m-2");
  });
});
