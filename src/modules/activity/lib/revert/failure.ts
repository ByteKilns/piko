// The planner checks references and existence, but a few conflicts only show
// up as constraint errors when the revert is written (e.g. a budget line for
// the same category and owner was added since). Those are expected outcomes,
// so they become a reason for the user rather than a thrown error.
const REASONS: Record<string, string> = {
  "23503": "Something it depended on no longer exists.",
  "23505": "Something added since takes its place — remove that first.",
};

// Drizzle wraps the driver's error, so the Postgres code sits down the cause chain.
export function revertFailureReason(error: unknown): null | string {
  let current: unknown = error;
  while (current instanceof Error) {
    const code = "code" in current ? String(current.code) : null;
    if (code && code in REASONS) return REASONS[code];
    current = current.cause;
  }
  return null;
}
