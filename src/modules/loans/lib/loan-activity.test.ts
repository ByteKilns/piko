import { describe, expect, it } from "vitest";

import { testFormatters } from "@/modules/activity/lib/test-formatters";

import { loanChanges, loanPaymentSummary, type LoanSnapshot, loanSummary } from "./loan-activity";

const f = testFormatters();
const loan: LoanSnapshot = {
  counterpartyName: "Hari",
  date: "2026-08-01",
  direction: "given",
  dueDate: null,
  installmentAmount: null,
  installmentFrequency: null,
  nextInstallmentDate: null,
  note: null,
  ownerMemberId: "m-1",
  principalAmount: "50000.00",
};

describe("loan activity", () => {
  it("summarises a loan by direction", () => {
    expect(loanSummary(f, loan)).toBe("Lent to Hari · RS 50,000 · Asha");
    expect(loanSummary(f, { ...loan, direction: "taken", ownerMemberId: null })).toBe("Borrowed from Hari · RS 50,000 · Shared");
  });

  it("diffs loan fields with readable direction", () => {
    expect(loanChanges(f, loan, { ...loan, direction: "taken", principalAmount: 60000 })).toEqual([
      { field: "Type", from: "Lent", to: "Borrowed" },
      { field: "Amount", from: "RS 50,000", to: "RS 60,000" },
    ]);
  });

  it("summarises a payment", () => {
    expect(loanPaymentSummary(f, { amount: "5000.00", memberId: "m-2" }, loan)).toBe("RS 5,000 received from Hari · by Ravi");
    expect(loanPaymentSummary(f, { amount: 5000, memberId: "m-2" }, { ...loan, direction: "taken" })).toBe(
      "RS 5,000 paid to Hari · by Ravi",
    );
  });
});
