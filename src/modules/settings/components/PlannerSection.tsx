"use client";

import { useState, useTransition } from "react";

import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { setPlannerEnabledAction } from "@/modules/settings/api/settings.actions";

export function PlannerSection({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [, startTransition] = useTransition();

  function toggle(next: boolean) {
    setEnabled(next);
    startTransition(async () => {
      try {
        await setPlannerEnabledAction(next);
      } catch (err) {
        setEnabled(!next);
        toast.error(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">AI budget planner</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex items-start gap-3 text-sm">
          <input
            checked={enabled}
            className="mt-0.5 h-4 w-4"
            id="planner-enabled"
            onChange={(e) => toggle(e.target.checked)}
            type="checkbox"
          />
          <span>
            <span className="font-medium text-foreground">Use the AI budget planner</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Suggests a monthly budget from your recorded history. The AI sees only shares of income, category
              groups and fixed/flexible types — never amounts, names, dates or notes. You review what will be sent
              before anything leaves the app.
            </span>
          </span>
        </label>
        <p className="text-xs text-muted-foreground">
          Suggestions are heuristics drawn from behavioural economics (weekly allowances, a last-week buffer), not
          proven optimal limits. Always review before applying.
        </p>
      </CardContent>
    </Card>
  );
}
