import { getPlannerEnabledPref } from "@/lib/date-format-cookie";

import { plannerMode } from "./mode";

// Whether the planner's entry point and route should be visible: both the
// deployment gate and the household's own opt-in must be on, so the UI can't
// offer a planner that would refuse to run.
export async function isPlannerEnabled(householdId: string): Promise<boolean> {
  if (plannerMode() === null) return false;
  return getPlannerEnabledPref(householdId);
}
