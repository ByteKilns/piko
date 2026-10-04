import type { activityLogs } from "@/db/schema";
import { dhukuEntrySummary, type DhukuSnapshot, dhukuSummary } from "@/modules/dhuku/lib/dhuku-activity";
import { type ExpenseSnapshot, expenseSummary } from "@/modules/expenses/lib/expense-activity";
import { loanPaymentSummary, type LoanSnapshot, loanSummary } from "@/modules/loans/lib/loan-activity";
import { type RecurringSnapshot, recurringSummary } from "@/modules/recurring/lib/recurring-activity";

import type { ActivityFormatters } from "./activity-values";

type Created = { createdAt: Date; id: string };

export type BackfillSource = {
  dhukuEntries: (Created & { amount: number | string; dhukuId: string; type: string })[];
  dhukus: (Created & DhukuSnapshot)[];
  expenses: (Created & ExpenseSnapshot & { recurringExpenseId: null | string; updatedAt: Date })[];
  loanPayments: (Created & { amount: number | string; loanId: string; memberId: string })[];
  loans: (Created & LoanSnapshot)[];
  recurring: (RecurringSnapshot & { id: string })[];
};

type BackfillRow = typeof activityLogs.$inferInsert;

const UNKNOWN_ACTOR = "Imported";
// updated_at defaults to now() on insert, so it trails created_at by a few ms
// on rows that were never edited.
const EDIT_THRESHOLD_MS = 1000;

// Reconstructs "added" entries for rows that existed before the activity log
// did, plus one "edited" entry for each expense whose updated_at shows a later
// edit (only expenses track that; what changed was never recorded, so those
// entries carry no field changes). Nothing records who *entered* a row, so the
// actor is a best guess: an expense's payer, a payment's payer, a loan/dhuku's
// owner (shared → unknown). Every row is source "import" so the page can say
// so. `alreadyLogged` holds "<action>:<entityType>:<entityId>" keys, which
// makes re-running add nothing.
export function buildBackfillRows({
  alreadyLogged,
  f,
  householdId,
  memberNames,
  source,
}: {
  alreadyLogged: ReadonlySet<string>;
  f: ActivityFormatters;
  householdId: string;
  memberNames: ReadonlyMap<string, string>;
  source: BackfillSource;
}): BackfillRow[] {
  const rows: BackfillRow[] = [];
  const isNew = (entityType: BackfillRow["entityType"], id: string, action: BackfillRow["action"] = "created") =>
    !alreadyLogged.has(`${action}:${entityType}:${id}`);
  const actor = (memberId: null | string) => {
    const name = memberId ? memberNames.get(memberId) : undefined;
    return name && memberId ? { actorMemberId: memberId, actorName: name } : { actorMemberId: null, actorName: UNKNOWN_ACTOR };
  };
  const row = (
    entityType: BackfillRow["entityType"],
    action: BackfillRow["action"],
    entityId: string,
    createdAt: Date,
    memberId: null | string,
    summary: string,
  ): BackfillRow => ({ action, ...actor(memberId), createdAt, entityId, entityType, householdId, source: "import", summary });

  const recurringById = new Map(source.recurring.map((r) => [r.id, r]));
  for (const expense of source.expenses) {
    const summary = expenseSummary(f, expense);
    if (isNew("expense", expense.id)) {
      // Expenses created by "mark paid" get the same pair the live action logs.
      const bill = expense.recurringExpenseId ? recurringById.get(expense.recurringExpenseId) : undefined;
      if (bill) {
        const billSummary = `${recurringSummary(f, bill)} · for ${f.date(expense.date)}`;
        rows.push(row("recurring_expense", "paid", bill.id, expense.createdAt, expense.paidByMemberId, billSummary));
      }
      rows.push(row("expense", "created", expense.id, expense.createdAt, expense.paidByMemberId, summary));
    }
    const wasEdited = expense.updatedAt.getTime() - expense.createdAt.getTime() > EDIT_THRESHOLD_MS;
    if (wasEdited && isNew("expense", expense.id, "updated")) {
      rows.push(row("expense", "updated", expense.id, expense.updatedAt, expense.paidByMemberId, summary));
    }
  }

  const loansById = new Map(source.loans.map((l) => [l.id, l]));
  for (const loan of source.loans) {
    if (isNew("loan", loan.id)) rows.push(row("loan", "created", loan.id, loan.createdAt, loan.ownerMemberId, loanSummary(f, loan)));
  }
  for (const payment of source.loanPayments) {
    const loan = loansById.get(payment.loanId);
    if (!loan || !isNew("loan_payment", payment.id)) continue;
    rows.push(row("loan_payment", "created", payment.id, payment.createdAt, payment.memberId, loanPaymentSummary(f, payment, loan)));
  }

  const dhukusById = new Map(source.dhukus.map((d) => [d.id, d]));
  for (const dhuku of source.dhukus) {
    if (isNew("dhuku", dhuku.id)) rows.push(row("dhuku", "created", dhuku.id, dhuku.createdAt, dhuku.ownerMemberId, dhukuSummary(f, dhuku)));
  }
  for (const entry of source.dhukuEntries) {
    const dhuku = dhukusById.get(entry.dhukuId);
    if (!dhuku || !isNew("dhuku_entry", entry.id)) continue;
    rows.push(row("dhuku_entry", "created", entry.id, entry.createdAt, dhuku.ownerMemberId, dhukuEntrySummary(f, entry, dhuku.name)));
  }

  return rows;
}
