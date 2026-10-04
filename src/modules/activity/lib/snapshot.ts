import { getTableColumns } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

import type { ActivitySnapshot } from "@/db/schema";

// Exactly what jsonb stores and gives back (Dates → ISO strings, undefined
// keys dropped), so live rows and stored snapshots compare like for like.
export function toSnapshot(row: object): ActivitySnapshot {
  return JSON.parse(JSON.stringify(row)) as ActivitySnapshot;
}

export function rawEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

// Turns a snapshot back into insert/update values for `table`: timestamp
// columns (stored as ISO strings) become Dates again; keys that aren't
// columns of the table are dropped.
export function reviveRow<T extends PgTable>(table: T, row: ActivitySnapshot): T["$inferInsert"] {
  const columns = getTableColumns(table);
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const column = columns[key];
    if (!column) continue;
    values[key] = column.columnType === "PgTimestamp" && typeof value === "string" ? new Date(value) : value;
  }
  return values as T["$inferInsert"];
}
