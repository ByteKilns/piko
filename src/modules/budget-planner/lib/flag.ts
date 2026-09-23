import { plannerMode } from "./mode";

// Whether the planner's entry point and route should be visible. Same gate as
// the AI dispatch, so the UI can't offer a planner that would refuse to run.
export function isPlannerEnabled(): boolean {
  return plannerMode() !== null;
}
