import { date, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { householdMembers } from "./householdMembers";
import { households } from "./households";

// Money one member hands the other to bring down the "pay back later"
// balance between them. Any amount; it isn't matched to particular expenses.
export const paybacks = pgTable("paybacks", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  fromMemberId: uuid("from_member_id")
    .notNull()
    .references(() => householdMembers.id, { onDelete: "cascade" }),
  toMemberId: uuid("to_member_id")
    .notNull()
    .references(() => householdMembers.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  date: date("date").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
