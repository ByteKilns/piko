import { sql } from "drizzle-orm";
import { integer, numeric, pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { householdMembers } from "./householdMembers";
import { households } from "./households";

// "pay" is the base pay a person can count on: one per person per month, and
// it carries forward to later months. "extra" is anything else that month (a
// bonus, a refund), any number of entries.
export const incomeKindEnum = pgEnum("income_kind", ["pay", "extra"]);

export const incomes = pgTable(
  "incomes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => householdMembers.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    note: text("note"),
    kind: incomeKindEnum("kind").notNull().default("pay"),
  },
  (table) => [uniqueIndex("incomes_one_pay").on(table.memberId, table.year, table.month).where(sql`${table.kind} = 'pay'`)],
);
