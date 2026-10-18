import { describe, expect, it } from "vitest";

import type { BudgetLine, CategoryChange } from "./reports-stats";
import { chartLabelPosition, expenseLead, paceMarker } from "./reports-view";

const change = (name: string, delta: number, categoryId = name): CategoryChange => ({
  categoryId,
  current: 0,
  delta,
  groupName: "Other",
  name,
  pct: null,
  previous: 0,
  tone: "blue",
});

const line = (name: string, planned: number, spent: number, categoryId = name): BudgetLine => ({
  categoryId,
  groupName: "Other",
  name,
  planned,
  spent,
  tone: "blue",
});

describe("expenseLead", () => {
  it("names the category that both moved most and is over budget", () => {
    const lead = expenseLead({
      budgetLines: [line("Family Support", 40000, 84765)],
      changes: [change("Family Support", 24765)],
      current: 158892,
      prevMonthName: "Bhadra",
      previous: 158000,
    });
    expect(lead.overall).toBe("Overall, spending is about the same as Bhadra.");
    expect(lead.exceptionStrong).toBe("Family Support");
    expect(lead.exceptionRest).toContain("is the exception");
    expect(lead.exceptionRest).toContain("over its budget");
  });

  it("falls back to the biggest mover when nothing is over budget", () => {
    const lead = expenseLead({
      budgetLines: [],
      changes: [change("Internet", 10951)],
      current: 20000,
      prevMonthName: "Bhadra",
      previous: 10000,
    });
    expect(lead.overall).toBe("Overall, spending is 100% more than Bhadra.");
    expect(lead.exceptionStrong).toBe("Internet");
    expect(lead.exceptionRest).toContain("moved the most");
  });

  it("has no exception when nothing stands out", () => {
    const lead = expenseLead({
      budgetLines: [],
      changes: [],
      current: 10000,
      prevMonthName: "Bhadra",
      previous: 10000,
    });
    expect(lead.exceptionStrong).toBe("");
    expect(lead.exceptionRest).toBe("");
  });
});

describe("chartLabelPosition", () => {
  it("puts the label to the right of a marker in the left half of the chart", () => {
    expect(chartLabelPosition(10, 30, 14)).toEqual({ align: "start", style: { left: `calc(${(10 / 30) * 100}% + 14px)` } });
  });

  it("puts the label to the left of a marker in the right half, so it never runs past the chart's edge", () => {
    expect(chartLabelPosition(30, 30, 14)).toEqual({ align: "end", style: { right: "calc(0% + 14px)" } });
    expect(chartLabelPosition(24, 30, 10)).toEqual({ align: "end", style: { right: "calc(20% + 10px)" } });
  });

  it("keeps a marker exactly half way on the right side", () => {
    expect(chartLabelPosition(15, 30, 14).align).toBe("start");
  });
});

describe("paceMarker", () => {
  it("sits as high up the chart as the running total, not mirrored", () => {
    expect(paceMarker({ isCurrent: true, value: 178_148, yMax: 200_000 }).bottom).toBe(`${(178_148 / 200_000) * 100}%`);
    expect(paceMarker({ isCurrent: true, value: 0, yMax: 200_000 }).bottom).toBe("0%");
  });

  it("says Today for this month and Month end for a month that's over", () => {
    expect(paceMarker({ isCurrent: true, value: 1, yMax: 2 }).caption).toBe("Today");
    expect(paceMarker({ isCurrent: false, value: 1, yMax: 2 }).caption).toBe("Month end");
  });

  it("puts its label just above the point, where the line (a running total, so never higher to the left) can't cross it", () => {
    expect(paceMarker({ isCurrent: false, value: 50, yMax: 100 }).labelBottom).toBe("calc(50% + 8px)");
    // Even at the top: the chart leaves room above it.
    expect(paceMarker({ isCurrent: false, value: 100, yMax: 100 }).labelBottom).toBe("calc(100% + 8px)");
    // And at the bottom, clear of the axis.
    expect(paceMarker({ isCurrent: true, value: 0, yMax: 100 }).labelBottom).toBe("calc(0% + 8px)");
  });
});
