import { sql } from "drizzle-orm";
import { date, integer, numeric, pgEnum, pgTable, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { householdMembers } from "./householdMembers";
import { households } from "./households";

export const savingsDepositKindEnum = pgEnum("savings_deposit_kind", ["deposit", "opening", "interest"]);

// One pot per real savings account: at most one shared pot (no owner) and one
// per member. The plain unique covers members; Postgres treats NULLs as
// distinct, so the partial index below covers the single shared pot.
export const savingsPots = pgTable(
  "savings_pots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    // null = shared
    ownerMemberId: uuid("owner_member_id").references(() => householdMembers.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    // Whose bank account holds the money. A label only.
    heldByMemberId: uuid("held_by_member_id").references(() => householdMembers.id, {
      onDelete: "set null",
    }),
    // Kept untouched by the priority list; it always fills first.
    reserveMinimum: numeric("reserve_minimum", { precision: 12, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique().on(table.householdId, table.ownerMemberId),
    uniqueIndex("savings_pots_one_shared").on(table.householdId).where(sql`${table.ownerMemberId} is null`),
  ],
);

// How much each person plans to put into a pot every month. It drives the
// forecast.
export const savingsPotPlans = pgTable(
  "savings_pot_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    potId: uuid("pot_id")
      .notNull()
      .references(() => savingsPots.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => householdMembers.id, { onDelete: "cascade" }),
    monthlyAmount: numeric("monthly_amount", { precision: 12, scale: 2 }).notNull(),
  },
  (table) => [unique().on(table.potId, table.memberId)],
);

// The priority list; a lower position comes first. An item is done once an
// expense paid from savings links to it (expenses.savingsItemId).
export const savingsItems = pgTable("savings_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  potId: uuid("pot_id")
    .notNull()
    .references(() => savingsPots.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  cost: numeric("cost", { precision: 12, scale: 2 }).notNull(),
  position: integer("position").notNull(),
  neededBy: date("needed_by"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Money into a pot. "opening" = what was already in the account when the pot
// was set up, and "interest" = bank interest; neither has a member.
export const savingsDeposits = pgTable("savings_deposits", {
  id: uuid("id").defaultRandom().primaryKey(),
  potId: uuid("pot_id")
    .notNull()
    .references(() => savingsPots.id, { onDelete: "cascade" }),
  kind: savingsDepositKindEnum("kind").notNull().default("deposit"),
  memberId: uuid("member_id").references(() => householdMembers.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  date: date("date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
