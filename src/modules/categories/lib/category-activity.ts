import { diffFields, type FieldSpec } from "@/modules/activity/lib/diff";

export type CategorySnapshot = { budgetType: string; groupName: string; name: string };

function budgetTypeLabel(value: unknown): null | string {
  if (value === "fixed") return "Fixed";
  if (value === "flexible") return "Flexible";
  return null;
}

function text(value: unknown): null | string {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

// "Groceries · Household · Flexible"
export function categorySummary(category: CategorySnapshot): string {
  return [category.name, category.groupName, budgetTypeLabel(category.budgetType)].filter(Boolean).join(" · ");
}

export function categoryFields(): FieldSpec<CategorySnapshot>[] {
  return [
    { format: text, key: "name", label: "Name" },
    { format: text, key: "groupName", label: "Group" },
    { format: budgetTypeLabel, key: "budgetType", label: "Type" },
  ];
}

export function categoryChanges(before: CategorySnapshot, after: CategorySnapshot) {
  return diffFields(before, after, categoryFields());
}
