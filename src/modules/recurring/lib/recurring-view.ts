import type { DateFormat } from "@/lib/date-format-cookie";
import { adToBs, bsToAd, daysInBsMonth } from "@/lib/nepali-date";

// Pure view logic for the Recurring page: the "day by day" strip and the
// due-day → next-occurrence resolution used by the dialog.

export type TimelineEntry = { amount: number; day: number; name: string; paid: boolean };
export type TimelineDay = {
  allPaid: boolean;
  day: number;
  hasDue: boolean;
  isPast: boolean;
  isToday: boolean;
  showNumber: boolean;
};
export type TimelineMark = { align: "left" | "right"; amount: number; day: number; label: string };

// Day numbers always labelled (1/5/10/15/25), plus the last day, today and any
// day something falls due.
const NUMBER_DAYS = [1, 5, 10, 15, 25];

export function buildRecurringTimeline(input: {
  daysInPeriod: number;
  entries: TimelineEntry[];
  todayDay: null | number;
}): { days: TimelineDay[]; marks: TimelineMark[] } {
  const { daysInPeriod, entries, todayDay } = input;
  const byDay = new Map<number, TimelineEntry[]>();
  for (const entry of entries) {
    if (entry.day < 1 || entry.day > daysInPeriod) continue;
    byDay.set(entry.day, [...(byDay.get(entry.day) ?? []), entry]);
  }

  const mid = daysInPeriod / 2;
  const days: TimelineDay[] = [];
  const marks: TimelineMark[] = [];

  for (let day = 1; day <= daysInPeriod; day++) {
    const items = byDay.get(day) ?? [];
    const hasDue = items.length > 0;
    const isToday = todayDay === day;
    days.push({
      allPaid: hasDue && items.every((item) => item.paid),
      day,
      hasDue,
      isPast: todayDay !== null && day < todayDay,
      isToday,
      showNumber: NUMBER_DAYS.includes(day) || day === daysInPeriod || isToday || hasDue,
    });

    if (hasDue) {
      marks.push({
        align: day > mid ? "left" : "right",
        amount: items.reduce((sum, item) => sum + item.amount, 0),
        day,
        label: items.length > 1 ? `${items.length} payments` : items[0].name,
      });
    }
  }

  return { days, marks };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// The next date, on or after `today`, whose day-of-month equals `dueDay` in the
// household's calendar (clamped to the month length). Pure.
export function nextDueDateForDay(dueDay: number, dateFormat: DateFormat, today: string): string {
  const day = Math.max(1, Math.round(dueDay));

  if (dateFormat === "english") {
    const [y, m] = today.split("-").map(Number);
    const thisMonthDays = new Date(y, m, 0).getDate();
    const candidate = `${y}-${pad(m)}-${pad(Math.min(day, thisMonthDays))}`;
    if (candidate >= today) return candidate;
    const ny = m === 12 ? y + 1 : y;
    const nm = m === 12 ? 1 : m + 1;
    const nextMonthDays = new Date(ny, nm, 0).getDate();
    return `${ny}-${pad(nm)}-${pad(Math.min(day, nextMonthDays))}`;
  }

  const bs = adToBs(today);
  const candidate = bsToAd(bs.year, bs.month, Math.min(day, daysInBsMonth(bs.year, bs.month)));
  if (candidate >= today) return candidate;
  const ny = bs.month === 12 ? bs.year + 1 : bs.year;
  const nm = bs.month === 12 ? 1 : bs.month + 1;
  return bsToAd(ny, nm, Math.min(day, daysInBsMonth(ny, nm)));
}

// The day-of-period (household calendar) that an AD date falls on.
export function dayOfHouseholdCalendar(dateStr: string, dateFormat: DateFormat): number {
  if (dateFormat === "english") return Number(dateStr.split("-")[2]);
  return adToBs(dateStr).day;
}
