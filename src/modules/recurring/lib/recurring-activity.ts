import type { ActivityFormatters } from "@/modules/activity/lib/activity-values";
import { diffFields } from "@/modules/activity/lib/diff";

export type RecurringSnapshot = {
  amount: number | string;
  categoryId: string;
  endDate?: null | string;
  frequency: string;
  icon: string;
  name: string;
  nextDueDate: string;
  ownerMemberId: null | string;
  vendor?: null | string;
};

// "Internet · RS 1,500 monthly · Bills"
export function recurringSummary(f: ActivityFormatters, item: RecurringSnapshot): string {
  return [item.name, `${f.money(item.amount)} ${item.frequency}`, f.category(item.categoryId)].filter(Boolean).join(" · ");
}

export function recurringChanges(f: ActivityFormatters, before: RecurringSnapshot, after: RecurringSnapshot) {
  return diffFields(before, after, [
    { format: f.text, key: "name", label: "Name" },
    { format: f.money, key: "amount", label: "Amount" },
    { format: f.category, key: "categoryId", label: "Category" },
    { format: f.text, key: "frequency", label: "Frequency" },
    { format: f.date, key: "nextDueDate", label: "Next due" },
    { format: f.date, key: "endDate", label: "Ends" },
    { format: f.owner, key: "ownerMemberId", label: "For" },
    { format: f.text, key: "vendor", label: "Vendor" },
    { format: f.text, key: "icon", label: "Icon" },
  ]);
}
