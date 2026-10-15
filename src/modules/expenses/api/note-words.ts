import { and, desc, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db/client";
import { expenses } from "@/db/schema";
import { listCategories } from "@/modules/categories/api/categories";

import { noteCategoryTable } from "../lib/note-words";

// The word → category table the app's Add expense sheet suggests from, built
// from every note the household has written, newest first.
export async function noteCategoryTableForHousehold(householdId: string) {
  const [samples, categories] = await Promise.all([
    db
      .select({ categoryId: expenses.categoryId, note: expenses.note })
      .from(expenses)
      .where(and(eq(expenses.householdId, householdId), isNotNull(expenses.note)))
      .orderBy(desc(expenses.date), desc(expenses.createdAt)),
    listCategories(householdId),
  ]);
  return noteCategoryTable(
    samples.flatMap((s) => (s.note === null ? [] : [{ categoryId: s.categoryId, note: s.note }])),
    categories,
  );
}
