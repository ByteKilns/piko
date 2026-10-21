import { desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import { dhukuEntries, dhukus } from "@/db/schema";

export async function listDhukus(householdId: string) {
  return db.select().from(dhukus).where(eq(dhukus.householdId, householdId)).orderBy(desc(dhukus.startDate));
}

export async function listDhukuEntries(householdId: string) {
  const rows = await listDhukus(householdId);
  const dhukuIds = rows.map((d) => d.id);
  if (dhukuIds.length === 0) return [];

  return db
    .select()
    .from(dhukuEntries)
    .where(inArray(dhukuEntries.dhukuId, dhukuIds))
    .orderBy(desc(dhukuEntries.date), desc(dhukuEntries.createdAt));
}
