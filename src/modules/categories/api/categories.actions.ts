"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { categories } from "@/db/schema";
import { getCurrentMember } from "@/lib/session";
import { activityActor, logActivity } from "@/modules/activity/api/activity";

import { categoryChanges, categorySummary } from "../lib/category-activity";
import { type CategoryInput, categorySchema } from "../schemas/category.schema";

function revalidateCategoryPaths() {
  revalidatePath("/categories");
  revalidatePath("/budget");
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}

async function findCategoryInHousehold(householdId: string, id: string) {
  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.householdId, householdId)));
  return category;
}

export async function createCategoryAction(input: CategoryInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = categorySchema.parse(input);

  const [row] = await db
    .insert(categories)
    .values({
      budgetType: parsed.budgetType,
      groupName: parsed.groupName,
      householdId,
      name: parsed.name,
    })
    .returning();
  const category = { archived: row.archived, budgetType: row.budgetType, groupName: row.groupName, id: row.id, name: row.name };

  await logActivity(activityActor(member), {
    action: "created",
    after: row,
    entityId: category.id,
    entityType: "category",
    summary: categorySummary(category),
  });

  revalidateCategoryPaths();

  return category;
}

export async function updateCategoryAction(id: string, input: CategoryInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = categorySchema.parse(input);

  const before = await findCategoryInHousehold(householdId, id);
  if (!before) return;

  const [updated] = await db
    .update(categories)
    .set({ budgetType: parsed.budgetType, groupName: parsed.groupName, name: parsed.name })
    .where(and(eq(categories.id, id), eq(categories.householdId, householdId)))
    .returning();

  await logActivity(activityActor(member), {
    action: "updated",
    after: updated,
    before,
    changes: categoryChanges(before, parsed),
    entityId: id,
    entityType: "category",
    summary: categorySummary(parsed),
  });

  revalidateCategoryPaths();
}

async function setCategoryArchived(id: string, archived: boolean) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const before = await findCategoryInHousehold(householdId, id);
  if (!before || before.archived === archived) return;

  const [updated] = await db
    .update(categories)
    .set({ archived })
    .where(and(eq(categories.id, id), eq(categories.householdId, householdId)))
    .returning();

  await logActivity(activityActor(member), {
    action: archived ? "archived" : "restored",
    after: updated,
    before,
    entityId: id,
    entityType: "category",
    summary: categorySummary(before),
  });

  revalidateCategoryPaths();
}

// Categories are archived, never hard-deleted — expenses and budget_items
// both reference categoryId with onDelete: "cascade", so an actual DELETE
// here would silently wipe out every expense/budget row ever logged
// against that category. archived=true keeps history intact while
// removing the category from listCategories' default (active-only) view.
export async function archiveCategoryAction(id: string) {
  await setCategoryArchived(id, true);
}

export async function restoreCategoryAction(id: string) {
  await setCategoryArchived(id, false);
}
