import { describe, expect, it } from "vitest";

import { payAmount, payRows } from "./pay-amount";

describe("payAmount", () => {
  it("is the whole expense when it was paid from pay", () => {
    expect(payAmount({ amount: "1500.00", fundAmount: null, savingsPotId: null })).toBe(1500);
  });

  it("is nothing when it was paid from savings", () => {
    expect(payAmount({ amount: "1500.00", fundAmount: null, savingsPotId: "pot" })).toBe(0);
  });

  it("is what the fund didn't cover when it was paid from a fund", () => {
    expect(payAmount({ amount: "14690.00", fundAmount: "12000.00", savingsPotId: null })).toBe(2690);
    expect(payAmount({ amount: "14690.00", fundAmount: "14690.00", savingsPotId: null })).toBe(0);
  });
});

describe("payRows", () => {
  it("keeps each row's shape with the pay part as its amount, dropping rows with none", () => {
    const rows = [
      { amount: "500.00", fundAmount: null, id: "lunch", savingsPotId: null },
      { amount: "14690.00", fundAmount: "12000.00", id: "internet", savingsPotId: null },
      { amount: "3000.00", fundAmount: null, id: "surgery", savingsPotId: "pot" },
    ];

    expect(payRows(rows)).toEqual([
      { amount: "500", fundAmount: null, id: "lunch", savingsPotId: null },
      { amount: "2690", fundAmount: "12000.00", id: "internet", savingsPotId: null },
    ]);
  });
});
