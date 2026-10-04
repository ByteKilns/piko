import { describe, expect, it } from "vitest";

import { groupActivityByDay } from "./activity-days";

// 2026-10-04 10:00 in Kathmandu.
const NOW = new Date("2026-10-04T04:15:00Z");

describe("groupActivityByDay", () => {
  it("groups newest-first entries under Kathmandu-day headings", () => {
    const entries = [
      { createdAt: new Date("2026-10-04T02:00:00Z"), id: "a" },
      { createdAt: new Date("2026-10-03T18:20:00Z"), id: "b" }, // 00:05 on the 4th in Kathmandu
      { createdAt: new Date("2026-10-03T18:10:00Z"), id: "c" }, // 23:55 on the 3rd
      { createdAt: new Date("2026-09-28T06:00:00Z"), id: "d" },
    ];

    const days = groupActivityByDay(entries, "english", NOW);

    expect(days.map((d) => [d.label, d.entries.map((e) => e.id)])).toEqual([
      ["Today", ["a", "b"]],
      ["Yesterday", ["c"]],
      ["28 September 2026", ["d"]],
    ]);
  });

  it("uses the household's BS calendar for older days", () => {
    const days = groupActivityByDay([{ createdAt: new Date("2026-09-28T06:00:00Z") }], "nepali", NOW);
    expect(days[0].label).toBe("12 Ashwin 2083");
  });
});
