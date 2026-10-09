import { date, integer, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { householdMembers } from "./householdMembers";
import { households } from "./households";

export const dhukuEntryTypeEnum = pgEnum("dhuku_entry_type", ["contribution", "payout"]);

export const dhukus = pgTable("dhukus", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  // null = shared/joint, same convention as loans.ownerMemberId
  ownerMemberId: uuid("owner_member_id").references(() => householdMembers.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  // Cycle length in months — also the group size (one payout per member).
  totalMembers: integer("total_members").notNull(),
  monthlyContribution: numeric("monthly_contribution", { precision: 12, scale: 2 }).notNull(),
  // Fixed extra amount owed per month once you've taken your payout — null
  // until known / not applicable.
  interestPerMonth: numeric("interest_per_month", { precision: 12, scale: 2 }),
  startDate: date("start_date").notNull(),
  note: text("note"),
  // Set when a dhuku is manually marked completed (or auto-completes); null
  // means it's derived from the logged months.
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dhukuEntries = pgTable("dhuku_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  dhukuId: uuid("dhuku_id")
    .notNull()
    .references(() => dhukus.id, { onDelete: "cascade" }),
  type: dhukuEntryTypeEnum("type").notNull(),
  date: date("date").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
