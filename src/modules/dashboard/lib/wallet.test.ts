import { describe, expect, it } from "vitest";

import { walletSpentByMember } from "./wallet";

const ME = "me";
const HER = "her";

describe("walletSpentByMember", () => {
  it("counts each expense against whoever paid, shared ones and gifts included", () => {
    const totals = walletSpentByMember(
      [
        { amount: 1000, paidByMemberId: ME, payBackAmount: null }, // my phone bill
        { amount: 2000, paidByMemberId: ME, payBackAmount: null }, // a date, logged as shared
        { amount: 1500, paidByMemberId: ME, payBackAmount: null }, // a gift for her
      ],
      [ME, HER],
    );

    expect(totals.get(ME)).toBe(4500);
    expect(totals.get(HER)).toBe(0);
  });

  it("moves the to-be-paid-back part onto the other person", () => {
    const totals = walletSpentByMember([{ amount: 3000, paidByMemberId: HER, payBackAmount: 3000 }], [ME, HER]);

    expect(totals.get(HER)).toBe(0);
    expect(totals.get(ME)).toBe(3000);
  });

  it("splits an expense where only half is to be paid back", () => {
    const totals = walletSpentByMember([{ amount: 3000, paidByMemberId: HER, payBackAmount: 1500 }], [ME, HER]);

    expect(totals.get(HER)).toBe(1500);
    expect(totals.get(ME)).toBe(1500);
  });

  it("never moves more than the expense itself", () => {
    const totals = walletSpentByMember([{ amount: 1000, paidByMemberId: HER, payBackAmount: 5000 }], [ME, HER]);

    expect(totals.get(HER)).toBe(0);
    expect(totals.get(ME)).toBe(1000);
  });

  it("ignores pay-back amounts when the household has one person", () => {
    const totals = walletSpentByMember([{ amount: 1000, paidByMemberId: ME, payBackAmount: 1000 }], [ME]);

    expect(totals.get(ME)).toBe(1000);
  });
});
