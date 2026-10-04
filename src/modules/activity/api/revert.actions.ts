"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db/client";
import { type ActivityAction, type ActivityChange, type ActivityLog, activityLogs } from "@/db/schema";
import { type CurrentMember, getCurrentMember } from "@/lib/session";

import type { ActivityFormatters } from "../lib/activity-values";
import { ENTITY_REVERT, type EntityRevert } from "../lib/revert/entities";
import { revertFailureReason } from "../lib/revert/failure";
import { isRevertible, planRevert, type RevertContext, type RevertMode, revertModes, type RevertOperation, type RevertPlan } from "../lib/revert/plan";
import { activityActor, loadActivityFormatters, logActivity } from "./activity";
import { REVERT_STORES, type RevertStore } from "./revert-store";

const inputSchema = z.object({ entryId: z.string().uuid(), mode: z.enum(["restore", "undo"]) });

export type RevertPreview = { changes: ActivityChange[]; kind: RevertPlan["kind"]; reason: null | string; warnings: string[] };

export type RevertResult = { ok: false; reason: string } | { ok: true };

const NOT_REVERTIBLE = "This change can't be reverted.";

// What the revert itself did, as it appears in the log.
const LOGGED_ACTION: Record<RevertOperation["type"], ActivityAction> = {
  delete: "deleted",
  insert: "created",
  unpay: "updated",
  update: "updated",
};

type Prepared =
  | {
      config: EntityRevert;
      context: RevertContext;
      entityId: string;
      entry: ActivityLog;
      f: ActivityFormatters;
      ok: true;
      plan: RevertPlan;
      store: RevertStore;
    }
  | { ok: false; plan: RevertPlan };

// Always re-reads the entry and the live row for *this* household, so a
// stale preview or a crafted id can never act on anything else.
async function prepare(member: CurrentMember, entryId: string, mode: RevertMode): Promise<Prepared> {
  const input = inputSchema.parse({ entryId, mode });
  const [entry] = await db
    .select()
    .from(activityLogs)
    .where(and(eq(activityLogs.id, input.entryId), eq(activityLogs.householdId, member.householdId)));
  if (!entry) throw new Error("Activity entry not found");

  const config = ENTITY_REVERT[entry.entityType];
  const store = REVERT_STORES[entry.entityType];
  const hasSnapshot = entry.before !== null || entry.after !== null;
  if (
    !config ||
    !store ||
    !entry.entityId ||
    !isRevertible({ entityType: entry.entityType, hasSnapshot, source: entry.source }) ||
    !revertModes(entry.action).includes(input.mode)
  ) {
    return { ok: false, plan: { kind: "blocked", reason: NOT_REVERTIBLE } };
  }

  const [context, f] = await Promise.all([store.load(member.householdId, entry.entityId, entry), loadActivityFormatters(member.householdId)]);
  return { config, context, entityId: entry.entityId, entry, f, ok: true, plan: planRevert(entry, context, input.mode, f), store };
}

export async function previewRevertAction(entryId: string, mode: RevertMode): Promise<RevertPreview> {
  const { plan } = await prepare(await getCurrentMember(), entryId, mode);
  return plan.kind === "apply"
    ? { changes: plan.changes, kind: "apply", reason: null, warnings: plan.warnings }
    : { changes: [], kind: plan.kind, reason: plan.reason, warnings: [] };
}

// Expected failures (blocked / nothing to do / a constraint conflict) are
// returned rather than thrown: production Next.js replaces thrown
// server-action messages with a generic one.
export async function revertActivityAction(entryId: string, mode: RevertMode): Promise<RevertResult> {
  const member = await getCurrentMember();
  const prepared = await prepare(member, entryId, mode);
  if (!prepared.ok || prepared.plan.kind !== "apply") {
    return { ok: false, reason: prepared.plan.kind === "apply" ? NOT_REVERTIBLE : prepared.plan.reason };
  }
  const { config, context, entityId, entry, f, plan, store } = prepared;
  const op = plan.operation;

  try {
    // Entity, children and any parent update / re-link land together or not at all.
    await db.transaction((tx) => store.apply(tx, member.householdId, entityId, op));
  } catch (error) {
    const reason = revertFailureReason(error);
    if (reason) return { ok: false, reason };
    throw error;
  }

  // before/after are the live row either side of the revert, and a delete
  // records what it took along — so the revert can itself be reverted.
  const resulting = op.type === "insert" ? op.row : op.type === "delete" ? (context.row ?? {}) : { ...context.row, ...op.set };
  const cascaded = Object.fromEntries(config.children.map((c) => [c.kind, context.children[c.kind] ?? []]));

  await logActivity(activityActor(member), {
    action: LOGGED_ACTION[op.type],
    after: op.type === "delete" ? null : resulting,
    before: op.type === "insert" ? null : context.row,
    // An empty list would make logActivity skip the entry; a revert that
    // wrote something is always logged.
    changes: plan.changes.length > 0 ? plan.changes : undefined,
    entityId,
    entityType: entry.entityType,
    related: op.type === "delete" ? cascaded : undefined,
    revertOfId: entry.id,
    summary: config.summary(f, resulting),
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
