import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db/client";

import journal from "../../../../drizzle/meta/_journal.json";
import { migrationsPending, newestMigrationAt } from "./release-status";

vi.mock("@/db/client", () => ({ db: { execute: vi.fn() } }));

const newest = Math.max(...journal.entries.map((e) => e.when));

// The two queries migrationsPending makes, in order: does the log table
// exist, then the newest migration it recorded.
function database(found: null | string, last?: null | string) {
  vi.mocked(db.execute).mockResolvedValueOnce([{ found }] as never);
  if (last !== undefined) vi.mocked(db.execute).mockResolvedValueOnce([{ last }] as never);
}

describe("migrationsPending", () => {
  beforeEach(() => vi.mocked(db.execute).mockReset());

  it("knows the newest migration this build ships with", () => {
    expect(newestMigrationAt()).toBe(newest);
  });

  it("is false when the database has run the newest migration", async () => {
    database("drizzle.__drizzle_migrations", String(newest));
    await expect(migrationsPending()).resolves.toBe(false);
  });

  it("is true when the database is behind this build", async () => {
    database("drizzle.__drizzle_migrations", String(newest - 1));
    await expect(migrationsPending()).resolves.toBe(true);
  });

  it("is true when nothing was ever migrated", async () => {
    database("drizzle.__drizzle_migrations", null);
    await expect(migrationsPending()).resolves.toBe(true);

    database(null);
    await expect(migrationsPending()).resolves.toBe(true);
    expect(db.execute).toHaveBeenCalledTimes(3);
  });
});
