"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { paybacks } from "@/db/schema";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { activityActor, loadActivityFormatters, logActivity } from "@/modules/activity/api/activity";
import { formatNPR } from "@/modules/dashboard/lib/format";
import { insertNotification } from "@/modules/notifications/api/notifications";

import { paybackSummary } from "../lib/payback-activity";
import { type PaybackInput, paybackSchema } from "../schemas/payback.schema";

export async function createPaybackAction(input: PaybackInput) {
  const member = await getCurrentMember();
  const { householdId, name: actorName } = member;
  const parsed = paybackSchema.parse(input);
  const members = await getHouseholdMembers(householdId);
  const from = members.find((m) => m.id === parsed.fromMemberId);
  const to = members.find((m) => m.id === parsed.toMemberId);
  if (!from || !to) throw new Error("Member does not belong to this household");

  const [created] = await db
    .insert(paybacks)
    .values({
      amount: String(parsed.amount),
      date: parsed.date,
      fromMemberId: parsed.fromMemberId,
      householdId,
      note: parsed.note?.trim() || null,
      toMemberId: parsed.toMemberId,
    })
    .returning();

  await insertNotification({
    body: `${actorName} recorded ${from.user.name} paying back ${formatNPR(parsed.amount)} to ${to.user.name}.`,
    category: "payment",
    dedupeKey: `payback:${created.id}`,
    householdId,
    severity: "success",
    title: "Payback recorded",
  });

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "created",
    after: created,
    entityId: created.id,
    entityType: "payback",
    summary: paybackSummary(f, created),
  });

  revalidatePath("/dashboard");
}

export async function deletePaybackAction(id: string) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const [before] = await db.select().from(paybacks).where(and(eq(paybacks.id, id), eq(paybacks.householdId, householdId)));
  if (!before) return;

  await db.delete(paybacks).where(and(eq(paybacks.id, id), eq(paybacks.householdId, householdId)));

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "deleted",
    before,
    entityId: id,
    entityType: "payback",
    summary: paybackSummary(f, before),
  });

  revalidatePath("/dashboard");
}
