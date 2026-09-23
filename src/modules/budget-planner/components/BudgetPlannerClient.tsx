"use client";

import { useState } from "react";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  generateBudgetPlanAction,
  type GeneratePlanResult,
} from "@/modules/budget-planner/api/budget-planner.actions";
import type { PlanRow } from "@/modules/budget-planner/lib/build-plan";
import { setBudgetItemAction } from "@/modules/budget/api/budget.actions";
import { formatNPR } from "@/modules/dashboard/lib/format";

type Props = {
  confidence: "high" | "low" | "medium";
  envelope: { fixed: string; flexible: string; income: string; savings: string };
  maskedJson: string;
  monthsUsed: number;
  variability: "high" | "low" | "medium" | "unknown";
};

const REASON_MESSAGE: Record<string, string> = {
  disabled: "The AI budget planner is turned off.",
  failed: "The planner couldn't produce a plan. Please try again.",
  no_history: "Not enough spending history yet — keep recording expenses.",
  no_income: "Record at least one month of income first.",
};

function rowKey(row: PlanRow): string {
  return `${row.categoryId}::${row.ownerMemberId ?? "shared"}`;
}

export function BudgetPlannerClient({ confidence, envelope, maskedJson, monthsUsed, variability }: Props) {
  const router = useRouter();
  const [result, setResult] = useState<GeneratePlanResult | null>(null);
  const [pending, setPending] = useState(false);
  const [applied, setApplied] = useState<Set<string>>(new Set());

  async function generate() {
    setPending(true);
    setApplied(new Set());
    try {
      setResult(await generateBudgetPlanAction());
    } finally {
      setPending(false);
    }
  }

  async function applyRow(plan: { month: number; year: number }, row: PlanRow) {
    try {
      await setBudgetItemAction({
        categoryId: row.categoryId,
        month: plan.month,
        ownerMemberId: row.ownerMemberId,
        plannedAmount: row.plannedAmount,
        year: plan.year,
      });
      setApplied((prev) => new Set(prev).add(rowKey(row)));
      toast.success(`Applied ${row.categoryName}`);
      router.refresh();
    } catch {
      toast.error(`Couldn't apply ${row.categoryName}`);
    }
  }

  async function applyAll() {
    if (!result?.ok) return;
    for (const row of result.plan.rows) {
      if (!applied.has(rowKey(row))) await applyRow(result.plan, row);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Planning income" value={envelope.income} />
        <Stat label="Fixed commitments" value={envelope.fixed} />
        <Stat label="Savings target" value={envelope.savings} />
        <Stat label="Flexible pool" value={envelope.flexible} />
      </div>

      <p className="text-sm text-muted-foreground">
        Based on {monthsUsed} months of history · confidence {confidence} · income variability {variability}
      </p>

      <div className="rounded-xl border bg-background p-4">
        <details>
          <summary className="cursor-pointer text-sm font-medium">Review what will be sent</summary>
          <p className="mt-2 text-xs text-muted-foreground">
            Amounts become shares of income, categories become tokens, and names, dates and notes are removed.
          </p>
          <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-muted p-3 text-xs">{maskedJson}</pre>
        </details>
      </div>

      <div>
        <Button disabled={pending} onClick={generate} type="button">
          <Sparkles className="h-4 w-4" />
          {pending ? "Generating…" : "Generate plan"}
        </Button>
      </div>

      {result && !result.ok && (
        <div className="rounded-xl border bg-background p-6 text-sm text-muted-foreground">
          {REASON_MESSAGE[result.reason] ?? "Something went wrong."}
        </div>
      )}

      {result?.ok && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-background p-4">
            <p className="text-sm">{result.plan.summary}</p>
            {result.plan.warnings.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-xs text-amber-600">
                {result.plan.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium">
              Suggested budget · {formatNPR(result.plan.totalPlanned)} total
            </p>
            <Button onClick={applyAll} size="sm" type="button" variant="outline">
              Apply all
            </Button>
          </div>

          <ul className="divide-y rounded-xl border bg-background text-sm">
            {result.plan.rows.map((row) => (
              <li className="flex items-start justify-between gap-4 p-3" key={rowKey(row)}>
                <div className="min-w-0">
                  <p className="font-medium">
                    {row.categoryName} <span className="text-muted-foreground">· {row.ownerName}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{row.rationale}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-medium">{formatNPR(row.plannedAmount)}</span>
                  <Button
                    disabled={applied.has(rowKey(row))}
                    onClick={() => applyRow(result.plan, row)}
                    size="sm"
                    type="button"
                    variant={applied.has(rowKey(row)) ? "ghost" : "outline"}
                  >
                    {applied.has(rowKey(row)) ? "Applied" : "Apply"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          <p className="text-xs text-muted-foreground">
            Nothing is saved until you apply it. Applying writes the month&apos;s budget for that category.
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
