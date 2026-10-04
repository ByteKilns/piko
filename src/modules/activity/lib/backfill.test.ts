import { describe, expect, it } from "vitest";

import { type BackfillSource, buildBackfillRows } from "./backfill";
import { testFormatters } from "./test-formatters";

const HOUSEHOLD = "h-1";
const memberNames = new Map([
  ["m-1", "Asha"],
  ["m-2", "Ravi"],
]);
const at = (iso: string) => new Date(iso);

const expense = {
  amount: "1200.00",
  categoryId: "cat-1",
  createdAt: at("2026-08-23T10:14:29.071Z"),
  date: "2026-08-23",
  id: "e-1",
  note: null,
  ownerMemberId: null,
  paidByMemberId: "m-2",
  recurringExpenseId: null,
  // defaults to now() on insert, so a never-edited row is within a few ms of createdAt
  updatedAt: at("2026-08-23T10:14:29.071Z"),
};
const loan = {
  counterpartyName: "Hari",
  createdAt: at("2026-09-01T05:00:00Z"),
  date: "2026-09-01",
  direction: "given",
  id: "l-1",
  ownerMemberId: null,
  principalAmount: "50000.00",
};
const dhuku = {
  createdAt: at("2026-09-02T05:00:00Z"),
  id: "d-1",
  monthlyContribution: "10000.00",
  name: "Office dhuku",
  ownerMemberId: "m-1",
  startDate: "2026-01-01",
  totalMembers: 12,
};

function source(overrides: Partial<BackfillSource> = {}): BackfillSource {
  return { dhukuEntries: [], dhukus: [], expenses: [], loanPayments: [], loans: [], recurring: [], ...overrides };
}

function build(src: BackfillSource, alreadyLogged = new Set<string>()) {
  return buildBackfillRows({ alreadyLogged, f: testFormatters(), householdId: HOUSEHOLD, memberNames, source: src });
}

describe("buildBackfillRows", () => {
  it("logs an existing expense as added by its payer, at its original time", () => {
    expect(build(source({ expenses: [expense] }))).toEqual([
      {
        action: "created",
        actorMemberId: "m-2",
        actorName: "Ravi",
        createdAt: expense.createdAt,
        entityId: "e-1",
        entityType: "expense",
        householdId: HOUSEHOLD,
        source: "import",
        summary: "Groceries · RS 1,200 · Shared",
      },
    ]);
  });

  it("adds an imported edit, without field changes, for an expense updated after it was created", () => {
    const edited = { ...expense, amount: "1500.00", updatedAt: at("2026-10-02T04:46:13.234Z") };
    const rows = build(source({ expenses: [edited] }));
    expect(rows.map((r) => [r.action, r.createdAt, r.actorName, r.summary, r.changes])).toEqual([
      ["created", expense.createdAt, "Ravi", "Groceries · RS 1,500 · Shared", undefined],
      ["updated", edited.updatedAt, "Ravi", "Groceries · RS 1,500 · Shared", undefined],
    ]);
  });

  it("treats an updatedAt within a second of creation as never edited", () => {
    const rows = build(source({ expenses: [{ ...expense, updatedAt: at("2026-08-23T10:14:29.900Z") }] }));
    expect(rows.map((r) => r.action)).toEqual(["created"]);
  });

  it("skips an imported edit when the expense already has a logged edit", () => {
    const edited = { ...expense, updatedAt: at("2026-10-02T04:46:13.234Z") };
    const rows = build(source({ expenses: [edited] }), new Set(["updated:expense:e-1"]));
    expect(rows.map((r) => r.action)).toEqual(["created"]);
  });

  it("logs a recurring-bill expense as the bill being marked paid plus the expense", () => {
    const recurring = {
      amount: "1500.00",
      categoryId: "cat-1",
      frequency: "monthly",
      icon: "wifi",
      id: "r-1",
      name: "Internet",
      nextDueDate: "2026-10-15",
      ownerMemberId: null,
    };
    const rows = build(source({ expenses: [{ ...expense, recurringExpenseId: "r-1" }], recurring: [recurring] }));
    expect(rows.map((r) => [r.action, r.entityType, r.entityId, r.summary])).toEqual([
      ["paid", "recurring_expense", "r-1", "Internet · RS 1,500 monthly · Groceries · for 23 August 2026"],
      ["created", "expense", "e-1", "Groceries · RS 1,200 · Shared"],
    ]);
  });

  it("attributes owned loans and dhukus to their owner, shared ones to Imported, payments to the payer", () => {
    const rows = build(
      source({
        dhukuEntries: [{ amount: "10000.00", createdAt: at("2026-09-03T05:00:00Z"), dhukuId: "d-1", id: "de-1", type: "contribution" }],
        dhukus: [dhuku],
        loanPayments: [{ amount: "5000.00", createdAt: at("2026-09-04T05:00:00Z"), id: "lp-1", loanId: "l-1", memberId: "m-1" }],
        loans: [loan],
      }),
    );
    expect(rows.map((r) => [r.entityType, r.actorMemberId, r.actorName, r.summary])).toEqual([
      ["loan", null, "Imported", "Lent to Hari · RS 50,000 · Shared"],
      ["loan_payment", "m-1", "Asha", "RS 5,000 received from Hari · by Asha"],
      ["dhuku", "m-1", "Asha", "Office dhuku · RS 10,000/month · 12 members"],
      ["dhuku_entry", "m-1", "Asha", "Contribution · RS 10,000 · Office dhuku"],
    ]);
  });

  it("skips anything already in the log, so re-running adds nothing", () => {
    const rows = build(source({ expenses: [expense], loans: [loan] }), new Set(["created:expense:e-1"]));
    expect(rows.map((r) => r.entityId)).toEqual(["l-1"]);
  });

  it("skips payments and entries whose parent no longer exists", () => {
    const rows = build(
      source({
        dhukuEntries: [{ amount: "1.00", createdAt: at("2026-09-03T05:00:00Z"), dhukuId: "gone", id: "de-1", type: "payout" }],
        loanPayments: [{ amount: "1.00", createdAt: at("2026-09-04T05:00:00Z"), id: "lp-1", loanId: "gone", memberId: "m-1" }],
      }),
    );
    expect(rows).toEqual([]);
  });
});
