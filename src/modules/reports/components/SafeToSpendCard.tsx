import { WalletCards } from "lucide-react";

import type { PacingSchedule, WeekPacing } from "@/modules/budget-planner/lib/pacing";
import { formatNPR } from "@/modules/dashboard/lib/format";

type Props = {
  daysLeft: number;
  monthLabel: string;
  pacing?: null | { schedule: PacingSchedule; week: WeekPacing };
  safeToSpend: number;
  totalActual: number;
  totalPlanned: number;
};

type Tone = { amount: string; bg: string; dot: string; icon: string; status: string };

const ON_TRACK: Tone = {
  amount: "text-green-700 dark:text-green-400",
  bg: "bg-green-100 dark:bg-green-950/40",
  dot: "bg-green-600",
  icon: "bg-green-200 text-green-700 dark:bg-green-900 dark:text-green-400",
  status: "text-green-700 dark:text-green-400",
};

const OVER_BUDGET: Tone = {
  amount: "text-destructive",
  bg: "bg-destructive/15",
  dot: "bg-destructive",
  icon: "bg-destructive/20 text-destructive",
  status: "text-destructive",
};

const NO_BUDGET: Tone = {
  amount: "text-foreground",
  bg: "bg-muted/60",
  dot: "bg-muted-foreground",
  icon: "bg-muted text-muted-foreground",
  status: "text-muted-foreground",
};

export function SafeToSpendCard({ daysLeft, monthLabel, pacing, safeToSpend, totalActual, totalPlanned }: Props) {
  const monthName = monthLabel.split(" ")[0];
  const remaining = totalPlanned - totalActual;
  const noBudget = totalPlanned <= 0;
  const onTrack = !noBudget && remaining >= 0;

  const status = noBudget ? "No budget set" : onTrack ? "On track" : "Over budget";
  const tone = noBudget ? NO_BUDGET : onTrack ? ON_TRACK : OVER_BUDGET;
  const showPacing = Boolean(pacing) && !noBudget;

  return (
    <div className={`rounded-2xl p-6 ${tone.bg}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${tone.icon}`}>
            <WalletCards className="h-5 w-5" />
          </div>
          <div>
            <p className="text-base font-medium">Safe to spend today</p>
            <p className="text-xs text-muted-foreground">
              {daysLeft} day{daysLeft === 1 ? "" : "s"} left in {monthName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <p className={`text-3xl font-extrabold ${tone.amount}`}>{formatNPR(safeToSpend)}</p>
          <span className={`flex items-center gap-1.5 text-sm font-medium ${tone.status}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
            {status}
          </span>
          <button
            aria-label="Learn how safe to spend is calculated"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-background text-xs text-muted-foreground hover:bg-accent"
            title="(Remaining budget for the month) ÷ (days left), never below NPR 0."
            type="button"
          >
            ?
          </button>
        </div>
      </div>

      {showPacing && pacing && (
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-foreground/10 pt-4">
          <div>
            <p className="text-xs text-muted-foreground">This week left</p>
            <p className="text-sm font-semibold">{formatNPR(pacing.week.remaining)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Weekly allowance</p>
            <p className="text-sm font-semibold">{formatNPR(pacing.week.allowance)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last-week buffer</p>
            <p className="text-sm font-semibold">{formatNPR(pacing.schedule.bufferAmount)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
