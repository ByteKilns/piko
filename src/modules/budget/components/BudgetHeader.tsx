import { ChevronLeft, ChevronRight, Copy, Sparkles } from "lucide-react";
import Link from "next/link";

import { copyPreviousMonthBudgetAction } from "@/modules/budget/api/budget.actions";

type Props = {
  canCopyPreviousMonth: boolean;
  month: number;
  monthLabel: string;
  nextHref: string;
  plannerEnabled: boolean;
  prevHref: string;
  year: number;
};

export function BudgetHeader({ canCopyPreviousMonth, month, monthLabel, nextHref, plannerEnabled, prevHref, year }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Budget</h1>
        <p className="text-sm text-muted-foreground">Plan your money for the month</p>
      </div>
      <div className="flex items-center gap-3">
        {plannerEnabled && (
          <Link
            className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/15"
            href="/budget/plan"
          >
            <Sparkles className="h-4 w-4" />
            Plan with AI
          </Link>
        )}

        <div className="flex items-center gap-1 rounded-full border bg-background px-1 py-1 text-foreground">
          <Link aria-label="Previous month" className="rounded-full p-1 hover:bg-accent" href={prevHref}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="px-2 text-sm font-medium">{monthLabel}</span>
          <Link aria-label="Next month" className="rounded-full p-1 hover:bg-accent" href={nextHref}>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <form action={copyPreviousMonthBudgetAction.bind(null, year, month)}>
          <button
            className="flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-sm text-muted-foreground enabled:hover:bg-accent disabled:cursor-not-allowed disabled:text-muted-foreground/50"
            disabled={!canCopyPreviousMonth}
            type="submit"
          >
            <Copy className="h-4 w-4" />
            Copy previous month
          </button>
        </form>
      </div>
    </div>
  );
}
