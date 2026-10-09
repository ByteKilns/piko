import { date, numeric, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { categories } from "./categories";
import { householdMembers } from "./householdMembers";
import { households } from "./households";

export const recurringFrequencyEnum = pgEnum("recurring_frequency", ["monthly", "quarterly", "yearly"]);
export const recurringStatusEnum = pgEnum("recurring_status", ["active", "paused", "completed"]);

export const recurringExpenses = pgTable("recurring_expenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  // null = shared
  ownerMemberId: uuid("owner_member_id").references(() => householdMembers.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  vendor: text("vendor"),
  icon: text("icon").notNull().default("receipt"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  frequency: recurringFrequencyEnum("frequency").notNull().default("monthly"),
  status: recurringStatusEnum("status").notNull().default("active"),
  nextDueDate: date("next_due_date").notNull(),
  // Optional last occurrence — once a paid cycle would roll nextDueDate past
  // this, the item is auto-marked "completed" instead of advancing further.
  endDate: date("end_date"),
});
