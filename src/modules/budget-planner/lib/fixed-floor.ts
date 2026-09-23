import type { DateFormat } from "@/lib/date-format-cookie";
import { cycleStatus, expectedNextAmount } from "@/modules/dhuku/lib/dhuku-stats";

import { adAddDays, adAddMonths, adDateInRange } from "./ad-date";
import { periodBounds, type PeriodRef } from "./periods";

export type RecurringRow = {
  amount: string;
  categoryId: string;
  endDate: null | string;
  frequency: "monthly" | "yearly";
  nextDueDate: string;
  ownerMemberId: null | string;
  status: "active" | "completed" | "paused";
};

export type LoanRow = {
  direction: "given" | "taken";
  installmentAmount: null | string;
  installmentFrequency: "monthly" | "weekly" | null;
  nextInstallmentDate: null | string;
  ownerMemberId: null | string;
};

export type DhukuRow = {
  id: string;
  interestPerMonth: null | string;
  monthlyContribution: string;
  ownerMemberId: null | string;
  totalMembers: number;
};

export type DhukuEntryRow = { dhukuId: string; type: "contribution" | "payout" };

export type FixedCommitment = { amount: number; categoryId: null | string; ownerMemberId: null | string };

export type FixedFloor = {
  byCategory: { amount: number; categoryId: string }[];
  byOwner: { amount: number; ownerMemberId: null | string }[];
  total: number;
};

export type FixedFloorInput = {
  dhukuEntries: DhukuEntryRow[];
  dhukus: DhukuRow[];
  loans: LoanRow[];
  recurring: RecurringRow[];
};

// Generous upper bound so a malformed schedule can't spin forever.
const MAX_INSTALLMENTS = 60;

// How many of a loan's scheduled installments land inside [startDate, endDate].
// Only in-period occurrences count; an overdue nextInstallmentDate before the
// period is skipped rather than back-counted (we're planning forward).
function loanOccurrencesInPeriod(loan: LoanRow, startDate: string, endDate: string): number {
  if (!loan.installmentAmount || !loan.installmentFrequency || !loan.nextInstallmentDate) return 0;

  let count = 0;
  let cursor = loan.nextInstallmentDate;
  for (let i = 0; i < MAX_INSTALLMENTS && cursor <= endDate; i++) {
    if (cursor >= startDate) count++;
    cursor = loan.installmentFrequency === "weekly" ? adAddDays(cursor, 7) : adAddMonths(cursor, 1);
  }
  return count;
}

// Fixed commitments the household is already on the hook for in `period`:
// active recurring bills, "taken" loan installments, and active dhuku
// contributions. These are the floor the plan must cover before any flexible
// allocation — computed locally, never sent to the AI (only its aggregate
// share is).
export function fixedFloor(period: PeriodRef, dateFormat: DateFormat, input: FixedFloorInput): FixedFloor {
  const { endDate, startDate } = periodBounds(period, dateFormat);
  const commitments: FixedCommitment[] = [];

  for (const item of input.recurring) {
    if (item.status !== "active") continue;
    const dueInPeriod =
      item.frequency === "yearly"
        ? adDateInRange(item.nextDueDate, startDate, endDate)
        : item.nextDueDate <= endDate && (item.endDate === null || item.endDate >= startDate);
    if (!dueInPeriod) continue;
    commitments.push({ amount: Number(item.amount), categoryId: item.categoryId, ownerMemberId: item.ownerMemberId });
  }

  for (const loan of input.loans) {
    // Only "taken" loans are obligations (money we pay out). A "given" loan's
    // installments are money coming back to us, so they aren't a commitment.
    if (loan.direction !== "taken" || !loan.installmentAmount) continue;
    const occurrences = loanOccurrencesInPeriod(loan, startDate, endDate);
    if (occurrences === 0) continue;
    commitments.push({
      amount: occurrences * Number(loan.installmentAmount),
      categoryId: null,
      ownerMemberId: loan.ownerMemberId,
    });
  }

  const entriesByDhuku = new Map<string, DhukuEntryRow[]>();
  for (const entry of input.dhukuEntries) {
    const list = entriesByDhuku.get(entry.dhukuId) ?? [];
    list.push(entry);
    entriesByDhuku.set(entry.dhukuId, list);
  }
  for (const dhuku of input.dhukus) {
    const entries = entriesByDhuku.get(dhuku.id) ?? [];
    if (cycleStatus(dhuku.totalMembers, entries) !== "active") continue;
    commitments.push({
      amount: expectedNextAmount(
        Number(dhuku.monthlyContribution),
        dhuku.interestPerMonth === null ? null : Number(dhuku.interestPerMonth),
        entries,
      ),
      categoryId: null,
      ownerMemberId: dhuku.ownerMemberId,
    });
  }

  const byCategoryMap = new Map<string, number>();
  const byOwnerMap = new Map<null | string, number>();
  let total = 0;
  for (const c of commitments) {
    total += c.amount;
    if (c.categoryId) byCategoryMap.set(c.categoryId, (byCategoryMap.get(c.categoryId) ?? 0) + c.amount);
    byOwnerMap.set(c.ownerMemberId, (byOwnerMap.get(c.ownerMemberId) ?? 0) + c.amount);
  }

  return {
    byCategory: [...byCategoryMap.entries()]
      .map(([categoryId, amount]) => ({ amount, categoryId }))
      .sort((a, b) => a.categoryId.localeCompare(b.categoryId)),
    byOwner: [...byOwnerMap.entries()]
      .map(([ownerMemberId, amount]) => ({ amount, ownerMemberId }))
      .sort((a, b) => String(a.ownerMemberId).localeCompare(String(b.ownerMemberId))),
    total,
  };
}
