"use client";

import { useState } from "react";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { Modal } from "@/components/Modal";
import { TONE_BAR_CLASSES, ToneIcon } from "@/components/ToneIcon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/modules/categories/lib/category-icons";
import { formatNPR } from "@/modules/dashboard/lib/format";
import type { BudgetLine } from "@/modules/reports/lib/reports-stats";

const CARD_LINE_LIMIT = 6;

function BudgetLineRow({ line }: { line: BudgetLine }) {
  const unbudgeted = line.planned === 0;
  const over = unbudgeted ? 0 : line.spent - line.planned;
  const usedPct = line.planned > 0 ? Math.round((line.spent / line.planned) * 100) : null;

  return (
    <div className="flex items-center gap-3">
      <ToneIcon className="h-8 w-8 shrink-0" icon={getCategoryIcon(line.groupName)} tone={line.tone} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate font-medium">{line.name}</span>
          <span className={cn("shrink-0 text-xs whitespace-nowrap", over > 0 ? "font-medium text-destructive" : "text-muted-foreground")}>
            {unbudgeted ? "No budget" : over > 0 ? `${formatNPR(over)} over` : `${usedPct}% used`}
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full", over > 0 ? "bg-destructive" : unbudgeted ? "bg-muted-foreground/40" : TONE_BAR_CLASSES[line.tone])}
            style={{ width: `${usedPct === null ? 100 : Math.min(usedPct, 100)}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatNPR(line.spent)}
          {!unbudgeted && ` of ${formatNPR(line.planned)}`}
        </p>
      </div>
    </div>
  );
}

type Props = { budgetHref: string; lines: BudgetLine[] };

// Planned vs spent per category — the "where did we overspend?" view.
// `lines` arrive overspent-first, so the card's top rows are the ones that
// need attention.
export function BudgetVsActualCard({ budgetHref, lines }: Props) {
  const [open, setOpen] = useState(false);
  const overCount = lines.filter((l) => l.planned > 0 && l.spent > l.planned).length;
  // Spending alone isn't worth comparing — without any budget every row
  // would just read "No budget".
  const hasBudget = lines.some((l) => l.planned > 0);
  const shown = hasBudget ? lines : [];

  return (
    <Card>
      <CardHeader className="flex items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base font-medium">Budget vs actual</CardTitle>
          <p className="text-sm text-muted-foreground">
            {!hasBudget
              ? "No budget set for this month"
              : overCount > 0
                ? `${overCount} ${overCount === 1 ? "category" : "categories"} over budget`
                : "Every category is within budget"}
          </p>
        </div>
        {shown.length > CARD_LINE_LIMIT && (
          <button className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary" onClick={() => setOpen(true)} type="button">
            View all
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {!hasBudget && (
          <p className="text-sm text-muted-foreground">
            <Link className="font-medium text-primary hover:underline" href={budgetHref}>
              Set a budget
            </Link>{" "}
            to compare it with what you spend.
          </p>
        )}
        {shown.slice(0, CARD_LINE_LIMIT).map((line) => (
          <BudgetLineRow key={line.categoryId} line={line} />
        ))}
      </CardContent>

      <Modal className="sm:max-w-xl" onOpenChange={setOpen} open={open} title="Budget vs actual">
        <div className="space-y-3">
          {shown.map((line) => (
            <BudgetLineRow key={line.categoryId} line={line} />
          ))}
        </div>
      </Modal>
    </Card>
  );
}
