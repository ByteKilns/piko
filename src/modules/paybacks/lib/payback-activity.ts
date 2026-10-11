import type { ActivityFormatters } from "@/modules/activity/lib/activity-values";

export type PaybackSnapshot = { amount: number | string; fromMemberId: string; toMemberId: string };

// "Asha paid back RS 5,000 to Ram"
export function paybackSummary(f: ActivityFormatters, payback: PaybackSnapshot): string {
  return `${f.member(payback.fromMemberId)} paid back ${f.money(payback.amount)} to ${f.member(payback.toMemberId)}`;
}
