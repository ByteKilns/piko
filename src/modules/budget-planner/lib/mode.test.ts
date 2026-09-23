import { afterEach, describe, expect, it } from "vitest";

import { plannerMode } from "./mode";

const original = process.env.AI_BUDGET_PLANNER;

describe("plannerMode", () => {
  afterEach(() => {
    if (original === undefined) {
      delete process.env.AI_BUDGET_PLANNER;
    } else {
      process.env.AI_BUDGET_PLANNER = original;
    }
  });

  it("is null when unset or off", () => {
    delete process.env.AI_BUDGET_PLANNER;
    expect(plannerMode()).toBeNull();
    process.env.AI_BUDGET_PLANNER = "off";
    expect(plannerMode()).toBeNull();
    process.env.AI_BUDGET_PLANNER = "nonsense";
    expect(plannerMode()).toBeNull();
  });

  it("returns the mode when mock or live", () => {
    process.env.AI_BUDGET_PLANNER = "mock";
    expect(plannerMode()).toBe("mock");
    process.env.AI_BUDGET_PLANNER = "live";
    expect(plannerMode()).toBe("live");
  });
});
