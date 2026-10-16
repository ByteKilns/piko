import { describe, expect, it } from "vitest";

import { DEMO_LIFETIME_HOURS, demoExpiry, demoTimeLeft } from "./demo-constants";

describe("demoExpiry", () => {
  it("is a day after the demo starts", () => {
    const now = new Date("2026-10-15T06:00:00Z");
    expect(DEMO_LIFETIME_HOURS).toBe(24);
    expect(demoExpiry(now).toISOString()).toBe("2026-10-16T06:00:00.000Z");
  });
});

describe("demoTimeLeft", () => {
  const expiresAt = new Date("2026-10-16T06:00:00Z");

  it("counts whole hours left", () => {
    expect(demoTimeLeft(expiresAt, new Date("2026-10-15T06:00:00Z"))).toBe("24 h");
    expect(demoTimeLeft(expiresAt, new Date("2026-10-15T12:59:00Z"))).toBe("17 h");
  });

  it("says under an hour for the last hour, and after it has passed", () => {
    expect(demoTimeLeft(expiresAt, new Date("2026-10-16T05:30:00Z"))).toBe("under an hour");
    expect(demoTimeLeft(expiresAt, new Date("2026-10-16T07:00:00Z"))).toBe("under an hour");
  });
});
