import type { DateFormat } from "@/lib/date-format-cookie";
import { overrunFromPlan, overrunNote, type PersonPlan } from "@/modules/budget/lib/budget-view";

import { spentByDayIn } from "./cash-flow";
import { buildPacingSchedule, currentWeekPacing, weekIndexOf, withOverrun } from "./pacing";

// Home's "Safe to spend today": the website's hero and the phone's both come
// from viewerPacing, so the two always agree.
export type HomePacing = {
  carryIn: number;
  nextWeekAllowance: number;
  nextWeekday: null | string;
  over: boolean;
  // Set when another line went over (or money went outside a budget) and was
  // taken from the can-cut money.
  overrunNote: null | string;
  safeToday: number;
  weekLeft: number;
  weeklyAllowance: number;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function weekdayOf(startDate: string, dayOfPeriod: number): string {
  const [year, month, day] = startDate.split("-").map(Number);
  return WEEKDAYS[new Date(year, month - 1, day + dayOfPeriod - 1).getDay()];
}

// Weekly pacing over one person's can-cut lines. Only can-cut spending counts
// against it day by day, and whatever went over elsewhere comes out of what's
// left, from this week on. Null when they have no can-cut lines.
export function viewerPacing(input: {
  dateFormat: DateFormat;
  // Today's day of the month's period (the last day for a month that's over).
  dayOfPeriod: number;
  month: number;
  period: { daysInPeriod: number; startDate: string };
  plan: PersonPlan;
  // What left their own wallet this month (personSpending).
  spending: { amount: number; categoryId: string; date: string }[];
  year: number;
}): HomePacing | null {
  const { dayOfPeriod, period, plan } = input;
  const canCut = plan.groups.find((g) => g.kind === "can_cut");
  if (!canCut) return null;

  const canCutIds = new Set(canCut.rows.map((r) => r.categoryId));
  const overrun = overrunFromPlan(plan);
  const baseSchedule = buildPacingSchedule({ daysInPeriod: period.daysInPeriod, flexibleTotal: canCut.planned });
  const schedule = withOverrun(baseSchedule, weekIndexOf(baseSchedule, dayOfPeriod), overrun.total);
  const spentByDay = spentByDayIn(input.spending, canCutIds, input.year, input.month, input.dateFormat);
  const week = currentWeekPacing(schedule, dayOfPeriod, spentByDay);

  return {
    carryIn: week.carryIn,
    nextWeekAllowance: schedule.weeks[week.index + 1]?.allowance ?? week.allowance,
    nextWeekday: weekdayOf(period.startDate, week.nextWeekStartDay),
    over: week.remaining <= 0,
    overrunNote: overrunNote(overrun),
    safeToday: week.safeToday,
    weekLeft: week.remaining,
    weeklyAllowance: week.allowance,
  };
}
