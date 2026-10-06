"use client";

import { useId, useState } from "react";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { adToBs, BS_MAX_YEAR, BS_MIN_YEAR, bsToAd, daysInBsMonth, formatBsDate, NEPALI_MONTHS } from "@/lib/nepali-date";
import { todayISO } from "@/lib/today";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

type Props = {
  containerClassName?: string;
  error?: string;
  inputClassName?: string;
  // Omit to render without a label — for dense contexts (e.g. a table cell)
  // that already have a column header doing that job.
  label?: string;
  onChange: (value: string) => void;
  // "YYYY-MM-DD" in AD (Gregorian) — every date column and zod schema in the
  // app stores/expects AD; BS is only what the user sees and picks. onChange
  // fires only on a day click, never in response to `value` changing, so a
  // re-render can't feed a converted value back in and drift the date.
  value: string;
};

type MonthView = { month: number; year: number };

function viewOf(adDate: string): MonthView {
  const { month, year } = adToBs(adDate);
  return { month, year };
}

function shiftMonth({ month, year }: MonthView, delta: -1 | 1): MonthView {
  const index = year * 12 + (month - 1) + delta;
  return { month: (index % 12) + 1, year: Math.floor(index / 12) };
}

export function NepaliDateField({ containerClassName, error, inputClassName, label, onChange, value }: Props) {
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<MonthView>(() => viewOf(value || todayISO()));

  const today = todayISO();
  const selected = value ? adToBs(value) : null;
  const firstWeekday = new Date(`${bsToAd(view.year, view.month, 1)}T00:00:00Z`).getUTCDay();
  const dayCount = daysInBsMonth(view.year, view.month);
  const canGoBack = view.year > BS_MIN_YEAR || view.month > 1;
  const canGoForward = view.year < BS_MAX_YEAR || view.month < 12;

  function handleOpenChange(next: boolean) {
    if (next) setView(viewOf(value || today));
    setOpen(next);
  }

  function pick(adDate: string) {
    onChange(adDate);
    setOpen(false);
  }

  return (
    <div className={cn("space-y-1", containerClassName)}>
      {label && <Label htmlFor={fieldId}>{label}</Label>}
      <Popover onOpenChange={handleOpenChange} open={open}>
        <PopoverTrigger asChild>
          <button
            aria-invalid={Boolean(error)}
            className={cn(
              "flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-left text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm",
              error && "border-destructive",
              !value && "text-muted-foreground",
              inputClassName,
            )}
            id={fieldId}
            type="button"
          >
            <span className="truncate">{value ? formatBsDate(value) : "Pick a date"}</span>
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-3">
          <div className="mb-2 flex items-center justify-between">
            <Button
              aria-label="Previous month"
              disabled={!canGoBack}
              onClick={() => setView((v) => shiftMonth(v, -1))}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <ChevronLeft />
            </Button>
            <p className="text-sm font-medium">
              {NEPALI_MONTHS[view.month - 1]} {view.year}
            </p>
            <Button
              aria-label="Next month"
              disabled={!canGoForward}
              onClick={() => setView((v) => shiftMonth(v, 1))}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <ChevronRight />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
            {WEEKDAYS.map((d) => (
              <span className="py-1 text-muted-foreground" key={d}>
                {d}
              </span>
            ))}
            {Array.from({ length: firstWeekday }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {Array.from({ length: dayCount }, (_, i) => {
              const day = i + 1;
              const adDate = bsToAd(view.year, view.month, day);
              const isSelected =
                selected?.year === view.year && selected.month === view.month && selected.day === day;
              return (
                <button
                  aria-label={formatBsDate(adDate)}
                  aria-pressed={isSelected}
                  className={cn(
                    "h-8 rounded-md text-sm",
                    isSelected ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                    !isSelected && adDate === today && "font-semibold text-primary",
                  )}
                  key={day}
                  onClick={() => pick(adDate)}
                  type="button"
                >
                  {day}
                </button>
              );
            })}
          </div>

          <Button className="mt-2 w-full" onClick={() => pick(today)} size="sm" type="button" variant="outline">
            Today
          </Button>
        </PopoverContent>
      </Popover>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
