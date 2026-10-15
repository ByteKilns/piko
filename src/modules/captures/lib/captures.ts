import type { capturedPayments } from "@/db/schema";

type CaptureRow = typeof capturedPayments.$inferSelect;

// Money going out waits for review; money coming in (cashback, refunds,
// transfers received) is kept only so the duplicate check sees it. Piko has
// no place for it yet: income is per person per month.
export function captureStatusFor(direction: CaptureRow["direction"]): CaptureRow["status"] {
  return direction === "debit" ? "draft" : "skipped";
}

// A captured payment as the app reads it. Money is a number (Drizzle returns
// numeric as a string) and the time is UTC.
export function captureJson(row: CaptureRow) {
  return {
    amount: Number(row.amount),
    category: row.category,
    categoryConfidence: row.categoryConfidence,
    counterparty: row.counterparty,
    direction: row.direction,
    id: row.id,
    kind: row.kind,
    occurredAt: row.occurredAt.toISOString(),
    rawText: row.rawText,
    refId: row.refId,
    source: row.source,
    status: row.status,
  };
}
