import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const dateFormatEnum = pgEnum("date_format", ["nepali", "english"]);

export const households = pgTable("households", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  // Shared across the whole household — not a per-user cookie — because
  // once a "month" is calendar-dependent (BS vs AD), household members
  // must agree on it or they'd compute different period boundaries for
  // the same shared budget/income data.
  dateFormat: dateFormatEnum("date_format").notNull().default("nepali"),
  // Set only on a public demo's sandbox household (src/modules/demo): when it
  // gets deleted. Null means a real household, and cleanup never touches a
  // household without it.
  demoExpiresAt: timestamp("demo_expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
