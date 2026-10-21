import { desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import { loanPayments, loans } from "@/db/schema";

export async function listLoans(householdId: string) {
  return db.select().from(loans).where(eq(loans.householdId, householdId)).orderBy(desc(loans.date));
}

export async function listLoanPayments(householdId: string) {
  const rows = await listLoans(householdId);
  const loanIds = rows.map((l) => l.id);
  if (loanIds.length === 0) return [];

  return db
    .select()
    .from(loanPayments)
    .where(inArray(loanPayments.loanId, loanIds))
    .orderBy(desc(loanPayments.date), desc(loanPayments.createdAt));
}
