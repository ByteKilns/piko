import { describe, expect, it } from "vitest";

import { meterWidths } from "./meter";

describe("meterWidths", () => {
  it("fills proportionally up to 100%", () => {
    expect(meterWidths(0.5)).toEqual({ fill: 50, over: 0 });
    expect(meterWidths(1)).toEqual({ fill: 100, over: 0 });
  });

  it("splits ink and red past 100% so the bar keeps its length", () => {
    expect(meterWidths(2)).toEqual({ fill: 50, over: 50 });
    const widths = meterWidths(1.48);
    expect(widths.fill).toBeCloseTo(67.57, 2);
    expect(widths.over).toBeCloseTo(32.43, 2);
  });

  it("is empty for zero, negative or NaN ratios", () => {
    expect(meterWidths(0)).toEqual({ fill: 0, over: 0 });
    expect(meterWidths(-1)).toEqual({ fill: 0, over: 0 });
    expect(meterWidths(Number.NaN)).toEqual({ fill: 0, over: 0 });
  });

  it("is all red when something was spent against a zero budget", () => {
    expect(meterWidths(Number.POSITIVE_INFINITY)).toEqual({ fill: 0, over: 100 });
  });
});
