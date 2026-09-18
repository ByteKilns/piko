"use client";

import { useState } from "react";

import { ArrowUpRight } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Modal } from "@/components/Modal";
import { TONE_BAR_CLASSES, ToneIcon } from "@/components/ToneIcon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/modules/categories/lib/category-icons";
import { formatNPR } from "@/modules/dashboard/lib/format";
import type { CategorySlice } from "@/modules/reports/lib/reports-stats";

const TONE_HEX: Record<CategorySlice["tone"], string> = {
  amber: "#f59e0b",
  blue: "#3b82f6",
  green: "#22c55e",
  orange: "#f97316",
  pink: "#ec4899",
  purple: "#a855f7",
};

// `large` is for the full-report modal, where there's room for a bigger donut.
type ContentProps = { large?: boolean; slices: CategorySlice[]; total: number };

// Donut beside the list only when the card itself is wide enough — a
// container query rather than a viewport breakpoint, since this card often
// sits in a narrow grid column on an otherwise wide screen. `large` always
// stacks, giving the bigger donut the full width above the list.
export function ExpenseBreakdownContent({ large, slices, total }: ContentProps) {
  return (
    <div className="@container">
      <div className={cn("flex flex-col gap-6", !large && "@lg:flex-row @lg:items-center")}>
        <div className={cn("relative mx-auto shrink-0", large ? "h-64 w-64" : "h-36 w-36")}>
          {slices.length > 0 && (
            <ResponsiveContainer height="100%" width="100%">
              <PieChart>
                <Pie data={slices} dataKey="amount" innerRadius="65%" nameKey="name" outerRadius="100%" paddingAngle={2}>
                  {slices.map((s) => (
                    <Cell fill={TONE_HEX[s.tone]} key={s.categoryId} />
                  ))}
                </Pie>
                {/* zIndex keeps the tooltip above the centered total overlay. */}
                <Tooltip formatter={(value) => formatNPR(Number(value))} wrapperStyle={{ zIndex: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className={cn("font-semibold whitespace-nowrap", large ? "text-lg" : "text-xs")}>{formatNPR(total)}</p>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          {slices.length === 0 && <p className="text-sm text-muted-foreground">No expenses this month yet.</p>}
          {slices.map((s) => (
            <div className="flex items-center gap-3" key={s.categoryId}>
              <ToneIcon className="h-8 w-8 shrink-0" icon={getCategoryIcon(s.groupName)} tone={s.tone} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{s.name}</span>
                  <span className="shrink-0 whitespace-nowrap text-muted-foreground">{formatNPR(s.amount)}</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${TONE_BAR_CLASSES[s.tone]}`} style={{ width: `${s.pct}%` }} />
                </div>
              </div>
              <span className="w-9 shrink-0 text-right text-sm text-muted-foreground">{s.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const CARD_SLICE_LIMIT = 5;

// `slices` is every category, largest first — the card shows the top few,
// "View full report" opens all of them in a modal.
type Props = { slices: CategorySlice[]; total: number };

export function ExpenseBreakdownCard({ slices, total }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base font-medium">Expense Breakdown</CardTitle>
          <p className="text-sm text-muted-foreground">Where your money went this month</p>
        </div>
        {slices.length > 0 && (
          <button className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary" onClick={() => setOpen(true)} type="button">
            View full report
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        )}
      </CardHeader>
      <CardContent>
        <ExpenseBreakdownContent slices={slices.slice(0, CARD_SLICE_LIMIT)} total={total} />
      </CardContent>

      <Modal className="sm:max-w-xl" onOpenChange={setOpen} open={open} title="Expense Breakdown">
        <ExpenseBreakdownContent large slices={slices} total={total} />
      </Modal>
    </Card>
  );
}
