import { and, eq, inArray, isNotNull } from "drizzle-orm";

import { db } from "@/db/client";
import { expenses, fundPlans, funds, fundTopUps } from "@/db/schema";

// Every fund in the household and what's needed to work out their balances:
// the monthly plans, the money added by hand, and what expenses took.
export async function listFundData(householdId: string) {
  const fundRows = await db.select().from(funds).where(eq(funds.householdId, householdId)).orderBy(funds.createdAt);
  const ids = fundRows.map((f) => f.id);
  if (ids.length === 0) return { funds: [], plans: [], spends: [], topUps: [] };

  const [planRows, topUpRows, spendRows] = await Promise.all([
    db.select().from(fundPlans).where(inArray(fundPlans.fundId, ids)),
    db.select().from(fundTopUps).where(inArray(fundTopUps.fundId, ids)),
    db
      .select({ amount: expenses.fundAmount, expenseId: expenses.id, fundId: expenses.fundId })
      .from(expenses)
      .where(and(eq(expenses.householdId, householdId), isNotNull(expenses.fundId))),
  ]);

  return {
    funds: fundRows.map((f) => ({ ...f, target: f.target === null ? null : Number(f.target) })),
    plans: planRows.map((p) => ({ fromMonth: p.fromMonth, fromYear: p.fromYear, fundId: p.fundId, monthlyAmount: Number(p.monthlyAmount) })),
    spends: spendRows.flatMap((s) => (s.fundId === null ? [] : [{ amount: Number(s.amount ?? 0), expenseId: s.expenseId, fundId: s.fundId }])),
    topUps: topUpRows.map((t) => ({ amount: Number(t.amount), fundId: t.fundId, month: t.month, year: t.year })),
  };
}

export type FundData = Awaited<ReturnType<typeof listFundData>>;
