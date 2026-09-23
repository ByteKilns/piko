export type PlannerMode = "live" | "mock";

// Reads the AI_BUDGET_PLANNER feature gate. Null means the planner is off
// entirely. Kept dependency-free so it can be unit-tested without pulling in
// the Gemini client.
export function plannerMode(): null | PlannerMode {
  const value = process.env.AI_BUDGET_PLANNER;
  return value === "live" || value === "mock" ? value : null;
}
