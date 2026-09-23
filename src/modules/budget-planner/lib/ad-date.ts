// Local-time "YYYY-MM-DD" arithmetic, mirroring src/lib/month-period.ts's
// private helpers. Duplicated here (rather than exported from that core lib)
// to keep this feature branch self-contained. Never use toISOString(): it
// converts to UTC and silently shifts the date back a day in UTC+ timezones
// (Nepal is UTC+5:45) — a bug this app has already hit once.

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function parse(dateStr: string): [number, number, number] {
  const [y, m, d] = dateStr.split("-").map(Number);
  return [y, m, d];
}

function format(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function adAddDays(dateStr: string, delta: number): string {
  const [y, m, d] = parse(dateStr);
  return format(new Date(y, m - 1, d + delta));
}

export function adAddMonths(dateStr: string, months: number): string {
  const [y, m, d] = parse(dateStr);
  return format(new Date(y, m - 1 + months, d));
}

// Inclusive-safe: both dates parsed as local midnight, so the difference is an
// exact multiple of a day (Math.round guards any float drift).
export function adDayDiff(startDate: string, endDate: string): number {
  const [sy, sm, sd] = parse(startDate);
  const [ey, em, ed] = parse(endDate);
  return Math.round((new Date(ey, em - 1, ed).getTime() - new Date(sy, sm - 1, sd).getTime()) / 86400000);
}

// Lexicographic comparison is correct for zero-padded YYYY-MM-DD strings.
export function adDateInRange(dateStr: string, startDate: string, endDate: string): boolean {
  return dateStr >= startDate && dateStr <= endDate;
}
