"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { savingsContributions, savingsGoals } from "@/db/schema";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { activityActor, loadActivityFormatters, logActivity } from "@/modules/activity/api/activity";
import { formatNPR } from "@/modules/dashboard/lib/format";
import { insertNotification } from "@/modules/notifications/api/notifications.actions";
import { contributionSummary, goalChanges, goalSummary } from "@/modules/savings-goals/lib/savings-activity";
import { type ContributionInput, contributionSchema, type SavingsGoalInput, savingsGoalSchema } from "@/modules/savings-goals/schemas/savings-goal.schema";

function revalidateSavingsGoalsPaths() {
  revalidatePath("/savings-goals");
  revalidatePath("/dashboard");
}

async function assertMemberInHousehold(householdId: string, memberId: string) {
  const members = await getHouseholdMembers(householdId);
  if (!members.some((m) => m.id === memberId)) {
    throw new Error("Member does not belong to this household");
  }
}

async function findGoalInHousehold(householdId: string, goalId: string) {
  const [goal] = await db
    .select()
    .from(savingsGoals)
    .where(and(eq(savingsGoals.id, goalId), eq(savingsGoals.householdId, householdId)));
  return goal;
}

export async function listSavingsGoals(householdId: string) {
  return db.select().from(savingsGoals).where(eq(savingsGoals.householdId, householdId)).orderBy(savingsGoals.createdAt);
}

export async function listSavingsContributions(householdId: string) {
  const goals = await listSavingsGoals(householdId);
  const goalIds = goals.map((g) => g.id);
  if (goalIds.length === 0) return [];

  return db
    .select()
    .from(savingsContributions)
    .where(inArray(savingsContributions.goalId, goalIds))
    .orderBy(desc(savingsContributions.date), desc(savingsContributions.createdAt));
}

export async function createSavingsGoalAction(input: SavingsGoalInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = savingsGoalSchema.parse(input);
  if (parsed.ownerMemberId) {
    await assertMemberInHousehold(householdId, parsed.ownerMemberId);
  }

  const [created] = await db
    .insert(savingsGoals)
    .values({
      description: parsed.description?.trim() || null,
      householdId,
      image: parsed.image,
      name: parsed.name,
      ownerMemberId: parsed.ownerMemberId,
      targetAmount: parsed.targetAmount === null ? null : String(parsed.targetAmount),
      targetDate: parsed.targetDate,
    })
    .returning();

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "created",
    entityId: created.id,
    entityType: "savings_goal",
    summary: goalSummary(f, created),
  });

  revalidateSavingsGoalsPaths();
}

export async function updateSavingsGoalAction(id: string, input: SavingsGoalInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = savingsGoalSchema.parse(input);
  if (parsed.ownerMemberId) {
    await assertMemberInHousehold(householdId, parsed.ownerMemberId);
  }

  const before = await findGoalInHousehold(householdId, id);
  if (!before) return;

  await db
    .update(savingsGoals)
    .set({
      description: parsed.description?.trim() || null,
      image: parsed.image,
      name: parsed.name,
      ownerMemberId: parsed.ownerMemberId,
      targetAmount: parsed.targetAmount === null ? null : String(parsed.targetAmount),
      targetDate: parsed.targetDate,
    })
    .where(and(eq(savingsGoals.id, id), eq(savingsGoals.householdId, householdId)));

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "updated",
    changes: goalChanges(f, before, parsed),
    entityId: id,
    entityType: "savings_goal",
    summary: goalSummary(f, parsed),
  });

  revalidateSavingsGoalsPaths();
}

export async function deleteSavingsGoalAction(id: string) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const before = await findGoalInHousehold(householdId, id);
  if (!before) return;

  await db.delete(savingsGoals).where(and(eq(savingsGoals.id, id), eq(savingsGoals.householdId, householdId)));

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "deleted",
    entityId: id,
    entityType: "savings_goal",
    summary: goalSummary(f, before),
  });

  revalidateSavingsGoalsPaths();
}

async function getGoalInHousehold(householdId: string, goalId: string) {
  const goal = await findGoalInHousehold(householdId, goalId);
  if (!goal) {
    throw new Error("Goal does not belong to this household");
  }
  return goal;
}

export async function addContributionAction(goalId: string, input: ContributionInput) {
  const member = await getCurrentMember();
  const { householdId, name: actorName } = member;
  const parsed = contributionSchema.parse(input);
  const goal = await getGoalInHousehold(householdId, goalId);
  await assertMemberInHousehold(householdId, parsed.memberId);

  const [created] = await db
    .insert(savingsContributions)
    .values({
      amount: String(parsed.amount),
      date: parsed.date,
      goalId,
      memberId: parsed.memberId,
    })
    .returning();

  await insertNotification({
    body: `${actorName} added ${formatNPR(parsed.amount)} to ${goal.name}.`,
    category: "goal",
    dedupeKey: `contribution:${created.id}`,
    householdId,
    severity: "success",
    title: "New contribution added",
  });

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "created",
    entityId: created.id,
    entityType: "savings_contribution",
    summary: contributionSummary(f, created, goal.name),
  });

  revalidateSavingsGoalsPaths();
}
