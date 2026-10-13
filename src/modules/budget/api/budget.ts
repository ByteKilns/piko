import { and, eq, lte, or } from "drizzle-orm";

import { db } from "@/db/client";
import { budgetItems, categories, monthlyBudgets } from "@/db/schema";

import { type DatedLine, type PlanLine, planLinesForMonth } from "../lib/plan-lines";

// Every budget line up to and including the given month, with the month it
// was set in.
export async function listDatedLines(householdId: string, through: { month: number; year: number }): Promise<DatedLine[]> {
  const rows = await db
    .select({
      categoryId: budgetItems.categoryId,
      id: budgetItems.id,
      kind: budgetItems.kind,
      month: monthlyBudgets.month,
      ownerMemberId: budgetItems.ownerMemberId,
      plannedAmount: budgetItems.plannedAmount,
      year: monthlyBudgets.year,
    })
    .from(budgetItems)
    .innerJoin(monthlyBudgets, eq(monthlyBudgets.id, budgetItems.monthlyBudgetId))
    .where(
      and(
        eq(monthlyBudgets.householdId, householdId),
        or(
          lte(monthlyBudgets.year, through.year - 1),
          and(eq(monthlyBudgets.year, through.year), lte(monthlyBudgets.month, through.month)),
        ),
      ),
    );
  return rows.map((r) => ({ ...r, plannedAmount: Number(r.plannedAmount) }));
}

// The lines that make up a month's plan, each person's own lines carried over
// from their latest earlier month when they have none in this one.
export async function listPlanLines(householdId: string, year: number, month: number): Promise<PlanLine[]> {
  const [lines, archived] = await Promise.all([
    listDatedLines(householdId, { month, year }),
    db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.householdId, householdId), eq(categories.archived, true))),
  ]);
  return planLinesForMonth(lines, { month, year }, new Set(archived.map((c) => c.id)));
}
