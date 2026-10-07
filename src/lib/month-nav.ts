import type { DateFormat } from "@/lib/date-format-cookie";
import { formatPeriodLabel } from "@/lib/month-period";

// Shared by every page that supports "?year=&month=" URL-based month
// navigation (Budget, Dashboard) so the parsing/adjacent-month logic can't
// drift between them.
export function previousMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export function nextMonth(year: number, month: number) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

export function parseMonthParam(value: string | string[] | undefined, fallback: number, max: number, min = 1) {
  const num = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(num) && num >= min && num <= max ? num : fallback;
}

type YearMonth = { month: number; year: number };

export type MonthNavOption = { href: string; label: string; selected: boolean };
export type MonthNavModel = { label: string; nextHref: null | string; options: MonthNavOption[]; prevHref: string };

const MENU_LENGTH = 12;

function toIndex({ month, year }: YearMonth): number {
  return year * 12 + (month - 1);
}

function fromIndex(index: number): YearMonth {
  return { month: (index % 12) + 1, year: Math.floor(index / 12) };
}

// The header month switcher on every month-scoped page. Pages stop at the
// current month (as in the mockups) unless `allowFuture` is set — Budget sets
// it so next month's budget can be planned ahead.
export function buildMonthNav(input: {
  allowFuture?: boolean;
  basePath: string;
  current: YearMonth;
  dateFormat: DateFormat;
  selected: YearMonth;
}): MonthNavModel {
  const { allowFuture = false, basePath, current, dateFormat, selected } = input;
  const href = (ym: YearMonth) => `${basePath}?year=${ym.year}&month=${ym.month}`;
  const label = (ym: YearMonth) => formatPeriodLabel(ym.year, ym.month, dateFormat);

  const next = nextMonth(selected.year, selected.month);
  const lastNavigable = allowFuture ? toIndex(nextMonth(current.year, current.month)) : toIndex(current);
  const newest = Math.max(toIndex(selected), lastNavigable);
  const options = Array.from({ length: MENU_LENGTH }, (_, k) => fromIndex(newest - k)).map((ym) => ({
    href: href(ym),
    label: label(ym),
    selected: toIndex(ym) === toIndex(selected),
  }));

  return {
    label: label(selected),
    nextHref: allowFuture || toIndex(next) <= toIndex(current) ? href(next) : null,
    options,
    prevHref: href(previousMonth(selected.year, selected.month)),
  };
}
