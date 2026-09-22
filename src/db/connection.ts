// Raw connection setup. App code should import from ./client, not this file directly — this module has no server-only guard.
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const client = postgres(connectionString, {
  // Fail fast instead of hanging a page render when the database is unreachable.
  connect_timeout: 10,
  // Without these the pool holds sockets open indefinitely, so the first query
  // after a laptop sleep / network change reuses a dead connection and fails
  // with an opaque "Failed query" before the pool reconnects.
  idle_timeout: 20,
  max_lifetime: 60 * 30,
  prepare: false,
});

export const db = drizzle(client, { schema });
