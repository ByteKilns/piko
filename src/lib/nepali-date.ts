import calendar from "@/lib/bs-calendar-data.json";

export const NEPALI_MONTHS = [
  "Baisakh",
  "Jestha",
  "Ashadh",
  "Shrawan",
  "Bhadra",
  "Ashwin",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
] as const;

// BS month lengths aren't formula-based — they're published yearly by
// Nepal's calendar committee. bs-calendar-data.json is the single source of
// truth: the web converts with it here, /api/mobile/calendar serves it to the
// mobile app, and mobile/assets/bs_calendar.json is a bundled copy kept
// identical by nepali-date.test.ts. When a new year's official calendar is
// published, check its 12 month lengths here and pin its Baisakh 1 in the
// tests. Data originally from nepali_utils (MIT), verified against published
// calendars through 2083.
export const BS_MIN_YEAR = calendar.firstYear;
export const BS_MAX_YEAR = calendar.firstYear + calendar.monthDays.length - 1;

const DAY_MS = 86_400_000;

// Days since 1970-01-01 for a "YYYY-MM-DD" AD string — pure UTC arithmetic,
// so the host timezone can never shift the result.
function adToEpochDay(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

function epochDayToAd(epochDay: number): string {
  return new Date(epochDay * DAY_MS).toISOString().slice(0, 10);
}

const FIRST_EPOCH_DAY = adToEpochDay(calendar.firstDayAd);

// YEAR_START[i] = days from BS_MIN_YEAR Baisakh 1 to (BS_MIN_YEAR + i)
// Baisakh 1; the extra last entry is the day after the table ends.
const YEAR_START: number[] = [0];
for (const months of calendar.monthDays) {
  YEAR_START.push(YEAR_START[YEAR_START.length - 1] + months.reduce((sum, n) => sum + n, 0));
}

function monthsOf(year: number): number[] {
  const months = calendar.monthDays[year - BS_MIN_YEAR];
  if (!months) throw new RangeError(`BS year ${year} is outside ${BS_MIN_YEAR}-${BS_MAX_YEAR}`);
  return months;
}

export function daysInBsMonth(year: number, month: number): number {
  return monthsOf(year)[month - 1];
}

// dateStr is a "YYYY-MM-DD" AD (Gregorian) string, the format every date is
// stored/queried in throughout the app. BS is display/input only.
export function adToBs(dateStr: string): { day: number; month: number; year: number } {
  let offset = adToEpochDay(dateStr) - FIRST_EPOCH_DAY;
  if (offset < 0 || offset >= YEAR_START[YEAR_START.length - 1]) {
    throw new RangeError(`${dateStr} is outside BS ${BS_MIN_YEAR}-${BS_MAX_YEAR}`);
  }
  let index = 0;
  while (YEAR_START[index + 1] <= offset) index++;
  offset -= YEAR_START[index];
  const months = calendar.monthDays[index];
  let month = 0;
  while (offset >= months[month]) offset -= months[month++];
  return { day: offset + 1, month: month + 1, year: BS_MIN_YEAR + index };
}

export function bsToAd(year: number, month: number, day: number): string {
  const months = monthsOf(year);
  if (month < 1 || month > 12 || day < 1 || day > months[month - 1]) {
    throw new RangeError(`${year}-${month}-${day} is not a valid BS date`);
  }
  let offset = YEAR_START[year - BS_MIN_YEAR] + day - 1;
  for (let i = 0; i < month - 1; i++) offset += months[i];
  return epochDayToAd(FIRST_EPOCH_DAY + offset);
}

// "15 Bhadra 2083"
export function formatBsDate(dateStr: string): string {
  const { day, month, year } = adToBs(dateStr);
  return `${day} ${NEPALI_MONTHS[month - 1]} ${year}`;
}

// "15 Bhadra"
export function formatBsShortDate(dateStr: string): string {
  const { day, month } = adToBs(dateStr);
  return `${day} ${NEPALI_MONTHS[month - 1]}`;
}

// "Bha" — first 3 letters of the BS month containing the given AD date. Used
// for chart-axis labels bucketed by AD calendar month (trend charts etc.) —
// this only relabels each bucket in BS, the buckets themselves are still AD
// calendar months.
export function formatBsMonthShort(dateStr: string): string {
  const { month } = adToBs(dateStr);
  return NEPALI_MONTHS[month - 1].slice(0, 3);
}

// "Bhadra 2083" — the BS month/year containing the given AD date. Used for
// page headers whose underlying period is still tracked by AD year/month
// (budgets, report ranges, etc.) — this only relabels that period in BS, it
// does not change which AD dates the period actually spans.
export function formatBsMonthYear(dateStr: string): string {
  const { month, year } = adToBs(dateStr);
  return `${NEPALI_MONTHS[month - 1]} ${year}`;
}
