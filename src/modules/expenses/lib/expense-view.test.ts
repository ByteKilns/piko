import { describe, expect, it } from "vitest";

import {
  addDays,
  type ExpenseItem,
  filterExpenses,
  groupByDay,
  NO_FILTER,
  ownerTotals,
  topCategoryIds,
  visibleNote,
} from "./expense-view";

const ME = "me";
const PARTNER = "partner";
const TODAY = "2026-10-08"; // a Thursday

function expense(overrides: Partial<ExpenseItem>): ExpenseItem {
  return {
    amount: 100,
    categoryId: "lunch",
    categoryName: "Lunch",
    date: TODAY,
    id: "e1",
    note: null,
    ownerMemberId: ME,
    paidByMemberId: ME,
    ...overrides,
  };
}

describe("addDays", () => {
  it("moves across month and year boundaries", () => {
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("ownerTotals", () => {
  it("splits spending into me, partner and shared and sums the whole", () => {
    const rows = [
      expense({ amount: 100, id: "a", ownerMemberId: ME }),
      expense({ amount: 250.5, id: "b", ownerMemberId: PARTNER }),
      expense({ amount: 40, id: "c", ownerMemberId: null }),
      expense({ amount: 10, id: "d", ownerMemberId: ME }),
    ];
    expect(ownerTotals(rows, ME)).toEqual({ all: 400.5, me: 110, partner: 250.5, shared: 40 });
  });
});

describe("filterExpenses", () => {
  const rows = [
    expense({ id: "mine", ownerMemberId: ME }),
    expense({ id: "theirs", ownerMemberId: PARTNER, paidByMemberId: PARTNER }),
    expense({ id: "shared", ownerMemberId: null, paidByMemberId: PARTNER }),
  ];
  const ctx = { meId: ME, today: TODAY };
  const ids = (filtered: ExpenseItem[]) => filtered.map((e) => e.id);

  it("keeps everything with no filter", () => {
    expect(ids(filterExpenses(rows, NO_FILTER, ctx))).toEqual(["mine", "theirs", "shared"]);
  });

  it("filters by whose expense it is", () => {
    expect(ids(filterExpenses(rows, { ...NO_FILTER, owner: "me" }, ctx))).toEqual(["mine"]);
    expect(ids(filterExpenses(rows, { ...NO_FILTER, owner: "partner" }, ctx))).toEqual(["theirs"]);
    expect(ids(filterExpenses(rows, { ...NO_FILTER, owner: "shared" }, ctx))).toEqual(["shared"]);
  });

  it("filters by who paid", () => {
    expect(ids(filterExpenses(rows, { ...NO_FILTER, payerId: PARTNER }, ctx))).toEqual(["theirs", "shared"]);
  });

  it("filters by category", () => {
    const mixed = [expense({ categoryId: "lunch", id: "a" }), expense({ categoryId: "petrol", id: "b" })];
    expect(ids(filterExpenses(mixed, { ...NO_FILTER, categoryId: "petrol" }, ctx))).toEqual(["b"]);
  });

  it("searches notes and category names, ignoring case", () => {
    const mixed = [
      expense({ id: "a", note: "Chau chau" }),
      expense({ categoryName: "Petrol", id: "b", note: "Bike" }),
    ];
    expect(ids(filterExpenses(mixed, { ...NO_FILTER, query: "CHAU" }, ctx))).toEqual(["a"]);
    expect(ids(filterExpenses(mixed, { ...NO_FILTER, query: "petr" }, ctx))).toEqual(["b"]);
  });

  it("limits to today or the last 7 days", () => {
    const dated = [
      expense({ date: TODAY, id: "today" }),
      expense({ date: addDays(TODAY, -6), id: "sixDaysAgo" }),
      expense({ date: addDays(TODAY, -7), id: "weekAgo" }),
    ];
    expect(ids(filterExpenses(dated, { ...NO_FILTER, range: "today" }, ctx))).toEqual(["today"]);
    expect(ids(filterExpenses(dated, { ...NO_FILTER, range: "week" }, ctx))).toEqual(["today", "sixDaysAgo"]);
  });
});

describe("groupByDay", () => {
  it("groups newest day first with Today / Yesterday / weekday labels and day totals", () => {
    const rows = [
      expense({ amount: 80, date: TODAY, id: "a" }),
      expense({ amount: 35, date: addDays(TODAY, -3), id: "b" }),
      expense({ amount: 70, date: TODAY, id: "c" }),
      expense({ amount: 25, date: addDays(TODAY, -1), id: "d" }),
    ];
    const groups = groupByDay(rows, { dateFormat: "english", today: TODAY });

    expect(groups.map((g) => [g.label, g.sub, g.total, g.rows.map((r) => r.id)])).toEqual([
      ["Today", "8 Oct, Thursday", 150, ["a", "c"]],
      ["Yesterday", "7 Oct, Wednesday", 25, ["d"]],
      ["Monday", "5 Oct", 35, ["b"]],
    ]);
  });

  it("uses Bikram Sambat dates for nepali households", () => {
    const [group] = groupByDay([expense({ date: "2026-10-05" })], { dateFormat: "nepali", today: TODAY });
    expect(group.sub).toBe("19 Ashwin");
  });
});

describe("topCategoryIds", () => {
  it("ranks categories by how often they were used", () => {
    const rows = [
      expense({ categoryId: "petrol", id: "a" }),
      expense({ categoryId: "lunch", id: "b" }),
      expense({ categoryId: "lunch", id: "c" }),
      expense({ categoryId: "groceries", id: "d" }),
    ];
    expect(topCategoryIds(rows, 2)).toEqual(["lunch", "petrol"]);
  });
});

describe("visibleNote", () => {
  it("hides a note that just repeats the category", () => {
    expect(visibleNote(" lunch ", "Lunch")).toBe("");
    expect(visibleNote(null, "Lunch")).toBe("");
    expect(visibleNote("Bara", "Lunch")).toBe("Bara");
  });
});
