import { describe, expect, it } from "vitest";

import { type DatedLine, kindOf, lastKindByCategory, planLinesForMonth } from "./plan-lines";

const ME = "me";
const HER = "her";

function line(overrides: Partial<DatedLine>): DatedLine {
  return { categoryId: "petrol", id: "l1", kind: null, month: 6, ownerMemberId: ME, plannedAmount: 6500, year: 2083, ...overrides };
}

describe("kindOf", () => {
  it("keeps a kind the person chose", () => {
    expect(kindOf("can_cut", "fixed")).toBe("can_cut");
  });

  it("follows the category when none was chosen", () => {
    expect(kindOf(null, "fixed")).toBe("fixed");
    expect(kindOf(null, "flexible")).toBe("essential");
    expect(kindOf(null, undefined)).toBe("essential");
  });
});

describe("planLinesForMonth", () => {
  it("uses a person's own lines in that month", () => {
    const lines = [line({ id: "asoj", month: 6 }), line({ id: "kartik", month: 7, plannedAmount: 7000 })];

    expect(planLinesForMonth(lines, { month: 7, year: 2083 }, new Set())).toEqual([
      { ...lines[1], inherited: false },
    ]);
  });

  it("carries a person's latest earlier month into a month where they have none", () => {
    const lines = [
      line({ categoryId: "lunch", id: "bhadra", month: 5 }),
      line({ categoryId: "petrol", id: "asoj-petrol", month: 6 }),
      line({ categoryId: "groceries", id: "asoj-groceries", month: 6 }),
    ];

    const plan = planLinesForMonth(lines, { month: 8, year: 2083 }, new Set());

    expect(plan.map((l) => l.id)).toEqual(["asoj-petrol", "asoj-groceries"]);
    expect(plan.every((l) => l.inherited)).toBe(true);
  });

  it("carries over across a year end", () => {
    const lines = [line({ id: "chaitra", month: 12, year: 2083 })];

    expect(planLinesForMonth(lines, { month: 1, year: 2084 }, new Set()).map((l) => l.id)).toEqual(["chaitra"]);
  });

  it("works each person out on their own", () => {
    const lines = [line({ id: "mine-asoj", month: 6 }), line({ id: "hers-kartik", month: 7, ownerMemberId: HER })];

    const plan = planLinesForMonth(lines, { month: 7, year: 2083 }, new Set());

    expect(plan.map((l) => [l.id, l.inherited])).toEqual([
      ["mine-asoj", true],
      ["hers-kartik", false],
    ]);
  });

  it("never looks ahead to later months", () => {
    expect(planLinesForMonth([line({ month: 8 })], { month: 7, year: 2083 }, new Set())).toEqual([]);
  });

  it("leaves archived categories out of a carried-over plan, but not out of the month they were set in", () => {
    const lines = [line({ categoryId: "savings", id: "asoj-savings", month: 6 }), line({ id: "asoj-petrol", month: 6 })];
    const archived = new Set(["savings"]);

    expect(planLinesForMonth(lines, { month: 7, year: 2083 }, archived).map((l) => l.id)).toEqual(["asoj-petrol"]);
    expect(planLinesForMonth(lines, { month: 6, year: 2083 }, archived).map((l) => l.id)).toEqual(["asoj-savings", "asoj-petrol"]);
  });

  it("keeps shared lines in their own month only", () => {
    const shared = line({ id: "shared-bhadra", month: 5, ownerMemberId: null });

    expect(planLinesForMonth([shared], { month: 5, year: 2083 }, new Set())).toEqual([{ ...shared, inherited: false }]);
    expect(planLinesForMonth([shared], { month: 6, year: 2083 }, new Set())).toEqual([]);
  });
});

describe("lastKindByCategory", () => {
  it("remembers the latest kind a person chose for each category", () => {
    const lines = [
      line({ categoryId: "lunch", kind: "essential", month: 5 }),
      line({ categoryId: "lunch", kind: "can_cut", month: 6 }),
      line({ categoryId: "petrol", kind: null, month: 6 }),
      line({ categoryId: "dates", kind: "can_cut", month: 6, ownerMemberId: HER }),
    ];

    expect(lastKindByCategory(lines, ME)).toEqual({ lunch: "can_cut" });
  });
});
