import { config } from "dotenv";

config({ path: ".env.local" });

import bcrypt from "bcryptjs";

import { DEFAULT_CATEGORIES } from "../modules/categories/lib/default-categories";
import { categories, householdMembers, households, users } from "./schema";

async function seed() {
  // Imported dynamically (after dotenv config runs above) so that
  // ./connection reads DATABASE_URL only once it has actually been
  // populated from .env.local — a static top-level import would be
  // hoisted above the config() call by the module transpiler.
  const { db } = await import("./connection");

  const email1 = process.env.SEED_USER1_EMAIL;
  const password1 = process.env.SEED_USER1_PASSWORD;
  const name1 = process.env.SEED_USER1_NAME ?? "Me";
  const email2 = process.env.SEED_USER2_EMAIL;
  const password2 = process.env.SEED_USER2_PASSWORD;
  const name2 = process.env.SEED_USER2_NAME ?? "Partner";
  const householdName = process.env.SEED_HOUSEHOLD_NAME ?? "Our Household";

  if (!email1 || !password1 || !email2 || !password2) {
    throw new Error(
      "Set SEED_USER1_EMAIL, SEED_USER1_PASSWORD, SEED_USER2_EMAIL, SEED_USER2_PASSWORD in .env.local before seeding",
    );
  }

  // Wrapped in a transaction so a failure partway through (e.g. the unique
  // constraint on users.email during an accidental re-run) rolls back the
  // whole batch instead of leaving an orphaned household + categories
  // behind — households/categories have no uniqueness guard of their own.
  const household = await db.transaction(async (tx) => {
    const [household] = await tx
      .insert(households)
      .values({ name: householdName })
      .returning();

    const [user1] = await tx
      .insert(users)
      .values({ email: email1, passwordHash: await bcrypt.hash(password1, 12), name: name1 })
      .returning();
    const [user2] = await tx
      .insert(users)
      .values({ email: email2, passwordHash: await bcrypt.hash(password2, 12), name: name2 })
      .returning();

    await tx.insert(householdMembers).values([
      { householdId: household.id, userId: user1.id },
      { householdId: household.id, userId: user2.id },
    ]);

    await tx.insert(categories).values(
      DEFAULT_CATEGORIES.map((c) => ({
        householdId: household.id,
        name: c.name,
        groupName: c.group,
        budgetType: c.budgetType,
      })),
    );

    return household;
  });

  console.log(`Seeded household "${household.name}" with users ${email1} and ${email2}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
