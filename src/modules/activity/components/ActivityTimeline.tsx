import type { DateFormat } from "@/lib/date-format-cookie";

import type { ActivityListEntry } from "../api/activity";
import { groupActivityByDay } from "../lib/activity-days";
import { ActivityRow } from "./ActivityRow";

type Props = { dateFormat: DateFormat; entries: ActivityListEntry[]; realMemberId: string };

export function ActivityTimeline({ dateFormat, entries, realMemberId }: Props) {
  const days = groupActivityByDay(entries, dateFormat, new Date());

  return (
    <div>
      {days.map((day) => (
        <section aria-label={day.label} key={day.dateKey}>
          <div className="border-b border-rule px-2 pt-6 pb-2 text-[13px] font-semibold text-n-600">{day.label}</div>
          <ul>
            {day.entries.map((entry) => (
              <ActivityRow entry={entry} key={entry.id} realMemberId={realMemberId} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
