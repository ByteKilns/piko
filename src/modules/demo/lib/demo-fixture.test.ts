import { describe, expect, it } from "vitest";

import { adToBs, bsToAd } from "@/lib/nepali-date";

import { buildDemoFixture, type DemoFixture } from "./demo-fixture";

const AARAV = "member-aarav";
const SITA = "member-sita";
const HOUSEHOLD = "household-demo";
const TODAY = "2026-10-15";

function build(today = TODAY): DemoFixture {
  let next = 0;
  return buildDemoFixture({ aaravId: AARAV, householdId: HOUSEHOLD, newId: () => `id-${++next}`, sitaId: SITA, today });
}

function monthKey(date: string): string {
  const { month, year } = adToBs(date);
  return `${year}-${month}`;
}

// The first day of the BS month `today` falls in: the emptiest "this month".
function firstOfThisMonth(today: string): string {
  const { month, year } = adToBs(today);
  return bsToAd(year, month, 1);
}

describe("buildDemoFixture", () => {
  it("covers six BS months of spending, none of it after today", () => {
    const fixture = build();
    const months = new Set(fixture.expenses.map((e) => monthKey(e.date)));
    expect(months.size).toBe(6);
    expect(months.has(monthKey(TODAY))).toBe(true);
    expect(fixture.expenses.every((e) => e.date <= TODAY)).toBe(true);
    expect(fixture.expenses.length).toBeGreaterThan(100);
  });

  it("keeps every row in the demo household, between its two people", () => {
    const fixture = build();
    const people = [AARAV, SITA];
    const categoryIds = new Set(fixture.categories.map((c) => c.id));
    for (const rows of [fixture.categories, fixture.expenses, fixture.incomes, fixture.loans, fixture.dhukus, fixture.funds]) {
      expect(rows.every((row) => row.householdId === HOUSEHOLD)).toBe(true);
    }
    for (const e of fixture.expenses) {
      expect(people).toContain(e.paidByMemberId);
      expect([...people, null]).toContain(e.ownerMemberId);
      expect(categoryIds.has(e.categoryId)).toBe(true);
    }
  });

  it("pays both people every month, plus one extra", () => {
    const fixture = build();
    expect(fixture.incomes.filter((i) => i.kind === "pay" && i.memberId === AARAV)).toHaveLength(6);
    expect(fixture.incomes.filter((i) => i.kind === "pay" && i.memberId === SITA)).toHaveLength(6);
    expect(fixture.incomes.filter((i) => i.kind === "extra")).toHaveLength(1);
  });

  it.each([TODAY, firstOfThisMonth(TODAY)])("plans this month for both, with Aarav's dining nearly used (today %s)", (today) => {
    const fixture = build(today);
    const { month, year } = adToBs(today);
    const budget = fixture.monthlyBudgets.find((b) => b.year === year && b.month === month);
    expect(budget).toBeDefined();
    const lines = fixture.budgetItems.filter((line) => line.monthlyBudgetId === budget?.id);
    expect(lines.some((line) => line.ownerMemberId === AARAV)).toBe(true);
    expect(lines.some((line) => line.ownerMemberId === SITA)).toBe(true);

    const diningId = fixture.categories.find((c) => c.name === "Dining Out")?.id;
    const cap = lines.find((line) => line.ownerMemberId === AARAV && line.categoryId === diningId);
    expect(cap?.kind).toBe("can_cut");
    const spent = fixture.expenses
      .filter((e) => e.categoryId === diningId && e.paidByMemberId === AARAV && monthKey(e.date) === `${year}-${month}`)
      .reduce((sum, e) => sum + Number(e.amount), 0);
    expect(spent / Number(cap?.plannedAmount)).toBeGreaterThanOrEqual(0.8);
    expect(spent / Number(cap?.plannedAmount)).toBeLessThan(1);
  });

  it("has a pay-back-later still owed, one already paid back, and one expense paid from savings", () => {
    const fixture = build();
    expect(fixture.expenses.filter((e) => e.payBackAmount)).toHaveLength(2);
    expect(fixture.paybacks).toHaveLength(1);
    expect(fixture.paybacks[0]).toMatchObject({ fromMemberId: SITA, toMemberId: AARAV });
    const fromSavings = fixture.expenses.filter((e) => e.savingsPotId);
    expect(fromSavings).toHaveLength(1);
    expect(fromSavings[0].savingsPotId).toBe(fixture.savingsPots[0].id);
  });

  it("sets up the savings pot, dhuku, loan and fund", () => {
    const fixture = build();
    expect(fixture.savingsPots).toHaveLength(1);
    expect(fixture.savingsPots[0]).toMatchObject({ name: "Home fund", ownerMemberId: null });
    expect(fixture.savingsItems.map((item) => item.name)).toEqual(["New laptop", "Pokhara trip"]);
    expect(fixture.savingsPotPlans).toHaveLength(2);

    expect(fixture.dhukus).toHaveLength(1);
    expect(fixture.dhukus[0]).toMatchObject({ monthlyContribution: "5000", totalMembers: 10 });
    expect(fixture.dhukuEntries.every((entry) => entry.type === "contribution")).toBe(true);

    expect(fixture.loans).toHaveLength(1);
    expect(fixture.loans[0]).toMatchObject({ counterpartyName: "Bikash", direction: "given", principalAmount: "20000" });
    const repaid = fixture.loanPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    expect(repaid).toBeGreaterThan(0);
    expect(repaid).toBeLessThan(20000);

    expect(fixture.funds).toHaveLength(1);
    expect(fixture.funds[0]).toMatchObject({ name: "Dashain shopping", ownerMemberId: SITA });
    expect(fixture.fundPlans).toHaveLength(1);
    expect(fixture.recurringExpenses.map((bill) => bill.name)).toEqual(["Rent", "Internet", "Insurance"]);
  });

  it("keeps Aarav's spending in each full month under his pay", () => {
    const fixture = build();
    const current = monthKey(TODAY);
    const byMonth = new Map<string, number>();
    for (const e of fixture.expenses) {
      if (e.paidByMemberId !== AARAV || monthKey(e.date) === current) continue;
      byMonth.set(monthKey(e.date), (byMonth.get(monthKey(e.date)) ?? 0) + Number(e.amount));
    }
    expect(byMonth.size).toBe(5);
    for (const total of byMonth.values()) expect(total).toBeLessThan(85000);
  });

  it("gives every row its own id and contains no email address", () => {
    const fixture = build();
    const ids = Object.values(fixture)
      .flat()
      .map((row) => (row as { id?: string }).id)
      .filter((id) => id !== undefined);
    expect(new Set(ids).size).toBe(ids.length);
    expect(JSON.stringify(fixture)).not.toContain("@");
  });
});
