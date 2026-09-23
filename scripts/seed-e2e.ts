// Prepares the dedicated e2e database: creates it if missing, resets the
// schema, applies migrations, and inserts a deterministic fixture (6 months of
// history) so the planner has something to plan from.
//
// Run by `npm run e2e:serve` with DATABASE_URL pointed at the e2e database
// (Playwright's webServer sets it). Refuses to touch a database whose name
// doesn't end in "_e2e", so it can never wipe the dev/prod database.
import { config } from "dotenv";

config({ path: ".env.local" });

import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import {
  categories,
  dhukus,
  expenses,
  householdMembers,
  households,
  incomes,
  loans,
  recurringExpenses,
  users,
} from "../src/db/schema";
import { DEFAULT_CATEGORIES } from "../src/modules/categories/lib/default-categories";

const HISTORY_MONTHS = 6;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function databaseName(url: string): string {
  return new URL(url).pathname.replace(/^\//, "");
}

function withDatabaseName(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

function dateFor(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

// The N months before the current one, oldest first.
function completedMonths(count: number): { month: number; year: number }[] {
  const now = new Date();
  const months: { month: number; year: number }[] = [];
  for (let i = count; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ month: d.getMonth() + 1, year: d.getFullYear() });
  }
  return months;
}

async function main() {
  const e2eUrl = process.env.DATABASE_URL;
  if (!e2eUrl) throw new Error("DATABASE_URL is not set for the e2e database");

  const name = databaseName(e2eUrl);
  if (!name.endsWith("_e2e")) {
    throw new Error(`Refusing to reset a non-e2e database: "${name}" (name must end with "_e2e")`);
  }

  // 1. Ensure the database exists (connect to the maintenance db).
  const admin = postgres(withDatabaseName(e2eUrl, "postgres"), { max: 1, prepare: false });
  try {
    const existing = await admin`select 1 from pg_database where datname = ${name}`;
    if (existing.length === 0) await admin.unsafe(`create database "${name}"`);
  } finally {
    await admin.end();
  }

  // 2. Reset + migrate.
  const client = postgres(e2eUrl, { max: 1, prepare: false });
  const db = drizzle(client);
  // Drop drizzle's migration ledger too, or `migrate` would see everything as
  // already applied and skip creating the tables in the fresh public schema.
  await db.execute(sql`drop schema if exists public cascade`);
  await db.execute(sql`drop schema if exists drizzle cascade`);
  await db.execute(sql`create schema public`);
  await migrate(db, { migrationsFolder: "drizzle" });

  // 3. Deterministic fixture.
  const email1 = process.env.SEED_USER1_EMAIL;
  const password1 = process.env.SEED_USER1_PASSWORD;
  const email2 = process.env.SEED_USER2_EMAIL;
  const password2 = process.env.SEED_USER2_PASSWORD;
  if (!email1 || !password1 || !email2 || !password2) {
    throw new Error("Set SEED_USER1_* and SEED_USER2_* in .env.local before seeding");
  }

  const [household] = await db
    .insert(households)
    .values({ name: "E2E Household", dateFormat: "english" })
    .returning();
  const [user1] = await db
    .insert(users)
    .values({ email: email1, name: process.env.SEED_USER1_NAME ?? "Me", passwordHash: await bcrypt.hash(password1, 12) })
    .returning();
  const [user2] = await db
    .insert(users)
    .values({ email: email2, name: process.env.SEED_USER2_NAME ?? "Partner", passwordHash: await bcrypt.hash(password2, 12) })
    .returning();
  const [m1] = await db.insert(householdMembers).values({ householdId: household.id, userId: user1.id }).returning();
  const [m2] = await db.insert(householdMembers).values({ householdId: household.id, userId: user2.id }).returning();

  const categoryRows = await db
    .insert(categories)
    .values(
      DEFAULT_CATEGORIES.map((c) => ({
        budgetType: c.budgetType,
        groupName: c.group,
        householdId: household.id,
        name: c.name,
      })),
    )
    .returning();
  const categoryId = new Map(categoryRows.map((c) => [c.name, c.id]));
  const idOf = (categoryName: string) => {
    const id = categoryId.get(categoryName);
    if (!id) throw new Error(`Fixture category not found: ${categoryName}`);
    return id;
  };

  const months = completedMonths(HISTORY_MONTHS);

  // Income: member 1 varies (exercises the variability band), member 2 fixed.
  for (const [index, month] of months.entries()) {
    await db.insert(incomes).values([
      { amount: String(80000 + index * 5000), householdId: household.id, memberId: m1.id, month: month.month, year: month.year },
      { amount: "40000", householdId: household.id, memberId: m2.id, month: month.month, year: month.year },
    ]);
  }

  // Expenses: a stable set each month across fixed + flexible categories.
  const expensePlan = [
    { amount: 12000, category: "Groceries", day: 5, owner: null },
    { amount: 4000, category: "Dining Out", day: 12, owner: m1.id },
    { amount: 3000, category: "Entertainment", day: 18, owner: m2.id },
    { amount: 2500, category: "Utilities", day: 8, owner: null },
    { amount: 8000, category: "EMI", day: 3, owner: m1.id },
  ];
  for (const month of months) {
    await db.insert(expenses).values(
      expensePlan.map((e) => ({
        amount: String(e.amount),
        categoryId: idOf(e.category),
        date: dateFor(month.year, month.month, e.day),
        householdId: household.id,
        note: null,
        ownerMemberId: e.owner,
        paidByMemberId: e.owner ?? m1.id,
      })),
    );
  }

  const now = new Date();
  const current = { month: now.getMonth() + 1, year: now.getFullYear() };
  const oldest = months[0];

  // Fixed commitments for the current month: a bill, a taken-loan installment,
  // and an active dhuku contribution.
  await db.insert(recurringExpenses).values({
    amount: "3000",
    categoryId: idOf("Bills"),
    endDate: null,
    frequency: "monthly",
    householdId: household.id,
    icon: "receipt",
    name: "Internet bill",
    nextDueDate: dateFor(current.year, current.month, 10),
    ownerMemberId: null,
    status: "active",
    vendor: null,
  });

  await db.insert(loans).values({
    counterpartyName: "Bank",
    date: dateFor(oldest.year, oldest.month, 1),
    direction: "taken",
    dueDate: null,
    householdId: household.id,
    installmentAmount: "5000",
    installmentFrequency: "monthly",
    nextInstallmentDate: dateFor(current.year, current.month, 15),
    note: null,
    ownerMemberId: m1.id,
    principalAmount: "60000",
  });

  await db.insert(dhukus).values({
    householdId: household.id,
    interestPerMonth: null,
    monthlyContribution: "2000",
    name: "Family dhuku",
    note: null,
    ownerMemberId: null,
    startDate: dateFor(oldest.year, oldest.month, 1),
    totalMembers: 6,
  });

  await client.end();
  console.log(`Seeded e2e database "${name}" with ${HISTORY_MONTHS} months of history`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
