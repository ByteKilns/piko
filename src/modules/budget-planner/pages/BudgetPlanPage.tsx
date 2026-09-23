import Link from "next/link";
import { notFound } from "next/navigation";

import { getCurrentMember } from "@/lib/session";
import { buildPlannerPreview } from "@/modules/budget-planner/api/budget-planner.queries";
import { PlanPreviewPanel } from "@/modules/budget-planner/components/PlanPreviewPanel";
import { isPlannerEnabled } from "@/modules/budget-planner/lib/flag";
import { formatNPR } from "@/modules/dashboard/lib/format";

export async function BudgetPlanPage() {
  if (!isPlannerEnabled()) notFound();

  const { householdId } = await getCurrentMember();
  const preview = await buildPlannerPreview(householdId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Budget planner</h1>
          <p className="text-sm text-muted-foreground">
            Plan from your recorded history — nothing leaves the app until you approve it.
          </p>
        </div>
        <Link className="text-sm font-medium text-primary" href="/budget">
          Back to budget
        </Link>
      </div>

      {preview.ok ? (
        <PlanPreviewPanel
          confidence={preview.profile.incomeAnchor.confidence}
          envelope={{
            fixed: formatNPR(preview.profile.envelope.fixed),
            flexible: formatNPR(preview.profile.envelope.flexible),
            income: formatNPR(preview.profile.envelope.income),
            savings: formatNPR(preview.profile.envelope.savings),
          }}
          maskedJson={JSON.stringify(preview.masked, null, 2)}
          monthsUsed={preview.profile.periods.length}
          variability={preview.profile.incomeVariability.band}
        />
      ) : (
        <div className="rounded-xl border bg-background p-8 text-center">
          <p className="font-medium">
            {preview.reason === "no_income" ? "Record your income first" : "Not enough spending history yet"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {preview.reason === "no_income"
              ? "The planner needs at least one month of recorded income to set limits against."
              : "Keep recording expenses — the planner gets useful once there's at least a month of history."}
          </p>
        </div>
      )}
    </div>
  );
}
