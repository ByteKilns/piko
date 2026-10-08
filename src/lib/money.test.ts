import { describe, expect, it } from "vitest";

import { formatMoney, sanitizeAmountInput, splitAmount } from "./money";

describe("splitAmount", () => {
  it("groups rupees with commas and keeps two-digit paisa", () => {
    expect(splitAmount(179291.88)).toEqual({ decimals: ".88", integer: "179,291", negative: false });
  });

  it("pads whole amounts with .00", () => {
    expect(splitAmount(512)).toEqual({ decimals: ".00", integer: "512", negative: false });
  });

  it("rounds to the nearest paisa", () => {
    expect(splitAmount(2974.199)).toEqual({ decimals: ".20", integer: "2,974", negative: false });
  });

  it("flags negatives and keeps the sign out of the digits", () => {
    expect(splitAmount(-23691.88)).toEqual({ decimals: ".88", integer: "23,691", negative: true });
  });

  it("never shows a negative zero", () => {
    expect(splitAmount(-0.004)).toEqual({ decimals: ".00", integer: "0", negative: false });
  });

  it("shows zero for non-finite input instead of NaN", () => {
    expect(splitAmount(Number.NaN)).toEqual({ decimals: ".00", integer: "0", negative: false });
    expect(splitAmount(Number.POSITIVE_INFINITY)).toEqual({ decimals: ".00", integer: "0", negative: false });
  });
});

describe("formatMoney", () => {
  it("prefixes Rs and puts the minus after it", () => {
    expect(formatMoney(-23691.88)).toBe("Rs \u221223,691.88");
  });

  it("can leave the currency off", () => {
    expect(formatMoney(1500, { currency: false })).toBe("1,500.00");
  });
});

describe("sanitizeAmountInput", () => {
  it("drops currency text and thousands separators from pasted amounts", () => {
    expect(sanitizeAmountInput("Rs 1,500.50")).toBe("1500.50");
  });

  it("keeps only the first decimal point", () => {
    expect(sanitizeAmountInput("1.2.3")).toBe("1.23");
  });

  it("limits paisa to two places", () => {
    expect(sanitizeAmountInput("12.345")).toBe("12.34");
  });

  it("allows an amount that starts with the point", () => {
    expect(sanitizeAmountInput(".5")).toBe(".5");
  });

  it("doesn't mistake the dot in 'Rs.' or 'रु.' for the decimal point", () => {
    expect(sanitizeAmountInput("Rs. 1,500.50")).toBe("1500.50");
    expect(sanitizeAmountInput("Rs.1500")).toBe("1500");
    expect(sanitizeAmountInput("रु. 1,500")).toBe("1500");
    expect(sanitizeAmountInput("NPR. 2,000")).toBe("2000");
  });

  it("keeps a point typed on its own or at the end, so typing '.5' or '12.' isn't blocked", () => {
    expect(sanitizeAmountInput(".")).toBe(".");
    expect(sanitizeAmountInput("12.")).toBe("12.");
  });

  it("returns an empty string when nothing numeric is left", () => {
    expect(sanitizeAmountInput("abc")).toBe("");
  });
});
