import type { ActivityLog } from "@/db/schema";
import type { DateFormat } from "@/lib/date-format-cookie";

import { groupActivityByDay } from "../lib/activity-days";
import { ActivityRow } from "./ActivityRow";

type Props = { dateFormat: DateFormat; entries: ActivityLog[]; memberImages: Map<string, null | string> };

export function ActivityTimeline({ dateFormat, entries, memberImages }: Props) {
  const days = groupActivityByDay(entries, dateFormat, new Date());

  return (
    <div className="space-y-4">
      {days.map((day) => (
        <section aria-label={day.label} key={day.dateKey}>
          <h2 className="px-1 pb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{day.label}</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {day.entries.map((entry) => (
              <ActivityRow
                actorImage={entry.actorMemberId ? (memberImages.get(entry.actorMemberId) ?? null) : null}
                entry={entry}
                key={entry.id}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
