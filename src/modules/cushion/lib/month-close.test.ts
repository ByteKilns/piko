import { describe, expect, it } from "vitest";

import { checkSplit, cushionBalance } from "./month-close";

const NONE = { cushion: 0, funds: [], loans: [], savings: [] };

describe("checkSplit", () => {
  it("accepts extra money split exactly", () => {
    expect(
      checkSplit(10000, {
        cushion: 2000,
        funds: [{ amount: 3000, fundId: "festivals" }],
        loans: [{ amount: 4000, loanId: "raju" }],
        savings: [{ amount: 1000, potId: "shared" }],
      }),
    ).toBeNull();
  });

  it("refuses a split that doesn't add up", () => {
    expect(checkSplit(10000, { ...NONE, cushion: 9000 })).toBe("The parts add up to Rs 9,000.00, not Rs 10,000.00");
  });

  it("refuses a part below zero", () => {
    expect(checkSplit(1000, { ...NONE, cushion: 2000, savings: [{ amount: -1000, potId: "shared" }] })).toBe("No part can be below zero");
  });

  it("settles a month that went over from the cushion, whole", () => {
    expect(checkSplit(-2000, { ...NONE, cushion: -2000 })).toBeNull();
    expect(checkSplit(-2000, { ...NONE, cushion: -1000 })).toBe("A month that went over comes from the cushion");
    expect(checkSplit(-2000, { ...NONE, cushion: -2000, savings: [{ amount: 0, potId: "shared" }] })).toBe(
      "A month that went over comes from the cushion",
    );
  });

  it("takes a month that came out even", () => {
    expect(checkSplit(0, NONE)).toBeNull();
  });
});

describe("cushionBalance", () => {
  it("adds up money kept, months that went over and corrections", () => {
    expect(cushionBalance([{ amount: 20000 }, { amount: -2500.5 }, { amount: 4200 }])).toBe(21699.5);
  });

  it("starts at zero", () => {
    expect(cushionBalance([])).toBe(0);
  });
});
