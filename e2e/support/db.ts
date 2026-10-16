import { config as loadEnv } from "dotenv";
import postgres from "postgres";

loadEnv({ path: ".env.local" });

function withDatabaseName(url: string | undefined, name: string): string | undefined {
  if (!url) return undefined;
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

// e2e runs against its own database (reset + seeded by scripts/seed-e2e.ts),
// so tests can write freely without touching the dev DB. Defaults to the
// .env.local DATABASE_URL with the database name swapped for "piko_e2e".
export const e2eDatabaseUrl = process.env.E2E_DATABASE_URL ?? withDatabaseName(process.env.DATABASE_URL, "piko_e2e");

// For the few checks a browser can't see (e.g. that a deleted row is gone).
export async function queryE2e<T>(run: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  if (!e2eDatabaseUrl) throw new Error("Set DATABASE_URL (or E2E_DATABASE_URL) in .env.local");
  const sql = postgres(e2eDatabaseUrl, { max: 1, prepare: false });
  try {
    return await run(sql);
  } finally {
    await sql.end();
  }
}
