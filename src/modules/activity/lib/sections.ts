import type { ActivityAction, ActivityEntityType } from "@/db/schema";

// How the Activity page groups entity types into its "Section" filter.
export const ACTIVITY_SECTIONS = [
  { entityTypes: ["expense"], label: "Expenses", value: "expenses" },
  { entityTypes: ["budget_item", "income"], label: "Income & budget", value: "budget" },
  { entityTypes: ["savings_goal", "savings_contribution"], label: "Savings", value: "savings" },
  { entityTypes: ["loan", "loan_payment"], label: "Loans", value: "loans" },
  { entityTypes: ["dhuku", "dhuku_entry"], label: "Dhuku", value: "dhuku" },
  { entityTypes: ["recurring_expense"], label: "Recurring", value: "recurring" },
  { entityTypes: ["category"], label: "Categories", value: "categories" },
  { entityTypes: ["household_settings", "account"], label: "Settings", value: "settings" },
] as const satisfies readonly { entityTypes: readonly ActivityEntityType[]; label: string; value: string }[];

export const ACTION_GROUPS = [
  { actions: ["created"], label: "Created", value: "created" },
  { actions: ["updated"], label: "Edited", value: "updated" },
  { actions: ["deleted"], label: "Deleted", value: "deleted" },
  {
    actions: ["archived", "completed", "paid", "paused", "restored", "resumed"],
    label: "Other",
    value: "other",
  },
] as const satisfies readonly { actions: readonly ActivityAction[]; label: string; value: string }[];

export type ActionGroup = (typeof ACTION_GROUPS)[number]["value"];
export type ActivitySection = (typeof ACTIVITY_SECTIONS)[number]["value"];

export const ACTION_GROUP_VALUES = ACTION_GROUPS.map((g) => g.value) as [ActionGroup, ...ActionGroup[]];
export const SECTION_VALUES = ACTIVITY_SECTIONS.map((s) => s.value) as [ActivitySection, ...ActivitySection[]];

export function entityTypesForSection(section: ActivitySection): ActivityEntityType[] {
  return [...(ACTIVITY_SECTIONS.find((s) => s.value === section)?.entityTypes ?? [])];
}

export function actionsForGroup(group: ActionGroup): ActivityAction[] {
  return [...(ACTION_GROUPS.find((g) => g.value === group)?.actions ?? [])];
}

export function sectionForEntityType(entityType: ActivityEntityType): ActivitySection {
  const section = ACTIVITY_SECTIONS.find((s) => (s.entityTypes as readonly ActivityEntityType[]).includes(entityType));
  if (!section) throw new Error(`No activity section for ${entityType}`);
  return section.value;
}
