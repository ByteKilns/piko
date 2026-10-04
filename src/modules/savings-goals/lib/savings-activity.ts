import type { ActivityFormatters } from "@/modules/activity/lib/activity-values";
import { diffFields } from "@/modules/activity/lib/diff";

export type SavingsGoalSnapshot = {
  description?: null | string;
  image?: null | string;
  name: string;
  ownerMemberId: null | string;
  targetAmount?: null | number | string;
  targetDate?: null | string;
};

// "Emergency fund · Shared · target RS 500,000"
export function goalSummary(f: ActivityFormatters, goal: SavingsGoalSnapshot): string {
  const target = f.money(goal.targetAmount);
  return [goal.name, f.owner(goal.ownerMemberId), target && `target ${target}`].filter(Boolean).join(" · ");
}

export function goalChanges(f: ActivityFormatters, before: SavingsGoalSnapshot, after: SavingsGoalSnapshot) {
  const changes = diffFields(before, after, [
    { format: f.text, key: "name", label: "Name" },
    { format: f.text, key: "description", label: "Description" },
    { format: f.owner, key: "ownerMemberId", label: "For" },
    { format: f.money, key: "targetAmount", label: "Target" },
    { format: f.date, key: "targetDate", label: "Target date" },
  ]);
  // The image is a data URL, so the log records only that it changed — never
  // the image itself.
  if ((before.image ?? null) !== (after.image ?? null)) {
    changes.push({ field: "Photo", from: before.image ? "Old photo" : null, to: after.image ? "New photo" : null });
  }
  return changes;
}

// "RS 5,000 to Emergency fund · by Asha"
export function contributionSummary(
  f: ActivityFormatters,
  contribution: { amount: number | string; memberId: string },
  goalName: string,
): string {
  return `${f.money(contribution.amount)} to ${goalName} · by ${f.member(contribution.memberId)}`;
}
