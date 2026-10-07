import { describe, expect, it } from "vitest";

import { buildMonthNav } from "./month-nav";

const current = { month: 10, year: 2026 };

describe("buildMonthNav", () => {
  it("links to the previous month and stops at the current one", () => {
    const nav = buildMonthNav({ basePath: "/expenses", current, dateFormat: "english", selected: current });
    expect(nav.label).toBe("October 2026");
    expect(nav.prevHref).toBe("/expenses?year=2026&month=9");
    expect(nav.nextHref).toBeNull();
  });

  it("links forward from a past month", () => {
    const nav = buildMonthNav({ basePath: "/expenses", current, dateFormat: "english", selected: { month: 8, year: 2026 } });
    expect(nav.nextHref).toBe("/expenses?year=2026&month=9");
  });

  it("crosses the year boundary in both directions", () => {
    const nav = buildMonthNav({ basePath: "/reports", current, dateFormat: "english", selected: { month: 1, year: 2026 } });
    expect(nav.prevHref).toBe("/reports?year=2025&month=12");
    expect(buildMonthNav({ basePath: "/reports", current, dateFormat: "english", selected: { month: 12, year: 2025 } }).nextHref).toBe(
      "/reports?year=2026&month=1",
    );
  });

  it("lets Budget go past the current month", () => {
    const nav = buildMonthNav({ allowFuture: true, basePath: "/budget", current, dateFormat: "english", selected: current });
    expect(nav.nextHref).toBe("/budget?year=2026&month=11");
    expect(nav.options[0]).toEqual({ href: "/budget?year=2026&month=11", label: "November 2026", selected: false });
  });

  it("offers the last 12 months, newest first, with the selected one marked", () => {
    const nav = buildMonthNav({ basePath: "/expenses", current, dateFormat: "english", selected: { month: 8, year: 2026 } });
    expect(nav.options).toHaveLength(12);
    expect(nav.options[0].label).toBe("October 2026");
    expect(nav.options[11].label).toBe("November 2025");
    expect(nav.options.filter((o) => o.selected).map((o) => o.label)).toEqual(["August 2026"]);
  });

  it("marks nothing when the selected month is older than the menu", () => {
    const nav = buildMonthNav({ basePath: "/expenses", current, dateFormat: "english", selected: { month: 1, year: 2024 } });
    expect(nav.options.some((o) => o.selected)).toBe(false);
    expect(nav.label).toBe("January 2024");
  });

  it("uses Bikram Sambat month names for nepali households", () => {
    const nav = buildMonthNav({ basePath: "/expenses", current: { month: 6, year: 2083 }, dateFormat: "nepali", selected: { month: 1, year: 2083 } });
    expect(nav.label).toBe("Baisakh 2083");
  });
});
