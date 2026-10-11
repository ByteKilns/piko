"use server";

import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { expenses, savingsDeposits, savingsItems, savingsPotPlans, savingsPots } from "@/db/schema";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { todayISO } from "@/lib/today";
import { activityActor, loadActivityFormatters, logActivity } from "@/modules/activity/api/activity";
import { formatNPR } from "@/modules/dashboard/lib/format";
import { insertNotification } from "@/modules/notifications/api/notifications.actions";

import { depositSummary, itemSummary, potSummary } from "../lib/savings-activity";
import {
  type CreatePotInput,
  createPotSchema,
  type DepositInput,
  depositSchema,
  type ItemInput,
  itemSchema,
  type UpdatePotInput,
  updatePotSchema,
} from "../schemas/savings.schema";

type PlanInput = { memberId: string; monthlyAmount: number };

function revalidateSavingsPaths() {
  revalidatePath("/savings");
  revalidatePath("/dashboard");
  revalidatePath("/budget");
  revalidatePath("/reports");
}

export async function listSavingsPots(householdId: string) {
  return db.select().from(savingsPots).where(eq(savingsPots.householdId, householdId)).orderBy(asc(savingsPots.createdAt));
}

async function potIdsOf(householdId: string) {
  return (await listSavingsPots(householdId)).map((pot) => pot.id);
}

export async function listSavingsPotPlans(householdId: string) {
  const potIds = await potIdsOf(householdId);
  if (potIds.length === 0) return [];
  return db.select().from(savingsPotPlans).where(inArray(savingsPotPlans.potId, potIds));
}

export async function listSavingsItems(householdId: string) {
  const potIds = await potIdsOf(householdId);
  if (potIds.length === 0) return [];
  return db.select().from(savingsItems).where(inArray(savingsItems.potId, potIds)).orderBy(asc(savingsItems.position));
}

export async function listSavingsDeposits(householdId: string) {
  const potIds = await potIdsOf(householdId);
  if (potIds.length === 0) return [];
  return db
    .select()
    .from(savingsDeposits)
    .where(inArray(savingsDeposits.potId, potIds))
    .orderBy(desc(savingsDeposits.date), desc(savingsDeposits.createdAt));
}

// Every expense ever paid from a pot: for pot balances and finished items.
export async function listSavingsExpenses(householdId: string) {
  return db
    .select({
      amount: expenses.amount,
      date: expenses.date,
      id: expenses.id,
      savingsItemId: expenses.savingsItemId,
      savingsPotId: expenses.savingsPotId,
    })
    .from(expenses)
    .where(and(eq(expenses.householdId, householdId), isNotNull(expenses.savingsPotId)));
}

async function findPotInHousehold(householdId: string, potId: string) {
  const [pot] = await db.select().from(savingsPots).where(and(eq(savingsPots.id, potId), eq(savingsPots.householdId, householdId)));
  if (!pot) throw new Error("Savings pot does not belong to this household");
  return pot;
}

async function findItemInHousehold(householdId: string, itemId: string) {
  const [item] = await db.select().from(savingsItems).where(eq(savingsItems.id, itemId));
  if (!item) throw new Error("List item not found");
  const pot = await findPotInHousehold(householdId, item.potId);
  return { item, pot };
}

// Replaces a pot's monthly plans. Only household members count, and an
// individual pot only takes its owner's plan.
async function savePlans(potId: string, ownerMemberId: null | string, plans: PlanInput[], memberIds: Set<string>) {
  const rows = plans
    .filter((p) => memberIds.has(p.memberId) && (ownerMemberId === null || p.memberId === ownerMemberId) && p.monthlyAmount > 0)
    .map((p) => ({ memberId: p.memberId, monthlyAmount: String(p.monthlyAmount), potId }));
  await db.delete(savingsPotPlans).where(eq(savingsPotPlans.potId, potId));
  if (rows.length > 0) await db.insert(savingsPotPlans).values(rows);
}

export async function createSavingsPotAction(input: CreatePotInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = createPotSchema.parse(input);
  const members = await getHouseholdMembers(householdId);
  const memberIds = new Set(members.map((m) => m.id));
  if (parsed.ownerMemberId !== null && !memberIds.has(parsed.ownerMemberId)) {
    throw new Error("Member does not belong to this household");
  }
  const existing = await listSavingsPots(householdId);
  if (existing.some((pot) => pot.ownerMemberId === parsed.ownerMemberId)) {
    throw new Error("That pot is already set up");
  }
  // An individual pot is always held by its owner.
  const heldByMemberId =
    parsed.ownerMemberId ?? (parsed.heldByMemberId !== null && memberIds.has(parsed.heldByMemberId) ? parsed.heldByMemberId : null);

  const [created] = await db
    .insert(savingsPots)
    .values({
      heldByMemberId,
      householdId,
      name: parsed.name,
      ownerMemberId: parsed.ownerMemberId,
      reserveMinimum: String(parsed.reserveMinimum),
    })
    .returning();
  await savePlans(created.id, created.ownerMemberId, parsed.plans, memberIds);
  if (parsed.openingBalance > 0) {
    await db.insert(savingsDeposits).values({
      amount: String(parsed.openingBalance),
      date: todayISO(),
      kind: "opening",
      memberId: null,
      potId: created.id,
    });
  }

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "created",
    after: created,
    entityId: created.id,
    entityType: "savings_pot",
    summary: potSummary(f, created),
  });

  revalidateSavingsPaths();
}

export async function updateSavingsPotAction(id: string, input: UpdatePotInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = updatePotSchema.parse(input);
  const before = await findPotInHousehold(householdId, id);
  const members = await getHouseholdMembers(householdId);
  const memberIds = new Set(members.map((m) => m.id));
  const heldByMemberId =
    before.ownerMemberId ?? (parsed.heldByMemberId !== null && memberIds.has(parsed.heldByMemberId) ? parsed.heldByMemberId : null);

  const [updated] = await db
    .update(savingsPots)
    .set({ heldByMemberId, name: parsed.name, reserveMinimum: String(parsed.reserveMinimum) })
    .where(and(eq(savingsPots.id, id), eq(savingsPots.householdId, householdId)))
    .returning();
  await savePlans(id, before.ownerMemberId, parsed.plans, memberIds);

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "updated",
    after: updated,
    before,
    entityId: id,
    entityType: "savings_pot",
    summary: potSummary(f, updated),
  });

  revalidateSavingsPaths();
}

export async function addSavingsDepositAction(potId: string, input: DepositInput) {
  const member = await getCurrentMember();
  const { householdId, name: actorName } = member;
  const parsed = depositSchema.parse(input);
  const pot = await findPotInHousehold(householdId, potId);

  let memberId: null | string = null;
  if (parsed.kind === "deposit") {
    // An individual pot only ever gets money from its owner.
    memberId = pot.ownerMemberId ?? parsed.memberId;
    const members = await getHouseholdMembers(householdId);
    if (memberId === null || !members.some((m) => m.id === memberId)) {
      throw new Error("Choose who put the money in");
    }
  }

  const [created] = await db
    .insert(savingsDeposits)
    .values({ amount: String(parsed.amount), date: parsed.date, kind: parsed.kind, memberId, potId })
    .returning();

  if (parsed.kind === "deposit") {
    await insertNotification({
      body: `${actorName} added ${formatNPR(parsed.amount)} to ${pot.name}.`,
      category: "goal",
      dedupeKey: `savings-deposit:${created.id}`,
      householdId,
      severity: "success",
      title: "Money added to savings",
    });
  }

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "created",
    after: created,
    entityId: created.id,
    entityType: "savings_deposit",
    summary: depositSummary(f, created, pot.name),
  });

  revalidateSavingsPaths();
}

export async function deleteSavingsDepositAction(id: string) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const [before] = await db.select().from(savingsDeposits).where(eq(savingsDeposits.id, id));
  if (!before) return;
  const pot = await findPotInHousehold(householdId, before.potId);

  await db.delete(savingsDeposits).where(eq(savingsDeposits.id, id));

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "deleted",
    before,
    entityId: id,
    entityType: "savings_deposit",
    summary: depositSummary(f, before, pot.name),
  });

  revalidateSavingsPaths();
}

export async function createSavingsItemAction(potId: string, input: ItemInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = itemSchema.parse(input);
  const pot = await findPotInHousehold(householdId, potId);
  const positions = await db.select({ position: savingsItems.position }).from(savingsItems).where(eq(savingsItems.potId, potId));
  const position = Math.max(0, ...positions.map((p) => p.position)) + 1;

  const [created] = await db
    .insert(savingsItems)
    .values({
      cost: String(parsed.cost),
      name: parsed.name,
      neededBy: parsed.neededBy,
      note: parsed.note?.trim() || null,
      position,
      potId,
    })
    .returning();

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "created",
    after: created,
    entityId: created.id,
    entityType: "savings_item",
    summary: itemSummary(f, created, pot.name),
  });

  revalidateSavingsPaths();
}

export async function updateSavingsItemAction(id: string, input: ItemInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = itemSchema.parse(input);
  const { item: before, pot } = await findItemInHousehold(householdId, id);

  const [updated] = await db
    .update(savingsItems)
    .set({ cost: String(parsed.cost), name: parsed.name, neededBy: parsed.neededBy, note: parsed.note?.trim() || null })
    .where(eq(savingsItems.id, id))
    .returning();

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "updated",
    after: updated,
    before,
    entityId: id,
    entityType: "savings_item",
    summary: itemSummary(f, updated, pot.name),
  });

  revalidateSavingsPaths();
}

export async function deleteSavingsItemAction(id: string) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const { item: before, pot } = await findItemInHousehold(householdId, id);

  // An expense that paid for it keeps its "from savings" flag; the foreign key
  // only clears the link to the item.
  await db.delete(savingsItems).where(eq(savingsItems.id, id));

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "deleted",
    before,
    entityId: id,
    entityType: "savings_item",
    summary: itemSummary(f, before, pot.name),
  });

  revalidateSavingsPaths();
}

// Swaps an item with its neighbour among the items not paid for yet, which is
// the order the Savings page shows.
export async function moveSavingsItemAction(id: string, direction: "down" | "up") {
  const member = await getCurrentMember();
  const { householdId } = member;
  const { item, pot } = await findItemInHousehold(householdId, id);

  const potItems = await db.select().from(savingsItems).where(eq(savingsItems.potId, pot.id)).orderBy(asc(savingsItems.position));
  const paid = await db
    .select({ savingsItemId: expenses.savingsItemId })
    .from(expenses)
    .where(and(eq(expenses.householdId, householdId), eq(expenses.savingsPotId, pot.id), isNotNull(expenses.savingsItemId)));
  const paidIds = new Set(paid.map((p) => p.savingsItemId));
  const open = potItems.filter((i) => !paidIds.has(i.id));
  const index = open.findIndex((i) => i.id === id);
  const neighbour = open[direction === "up" ? index - 1 : index + 1];
  if (index === -1 || !neighbour) return;

  await db.update(savingsItems).set({ position: neighbour.position }).where(eq(savingsItems.id, item.id));
  await db.update(savingsItems).set({ position: item.position }).where(eq(savingsItems.id, neighbour.id));

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "updated",
    after: { ...item, position: neighbour.position },
    before: item,
    entityId: item.id,
    entityType: "savings_item",
    summary: `${itemSummary(f, item, pot.name)} · moved ${direction}`,
  });

  revalidateSavingsPaths();
}
