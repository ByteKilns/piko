import Link from "next/link";

import { getDateFormatPref } from "@/lib/date-format-cookie";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";

import { listActivity } from "../api/activity";
import { ActivityFilters } from "../components/ActivityFilters";
import { ActivityTimeline } from "../components/ActivityTimeline";
import { type ActivityFilterParams, activityHref } from "../lib/activity-query";
import { parseActivityFilters } from "../schemas/activity-filter.schema";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function ActivityPage({ searchParams }: Props) {
  const { householdId, memberId } = await getCurrentMember();
  const [members, dateFormat, rawParams] = await Promise.all([
    getHouseholdMembers(householdId),
    getDateFormatPref(householdId),
    searchParams,
  ]);

  const filters = parseActivityFilters(rawParams, new Set(members.map((m) => m.id)));
  const { entries, nextCursor } = await listActivity(householdId, filters);

  const params: ActivityFilterParams = {
    action: filters.action,
    from: filters.from,
    member: filters.member,
    q: filters.q,
    section: filters.section,
    to: filters.to,
  };
  const hasFilters = Object.values(params).some(Boolean);

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">Activity</h1>
        <p className="text-sm text-muted-foreground">Who added, edited or deleted what across the household</p>
      </div>

      <ActivityFilters
        members={members.map((m) => ({ id: m.id, name: m.user.name }))}
        realMemberId={memberId}
        value={params}
      />

      {entries.length === 0 ? (
        <p className="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          {hasFilters || filters.cursor
            ? "No activity matches these filters."
            : "No activity yet. Changes anyone in the household makes will show up here."}
        </p>
      ) : (
        <ActivityTimeline
          dateFormat={dateFormat}
          entries={entries}
          memberImages={new Map(members.map((m) => [m.id, m.user.image]))}
        />
      )}

      {(filters.cursor || nextCursor) && (
        <nav aria-label="Activity pages" className="flex items-center justify-between text-sm font-medium text-primary">
          {filters.cursor ? <Link href={activityHref(params)}>← Back to newest</Link> : <span />}
          {nextCursor && <Link href={activityHref({ ...params, cursor: nextCursor })}>Older activity →</Link>}
        </nav>
      )}
    </>
  );
}
