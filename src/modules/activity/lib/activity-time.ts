// Nepal is UTC+05:45 year-round (no DST) and the household lives there, so log
// times are shown — and date filters interpreted — in Kathmandu time whatever
// the server's own timezone is (UTC on Vercel).
const TIME_ZONE = "Asia/Kathmandu";
const UTC_OFFSET = "+05:45";
const DAY_MS = 24 * 60 * 60 * 1000;

// en-CA formats as YYYY-MM-DD.
const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: TIME_ZONE,
  year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: TIME_ZONE });

export function kathmanduDateKey(date: Date): string {
  return dateKeyFormatter.format(date);
}

export function formatKathmanduTime(date: Date): string {
  return timeFormatter.format(date);
}

export function kathmanduDayStart(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00${UTC_OFFSET}`);
}

export function kathmanduNextDayStart(dateKey: string): Date {
  return new Date(kathmanduDayStart(dateKey).getTime() + DAY_MS);
}
