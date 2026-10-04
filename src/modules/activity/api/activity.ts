import { and, desc, eq, gte, ilike, inArray, lt, or, type SQL } from "drizzle-orm";

import { db } from "@/db/client";
import {
  type ActivityAction,
  type ActivityChange,
  type ActivityEntityType,
  type ActivityLog,
  activityLogs,
  type ActivitySnapshot,
  type ActivitySource,
} from "@/db/schema";
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { type CurrentMember, getHouseholdMembers } from "@/lib/session";
import { listCategories } from "@/modules/categories/api/categories";

import { encodeCursor, escapeLike } from "../lib/activity-query";
import { kathmanduDayStart, kathmanduNextDayStart } from "../lib/activity-time";
import { type ActivityFormatters, activityFormatters } from "../lib/activity-values";
import { actionsForGroup, entityTypesForSection } from "../lib/sections";
import { toSnapshot } from "../lib/snapshot";
import type { ActivityFilters } from "../schemas/activity-filter.schema";

export const ACTIVITY_PAGE_SIZE = 50;

export type ActivityActor = Pick<CurrentMember, "householdId" | "memberId" | "name"> & { source: ActivitySource };

export type ActivityEntry = {
  action: ActivityAction;
  // Raw rows for revert support; omit where the action has none.
  after?: null | object;
  before?: null | object;
  // Omit for entries that aren't field edits. An empty array means "saved,
  // but nothing actually changed" and the entry is skipped.
  changes?: ActivityChange[];
  entityId: null | string;
  entityType: ActivityEntityType;
  related?: Record<string, object[]>;
  // Set when this entry records a revert of another entry.
  revertOfId?: string;
  summary: string;
};

export function activityActor(member: CurrentMember, source: ActivitySource = "web"): ActivityActor {
  return { householdId: member.householdId, memberId: member.memberId, name: member.name, source };
}

// Call after the domain write has succeeded. householdId always comes from the
// actor (i.e. the session), never from the entry.
export async function logActivities(actor: ActivityActor, entries: ActivityEntry[]) {
  const toInsert = entries.filter((entry) => entry.changes === undefined || entry.changes.length > 0);
  if (toInsert.length === 0) return;

  await db.insert(activityLogs).values(
    toInsert.map((entry) => ({
      action: entry.action,
      actorMemberId: actor.memberId,
      actorName: actor.name,
      after: entry.after ? toSnapshot(entry.after) : null,
      before: entry.before ? toSnapshot(entry.before) : null,
      changes: entry.changes ?? null,
      entityId: entry.entityId,
      entityType: entry.entityType,
      householdId: actor.householdId,
      related: entry.related ? (toSnapshot(entry.related) as Record<string, ActivitySnapshot[]>) : null,
      revertOfId: entry.revertOfId ?? null,
      source: actor.source,
      summary: entry.summary,
    })),
  );
}

export async function logActivity(actor: ActivityActor, entry: ActivityEntry) {
  await logActivities(actor, [entry]);
}

export async function loadActivityFormatters(householdId: string): Promise<ActivityFormatters> {
  const [members, categories, dateFormat] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId, { includeArchived: true }),
    getDateFormatPref(householdId),
  ]);

  return activityFormatters({
    categoryNames: new Map(categories.map((c) => [c.id, c.name])),
    dateFormat,
    memberNames: new Map(members.map((m) => [m.id, m.user.name])),
  });
}

export async function listActivity(
  householdId: string,
  filters: ActivityFilters,
): Promise<{ entries: ActivityLog[]; nextCursor: null | string }> {
  const conditions: SQL[] = [eq(activityLogs.householdId, householdId)];
  if (filters.member) conditions.push(eq(activityLogs.actorMemberId, filters.member));
  if (filters.section) conditions.push(inArray(activityLogs.entityType, entityTypesForSection(filters.section)));
  if (filters.action) conditions.push(inArray(activityLogs.action, actionsForGroup(filters.action)));
  if (filters.from) conditions.push(gte(activityLogs.createdAt, kathmanduDayStart(filters.from)));
  if (filters.to) conditions.push(lt(activityLogs.createdAt, kathmanduNextDayStart(filters.to)));
  if (filters.q) conditions.push(ilike(activityLogs.summary, `%${escapeLike(filters.q)}%`));
  if (filters.cursor) {
    const { createdAt, id } = filters.cursor;
    const olderThanCursor = or(
      lt(activityLogs.createdAt, createdAt),
      and(eq(activityLogs.createdAt, createdAt), lt(activityLogs.id, id)),
    );
    if (olderThanCursor) conditions.push(olderThanCursor);
  }

  // One extra row tells us whether an older page exists.
  const rows = await db
    .select()
    .from(activityLogs)
    .where(and(...conditions))
    .orderBy(desc(activityLogs.createdAt), desc(activityLogs.id))
    .limit(ACTIVITY_PAGE_SIZE + 1);

  const entries = rows.slice(0, ACTIVITY_PAGE_SIZE);
  const last = entries.at(-1);
  return { entries, nextCursor: rows.length > ACTIVITY_PAGE_SIZE && last ? encodeCursor(last) : null };
}
