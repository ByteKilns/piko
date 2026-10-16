import { describe, expect, it } from "vitest";

import { buildRecentGroups } from "./recent-groups";

const categories = [
  { groupName: "Household", icon: null, id: "cat-groceries", name: "Groceries" },
  { groupName: "Lifestyle", icon: "utensils", id: "cat-dining", name: "Dining Out" },
];

function expense(id: string, date: string, amount: string, categoryId: string, note: null | string = null) {
  return { amount, categoryId, date, id, note, ownerMemberId: null, paidByMemberId: "member-1" };
}

describe("buildRecentGroups", () => {
  it("groups by day, newest first, with each row's category", () => {
    const groups = buildRecentGroups(
      [
        expense("e1", "2026-10-15", "450", "cat-dining", "Momo"),
        expense("e2", "2026-10-15", "1200.50", "cat-groceries"),
        expense("e3", "2026-10-14", "300", "cat-groceries"),
      ],
      categories,
      { dateFormat: "english", today: "2026-10-15" },
    );

    expect(groups.map((g) => [g.key, g.label, g.total])).toEqual([
      ["2026-10-15", "Today", 1650.5],
      ["2026-10-14", "Yesterday", 300],
    ]);
    expect(groups[0].rows[0]).toEqual({
      amount: 450,
      categoryGroupName: "Lifestyle",
      categoryIcon: "utensils",
      categoryName: "Dining Out",
      id: "e1",
      note: "Momo",
    });
  });

  it("names a missing category Unknown rather than failing", () => {
    const [group] = buildRecentGroups([expense("e1", "2026-10-15", "10", "cat-gone")], categories, {
      dateFormat: "english",
      today: "2026-10-15",
    });
    expect(group.rows[0]).toMatchObject({ categoryGroupName: "", categoryIcon: null, categoryName: "Unknown" });
  });
});
