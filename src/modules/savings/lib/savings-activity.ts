import type { ActivityFormatters } from "@/modules/activity/lib/activity-values";

// "Shared savings · Shared · reserve RS 100,000"
export function potSummary(f: ActivityFormatters, pot: { name: string; ownerMemberId: null | string; reserveMinimum: number | string }): string {
  return [pot.name, f.owner(pot.ownerMemberId), `reserve ${f.money(pot.reserveMinimum)}`].join(" · ");
}

// "Surgery · RS 300,000 · Shared savings"
export function itemSummary(f: ActivityFormatters, item: { cost: number | string; name: string }, potName: string): string {
  return `${item.name} · ${f.money(item.cost)} · ${potName}`;
}

// "RS 10,000 into Shared savings · by Asha"
export function depositSummary(
  f: ActivityFormatters,
  deposit: { amount: number | string; kind: string; memberId: null | string },
  potName: string,
): string {
  const source = deposit.kind === "opening" ? "opening balance" : deposit.kind === "interest" ? "bank interest" : `by ${f.member(deposit.memberId)}`;
  return `${f.money(deposit.amount)} into ${potName} · ${source}`;
}
