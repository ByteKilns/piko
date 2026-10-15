import { describe, expect, it } from "vitest";

import { captureJson, captureStatusFor } from "./captures";

describe("captureStatusFor", () => {
  it("makes money going out a draft to review", () => {
    expect(captureStatusFor("debit")).toBe("draft");
  });

  it("skips money coming in, so it is never offered for review", () => {
    expect(captureStatusFor("credit")).toBe("skipped");
  });
});

describe("captureJson", () => {
  const row = {
    amount: "1250.50",
    category: "Groceries",
    categoryConfidence: 0.9,
    counterparty: "Bhatbhateni Supermarket",
    createdAt: new Date("2026-10-14T06:20:00.000Z"),
    direction: "debit" as const,
    expenseId: null,
    householdId: "h1",
    id: "c1",
    kind: "payment",
    memberId: "m1",
    occurredAt: new Date("2026-10-14T06:15:30.250Z"),
    rawText: "eSewa You have paid Rs. 1,250.50 to Bhatbhateni Supermarket",
    refId: "0ABC12345",
    source: "notification",
    status: "draft" as const,
    updatedAt: new Date("2026-10-14T06:20:00.000Z"),
  };

  it("sends the amount as a number and the time as UTC with milliseconds", () => {
    expect(captureJson(row)).toEqual({
      amount: 1250.5,
      category: "Groceries",
      categoryConfidence: 0.9,
      counterparty: "Bhatbhateni Supermarket",
      direction: "debit",
      id: "c1",
      kind: "payment",
      occurredAt: "2026-10-14T06:15:30.250Z",
      rawText: "eSewa You have paid Rs. 1,250.50 to Bhatbhateni Supermarket",
      refId: "0ABC12345",
      source: "notification",
      status: "draft",
    });
  });

  it("leaves out who captured it and which household it belongs to", () => {
    const json = captureJson(row);
    expect(json).not.toHaveProperty("householdId");
    expect(json).not.toHaveProperty("memberId");
  });
});
