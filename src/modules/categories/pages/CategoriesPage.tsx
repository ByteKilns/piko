import { getCurrentMember } from "@/lib/session";
import { listCategories } from "@/modules/categories/api/categories";
import { CategoriesView } from "@/modules/categories/components/CategoriesView";

export async function CategoriesPage() {
  const { householdId } = await getCurrentMember();
  const categories = await listCategories(householdId, { includeArchived: true });

  return (
    <CategoriesView
      categories={categories.map((c) => ({ archived: c.archived, budgetType: c.budgetType, groupName: c.groupName, id: c.id, name: c.name }))}
    />
  );
}
