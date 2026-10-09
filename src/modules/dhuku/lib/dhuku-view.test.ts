import { describe, expect, it } from "vitest";

import { addMonths, dhukuMonthCells, dhukuProgress } from "./dhuku-view";

describe("dhukuProgress", () => {
  it("counts contributions, sums amounts, and marks the payout month", () => {
    const progress = dhukuProgress([
      { amount: 3000, date: "2026-01-01", id: "a", note: null, type: "contribution" },
      { amount: 3000, date: "2026-02-01", id: "b", note: null, type: "contribution" },
      { amount: 36000, date: "2026-03-01", id: "c", note: null, type: "payout" },
      { amount: 3000, date: "2026-04-01", id: "d", note: null, type: "contribution" },
    ]);

    expect(progress).toEqual({ contributed: 9000, paidCount: 3, payoutAt: 2, received: 36000 });
  });
});

describe("dhukuMonthCells", () => {
  it("marks paid, next and upcoming months", () => {
    const cells = dhukuMonthCells(4, 2, null, false);
    expect(cells.map((c) => c.state)).toEqual(["paid", "paid", "next", "upcoming"]);
    expect(cells[0].title).toContain("Month 1 · paid");
  });

  it("shows the payout cell even when that month is also paid", () => {
    const cells = dhukuMonthCells(4, 3, 2, false);
    expect(cells[2].state).toBe("payout");
    expect(cells[3].state).toBe("next");
  });

  it("has no next cell once completed", () => {
    const cells = dhukuMonthCells(3, 3, null, true);
    expect(cells.map((c) => c.state)).toEqual(["paid", "paid", "paid"]);
  });
});

describe("addMonths", () => {
  it("adds whole months keeping the day", () => {
    expect(addMonths("2026-01-15", 2)).toBe("2026-03-15");
    expect(addMonths("2026-11-05", 3)).toBe("2027-02-05");
  });
});
