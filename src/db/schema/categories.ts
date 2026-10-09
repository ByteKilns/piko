import { boolean, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { households } from "./households";

export const budgetTypeEnum = pgEnum("budget_type", ["fixed", "flexible"]);

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  groupName: text("group_name").notNull(),
  // Optional icon key (recurring-icon names); null falls back to a keyword
  // guess from the name. Additive.
  icon: text("icon"),
  budgetType: budgetTypeEnum("budget_type").notNull().default("flexible"),
  archived: boolean("archived").notNull().default(false),
});
