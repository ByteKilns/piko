import { describe, expect, it } from "vitest";

import { expenseSchema } from "./expense.schema";

const FUND = "11111111-1111-4111-8111-111111111111";
const POT = "22222222-2222-4222-8222-222222222222";
const base = {
  amount: 14690,
  categoryId: "33333333-3333-4333-8333-333333333333",
  date: "2026-10-20",
  ownerMemberId: null,
  paidByMemberId: "44444444-4444-4444-8444-444444444444",
};

describe("expenseSchema and funds", () => {
  it("takes an expense paid from a fund", () => {
    expect(expenseSchema.safeParse({ ...base, fundId: FUND }).success).toBe(true);
  });

  it("refuses an expense paid from a fund that's also to be paid back", () => {
    expect(expenseSchema.safeParse({ ...base, fundId: FUND, payBackAmount: 1000 }).success).toBe(false);
  });

  it("refuses an expense paid from both a fund and savings", () => {
    expect(expenseSchema.safeParse({ ...base, fundId: FUND, savingsPotId: POT }).success).toBe(false);
  });
});
