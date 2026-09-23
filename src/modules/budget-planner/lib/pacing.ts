import { clamp } from "./stats";

export type PacingWeek = {
  allowance: number;
  endDay: number;
  index: number;
  startDay: number;
};

export type PacingSchedule = {
  bufferAmount: number;
  dailyAllowance: number;
  flexibleTotal: number;
  weeks: PacingWeek[];
};

export type WeekPacing = {
  allowance: number;
  index: number;
  remaining: number;
  spent: number;
};

// Held back from the early weeks and released in the final week, so a heavy
// start doesn't leave the month stranded.
const DEFAULT_BUFFER_SHARE = 0.15;
const WEEK_DAYS = 7;

// Budgets read better in round numbers.
function roundTo10(value: number): number {
  return Math.round(value / 10) * 10;
}

// Splits the month's flexible budget into a weekly release schedule. This is
// the behavioural half of the plan: spacing spending out (and keeping a
// last-week buffer) is what makes a budget survivable, rather than one big
// allowance the user blows through early. Pure and deterministic.
export function buildPacingSchedule(input: {
  bufferShare?: number;
  daysInPeriod: number;
  flexibleTotal: number;
}): PacingSchedule {
  const { daysInPeriod, flexibleTotal } = input;
  const bufferShare = clamp(input.bufferShare ?? DEFAULT_BUFFER_SHARE, 0, 0.5);
  const dailyAllowance = roundTo10(flexibleTotal / Math.max(1, daysInPeriod));
  const weekCount = Math.max(1, Math.ceil(daysInPeriod / WEEK_DAYS));

  if (weekCount === 1) {
    return {
      bufferAmount: 0,
      dailyAllowance,
      flexibleTotal,
      weeks: [{ allowance: roundTo10(flexibleTotal), endDay: daysInPeriod, index: 0, startDay: 1 }],
    };
  }

  // Each week gets an equal share; the earlier weeks give up a slice of theirs
  // so the final week carries the buffer as a cushion.
  const bufferAmount = roundTo10(flexibleTotal * bufferShare);
  const perWeek = flexibleTotal / weekCount;
  const reduction = bufferAmount / (weekCount - 1);

  const weeks: PacingWeek[] = [];
  for (let i = 0; i < weekCount; i++) {
    const isLast = i === weekCount - 1;
    weeks.push({
      allowance: roundTo10(isLast ? perWeek + bufferAmount : Math.max(0, perWeek - reduction)),
      endDay: Math.min(daysInPeriod, (i + 1) * WEEK_DAYS),
      index: i,
      startDay: i * WEEK_DAYS + 1,
    });
  }

  // Correct any rounding drift on the final week so the weeks sum to the total.
  const sum = weeks.reduce((s, w) => s + w.allowance, 0);
  weeks[weekCount - 1].allowance += flexibleTotal - sum;

  return { bufferAmount, dailyAllowance, flexibleTotal, weeks };
}

// Where the given day sits in the schedule, and how much of that week's
// allowance is left. `spentByDay` is indexed from day 1 (index 0).
export function currentWeekPacing(schedule: PacingSchedule, dayOfPeriod: number, spentByDay: number[]): WeekPacing {
  const week =
    schedule.weeks.find((w) => dayOfPeriod >= w.startDay && dayOfPeriod <= w.endDay) ??
    schedule.weeks[schedule.weeks.length - 1];

  let spent = 0;
  const lastDay = Math.min(dayOfPeriod, week.endDay);
  for (let day = week.startDay; day <= lastDay; day++) {
    spent += spentByDay[day - 1] ?? 0;
  }

  return { allowance: week.allowance, index: week.index, remaining: Math.max(0, week.allowance - spent), spent };
}
