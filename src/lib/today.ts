// Today's "YYYY-MM-DD" AD date in Nepal, whatever the runtime's own timezone
// (UTC on Vercel, possibly anything in a browser). Never use
// `new Date().toISOString().slice(0, 10)` for this: that's the UTC date,
// which is still yesterday between 00:00 and 05:45 Nepal time.
const formatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Kathmandu",
  year: "numeric",
});

export function todayISO(now: Date = new Date()): string {
  return formatter.format(now);
}
