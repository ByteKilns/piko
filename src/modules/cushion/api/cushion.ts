import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { cushionEntries, cushionTargets, monthSettlements } from "@/db/schema";

// Everyone's cushion entries and targets, and the months they've decided on.
export async function listCushionData(householdId: string) {
  const [entries, targets, settlements] = await Promise.all([
    db.select().from(cushionEntries).where(eq(cushionEntries.householdId, householdId)),
    db.select().from(cushionTargets).where(eq(cushionTargets.householdId, householdId)),
    db.select().from(monthSettlements).where(eq(monthSettlements.householdId, householdId)),
  ]);
  return {
    entries: entries.map((e) => ({ amount: Number(e.amount), memberId: e.memberId })),
    settlements: settlements.map((s) => ({ memberId: s.memberId, month: s.month, year: s.year })),
    targets: targets.map((t) => ({ memberId: t.memberId, target: Number(t.target) })),
  };
}
