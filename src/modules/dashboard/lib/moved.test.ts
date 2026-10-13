import { describe, expect, it } from "vitest";

import { movedThisMonth } from "./moved";

const OCTOBER = { endDate: "2026-10-31", startDate: "2026-10-01" };

describe("movedThisMonth", () => {
  it("adds up savings deposits, dhuku payments and repayments on loans taken", () => {
    const moved = movedThisMonth({
      ...OCTOBER,
      deposits: [
        { amount: 10000, date: "2026-10-02", kind: "deposit" },
        { amount: 40000, date: "2026-10-01", kind: "opening" },
        { amount: 250, date: "2026-10-31", kind: "interest" },
      ],
      dhukuEntries: [
        { amount: 3300, date: "2026-10-04", type: "contribution" },
        { amount: 100, date: "2026-10-04", type: "fine" },
        { amount: 34200, date: "2026-10-04", type: "payout" },
      ],
      funds: 0,
      loanPayments: [
        { amount: 5000, date: "2026-10-10", direction: "taken" },
        { amount: 2000, date: "2026-10-12", direction: "given" },
      ],
    });

    expect(moved).toEqual({ dhuku: 3400, funds: 0, loans: 5000, savings: 10000, total: 18400 });
  });

  it("adds money put into funds", () => {
    const moved = movedThisMonth({ ...OCTOBER, deposits: [], dhukuEntries: [], funds: 1225, loanPayments: [] });

    expect(moved).toEqual({ dhuku: 0, funds: 1225, loans: 0, savings: 0, total: 1225 });
  });

  it("ignores anything outside the month", () => {
    const moved = movedThisMonth({
      ...OCTOBER,
      deposits: [{ amount: 10000, date: "2026-09-30", kind: "deposit" }],
      dhukuEntries: [{ amount: 3000, date: "2026-11-01", type: "contribution" }],
      funds: 0,
      loanPayments: [{ amount: 5000, date: "2026-09-15", direction: "taken" }],
    });

    expect(moved).toEqual({ dhuku: 0, funds: 0, loans: 0, savings: 0, total: 0 });
  });
});
