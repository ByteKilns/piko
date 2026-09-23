import { boolean, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const dateFormatEnum = pgEnum("date_format", ["nepali", "english"]);

export const households = pgTable("households", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  // Shared across the whole household — not a per-user cookie — because
  // once a "month" is calendar-dependent (BS vs AD), household members
  // must agree on it or they'd compute different period boundaries for
  // the same shared budget/income data.
  dateFormat: dateFormatEnum("date_format").notNull().default("nepali"),
  // Household-wide opt-in for the AI budget planner. Off until the household
  // chooses to use it, independent of the AI_BUDGET_PLANNER deployment gate.
  plannerEnabled: boolean("planner_enabled").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
