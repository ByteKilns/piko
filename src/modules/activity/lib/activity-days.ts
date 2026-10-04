import { formatDate } from "@/lib/date-format";
import type { DateFormat } from "@/lib/date-format-cookie";

import { kathmanduDateKey } from "./activity-time";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ActivityDay<T> = { dateKey: string; entries: T[]; label: string };

// Entries arrive newest first, so consecutive entries sharing a Kathmandu day
// form one group.
export function groupActivityByDay<T extends { createdAt: Date }>(
  entries: T[],
  dateFormat: DateFormat,
  now: Date,
): ActivityDay<T>[] {
  const todayKey = kathmanduDateKey(now);
  const yesterdayKey = kathmanduDateKey(new Date(now.getTime() - DAY_MS));

  const days: ActivityDay<T>[] = [];
  for (const entry of entries) {
    const dateKey = kathmanduDateKey(entry.createdAt);
    let day = days.at(-1);
    if (day?.dateKey !== dateKey) {
      const label = dateKey === todayKey ? "Today" : dateKey === yesterdayKey ? "Yesterday" : formatDate(dateKey, dateFormat);
      day = { dateKey, entries: [], label };
      days.push(day);
    }
    day.entries.push(entry);
  }
  return days;
}
