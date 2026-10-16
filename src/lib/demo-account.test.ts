import { describe, expect, it } from "vitest";

import { assertNotDemo, DEMO_LOCKED_MESSAGE, isDemoEmail } from "./demo-account";

describe("isDemoEmail", () => {
  it("is true for an address on the demo domain, in any case", () => {
    expect(isDemoEmail("aarav.0f3c@demo.piko.invalid")).toBe(true);
    expect(isDemoEmail("Sita.0f3c@DEMO.PIKO.INVALID")).toBe(true);
  });

  it("is false for real addresses and look-alikes", () => {
    expect(isDemoEmail("someone@gmail.com")).toBe(false);
    expect(isDemoEmail("demo.piko.invalid@gmail.com")).toBe(false);
    expect(isDemoEmail("x@notdemo.piko.invalid")).toBe(false);
    expect(isDemoEmail("x@demo.piko.invalid.example.com")).toBe(false);
  });

  it("is false when there is no email", () => {
    expect(isDemoEmail(null)).toBe(false);
    expect(isDemoEmail(undefined)).toBe(false);
    expect(isDemoEmail("")).toBe(false);
  });
});

describe("assertNotDemo", () => {
  it("lets a real member through", () => {
    expect(() => assertNotDemo({ isDemo: false })).not.toThrow();
  });

  it("refuses a demo member with the demo message", () => {
    expect(() => assertNotDemo({ isDemo: true })).toThrow(DEMO_LOCKED_MESSAGE);
  });
});
