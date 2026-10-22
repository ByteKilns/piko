import type { ReleaseRun } from "../api/release-workflow";

// Queued, waiting or going: anything GitHub hasn't finished.
export function isRunActive(run: ReleaseRun): boolean {
  return run.status !== "completed";
}

// What the Settings list says about a run.
export function runLabel(run: ReleaseRun): { label: string; tone: "bad" | "good" | "muted" } {
  if (run.status === "in_progress") return { label: "Running", tone: "muted" };
  if (isRunActive(run)) return { label: "Waiting to start", tone: "muted" };
  if (run.conclusion === "success") return { label: "Published", tone: "good" };
  if (run.conclusion === "cancelled") return { label: "Cancelled", tone: "muted" };
  return { label: "Failed", tone: "bad" };
}
