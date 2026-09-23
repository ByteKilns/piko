import { describe, expect, it } from "vitest";

import { clamp, coefficientOfVariation, lowerMedian, roundTo, shareOf } from "./stats";

describe("lowerMedian", () => {
  it("returns the middle value for an odd count", () => {
    expect(lowerMedian([3, 1, 2])).toBe(2);
  });

  it("returns the lower of the two middles for an even count", () => {
    expect(lowerMedian([1, 2, 3, 4])).toBe(2);
  });

  it("returns 0 for an empty list", () => {
    expect(lowerMedian([])).toBe(0);
  });

  it("does not mutate its input", () => {
    const values = [3, 1, 2];
    lowerMedian(values);
    expect(values).toEqual([3, 1, 2]);
  });
});

describe("shareOf", () => {
  it("returns the ratio", () => {
    expect(shareOf(25, 100)).toBe(0.25);
  });

  it("returns 0 when the whole is zero or negative", () => {
    expect(shareOf(5, 0)).toBe(0);
    expect(shareOf(5, -1)).toBe(0);
  });
});

describe("coefficientOfVariation", () => {
  it("returns null with fewer than two values", () => {
    expect(coefficientOfVariation([100])).toBeNull();
    expect(coefficientOfVariation([])).toBeNull();
  });

  it("returns null when the mean is not positive", () => {
    expect(coefficientOfVariation([0, 0])).toBeNull();
  });

  it("computes stddev / mean", () => {
    expect(coefficientOfVariation([10, 20])).toBeCloseTo(1 / 3, 5);
  });
});

describe("roundTo", () => {
  it("rounds to the given number of decimals", () => {
    expect(roundTo(1.2345, 2)).toBe(1.23);
  });

  it("rounds half up", () => {
    expect(roundTo(0.125, 2)).toBe(0.13);
  });
});

describe("clamp", () => {
  it("bounds the value on both sides", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});
