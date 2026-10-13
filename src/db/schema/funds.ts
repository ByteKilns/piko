import { boolean, integer, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { householdMembers } from "./householdMembers";
import { households } from "./households";

// A named pile inside one person's everyday account for an occasional cost
// (a yearly bill, festivals, gifts, health). It only exists in Piko: the
// money stays in the account. Months are the household's own calendar months.
export const funds = pgTable("funds", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  ownerMemberId: uuid("owner_member_id")
    .notNull()
    .references(() => householdMembers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // Optional: how much is needed, and by which month.
  target: numeric("target", { precision: 12, scale: 2 }),
  dueYear: integer("due_year"),
  dueMonth: integer("due_month"),
  // The first month money is set aside.
  startYear: integer("start_year").notNull(),
  startMonth: integer("start_month").notNull(),
  // Archived funds stop setting money aside and drop out of the plan.
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// The monthly set-aside from a month on. Changing it adds a row from the month
// the change is made, so earlier months keep the amount they had.
export const fundPlans = pgTable(
  "fund_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fundId: uuid("fund_id")
      .notNull()
      .references(() => funds.id, { onDelete: "cascade" }),
    fromYear: integer("from_year").notNull(),
    fromMonth: integer("from_month").notNull(),
    monthlyAmount: numeric("monthly_amount", { precision: 12, scale: 2 }).notNull(),
  },
  (table) => [unique().on(table.fundId, table.fromYear, table.fromMonth)],
);

// Money added to a fund on top of the monthly set-aside, counted in the month
// it was added for.
export const fundTopUps = pgTable("fund_top_ups", {
  id: uuid("id").defaultRandom().primaryKey(),
  fundId: uuid("fund_id")
    .notNull()
    .references(() => funds.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
