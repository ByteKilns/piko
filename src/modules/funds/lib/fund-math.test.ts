import { describe, expect, it } from "vitest";

import { fundBalance, fundBalances, fundShare, setAsideFor, suggestedMonthly, totalSetAside } from "./fund-math";

const ASOJ = { month: 6, year: 2083 };
const KARTIK = { month: 7, year: 2083 };
const POUSH = { month: 9, year: 2083 };

describe("setAsideFor", () => {
  const plans = [
    { fromMonth: 6, fromYear: 2083, monthlyAmount: 1225 },
    { fromMonth: 9, fromYear: 2083, monthlyAmount: 1500 },
  ];

  it("uses the latest plan starting on or before the month", () => {
    expect(setAsideFor(plans, KARTIK)).toBe(1225);
    expect(setAsideFor(plans, POUSH)).toBe(1500);
    expect(setAsideFor(plans, { month: 3, year: 2084 })).toBe(1500);
  });

  it("is 0 before the first plan", () => {
    expect(setAsideFor(plans, { month: 5, year: 2083 })).toBe(0);
  });
});

describe("totalSetAside", () => {
  it("adds every month from the start through the given month at the amount in force", () => {
    const plans = [
      { fromMonth: 6, fromYear: 2083, monthlyAmount: 1000 },
      { fromMonth: 8, fromYear: 2083, monthlyAmount: 2000 },
    ];

    // Asoj 1,000 + Kartik 1,000 + Mangsir 2,000 + Poush 2,000
    expect(totalSetAside(plans, ASOJ, POUSH)).toBe(6000);
  });

  it("runs across a year end", () => {
    const plans = [{ fromMonth: 11, fromYear: 2083, monthlyAmount: 500 }];

    expect(totalSetAside(plans, { month: 11, year: 2083 }, { month: 2, year: 2084 })).toBe(2000);
  });

  it("is 0 when the month is before the start", () => {
    expect(totalSetAside([{ fromMonth: 6, fromYear: 2083, monthlyAmount: 500 }], ASOJ, { month: 5, year: 2083 })).toBe(0);
  });
});

describe("fundBalance", () => {
  it("is everything set aside plus money added, less what expenses took", () => {
    const plans = [{ fromMonth: 6, fromYear: 2083, monthlyAmount: 1225 }];

    expect(fundBalance({ plans, spent: 1000, start: ASOJ, through: POUSH, topUps: 5000 })).toBe(1225 * 4 + 5000 - 1000);
  });
});

describe("fundBalances", () => {
  it("works out each fund's balance through a month", () => {
    const balances = fundBalances({
      funds: [
        { id: "internet", startMonth: 6, startYear: 2083 },
        { id: "festivals", startMonth: 7, startYear: 2083 },
      ],
      plans: [
        { fromMonth: 6, fromYear: 2083, fundId: "internet", monthlyAmount: 1225 },
        { fromMonth: 7, fromYear: 2083, fundId: "festivals", monthlyAmount: 2000 },
      ],
      spends: [{ amount: 1000, fundId: "festivals" }],
      through: KARTIK,
      topUps: [
        { amount: 10000, fundId: "festivals", month: 7, year: 2083 },
        { amount: 500, fundId: "internet", month: 9, year: 2083 },
      ],
    });

    expect(balances.get("internet")).toBe(2450);
    expect(balances.get("festivals")).toBe(2000 + 10000 - 1000);
  });
});

describe("suggestedMonthly", () => {
  it("spreads what's still needed over the months up to the due month", () => {
    expect(suggestedMonthly({ balance: 2690, due: { month: 6, year: 2084 }, now: ASOJ, target: 14690 })).toBe(1000);
  });

  it("is 0 when the fund already covers the target", () => {
    expect(suggestedMonthly({ balance: 15000, due: { month: 6, year: 2084 }, now: ASOJ, target: 14690 })).toBe(0);
  });

  it("asks for the whole shortfall when it's due this month or overdue", () => {
    expect(suggestedMonthly({ balance: 10000, due: ASOJ, now: ASOJ, target: 14690 })).toBe(4690);
    expect(suggestedMonthly({ balance: 10000, due: { month: 3, year: 2083 }, now: ASOJ, target: 14690 })).toBe(4690);
  });

  it("is null without a target or due month", () => {
    expect(suggestedMonthly({ balance: 0, due: null, now: ASOJ, target: 5000 })).toBeNull();
    expect(suggestedMonthly({ balance: 0, due: ASOJ, now: ASOJ, target: null })).toBeNull();
  });
});

describe("fundShare", () => {
  it("pays the whole expense when the fund covers it", () => {
    expect(fundShare(14690, 20000)).toBe(14690);
  });

  it("pays up to the balance, leaving the rest as normal spending", () => {
    expect(fundShare(14690, 12000)).toBe(12000);
  });

  it("pays nothing from an empty or overdrawn fund", () => {
    expect(fundShare(500, 0)).toBe(0);
    expect(fundShare(500, -100)).toBe(0);
  });
});
