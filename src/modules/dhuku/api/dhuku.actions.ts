// src/modules/dhuku/api/dhuku.actions.ts
"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { dhukuEntries, dhukus } from "@/db/schema";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { activityActor, loadActivityFormatters, logActivity } from "@/modules/activity/api/activity";
import { formatNPR } from "@/modules/dashboard/lib/format";
import { dhukuChanges, dhukuEntrySummary, dhukuSummary } from "@/modules/dhuku/lib/dhuku-activity";
import { type DhukuEntryInput, dhukuEntrySchema, type DhukuInput, dhukuSchema } from "@/modules/dhuku/schemas/dhuku.schema";
import { insertNotification } from "@/modules/notifications/api/notifications.actions";

function revalidateDhukuPaths() {
  revalidatePath("/dhuku");
  revalidatePath("/dashboard");
}

async function assertMemberInHousehold(householdId: string, memberId: string) {
  const members = await getHouseholdMembers(householdId);
  if (!members.some((m) => m.id === memberId)) {
    throw new Error("Member does not belong to this household");
  }
}

export async function listDhukus(householdId: string) {
  return db.select().from(dhukus).where(eq(dhukus.householdId, householdId)).orderBy(desc(dhukus.startDate));
}

export async function listDhukuEntries(householdId: string) {
  const rows = await listDhukus(householdId);
  const dhukuIds = rows.map((d) => d.id);
  if (dhukuIds.length === 0) return [];

  return db
    .select()
    .from(dhukuEntries)
    .where(inArray(dhukuEntries.dhukuId, dhukuIds))
    .orderBy(desc(dhukuEntries.date), desc(dhukuEntries.createdAt));
}

async function findDhukuInHousehold(householdId: string, dhukuId: string) {
  const [dhuku] = await db.select().from(dhukus).where(and(eq(dhukus.id, dhukuId), eq(dhukus.householdId, householdId)));
  return dhuku;
}

export async function createDhukuAction(input: DhukuInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = dhukuSchema.parse(input);
  if (parsed.ownerMemberId) {
    await assertMemberInHousehold(householdId, parsed.ownerMemberId);
  }

  const [created] = await db.insert(dhukus).values({
    householdId,
    interestPerMonth: parsed.interestPerMonth === null ? null : String(parsed.interestPerMonth),
    monthlyContribution: String(parsed.monthlyContribution),
    name: parsed.name,
    note: parsed.note?.trim() || null,
    ownerMemberId: parsed.ownerMemberId,
    startDate: parsed.startDate,
    totalMembers: parsed.totalMembers,
  }).returning();

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "created",
    after: created,
    entityId: created.id,
    entityType: "dhuku",
    summary: dhukuSummary(f, created),
  });

  revalidateDhukuPaths();
}

export async function updateDhukuAction(id: string, input: DhukuInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = dhukuSchema.parse(input);
  if (parsed.ownerMemberId) {
    await assertMemberInHousehold(householdId, parsed.ownerMemberId);
  }

  const before = await findDhukuInHousehold(householdId, id);
  if (!before) return;

  const [updated] = await db
    .update(dhukus)
    .set({
      interestPerMonth: parsed.interestPerMonth === null ? null : String(parsed.interestPerMonth),
      monthlyContribution: String(parsed.monthlyContribution),
      name: parsed.name,
      note: parsed.note?.trim() || null,
      ownerMemberId: parsed.ownerMemberId,
      startDate: parsed.startDate,
      totalMembers: parsed.totalMembers,
    })
    .where(and(eq(dhukus.id, id), eq(dhukus.householdId, householdId)))
    .returning();

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "updated",
    after: updated,
    before,
    changes: dhukuChanges(f, before, parsed),
    entityId: id,
    entityType: "dhuku",
    summary: dhukuSummary(f, parsed),
  });

  revalidateDhukuPaths();
}

export async function deleteDhukuAction(id: string) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const before = await findDhukuInHousehold(householdId, id);
  if (!before) return;

  const entries = await db.select().from(dhukuEntries).where(eq(dhukuEntries.dhukuId, id));

  await db.delete(dhukus).where(and(eq(dhukus.id, id), eq(dhukus.householdId, householdId)));

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "deleted",
    before,
    entityId: id,
    entityType: "dhuku",
    related: { dhukuEntries: entries },
    summary: dhukuSummary(f, before),
  });

  revalidateDhukuPaths();
}

async function getDhukuInHousehold(householdId: string, dhukuId: string) {
  const dhuku = await findDhukuInHousehold(householdId, dhukuId);
  if (!dhuku) {
    throw new Error("Dhuku does not belong to this household");
  }
  return dhuku;
}

export async function addDhukuEntryAction(dhukuId: string, input: DhukuEntryInput) {
  const member = await getCurrentMember();
  const { householdId, name: actorName } = member;
  const parsed = dhukuEntrySchema.parse(input);
  const dhuku = await getDhukuInHousehold(householdId, dhukuId);

  const [created] = await db
    .insert(dhukuEntries)
    .values({
      amount: String(parsed.amount),
      date: parsed.date,
      dhukuId,
      note: parsed.note?.trim() || null,
      type: parsed.type,
    })
    .returning();

  const body =
    parsed.type === "payout"
      ? `${actorName} recorded receiving ${formatNPR(parsed.amount)} from ${dhuku.name}.`
      : `${actorName} recorded a ${formatNPR(parsed.amount)} contribution to ${dhuku.name}.`;
  await insertNotification({
    body,
    category: "shared",
    dedupeKey: `dhuku-entry:${created.id}`,
    householdId,
    severity: "success",
    title: parsed.type === "payout" ? "Dhuku payout recorded" : "Dhuku contribution recorded",
  });

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "created",
    after: created,
    entityId: created.id,
    entityType: "dhuku_entry",
    summary: dhukuEntrySummary(f, created, dhuku.name),
  });

  revalidateDhukuPaths();
}

export async function deleteDhukuEntryAction(id: string) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const [entry] = await db.select().from(dhukuEntries).where(eq(dhukuEntries.id, id));
  if (!entry) return;
  const dhuku = await getDhukuInHousehold(householdId, entry.dhukuId);

  await db.delete(dhukuEntries).where(eq(dhukuEntries.id, id));

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "deleted",
    before: entry,
    entityId: id,
    entityType: "dhuku_entry",
    summary: dhukuEntrySummary(f, entry, dhuku.name),
  });

  revalidateDhukuPaths();
}
