import Link from "next/link";

import { PageHeader } from "@/components/PageHeader";
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
      <PageHeader subtitle="Who added, edited or deleted what" title="Activity" />

      <div data-tour="activity-filters">
        <ActivityFilters members={members.map((m) => ({ id: m.id, name: m.user.name }))} realMemberId={memberId} value={params} />
      </div>

      <div data-tour="activity-list">
        {entries.length === 0 ? (
          <p className="border-b border-n-300 px-2 py-10 text-sm text-n-700">
            {hasFilters || filters.cursor
              ? "No activity matches these filters."
              : "No activity yet. Changes anyone in the household makes will show up here."}
          </p>
        ) : (
          <ActivityTimeline dateFormat={dateFormat} entries={entries} realMemberId={memberId} />
        )}
      </div>

      {(filters.cursor || nextCursor) && (
        <nav aria-label="Activity pages" className="mt-7 flex items-center justify-between border-t-2 border-rule pt-4 text-sm font-semibold">
          {filters.cursor ? (
            <Link className="text-signal-ink hover:text-signal" href={activityHref(params)}>
              ← Back to newest
            </Link>
          ) : (
            <span />
          )}
          {nextCursor && (
            <Link className="text-signal-ink hover:text-signal" href={activityHref({ ...params, cursor: nextCursor })}>
              Older activity →
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
