import { formatDate } from "@/lib/date-format";
import type { DateFormat } from "@/lib/date-format-cookie";
import { formatPeriodLabel } from "@/lib/month-period";
import { formatNPR } from "@/modules/dashboard/lib/format";

export type ActivityLabels = {
  categoryNames: Map<string, string>;
  dateFormat: DateFormat;
  memberNames: Map<string, string>;
};

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === "";
}

// Turns raw row/input values into the display strings stored in activity
// summaries and diffs. Resolved at write time, so a later rename or deletion
// doesn't rewrite history.
export function activityFormatters(labels: ActivityLabels) {
  const memberName = (id: string) => labels.memberNames.get(id) ?? "Former member";

  return {
    category: (value: unknown) =>
      isBlank(value) ? null : (labels.categoryNames.get(String(value)) ?? "Unknown category"),
    date: (value: unknown) => (isBlank(value) ? null : formatDate(String(value), labels.dateFormat)),
    member: (value: unknown) => (isBlank(value) ? null : memberName(String(value))),
    money: (value: unknown) => (isBlank(value) ? null : formatNPR(Number(value))),
    owner: (value: unknown) => (isBlank(value) ? "Shared" : memberName(String(value))),
    period: (year: number, month: number) => formatPeriodLabel(year, month, labels.dateFormat),
    text: (value: unknown) => (isBlank(value) ? null : String(value).trim()),
  };
}

export type ActivityFormatters = ReturnType<typeof activityFormatters>;
