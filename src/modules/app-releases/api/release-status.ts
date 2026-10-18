import { sql } from "drizzle-orm";

import { db } from "@/db/client";

import journal from "../../../../drizzle/meta/_journal.json";

// When the newest migration this build ships with was generated. Each entry's
// `when` is also what `drizzle-kit migrate` records as `created_at` once it
// has run that migration on the database.
export function newestMigrationAt(): number {
  return Math.max(...journal.entries.map((e) => e.when));
}

// True while the database is missing a migration this build ships with, so
// the release workflow can refuse until `npm run db:migrate` has run. A
// database that was never migrated has no log table at all.
export async function migrationsPending(): Promise<boolean> {
  const [{ found }] = await db.execute<{ found: null | string }>(
    sql`select to_regclass('drizzle.__drizzle_migrations')::text as found`,
  );
  if (!found) return true;
  const [{ last }] = await db.execute<{ last: null | string }>(
    sql`select max(created_at)::text as last from drizzle.__drizzle_migrations`,
  );
  return last === null || Number(last) < newestMigrationAt();
}
