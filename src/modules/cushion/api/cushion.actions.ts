"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { cushionEntries, cushionTargets, fundTopUps, loanPayments, monthSettlements, savingsDeposits } from "@/db/schema";
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { currentPeriodYearMonth, resolvePeriod } from "@/lib/month-period";
import { getCurrentMember } from "@/lib/session";
import { activityActor, loadActivityFormatters, logActivity } from "@/modules/activity/api/activity";
import { loadPersonMonthMoney } from "@/modules/dashboard/api/month-money";
import { listFundData } from "@/modules/funds/api/funds";
import { listLoans } from "@/modules/loans/api/loans";
import { listSavingsPots } from "@/modules/savings/api/savings";

import { cushionSummary, settlementSummary } from "../lib/cushion-activity";
import { checkSplit, cushionBalance } from "../lib/month-close";
import { type SetCushionInput, setCushionSchema, type SettleMonthInput, settleMonthSchema } from "../schemas/cushion.schema";

const LEFTOVER_NOTE = "From the month's leftover";

function revalidateCushionPaths() {
  revalidatePath("/dashboard");
  revalidatePath("/budget");
  revalidatePath("/savings");
  revalidatePath("/loans");
}

// Decides a month's leftover for the person signed in: money into their
// savings pots and funds, toward loans they took, and the rest kept as
// cushion. A month that went over is taken from the cushion. The amount is
// worked out again here, never trusted from the browser. Money moved is
// dated the month's last day, so it counts in that month's Moved and leaves
// the next month alone.
export async function settleMonthAction(input: SettleMonthInput) {
  const member = await getCurrentMember();
  const { householdId, memberId } = member;
  const parsed = settleMonthSchema.parse(input);
  const { month, year } = parsed;

  const [settled] = await db
    .select()
    .from(monthSettlements)
    .where(and(eq(monthSettlements.memberId, memberId), eq(monthSettlements.year, year), eq(monthSettlements.month, month)));
  if (settled) throw new Error("That month is already decided");

  const money = await loadPersonMonthMoney(householdId, memberId, year, month);
  const parts = {
    cushion: parsed.parts.cushion,
    funds: parsed.parts.funds.filter((p) => p.amount > 0),
    loans: parsed.parts.loans.filter((p) => p.amount > 0),
    savings: parsed.parts.savings.filter((p) => p.amount > 0),
  };
  const problem = checkSplit(money.unallocated, parts);
  if (problem) throw new Error(problem);

  // Only the person's own piles: shared or own pots, their active funds, loans they took.
  const [pots, fundData, loans] = await Promise.all([listSavingsPots(householdId), listFundData(householdId), listLoans(householdId)]);
  const labels: { amount: number; label: string }[] = [];
  for (const part of parts.savings) {
    const pot = pots.find((p) => p.id === part.potId);
    if (!pot || (pot.ownerMemberId !== null && pot.ownerMemberId !== memberId)) throw new Error("That savings pot isn't yours");
    labels.push({ amount: part.amount, label: pot.name });
  }
  for (const part of parts.funds) {
    const fund = fundData.funds.find((f) => f.id === part.fundId);
    if (!fund || fund.ownerMemberId !== memberId || fund.archived) throw new Error("That fund isn't yours");
    labels.push({ amount: part.amount, label: `${fund.name} fund` });
  }
  for (const part of parts.loans) {
    const loan = loans.find((l) => l.id === part.loanId);
    if (!loan || loan.ownerMemberId !== memberId || loan.direction !== "taken") throw new Error("That loan isn't yours to repay");
    labels.push({ amount: part.amount, label: `toward ${loan.counterpartyName}` });
  }
  labels.push({ amount: parts.cushion, label: "kept" });

  const lastDay = resolvePeriod(year, month, await getDateFormatPref(householdId)).endDate;
  const settlement = await db.transaction(async (tx) => {
    for (const part of parts.savings) {
      await tx.insert(savingsDeposits).values({ amount: String(part.amount), date: lastDay, kind: "deposit", memberId, potId: part.potId });
    }
    for (const part of parts.funds) {
      await tx.insert(fundTopUps).values({ amount: String(part.amount), fundId: part.fundId, month, note: LEFTOVER_NOTE, year });
    }
    for (const part of parts.loans) {
      await tx.insert(loanPayments).values({ amount: String(part.amount), date: lastDay, loanId: part.loanId, memberId, note: LEFTOVER_NOTE });
    }
    if (parts.cushion !== 0) {
      await tx.insert(cushionEntries).values({
        amount: String(parts.cushion),
        householdId,
        kind: parts.cushion < 0 ? "overspend" : "kept",
        memberId,
        month,
        year,
      });
    }
    const [row] = await tx
      .insert(monthSettlements)
      .values({ amount: String(money.unallocated), householdId, memberId, month, year })
      .returning();
    return row;
  });

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "created",
    after: settlement,
    entityId: settlement.id,
    entityType: "month_settlement",
    summary: settlementSummary(f, { amount: money.unallocated, month, year }, labels),
  });

  revalidateCushionPaths();
}

// Sets what the person's cushion is aiming for, and corrects it to what's
// really in their account (recorded as an "adjust" entry for the difference).
export async function setCushionAction(input: SetCushionInput) {
  const member = await getCurrentMember();
  const { householdId, memberId } = member;
  const parsed = setCushionSchema.parse(input);

  const entries = await db.select().from(cushionEntries).where(eq(cushionEntries.memberId, memberId));
  const current = cushionBalance(entries.map((e) => ({ amount: Number(e.amount) })));
  const difference = Math.round((parsed.balance - current) * 100) / 100;
  if (difference !== 0) {
    const now = currentPeriodYearMonth(await getDateFormatPref(householdId));
    await db.insert(cushionEntries).values({
      amount: String(difference),
      householdId,
      kind: "adjust",
      memberId,
      month: now.month,
      note: "Corrected by hand",
      year: now.year,
    });
  }

  if (parsed.target === null) {
    await db.delete(cushionTargets).where(eq(cushionTargets.memberId, memberId));
  } else {
    await db
      .insert(cushionTargets)
      .values({ householdId, memberId, target: String(parsed.target) })
      .onConflictDoUpdate({ set: { target: String(parsed.target) }, target: cushionTargets.memberId });
  }

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "updated",
    entityId: memberId,
    entityType: "cushion",
    summary: cushionSummary(f, { balance: parsed.balance, target: parsed.target }),
  });

  revalidatePath("/dashboard");
}
