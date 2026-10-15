import { doublePrecision, index, numeric, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { categories } from "./categories";
import { expenses } from "./expenses";
import { householdMembers } from "./householdMembers";
import { households } from "./households";

// draft: waiting for review, never counted anywhere. approved: an expense was
// made from it (expenseId). rejected: dismissed. skipped: money coming in,
// kept only so the duplicate check and the debug log see it.
export const captureStatusEnum = pgEnum("capture_status", ["draft", "approved", "rejected", "skipped"]);
export const captureDirectionEnum = pgEnum("capture_direction", ["debit", "credit"]);

// Payments the app read from eSewa notifications on one member's phone. They
// stay out of `expenses`, and so out of every total, until approved.
export const capturedPayments = pgTable(
  "captured_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    // Whose phone captured it; only they review it.
    memberId: uuid("member_id")
      .notNull()
      .references(() => householdMembers.id, { onDelete: "cascade" }),
    status: captureStatusEnum("status").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    direction: captureDirectionEnum("direction").notNull(),
    // The app's TxnKind name: payment, transfer, topup, billPay, ...
    kind: text("kind").notNull(),
    counterparty: text("counterparty"),
    refId: text("ref_id"),
    occurredAt: timestamp("occurred_at", { precision: 3, withTimezone: true }).notNull(),
    source: text("source").notNull(),
    rawText: text("raw_text").notNull(),
    // The app's category guess, by name ("Uncategorized" when it had none).
    category: text("category").notNull(),
    categoryConfidence: doublePrecision("category_confidence").notNull(),
    expenseId: uuid("expense_id").references(() => expenses.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("captured_payments_member_occurred_idx").on(table.memberId, table.occurredAt)],
);

// Every eSewa notification the app saw, as captured (digits masked in OTP and
// login messages), for the app's debug screen and for tuning the parser.
export const captureEvents = pgTable(
  "capture_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => householdMembers.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    // Android's notification key; with postedAt it names one notification, so
    // the app can resend it safely.
    key: text("key").notNull(),
    title: text("title").notNull(),
    text: text("text").notNull(),
    postedAt: timestamp("posted_at", { precision: 3, withTimezone: true }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [unique().on(table.memberId, table.key, table.postedAt)],
);

// Payee → category, learned when a member changes the category while
// approving. Each member has their own.
export const captureRules = pgTable(
  "capture_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => householdMembers.id, { onDelete: "cascade" }),
    // The payee as the app lowercases it.
    counterparty: text("counterparty").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [unique().on(table.memberId, table.counterparty)],
);
