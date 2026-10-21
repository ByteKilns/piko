import { describe, expect, it } from "vitest";

import { type MonthMoneyInput, personMonthMoney, personSpending } from "./month-money";

const ME = "me";
const HER = "her";
const KARTIK = { month: 7, year: 2083 };
const PERIOD = { endDate: "2026-11-16", startDate: "2026-10-18" };

function expense(overrides: Partial<MonthMoneyInput["expenses"][number]>): MonthMoneyInput["expenses"][number] {
  return {
    amount: "1000.00",
    categoryId: "lunch",
    date: "2026-10-20",
    fundAmount: null,
    paidByMemberId: ME,
    payBackAmount: null,
    savingsPotId: null,
    ...overrides,
  };
}

const EMPTY: MonthMoneyInput = {
  deposits: [],
  dhukuEntries: [],
  dhukus: [],
  expenses: [],
  fundData: { funds: [], plans: [], topUps: [] },
  incomeRows: [],
  loanPayments: [],
  loans: [],
  memberId: ME,
  memberIds: [ME, HER],
  month: KARTIK,
  period: PERIOD,
};

describe("personMonthMoney", () => {
  it("counts only what left this person's wallet from pay", () => {
    const money = personMonthMoney({
      ...EMPTY,
      expenses: [
        expense({ amount: "1000.00" }),
        expense({ amount: "2000.00", paidByMemberId: HER, payBackAmount: "500.00" }),
        expense({ amount: "14690.00", fundAmount: "12000.00" }),
        expense({ amount: "3000.00", savingsPotId: "pot" }),
        expense({ amount: "9000.00", paidByMemberId: HER }),
      ],
    });

    // 1,000 + 500 to pay back + 2,690 the fund didn't cover.
    expect(money.spent).toBe(4190);
    expect(money.spending).toHaveLength(3);
  });

  it("moves savings deposits, own dhukus, repayments on loans taken and money into funds", () => {
    const money = personMonthMoney({
      ...EMPTY,
      deposits: [
        { amount: 5000, date: "2026-10-20", kind: "deposit", memberId: ME },
        { amount: 9000, date: "2026-10-20", kind: "deposit", memberId: HER },
      ],
      dhukuEntries: [
        { amount: 3000, date: "2026-10-19", dhukuId: "mine", type: "contribution" },
        { amount: 3300, date: "2026-10-19", dhukuId: "hers", type: "contribution" },
      ],
      dhukus: [
        { id: "mine", ownerMemberId: ME },
        { id: "hers", ownerMemberId: HER },
      ],
      fundData: {
        funds: [{ archived: false, id: "internet", name: "WorldLink", ownerMemberId: ME, startMonth: 6, startYear: 2083 }],
        plans: [{ fromMonth: 6, fromYear: 2083, fundId: "internet", monthlyAmount: 1225 }],
        topUps: [{ amount: 775, fundId: "internet", month: 7, year: 2083 }],
      },
      loanPayments: [{ amount: 5000, date: "2026-10-30", loanId: "raju", memberId: ME }],
      loans: [{ direction: "taken", id: "raju" }],
    });

    expect(money.moved).toEqual({ dhuku: 3000, funds: 2000, loans: 5000, savings: 5000, total: 15000 });
  });

  it("leaves what's unallocated: pay and extra less spent and moved", () => {
    const money = personMonthMoney({
      ...EMPTY,
      deposits: [{ amount: 5000, date: "2026-10-20", kind: "deposit", memberId: ME }],
      expenses: [expense({ amount: "40000.00" })],
      incomeRows: [
        { amount: 62000, id: "pay", kind: "pay", memberId: ME, month: 6, note: null, year: 2083 },
        { amount: 38000, id: "bonus", kind: "extra", memberId: ME, month: 7, note: "bonus", year: 2083 },
      ],
    });

    expect(money.income.pay).toBe(62000);
    expect(money.unallocated).toBe(62000 + 38000 - 40000 - 5000);
  });
});

describe("personSpending", () => {
  it("is the spending personMonthMoney counts: their pay share of each expense they paid, plus what's to be paid back to them", () => {
    const expenses = [
      expense({ amount: "1000.00" }),
      expense({ amount: "2000.00", categoryId: "dates", paidByMemberId: HER, payBackAmount: "500.00" }),
      expense({ amount: "14690.00", fundAmount: "12000.00" }),
      expense({ amount: "800.00", savingsPotId: "pot" }),
    ];

    const spending = personSpending({ expenses, memberId: ME, memberIds: [ME, HER] });

    expect(spending).toEqual(personMonthMoney({ ...EMPTY, expenses }).spending);
    expect(spending).toEqual([
      { amount: 1000, categoryId: "lunch", date: "2026-10-20" },
      { amount: 500, categoryId: "dates", date: "2026-10-20" },
      { amount: 2690, categoryId: "lunch", date: "2026-10-20" },
    ]);
  });
});
