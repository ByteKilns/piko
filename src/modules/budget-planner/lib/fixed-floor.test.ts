import { describe, expect, it } from "vitest";

import { type DhukuRow, fixedFloor, type FixedFloorInput, type LoanRow, type RecurringRow } from "./fixed-floor";

// English February 2026: 2026-02-01 .. 2026-02-28.
const period = { month: 2, year: 2026 };

function input(overrides: Partial<FixedFloorInput> = {}): FixedFloorInput {
  return { dhukuEntries: [], dhukus: [], loans: [], recurring: [], ...overrides };
}

function recurring(overrides: Partial<RecurringRow> = {}): RecurringRow {
  return {
    amount: "5000",
    categoryId: "cat-1",
    endDate: null,
    frequency: "monthly",
    nextDueDate: "2026-02-10",
    ownerMemberId: null,
    status: "active",
    ...overrides,
  };
}

describe("fixedFloor", () => {
  it("counts an active monthly bill due in the period", () => {
    const result = fixedFloor(period, "english", input({ recurring: [recurring()] }));

    expect(result.total).toBe(5000);
    expect(result.byCategory).toEqual([{ amount: 5000, categoryId: "cat-1" }]);
    expect(result.byOwner).toEqual([{ amount: 5000, ownerMemberId: null }]);
  });

  it("ignores paused and completed recurring items", () => {
    const result = fixedFloor(
      period,
      "english",
      input({ recurring: [recurring({ status: "paused" }), recurring({ status: "completed" })] }),
    );

    expect(result.total).toBe(0);
  });

  it("counts a yearly item only in its due month", () => {
    const yearly = recurring({ amount: "12000", frequency: "yearly", nextDueDate: "2026-02-15" });

    expect(fixedFloor(period, "english", input({ recurring: [yearly] })).total).toBe(12000);
    expect(fixedFloor({ month: 3, year: 2026 }, "english", input({ recurring: [yearly] })).total).toBe(0);
  });

  it("ignores a monthly item whose endDate is before the period", () => {
    const ended = recurring({ endDate: "2026-01-31" });

    expect(fixedFloor(period, "english", input({ recurring: [ended] })).total).toBe(0);
  });

  it("counts taken loan installments but not given ones", () => {
    const taken: LoanRow = {
      direction: "taken",
      installmentAmount: "3000",
      installmentFrequency: "monthly",
      nextInstallmentDate: "2026-02-05",
      ownerMemberId: "m-1",
    };
    const given: LoanRow = { ...taken, direction: "given" };

    const result = fixedFloor(period, "english", input({ loans: [taken, given] }));

    expect(result.total).toBe(3000);
    expect(result.byOwner).toEqual([{ amount: 3000, ownerMemberId: "m-1" }]);
  });

  it("counts every weekly installment inside the period", () => {
    const weekly: LoanRow = {
      direction: "taken",
      installmentAmount: "1000",
      installmentFrequency: "weekly",
      nextInstallmentDate: "2026-02-02",
      ownerMemberId: null,
    };

    // Feb 2, 9, 16, 23 -> 4 occurrences.
    expect(fixedFloor(period, "english", input({ loans: [weekly] })).total).toBe(4000);
  });

  it("counts active dhuku contributions and skips completed ones", () => {
    const active: DhukuRow = { id: "d1", interestPerMonth: null, monthlyContribution: "2000", ownerMemberId: "m-1", totalMembers: 5 };
    const completed: DhukuRow = { id: "d2", interestPerMonth: null, monthlyContribution: "2000", ownerMemberId: "m-1", totalMembers: 1 };

    const result = fixedFloor(
      period,
      "english",
      input({
        dhukuEntries: [
          { dhukuId: "d1", type: "contribution" },
          { dhukuId: "d2", type: "contribution" },
          { dhukuId: "d2", type: "payout" },
        ],
        dhukus: [active, completed],
      }),
    );

    expect(result.total).toBe(2000);
  });

  it("adds the interest after a dhuku payout", () => {
    const dhuku: DhukuRow = { id: "d1", interestPerMonth: "500", monthlyContribution: "2000", ownerMemberId: null, totalMembers: 5 };

    const result = fixedFloor(
      period,
      "english",
      input({
        dhukuEntries: [
          { dhukuId: "d1", type: "contribution" },
          { dhukuId: "d1", type: "payout" },
        ],
        dhukus: [dhuku],
      }),
    );

    expect(result.total).toBe(2500);
  });
});
