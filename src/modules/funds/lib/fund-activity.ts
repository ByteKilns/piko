import type { ActivityFormatters } from "@/modules/activity/lib/activity-values";
import { diffFields, type FieldSpec } from "@/modules/activity/lib/diff";

export type FundSnapshot = {
  dueMonth: null | number;
  dueYear: null | number;
  monthlyAmount: number | string;
  name: string;
  ownerMemberId: string;
  target: null | number | string;
};

type FundDiff = { due: null | string; monthlyAmount: number | string; name: string; target: null | number | string };

// "WorldLink · Asha · RS 1,225 a month"
export function fundSummary(f: ActivityFormatters, fund: FundSnapshot): string {
  return [fund.name, f.member(fund.ownerMemberId), `${f.money(fund.monthlyAmount)} a month`].filter(Boolean).join(" · ");
}

function toDiff(f: ActivityFormatters, fund: FundSnapshot): FundDiff {
  return {
    due: fund.dueYear !== null && fund.dueMonth !== null ? f.period(fund.dueYear, fund.dueMonth) : null,
    monthlyAmount: fund.monthlyAmount,
    name: fund.name,
    target: fund.target,
  };
}

export function fundChanges(f: ActivityFormatters, before: FundSnapshot, after: FundSnapshot) {
  const specs: FieldSpec<FundDiff>[] = [
    { format: f.text, key: "name", label: "Name" },
    { format: f.money, key: "monthlyAmount", label: "Monthly" },
    { format: f.money, key: "target", label: "Target" },
    { format: f.text, key: "due", label: "Needed by" },
  ];
  return diffFields(toDiff(f, before), toDiff(f, after), specs);
}

// "WorldLink · RS 5,000 added · Dashain bonus"
export function topUpSummary(f: ActivityFormatters, topUp: { amount: number | string; note: null | string }, fundName: string): string {
  return [fundName, `${f.money(topUp.amount)} added`, f.text(topUp.note)].filter(Boolean).join(" · ");
}
