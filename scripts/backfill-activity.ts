// One-off: reconstructs "added" activity-log entries for rows that existed
// before the activity log did (see src/modules/activity/lib/backfill.ts).
// Only ever INSERTs into activity_logs — no other table is written.
//
//   npx tsx scripts/backfill-activity.ts           # dry run: counts + samples
//   npx tsx scripts/backfill-activity.ts --apply   # write
//
// Targets .env.local's DATABASE_URL. Safe to re-run: entities that already
// have an entry are skipped. Undo with:
//   DELETE FROM activity_logs WHERE source = 'import';
import { config } from "dotenv";

config({ path: ".env.local" });

import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  activityLogs,
  categories,
  dhukuEntries,
  dhukus,
  expenses,
  householdMembers,
  households,
  loanPayments,
  loans,
  recurringExpenses,
  users,
} from "../src/db/schema";
import { activityFormatters } from "../src/modules/activity/lib/activity-values";
import { buildBackfillRows } from "../src/modules/activity/lib/backfill";

const INSERT_CHUNK = 500;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set in .env.local");
  const apply = process.argv.includes("--apply");
  const target = new URL(url);
  console.log(`${apply ? "APPLYING to" : "Dry run against"} ${target.hostname}${target.pathname}\n`);

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  try {
    for (const household of await db.select().from(households)) {
      const householdId = household.id;
      const members = await db
        .select({ id: householdMembers.id, name: users.name })
        .from(householdMembers)
        .innerJoin(users, eq(users.id, householdMembers.userId))
        .where(eq(householdMembers.householdId, householdId));
      const categoryRows = await db
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .where(eq(categories.householdId, householdId));
      const loanRows = await db.select().from(loans).where(eq(loans.householdId, householdId));
      const dhukuRows = await db.select().from(dhukus).where(eq(dhukus.householdId, householdId));
      const loanIds = loanRows.map((l) => l.id);
      const dhukuIds = dhukuRows.map((d) => d.id);

      const source = {
        dhukuEntries: dhukuIds.length ? await db.select().from(dhukuEntries).where(inArray(dhukuEntries.dhukuId, dhukuIds)) : [],
        dhukus: dhukuRows,
        expenses: await db.select().from(expenses).where(eq(expenses.householdId, householdId)),
        loanPayments: loanIds.length ? await db.select().from(loanPayments).where(inArray(loanPayments.loanId, loanIds)) : [],
        loans: loanRows,
        recurring: await db.select().from(recurringExpenses).where(eq(recurringExpenses.householdId, householdId)),
      };

      const logged = await db
        .select({ entityId: activityLogs.entityId, entityType: activityLogs.entityType })
        .from(activityLogs)
        .where(and(eq(activityLogs.householdId, householdId), eq(activityLogs.action, "created")));

      const memberNames = new Map(members.map((m) => [m.id, m.name]));
      const rows = buildBackfillRows({
        alreadyLogged: new Set(logged.map((l) => `${l.entityType}:${l.entityId}`)),
        f: activityFormatters({
          categoryNames: new Map(categoryRows.map((c) => [c.id, c.name])),
          dateFormat: household.dateFormat,
          memberNames,
        }),
        householdId,
        memberNames,
        source,
      });

      const counts = new Map<string, number>();
      for (const row of rows) counts.set(`${row.entityType} ${row.action}`, (counts.get(`${row.entityType} ${row.action}`) ?? 0) + 1);
      console.log(`Household "${household.name}": ${rows.length} entries to add (${logged.length} already logged)`);
      for (const [key, count] of [...counts].sort()) console.log(`  ${key.padEnd(30)} ${count}`);
      const actors = new Map<string, number>();
      for (const row of rows) actors.set(row.actorName, (actors.get(row.actorName) ?? 0) + 1);
      console.log(`  by actor: ${[...actors].map(([name, n]) => `${name} ${n}`).join(", ")}`);
      console.log("  samples:");
      for (const row of rows.slice(0, 3)) {
        console.log(`    ${row.createdAt?.toISOString()}  ${row.actorName} · ${row.entityType} ${row.action} · ${row.summary}`);
      }

      if (apply && rows.length > 0) {
        await db.transaction(async (tx) => {
          for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
            await tx.insert(activityLogs).values(rows.slice(i, i + INSERT_CHUNK));
          }
        });
        console.log(`  inserted ${rows.length}`);
      }
      console.log();
    }
    if (!apply) console.log("Dry run only — re-run with --apply to write.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
