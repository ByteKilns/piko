import { describe, expect, it } from "vitest";

import { dateFormatChanges, dateFormatLabel, plannerChanges } from "./settings-activity";

describe("settings activity", () => {
  it("labels date formats", () => {
    expect(dateFormatLabel("nepali")).toBe("Nepali (BS)");
    expect(dateFormatLabel("english")).toBe("English (AD)");
  });

  it("diffs the date format and planner toggle, or reports nothing when unchanged", () => {
    expect(dateFormatChanges("nepali", "english")).toEqual([{ field: "Date format", from: "Nepali (BS)", to: "English (AD)" }]);
    expect(dateFormatChanges("nepali", "nepali")).toEqual([]);
    expect(plannerChanges(false, true)).toEqual([{ field: "AI budget planner", from: "Off", to: "On" }]);
    expect(plannerChanges(true, true)).toEqual([]);
  });
});
