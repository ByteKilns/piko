"use client";

import { ChevronDown, ChevronLeft, ChevronRight, FileDown } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { downloadExpensesCsv, type ExpenseExportRow } from "@/lib/csv-export";

type Props = { exportRows: ExpenseExportRow[]; monthLabel: string; nextHref: string; prevHref: string };

export function ReportsHeader({ exportRows, monthLabel, nextHref, prevHref }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">Understand your money, make better decisions</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 rounded-full border bg-background px-1 py-1 text-foreground">
          <Link aria-label="Previous month" className="rounded-full p-1 hover:bg-accent" href={prevHref}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="flex items-center gap-1 px-2 text-sm font-medium">
            {monthLabel}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
          <Link aria-label="Next month" className="rounded-full p-1 hover:bg-accent" href={nextHref}>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <Button onClick={() => downloadExpensesCsv(exportRows, monthLabel)} type="button" variant="outline">
          <FileDown className="h-4 w-4" />
          Export
        </Button>
      </div>
    </div>
  );
}
