import { describe, expect, it } from "vitest";

import { paybackBalance } from "./payback-balance";

const ME = "me";
const HER = "her";

// The example month the owner agreed: she covers a recharge, a dinner, and
// half of a date, then I hand her Rs 5,000.
const SHE_COVERED = [
  { amount: 800, paidByMemberId: HER, payBackAmount: 800 },
  { amount: 3000, paidByMemberId: HER, payBackAmount: 3000 },
  { amount: 3000, paidByMemberId: HER, payBackAmount: 1500 },
];

describe("paybackBalance", () => {
  it("adds up what one person covered for the other", () => {
    expect(paybackBalance(SHE_COVERED, [], [ME, HER])).toEqual({ amount: 5300, creditorId: HER, debtorId: ME });
  });

  it("takes a payback of any amount off the running total", () => {
    const balance = paybackBalance(SHE_COVERED, [{ amount: 5000, fromMemberId: ME, toMemberId: HER }], [ME, HER]);

    expect(balance).toEqual({ amount: 300, creditorId: HER, debtorId: ME });
  });

  it("cancels amounts owed in both directions", () => {
    const balance = paybackBalance([...SHE_COVERED, { amount: 1000, paidByMemberId: ME, payBackAmount: 1000 }], [], [ME, HER]);

    expect(balance).toEqual({ amount: 4300, creditorId: HER, debtorId: ME });
  });

  it("flips direction when someone pays back more than they owe", () => {
    const balance = paybackBalance(SHE_COVERED, [{ amount: 6000, fromMemberId: ME, toMemberId: HER }], [ME, HER]);

    expect(balance).toEqual({ amount: 700, creditorId: ME, debtorId: HER });
  });

  it("returns null when the two are square", () => {
    const balance = paybackBalance(
      [{ amount: 800, paidByMemberId: HER, payBackAmount: 800 }],
      [{ amount: 800, fromMemberId: ME, toMemberId: HER }],
      [ME, HER],
    );

    expect(balance).toBeNull();
  });

  it("never owes more than the expense itself", () => {
    const balance = paybackBalance([{ amount: 1000, paidByMemberId: HER, payBackAmount: 5000 }], [], [ME, HER]);

    expect(balance).toEqual({ amount: 1000, creditorId: HER, debtorId: ME });
  });
});
