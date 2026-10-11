// src/modules/dhuku/lib/dhuku-stats.test.ts
import { describe, expect, it } from "vitest";

import {
  buildDhukuCards,
  cycleStatus,
  type EntryRow,
  expectedNextAmount,
  hasTakenPayout,
  monthsLogged,
  nextEntryDueDate,
  totalContributed,
} from "./dhuku-stats";

function entry(overrides: Partial<EntryRow> = {}): EntryRow {
  return { amount: "1000", date: "2026-01-15", dhukuId: "d1", id: "e1", note: null, type: "contribution", ...overrides };
}

describe("monthsLogged", () => {
  it("counts contributions only: a payout or a fine is never a month", () => {
    expect(monthsLogged([entry(), entry({ type: "payout" }), entry({ type: "fine" }), entry()])).toBe(2);
  });

  it("returns 0 for no entries", () => {
    expect(monthsLogged([])).toBe(0);
  });
});

describe("hasTakenPayout", () => {
  it("is true once any payout entry exists", () => {
    expect(hasTakenPayout([entry(), entry({ type: "payout" })])).toBe(true);
  });

  it("is false when only contributions have been logged", () => {
    expect(hasTakenPayout([entry(), entry()])).toBe(false);
  });
});

describe("totalContributed", () => {
  it("sums only contribution-type entries, ignoring the payout amount", () => {
    const entries = [entry({ amount: "1000" }), entry({ amount: "1000" }), entry({ amount: "13000", type: "payout" })];
    expect(totalContributed(entries)).toBe(2000);
  });
});

describe("expectedNextAmount", () => {
  it("is just the monthly contribution before the payout is taken", () => {
    expect(expectedNextAmount(1000, 200, [entry(), entry()])).toBe(1000);
  });

  it("adds the fixed interest once the payout has been taken", () => {
    const entries = [entry(), entry({ type: "payout", amount: "13000" })];
    expect(expectedNextAmount(1000, 200, entries)).toBe(1200);
  });

  it("treats a null interest as zero after the payout is taken", () => {
    const entries = [entry({ type: "payout", amount: "13000" })];
    expect(expectedNextAmount(1000, null, entries)).toBe(1000);
  });
});

describe("cycleStatus", () => {
  it("is active while fewer months are logged than the group size", () => {
    expect(cycleStatus(13, [entry(), entry()])).toBe("active");
  });

  it("is completed once every member's month has been logged", () => {
    const entries = Array.from({ length: 13 }, () => entry());
    expect(cycleStatus(13, entries)).toBe("completed");
  });
});

describe("nextEntryDueDate", () => {
  it("advances one calendar month per logged entry from the start date", () => {
    expect(nextEntryDueDate("2026-01-15", [])).toBe("2026-01-15");
    expect(nextEntryDueDate("2026-01-15", [entry()])).toBe("2026-02-15");
    expect(nextEntryDueDate("2026-01-15", [entry(), entry()])).toBe("2026-03-15");
  });
});

describe("buildDhukuCards", () => {
  it("shapes rows into cards, filling in owner name and derived fields", () => {
    const dhukuRows = [
      {
        id: "d1",
        interestPerMonth: "200.00",
        monthlyContribution: "1000.00",
        name: "Friends Dhuku",
        note: null,
        ownerMemberId: "m1",
        startDate: "2026-01-15",
        totalMembers: 13,
      },
    ];
    const entryRows: EntryRow[] = [
      { amount: "1000", date: "2026-01-15", dhukuId: "d1", id: "e1", note: null, type: "contribution" },
      { amount: "13000", date: "2026-02-15", dhukuId: "d1", id: "e2", note: null, type: "payout" },
    ];
    const memberById = new Map([["m1", { user: { name: "Nirjal" } }]]);

    const [card] = buildDhukuCards(dhukuRows, entryRows, memberById);

    expect(card.ownerName).toBe("Nirjal");
    expect(card.hasTaken).toBe(true);
    expect(card.monthsLogged).toBe(1);
    expect(card.totalContributed).toBe(1000);
    expect(card.totalReceived).toBe(13000);
    expect(card.expectedNextAmount).toBe(1200);
    expect(card.status).toBe("active");
    expect(card.nextDueDate).toBe("2026-02-15");
  });

  it("sets nextDueDate to null once the cycle is completed", () => {
    const dhukuRows = [
      {
        id: "d1",
        interestPerMonth: null,
        monthlyContribution: "1000.00",
        name: "Small Dhuku",
        note: null,
        ownerMemberId: null,
        startDate: "2026-01-15",
        totalMembers: 2,
      },
    ];
    const entryRows: EntryRow[] = [
      { amount: "1000", date: "2026-01-15", dhukuId: "d1", id: "e1", note: null, type: "contribution" },
      { amount: "1000", date: "2026-02-15", dhukuId: "d1", id: "e2", note: null, type: "contribution" },
      { amount: "2000", date: "2026-02-15", dhukuId: "d1", id: "e3", note: null, type: "payout" },
    ];

    const [card] = buildDhukuCards(dhukuRows, entryRows, new Map());

    expect(card.status).toBe("completed");
    expect(card.nextDueDate).toBeNull();
  });
});
