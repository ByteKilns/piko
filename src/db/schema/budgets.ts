import { integer, numeric, pgEnum, pgTable, unique, uuid } from "drizzle-orm/pg-core";

import { categories } from "./categories";
import { householdMembers } from "./householdMembers";
import { households } from "./households";

// How a person treats one of their budget lines. "can_cut" lines make up the
// money Home's "safe to spend" is worked out from.
export const budgetLineKindEnum = pgEnum("budget_line_kind", ["fixed", "essential", "can_cut"]);

export const monthlyBudgets = pgTable(
  "monthly_budgets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
  },
  (table) => [unique().on(table.householdId, table.year, table.month)],
);

export const budgetItems = pgTable(
  "budget_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    monthlyBudgetId: uuid("monthly_budget_id")
      .notNull()
      .references(() => monthlyBudgets.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    // null = shared
    ownerMemberId: uuid("owner_member_id").references(() => householdMembers.id, {
      onDelete: "cascade",
    }),
    plannedAmount: numeric("planned_amount", { precision: 12, scale: 2 }).notNull(),
    // null = not chosen yet: it follows the category (fixed → fixed,
    // flexible → essential).
    kind: budgetLineKindEnum("kind"),
  },
  (table) => [
    unique().on(table.monthlyBudgetId, table.categoryId, table.ownerMemberId),
  ],
);
