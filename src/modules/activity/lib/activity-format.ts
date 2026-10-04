import type { ActivityAction, ActivityEntityType } from "@/db/schema";

const ENTITY_NOUNS: Record<ActivityEntityType, string> = {
  account: "their account",
  budget_item: "a budget line",
  category: "a category",
  dhuku: "a dhuku",
  dhuku_entry: "a dhuku entry",
  expense: "an expense",
  household_settings: "household settings",
  income: "income",
  loan: "a loan",
  loan_payment: "a loan payment",
  recurring_expense: "a recurring bill",
  savings_contribution: "a savings contribution",
  savings_goal: "a savings goal",
};

const ACTION_VERBS: Record<Exclude<ActivityAction, "paid">, string> = {
  archived: "archived",
  completed: "completed",
  created: "added",
  deleted: "deleted",
  paused: "paused",
  restored: "restored",
  resumed: "resumed",
  updated: "edited",
};

// "added an expense", "marked a recurring bill paid" — follows the actor's name.
export function describeActivity(action: ActivityAction, entityType: ActivityEntityType): string {
  const noun = ENTITY_NOUNS[entityType];
  return action === "paid" ? `marked ${noun} paid` : `${ACTION_VERBS[action]} ${noun}`;
}
