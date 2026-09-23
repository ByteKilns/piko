// Feature gate for the AI budget planner. Phase 1 ships the local preview
// only, so the default is off: the entry point and route are hidden unless the
// value is explicitly mock/live. e2e sets it to "mock" via the Playwright
// webServer env.
export function isPlannerEnabled(): boolean {
  const value = process.env.AI_BUDGET_PLANNER;
  return value === "live" || value === "mock";
}
