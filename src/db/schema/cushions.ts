import { integer, numeric, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { householdMembers } from "./householdMembers";
import { households } from "./households";

export const cushionEntryKindEnum = pgEnum("cushion_entry_kind", ["kept", "overspend", "adjust"]);

// Each person's cushion: money in their everyday account beyond the month's
// plan. It only ever changes through these entries: money kept from a month
// ("kept"), a month that went over ("overspend", negative), or a correction
// by hand ("adjust"). year/month is the month the entry is about.
export const cushionEntries = pgTable("cushion_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  memberId: uuid("member_id")
    .notNull()
    .references(() => householdMembers.id, { onDelete: "cascade" }),
  kind: cushionEntryKindEnum("kind").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// The cushion a person is aiming for.
export const cushionTargets = pgTable("cushion_targets", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  memberId: uuid("member_id")
    .notNull()
    .unique()
    .references(() => householdMembers.id, { onDelete: "cascade" }),
  target: numeric("target", { precision: 12, scale: 2 }).notNull(),
});

// A month whose leftover (or overspend) its person has decided on. Its row
// is what stops Home asking about that month again. amount is what was left
// to decide at the time.
export const monthSettlements = pgTable(
  "month_settlements",
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
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [unique().on(table.memberId, table.year, table.month)],
);
