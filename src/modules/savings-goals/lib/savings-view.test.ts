import { describe, expect, it } from "vitest";

import { suggestedEmergencyTarget } from "./savings-view";

describe("suggestedEmergencyTarget", () => {
  it("returns three times the average monthly spending, rounded", () => {
    expect(suggestedEmergencyTarget([10000, 12000, 14000])).toBe(36000);
    expect(suggestedEmergencyTarget([10000, 10001, 10000])).toBe(30001);
  });

  it("returns zero with no history", () => {
    expect(suggestedEmergencyTarget([])).toBe(0);
  });
});
