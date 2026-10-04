import type { ActivityFormatters } from "@/modules/activity/lib/activity-values";
import { diffFields } from "@/modules/activity/lib/diff";

export type DhukuSnapshot = {
  interestPerMonth?: null | number | string;
  monthlyContribution: number | string;
  name: string;
  note?: null | string;
  ownerMemberId: null | string;
  startDate: string;
  totalMembers: number;
};

// "Office dhuku · RS 10,000/month · 12 members"
export function dhukuSummary(f: ActivityFormatters, dhuku: DhukuSnapshot): string {
  return `${dhuku.name} · ${f.money(dhuku.monthlyContribution)}/month · ${dhuku.totalMembers} members`;
}

export function dhukuChanges(f: ActivityFormatters, before: DhukuSnapshot, after: DhukuSnapshot) {
  return diffFields(before, after, [
    { format: f.text, key: "name", label: "Name" },
    { format: f.text, key: "totalMembers", label: "Members" },
    { format: f.money, key: "monthlyContribution", label: "Monthly contribution" },
    { format: f.money, key: "interestPerMonth", label: "Interest per month" },
    { format: f.date, key: "startDate", label: "Start date" },
    { format: f.owner, key: "ownerMemberId", label: "For" },
    { format: f.text, key: "note", label: "Note" },
  ]);
}

// "Payout · RS 120,000 · Office dhuku"
export function dhukuEntrySummary(
  f: ActivityFormatters,
  entry: { amount: number | string; type: string },
  dhukuName: string,
): string {
  return `${entry.type === "payout" ? "Payout" : "Contribution"} · ${f.money(entry.amount)} · ${dhukuName}`;
}
