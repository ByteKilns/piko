import { describe, expect, it } from "vitest";

import type { BudgetLine, CategoryChange } from "./reports-stats";
import { expenseLead } from "./reports-view";

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
