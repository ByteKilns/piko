import type { ExpenseInput } from "@/modules/expenses/schemas/expense.schema";

// One spreadsheet row of the Bulk add dialog, as typed. `owner` is a member
// id or "shared".
export type BulkRow = {
  amount: string;
  categoryId: string;
  date: string;
  note: string;
  owner: string;
  paidByMemberId: string;
};

export const SHARED_OWNER = "shared";

// Rows without an amount are skipped (the dialog starts with blank rows).
// Rows with an amount but no category are reported, 1-based, so the person
// can be told which row to fix.
export function parseBulkRows(rows: BulkRow[]): { inputs: ExpenseInput[]; missingCategoryRows: number[] } {
  const inputs: ExpenseInput[] = [];
  const missingCategoryRows: number[] = [];

  rows.forEach((row, index) => {
    const amount = Number(row.amount);
    if (!(amount > 0)) return;
    if (!row.categoryId) {
      missingCategoryRows.push(index + 1);
      return;
    }
    inputs.push({
      amount,
      categoryId: row.categoryId,
      date: row.date,
      note: row.note.trim() || undefined,
      ownerMemberId: row.owner === SHARED_OWNER ? null : row.owner,
      paidByMemberId: row.paidByMemberId,
    });
  });

  return { inputs, missingCategoryRows };
}
