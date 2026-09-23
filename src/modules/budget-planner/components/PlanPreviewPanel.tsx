"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

type Props = {
  confidence: "high" | "low" | "medium";
  envelope: { fixed: string; flexible: string; income: string; savings: string };
  maskedJson: string;
  monthsUsed: number;
  variability: "high" | "low" | "medium" | "unknown";
};

export function PlanPreviewPanel({ confidence, envelope, maskedJson, monthsUsed, variability }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(maskedJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-medium">What would be sent</h2>
            <p className="text-xs text-muted-foreground">
              Amounts become shares of income, categories become tokens, and names, dates and notes are removed.
            </p>
          </div>
          <Button onClick={copy} size="sm" type="button" variant="outline">
            {copied ? "Copied" : "Copy JSON"}
          </Button>
        </div>
        <pre className="mt-4 max-h-96 overflow-auto rounded-lg bg-muted p-3 text-xs">{maskedJson}</pre>
      </div>

      <p className="text-xs text-muted-foreground">
        AI generation and applying the plan arrive in the next phase. Nothing is sent or saved yet.
      </p>
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
