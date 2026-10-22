import { and, between, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { capturedPayments, captureEvents, captureRules, expenses } from "@/db/schema";
import type { CurrentMember } from "@/lib/session";
import { activityActor } from "@/modules/activity/api/activity";
import { listCategories } from "@/modules/categories/api/categories";
import { createExpenseForHousehold } from "@/modules/expenses/api/expenses";
import type { ExpenseInput } from "@/modules/expenses/schemas/expense.schema";

import { captureStatusFor } from "../lib/captures";
import type { CaptureEventInput, CaptureInput, CaptureRuleInput } from "../schemas/capture.schema";

// Everything here belongs to one member: the household and member always come
// from their sign-in, never from the request.
function ownedBy(member: CurrentMember) {
  return and(eq(capturedPayments.householdId, member.householdId), eq(capturedPayments.memberId, member.memberId));
}

// `created` is false when this notification was already stored (two drains
// at once, or a retry after a lost reply); the stored row comes back instead.
export async function insertCaptureForMember(member: CurrentMember, input: CaptureInput) {
  const [row] = await db
    .insert(capturedPayments)
    .values({
      amount: String(input.amount),
      category: input.category,
      categoryConfidence: input.categoryConfidence,
      counterparty: input.counterparty,
      direction: input.direction,
      eventId: input.eventId,
      householdId: member.householdId,
      kind: input.kind,
      memberId: member.memberId,
      occurredAt: new Date(input.occurredAt),
      rawText: input.rawText,
      refId: input.refId,
      source: input.source,
      status: captureStatusFor(input.direction),
    })
    .onConflictDoNothing({ target: [capturedPayments.memberId, capturedPayments.eventId] })
    .returning();
  if (row) return { created: true, row };

  // Only a known eventId conflicts (rows without one never do).
  const [existing] = await db
    .select()
    .from(capturedPayments)
    .where(and(ownedBy(member), eq(capturedPayments.eventId, input.eventId ?? "")));
  return { created: false, row: existing };
}

// Drafts waiting for review, newest first.
export async function listDraftCapturesForMember(member: CurrentMember) {
  return db
    .select()
    .from(capturedPayments)
    .where(and(ownedBy(member), eq(capturedPayments.status, "draft")))
    .orderBy(desc(capturedPayments.occurredAt));
}

// The note on the expense this member last approved for each payee (keyed as
// payeeKey does), so the next payment to them starts with it. Read from the
// expense, so an edit made since is what comes back; a deleted expense or an
// empty note gives nothing.
export async function lastNotesByPayeeForMember(member: CurrentMember): Promise<Map<string, string>> {
  const payee = sql<string>`lower(trim(${capturedPayments.counterparty}))`;
  const rows = await db
    .selectDistinctOn([payee], { note: expenses.note, payee })
    .from(capturedPayments)
    .innerJoin(expenses, and(eq(expenses.id, capturedPayments.expenseId), eq(expenses.householdId, capturedPayments.householdId)))
    .where(and(ownedBy(member), eq(capturedPayments.status, "approved"), sql`${payee} <> ''`, sql`trim(${expenses.note}) <> ''`))
    .orderBy(payee, desc(capturedPayments.occurredAt));
  return new Map(rows.map((row) => [row.payee, row.note!.trim()]));
}

// Captures in any status within `seconds` of `at`, for the app's duplicate check.
export async function listCapturesAroundForMember(member: CurrentMember, at: Date, seconds: number) {
  const from = new Date(at.getTime() - seconds * 1000);
  const to = new Date(at.getTime() + seconds * 1000);
  return db
    .select()
    .from(capturedPayments)
    .where(and(ownedBy(member), between(capturedPayments.occurredAt, from, to)));
}

// False when it wasn't a draft (already reviewed, or not this member's).
export async function rejectCaptureForMember(member: CurrentMember, id: string) {
  const rows = await db
    .update(capturedPayments)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(and(ownedBy(member), eq(capturedPayments.id, id), eq(capturedPayments.status, "draft")))
    .returning({ id: capturedPayments.id });
  return rows.length > 0;
}

// Turns a draft into a real expense through the same path as adding one by
// hand, so validation, notifications and the activity log all apply. The
// draft is claimed first, so a double tap or a retry can't make a second
// expense; if creating fails it goes back to being a draft. Null when it
// wasn't a draft.
export async function approveCaptureForMember(member: CurrentMember, id: string, expense: ExpenseInput) {
  const claimed = await db
    .update(capturedPayments)
    .set({ status: "approved", updatedAt: new Date() })
    .where(and(ownedBy(member), eq(capturedPayments.id, id), eq(capturedPayments.status, "draft")))
    .returning({ id: capturedPayments.id });
  if (claimed.length === 0) return null;

  try {
    const created = await createExpenseForHousehold(expense, activityActor(member, "mobile"));
    await db.update(capturedPayments).set({ expenseId: created.id }).where(eq(capturedPayments.id, id));
    return created;
  } catch (error) {
    await db.update(capturedPayments).set({ status: "draft", updatedAt: new Date() }).where(eq(capturedPayments.id, id));
    throw error;
  }
}

// The same notification can be sent again (the app retries until it hears
// back), so a repeat is ignored.
export async function saveCaptureEventForMember(member: CurrentMember, input: CaptureEventInput) {
  await db
    .insert(captureEvents)
    .values({
      householdId: member.householdId,
      key: input.key,
      memberId: member.memberId,
      postedAt: new Date(input.postedAt),
      source: input.source,
      text: input.text,
      title: input.title,
    })
    .onConflictDoNothing();
}

export async function listCaptureEventsForMember(member: CurrentMember, limit: number) {
  return db
    .select()
    .from(captureEvents)
    .where(and(eq(captureEvents.householdId, member.householdId), eq(captureEvents.memberId, member.memberId)))
    .orderBy(desc(captureEvents.postedAt))
    .limit(limit);
}

export async function listCaptureRulesForMember(member: CurrentMember) {
  return db
    .select({ categoryId: captureRules.categoryId, counterparty: captureRules.counterparty })
    .from(captureRules)
    .where(and(eq(captureRules.householdId, member.householdId), eq(captureRules.memberId, member.memberId)));
}

// Adds or updates rules; never deletes one. The app sends its whole set, and
// one it loaded while offline could be missing older rules, so replacing the
// set would lose them. Rules for categories outside the household are dropped.
export async function saveCaptureRulesForMember(member: CurrentMember, rules: CaptureRuleInput[]) {
  const known = new Set((await listCategories(member.householdId)).map((c) => c.id));
  const byPayee = new Map(
    rules.filter((r) => known.has(r.categoryId)).map((r) => [r.counterparty.toLowerCase(), r.categoryId]),
  );
  if (byPayee.size === 0) return;

  await db
    .insert(captureRules)
    .values(
      [...byPayee].map(([counterparty, categoryId]) => ({
        categoryId,
        counterparty,
        householdId: member.householdId,
        memberId: member.memberId,
      })),
    )
    .onConflictDoUpdate({
      set: { categoryId: sql`excluded.category_id`, updatedAt: new Date() },
      target: [captureRules.memberId, captureRules.counterparty],
    });
}
