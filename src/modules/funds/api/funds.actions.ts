"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { fundPlans, funds, fundTopUps } from "@/db/schema";
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { currentPeriodYearMonth } from "@/lib/month-period";
import { getCurrentMember } from "@/lib/session";
import { activityActor, loadActivityFormatters, logActivity } from "@/modules/activity/api/activity";

import { fundChanges, fundSummary, topUpSummary } from "../lib/fund-activity";
import { setAsideFor, type YearMonth } from "../lib/fund-math";
import { type FundInput, fundSchema, type FundTopUpInput, fundTopUpSchema } from "../schemas/fund.schema";

function revalidateFundPaths() {
  revalidatePath("/budget");
  revalidatePath("/dashboard");
  revalidatePath("/expenses");
}

// Funds count in the household's own calendar months.
async function currentMonth(householdId: string): Promise<YearMonth> {
  return currentPeriodYearMonth(await getDateFormatPref(householdId));
}

async function findFundInHousehold(householdId: string, id: string) {
  const [fund] = await db
    .select()
    .from(funds)
    .where(and(eq(funds.id, id), eq(funds.householdId, householdId)));
  if (!fund) throw new Error("Fund not found");
  return fund;
}

async function monthlyNow(fundId: string, now: YearMonth): Promise<number> {
  const plans = await db.select().from(fundPlans).where(eq(fundPlans.fundId, fundId));
  return setAsideFor(
    plans.map((p) => ({ fromMonth: p.fromMonth, fromYear: p.fromYear, monthlyAmount: Number(p.monthlyAmount) })),
    now,
  );
}

// The monthly set-aside from this month on. Earlier months keep theirs.
async function setMonthlyFrom(fundId: string, now: YearMonth, monthlyAmount: number) {
  await db
    .insert(fundPlans)
    .values({ fromMonth: now.month, fromYear: now.year, fundId, monthlyAmount: String(monthlyAmount) })
    .onConflictDoUpdate({
      set: { monthlyAmount: String(monthlyAmount) },
      target: [fundPlans.fundId, fundPlans.fromYear, fundPlans.fromMonth],
    });
}

// A fund always belongs to the person who sets it up, and starts this month.
export async function createFundAction(input: FundInput) {
  const member = await getCurrentMember();
  const { householdId, memberId } = member;
  const parsed = fundSchema.parse(input);
  const now = await currentMonth(householdId);

  const [created] = await db
    .insert(funds)
    .values({
      dueMonth: parsed.due?.month ?? null,
      dueYear: parsed.due?.year ?? null,
      householdId,
      name: parsed.name,
      ownerMemberId: memberId,
      startMonth: now.month,
      startYear: now.year,
      target: parsed.target === null ? null : String(parsed.target),
    })
    .returning();
  await setMonthlyFrom(created.id, now, parsed.monthlyAmount);

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "created",
    after: created,
    entityId: created.id,
    entityType: "fund",
    summary: fundSummary(f, { ...created, monthlyAmount: parsed.monthlyAmount }),
  });

  revalidateFundPaths();
}

export async function updateFundAction(id: string, input: FundInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = fundSchema.parse(input);
  const before = await findFundInHousehold(householdId, id);
  const now = await currentMonth(householdId);
  const monthlyBefore = await monthlyNow(id, now);

  const [updated] = await db
    .update(funds)
    .set({
      dueMonth: parsed.due?.month ?? null,
      dueYear: parsed.due?.year ?? null,
      name: parsed.name,
      target: parsed.target === null ? null : String(parsed.target),
    })
    .where(and(eq(funds.id, id), eq(funds.householdId, householdId)))
    .returning();
  if (parsed.monthlyAmount !== monthlyBefore) await setMonthlyFrom(id, now, parsed.monthlyAmount);

  const f = await loadActivityFormatters(householdId);
  const after = { ...updated, monthlyAmount: parsed.monthlyAmount };
  await logActivity(activityActor(member), {
    action: "updated",
    after: updated,
    before,
    changes: fundChanges(f, { ...before, monthlyAmount: monthlyBefore }, after),
    entityId: id,
    entityType: "fund",
    summary: fundSummary(f, after),
  });

  revalidateFundPaths();
}

// Stops a fund from this month on: no more set-asides, and it drops out of
// the plan. What's in it stays, for expenses already paid from it.
export async function archiveFundAction(id: string) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const before = await findFundInHousehold(householdId, id);
  const now = await currentMonth(householdId);

  const [updated] = await db
    .update(funds)
    .set({ archived: true })
    .where(and(eq(funds.id, id), eq(funds.householdId, householdId)))
    .returning();
  await setMonthlyFrom(id, now, 0);

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "archived",
    after: updated,
    before,
    entityId: id,
    entityType: "fund",
    summary: fundSummary(f, { ...updated, monthlyAmount: 0 }),
  });

  revalidateFundPaths();
}

// Money added to a fund on top of its monthly set-aside, for this month.
export async function addFundTopUpAction(fundId: string, input: FundTopUpInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = fundTopUpSchema.parse(input);
  const fund = await findFundInHousehold(householdId, fundId);
  const now = await currentMonth(householdId);

  const [created] = await db
    .insert(fundTopUps)
    .values({ amount: String(parsed.amount), fundId, month: now.month, note: parsed.note || null, year: now.year })
    .returning();

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "created",
    after: created,
    entityId: created.id,
    entityType: "fund_top_up",
    summary: topUpSummary(f, created, fund.name),
  });

  revalidateFundPaths();
}
