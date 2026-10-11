import { describe, expect, it } from "vitest";

import { potBalance, putInBetween } from "./savings-math";

const DEPOSITS = [
  { amount: 40000, date: "2026-10-01", kind: "opening" as const, memberId: null, potId: "shared" },
  { amount: 10000, date: "2026-10-02", kind: "deposit" as const, memberId: "me", potId: "shared" },
  { amount: 5000, date: "2026-10-07", kind: "deposit" as const, memberId: "her", potId: "shared" },
  { amount: 250, date: "2026-10-31", kind: "interest" as const, memberId: null, potId: "shared" },
  { amount: 10000, date: "2026-09-02", kind: "deposit" as const, memberId: "me", potId: "shared" },
  { amount: 3000, date: "2026-10-03", kind: "deposit" as const, memberId: "me", potId: "mine" },
];

describe("potBalance", () => {
  it("is everything put in, opening balance and interest included, less what was paid from it", () => {
    const balance = potBalance("shared", DEPOSITS, [
      { amount: 20000, savingsPotId: "shared" },
      { amount: 999, savingsPotId: "mine" },
    ]);

    expect(balance).toBe(45250);
  });

  it("only looks at its own pot", () => {
    expect(potBalance("mine", DEPOSITS, [])).toBe(3000);
  });
});

describe("putInBetween", () => {
  it("counts real deposits in the dates given, not the opening balance or interest", () => {
    expect(putInBetween("shared", DEPOSITS, "2026-10-01", "2026-10-31")).toBe(15000);
  });
});
