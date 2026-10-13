import { describe, expect, it } from "vitest";

import { dhukuSetAsides, loanSetAsides, savingsSetAsides } from "./set-aside";

const ME = "me";
const HER = "her";
const KARTIK = { endDate: "2026-11-16", startDate: "2026-10-18" };

describe("savingsSetAsides", () => {
  const pots = [{ id: "shared", name: "Shared savings" }];

  it("shows this person's plan for each pot against what they put in this month", () => {
    const rows = savingsSetAsides({
      deposits: [
        { amount: 3000, date: "2026-10-20", kind: "deposit", memberId: ME, potId: "shared" },
        { amount: 9000, date: "2026-10-21", kind: "deposit", memberId: HER, potId: "shared" },
        { amount: 2000, date: "2026-09-30", kind: "deposit", memberId: ME, potId: "shared" },
        { amount: 500, date: "2026-10-25", kind: "interest", memberId: null, potId: "shared" },
      ],
      memberId: ME,
      period: KARTIK,
      plans: [
        { memberId: ME, monthlyAmount: 5000, potId: "shared" },
        { memberId: HER, monthlyAmount: 10000, potId: "shared" },
      ],
      pots,
    });

    expect(rows).toEqual([{ done: 3000, id: "savings:shared", kind: "savings", label: "Shared savings", planned: 5000, sub: "Savings" }]);
  });

  it("leaves out pots this person has no plan for", () => {
    expect(savingsSetAsides({ deposits: [], memberId: ME, period: KARTIK, plans: [{ memberId: HER, monthlyAmount: 10000, potId: "shared" }], pots })).toEqual([]);
  });
});

describe("dhukuSetAsides", () => {
  const dhuku = {
    completedAt: null,
    id: "pottery",
    interestPerMonth: 300,
    monthlyContribution: 3000,
    name: "Pottery Dhuku",
    ownerMemberId: ME,
    totalMembers: 12,
  };

  it("plans the contribution until the payout is taken", () => {
    const rows = dhukuSetAsides({
      dhukus: [dhuku],
      entries: [{ amount: 3000, date: "2026-09-20", dhukuId: "pottery", type: "contribution" }],
      memberId: ME,
      period: KARTIK,
    });

    expect(rows).toEqual([{ done: 0, id: "dhuku:pottery", kind: "dhuku", label: "Pottery Dhuku", planned: 3000, sub: "Dhuku" }]);
  });

  it("adds the monthly interest from the month after the payout, and counts this month's contribution as done", () => {
    const rows = dhukuSetAsides({
      dhukus: [dhuku],
      entries: [
        { amount: 33000, date: "2026-08-25", dhukuId: "pottery", type: "payout" },
        { amount: 3300, date: "2026-10-19", dhukuId: "pottery", type: "contribution" },
      ],
      memberId: ME,
      period: KARTIK,
    });

    expect(rows[0]).toMatchObject({ done: 3300, planned: 3300, sub: "Dhuku, with interest" });
  });

  it("leaves out other people's, completed and fully paid dhukus", () => {
    const paidUp = Array.from({ length: 12 }, (_, i) => ({ amount: 3000, date: `2025-${String(i + 1).padStart(2, "0")}-01`, dhukuId: "pottery", type: "contribution" }));

    expect(dhukuSetAsides({ dhukus: [{ ...dhuku, ownerMemberId: HER }], entries: [], memberId: ME, period: KARTIK })).toEqual([]);
    expect(dhukuSetAsides({ dhukus: [{ ...dhuku, completedAt: "2026-09-01" }], entries: [], memberId: ME, period: KARTIK })).toEqual([]);
    expect(dhukuSetAsides({ dhukus: [dhuku], entries: paidUp, memberId: ME, period: KARTIK })).toEqual([]);
  });
});

describe("dhuku interest timing", () => {
  it("doesn't add interest in the month the pot is taken", () => {
    const rows = dhukuSetAsides({
      dhukus: [
        {
          completedAt: null,
          id: "pottery",
          interestPerMonth: 300,
          monthlyContribution: 3000,
          name: "Pottery Dhuku",
          ownerMemberId: ME,
          totalMembers: 12,
        },
      ],
      entries: [{ amount: 33000, date: "2026-10-19", dhukuId: "pottery", type: "payout" }],
      memberId: ME,
      period: KARTIK,
    });

    expect(rows[0]).toMatchObject({ planned: 3000, sub: "Dhuku" });
  });
});

describe("loanSetAsides", () => {
  const loan = {
    counterpartyName: "Raju",
    direction: "taken" as const,
    id: "raju",
    installmentAmount: 5000,
    installmentFrequency: "monthly" as const,
    ownerMemberId: ME,
    principalAmount: 100000,
  };

  it("plans the installment and counts this month's repayments as done", () => {
    const rows = loanSetAsides({
      loans: [loan],
      memberId: ME,
      payments: [{ amount: 5000, date: "2026-10-30", loanId: "raju" }],
      period: KARTIK,
    });

    expect(rows).toEqual([{ done: 5000, id: "loan:raju", kind: "loan", label: "Raju", planned: 5000, sub: "Loan repayment" }]);
  });

  it("caps the installment at what's still owed", () => {
    const rows = loanSetAsides({
      loans: [loan],
      memberId: ME,
      payments: [{ amount: 97000, date: "2026-09-01", loanId: "raju" }],
      period: KARTIK,
    });

    expect(rows[0].planned).toBe(3000);
  });

  it("turns a weekly installment into a monthly amount", () => {
    const rows = loanSetAsides({ loans: [{ ...loan, installmentAmount: 1200, installmentFrequency: "weekly" }], memberId: ME, payments: [], period: KARTIK });

    expect(rows[0].planned).toBe(5200);
  });

  it("leaves out loans without an installment, given loans, other people's and paid-off loans", () => {
    expect(loanSetAsides({ loans: [{ ...loan, installmentAmount: null, installmentFrequency: null }], memberId: ME, payments: [], period: KARTIK })).toEqual([]);
    expect(loanSetAsides({ loans: [{ ...loan, direction: "given" }], memberId: ME, payments: [], period: KARTIK })).toEqual([]);
    expect(loanSetAsides({ loans: [{ ...loan, ownerMemberId: HER }], memberId: ME, payments: [], period: KARTIK })).toEqual([]);
    expect(loanSetAsides({ loans: [loan], memberId: ME, payments: [{ amount: 100000, date: "2026-09-01", loanId: "raju" }], period: KARTIK })).toEqual([]);
  });
});
