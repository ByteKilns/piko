import { describe, expect, it } from "vitest";

import type { FixedFloor } from "./fixed-floor";
import { buildMaskedContext } from "./mask-financial-context";
import { buildProfile, type ProfileCategoryRow, type ProfileExpenseRow } from "./profile";

const noFixedFloor: FixedFloor = { byCategory: [], byOwner: [], total: 0 };

// Sentinel values that must never appear in the masked payload.
function sentinelProfile() {
  const categories: ProfileCategoryRow[] = [
    { archived: false, budgetType: "flexible", groupName: "Household", id: "cat-1", name: "Groceries" },
    { archived: false, budgetType: "flexible", groupName: "Personal", id: "cat-2", name: "Loan for Rajesh's shop" },
  ];
  const expense = {
    amount: "987654",
    categoryId: "cat-1",
    date: "2026-01-10",
    note: "secret note",
    ownerMemberId: "member-rajesh-id",
  };

  return buildProfile({
    categories,
    dateFormat: "english",
    expenses: [expense as ProfileExpenseRow],
    fixedFloor: noFixedFloor,
    incomes: [{ amount: "1000000", month: 1, year: 2026 }],
    periods: [{ month: 1, year: 2026 }],
    planningPeriod: { month: 2, year: 2026 },
  });
}

const masked = buildMaskedContext(sentinelProfile());
const json = JSON.stringify(masked);

describe("buildMaskedContext — no-leak guarantees", () => {
  it("never includes a raw amount or income", () => {
    expect(json).not.toContain("987654");
    expect(json).not.toContain("1000000");
  });

  it("never includes a custom category name", () => {
    expect(json).not.toContain("Rajesh");
  });

  it("never includes note text", () => {
    expect(json).not.toContain("secret note");
  });

  it("never includes raw ids", () => {
    expect(json).not.toContain("cat-1");
    expect(json).not.toContain("cat-2");
    expect(json).not.toContain("member-rajesh-id");
  });

  it("never includes dates", () => {
    expect(json).not.toContain("2026-01-10");
  });
});

describe("buildMaskedContext — shape", () => {
  it("keys categories by opaque tokens", () => {
    expect(masked.categories.map((c) => c.token)).toEqual(["c1", "c2"]);
  });

  it("keeps the default label and nulls the custom one", () => {
    expect(masked.categories[0]).toMatchObject({ group: "Household", label: "Groceries", token: "c1" });
    expect(masked.categories[1]).toMatchObject({ group: "Personal", label: null, token: "c2" });
  });

  it("expresses spend as a share of the envelope", () => {
    expect(masked.categories[0].spendShares).toEqual([0.988]);
  });

  it("maps owners to tokens", () => {
    expect(masked.owners).toEqual(["m1"]);
    expect(masked.categories[0].ownerSplit).toEqual({ m1: 1 });
  });

  it("matches the committed golden payload", () => {
    expect(JSON.stringify(masked, null, 2)).toMatchSnapshot();
  });
});
