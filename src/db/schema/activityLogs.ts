import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { householdMembers } from "./householdMembers";
import { households } from "./households";

export const activityEntityTypeEnum = pgEnum("activity_entity_type", [
  "account",
  "budget_item",
  "category",
  "dhuku",
  "dhuku_entry",
  "expense",
  "household_settings",
  "income",
  "loan",
  "loan_payment",
  "recurring_expense",
  "savings_contribution",
  "savings_goal",
]);
export const activityActionEnum = pgEnum("activity_action", [
  "archived",
  "completed",
  "created",
  "deleted",
  "paid",
  "paused",
  "restored",
  "resumed",
  "updated",
]);
export const activitySourceEnum = pgEnum("activity_source", ["mobile", "web"]);

export type ActivityAction = (typeof activityActionEnum.enumValues)[number];
export type ActivityEntityType = (typeof activityEntityTypeEnum.enumValues)[number];
export type ActivitySource = (typeof activitySourceEnum.enumValues)[number];
// One field's before/after on an "updated" entry, already formatted for display.
export type ActivityChange = { field: string; from: null | string; to: null | string };

// Append-only audit trail of household data changes (see
// src/modules/activity). Rows are written by the mutating actions themselves,
// so the actor and source come from the session, not the database.
export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    // set null so a removed member's history survives; actorName is the snapshot
    actorMemberId: uuid("actor_member_id").references(() => householdMembers.id, { onDelete: "set null" }),
    actorName: text("actor_name").notNull(),
    entityType: activityEntityTypeEnum("entity_type").notNull(),
    // No FK: the entity may be deleted later and its log must remain.
    entityId: uuid("entity_id"),
    action: activityActionEnum("action").notNull(),
    // Display text written at log time, e.g. "Groceries · RS 1,200 · Shared".
    summary: text("summary").notNull(),
    changes: jsonb("changes").$type<ActivityChange[]>(),
    source: activitySourceEnum("source").notNull(),
    // Millisecond precision (not Postgres' default microseconds) so a JS Date
    // round-trips exactly — the "Older activity" keyset cursor compares
    // against it, and a truncated cursor would skip rows in the same ms.
    createdAt: timestamp("created_at", { precision: 3, withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("activity_logs_household_created_idx").on(table.householdId, table.createdAt.desc(), table.id.desc()),
  ],
);

export type ActivityLog = typeof activityLogs.$inferSelect;
