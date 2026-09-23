// The canonical category set every new household is seeded with (see
// src/db/seed.ts). Kept here as the single source of truth so "is this a
// default category?" has exactly one definition: the budget planner relies on
// it to decide whether a category name is safe to send to the AI. Default
// names are generic; a user-created name may contain personal details, so
// anything not in this list is treated as custom and never sent by name.
export type DefaultCategory = { budgetType: "fixed" | "flexible"; group: string; name: string };

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { budgetType: "fixed", group: "Family", name: "Parents" },
  { budgetType: "fixed", group: "Family", name: "Family Support" },
  { budgetType: "fixed", group: "Obligations", name: "Personal Loan" },
  { budgetType: "fixed", group: "Obligations", name: "EMI" },
  { budgetType: "fixed", group: "Obligations", name: "Insurance" },
  { budgetType: "fixed", group: "Obligations", name: "Bills" },
  { budgetType: "flexible", group: "Household", name: "Groceries" },
  { budgetType: "fixed", group: "Household", name: "Utilities" },
  { budgetType: "fixed", group: "Household", name: "Internet" },
  { budgetType: "flexible", group: "Household", name: "Household" },
  { budgetType: "flexible", group: "Transportation", name: "Petrol" },
  { budgetType: "flexible", group: "Transportation", name: "Public Transport" },
  { budgetType: "flexible", group: "Transportation", name: "Vehicle Maintenance" },
  { budgetType: "flexible", group: "Lifestyle", name: "Dates" },
  { budgetType: "flexible", group: "Lifestyle", name: "Dining Out" },
  { budgetType: "flexible", group: "Lifestyle", name: "Entertainment" },
  { budgetType: "flexible", group: "Lifestyle", name: "Gifts" },
  { budgetType: "flexible", group: "Lifestyle", name: "Social" },
  { budgetType: "flexible", group: "Lifestyle", name: "Shopping" },
  { budgetType: "flexible", group: "Personal", name: "Personal" },
  { budgetType: "flexible", group: "Personal", name: "Health/Wellness" },
  { budgetType: "flexible", group: "Personal", name: "Other Personal" },
  { budgetType: "flexible", group: "Financial", name: "Savings" },
  { budgetType: "flexible", group: "Other", name: "Miscellaneous" },
];

export function isDefaultCategory(name: string, groupName: string): boolean {
  return DEFAULT_CATEGORIES.some((c) => c.name === name && c.group === groupName);
}
