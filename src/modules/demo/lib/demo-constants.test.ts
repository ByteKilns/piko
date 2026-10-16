import { describe, expect, it } from "vitest";

import { DEMO_LIFETIME_HOURS, demoExpiry } from "./demo-constants";

describe("demoExpiry", () => {
  it("is a day after the demo starts", () => {
    const now = new Date("2026-10-15T06:00:00Z");
    expect(DEMO_LIFETIME_HOURS).toBe(24);
    expect(demoExpiry(now).toISOString()).toBe("2026-10-16T06:00:00.000Z");
  });
});
