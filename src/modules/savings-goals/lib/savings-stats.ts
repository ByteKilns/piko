import { formatMonthShort } from "@/lib/date-format";
import type { DateFormat } from "@/lib/date-format-cookie";
import type { MemberRole } from "@/modules/expenses/lib/member-tone";

export type GoalStatus = "at-risk" | "behind" | "on-track";

export type GoalCardData = {
  createdAt: Date;
  description: null | string;
  id: string;
  image: null | string;
  name: string;
  ownerMemberId: null | string;
  ownerName: null | string;
  pct: null | number;
  saved: number;
  status: GoalStatus;
  targetAmount: null | number;
  targetDate: null | string;
};

export type ContributionEntry = {
  amount: number;
  date: string;
  goalImage: null | string;
  goalName: string;
  id: string;
  ownerLabel: string;
  role: MemberRole;
};

export type Goal = {
  createdAt: Date;
  id: string;
  targetAmount: null | number;
  targetDate: null | string;
};

export type Contribution = { amount: number; date: string; goalId: string };

export function savedAmountForGoal(goalId: string, contributions: Contribution[]): number {
  return contributions.filter((c) => c.goalId === goalId).reduce((s, c) => s + c.amount, 0);
}

// Compares how far through the goal's timeline we are against how much of
// the target has actually been saved. No target amount means this is an
// ongoing pool rather than a goal being saved toward, so it's always
// "on-track"; likewise no target date means there's no schedule to fall
// behind on.
export function classifyGoal(goal: Goal, saved: number): GoalStatus {
  if (goal.targetAmount === null || goal.targetAmount <= 0 || saved >= goal.targetAmount) return "on-track";
  if (!goal.targetDate) return "on-track";

  const start = goal.createdAt.getTime();
  const end = new Date(`${goal.targetDate}T00:00:00`).getTime();
  const now = Date.now();
  if (end <= start) return saved >= goal.targetAmount ? "on-track" : "at-risk";

  const timeElapsedPct = Math.min(1, Math.max(0, (now - start) / (end - start)));
  const progressPct = Math.min(1, saved / goal.targetAmount);
  const diff = progressPct - timeElapsedPct;

  if (diff >= -0.1) return "on-track";
  if (diff >= -0.25) return "behind";
  return "at-risk";
}

export function monthlyTotals(
  contributions: Contribution[],
  monthsBack: number,
  dateFormat: DateFormat,
): { cumulative: number; label: string }[] {
  const now = new Date();
  const months: { label: string; month: number; year: number }[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: formatMonthShort(d.toISOString().slice(0, 10), dateFormat),
      month: d.getMonth() + 1,
      year: d.getFullYear(),
    });
  }

  const sorted = [...contributions].sort((a, b) => a.date.localeCompare(b.date));
  let runningTotal = 0;
  let contribIndex = 0;

  return months.map(({ label, month, year }) => {
    const monthEnd = new Date(year, month, 0);
    while (contribIndex < sorted.length && new Date(`${sorted[contribIndex].date}T00:00:00`) <= monthEnd) {
      runningTotal += sorted[contribIndex].amount;
      contribIndex++;
    }
    return { cumulative: runningTotal, label };
  });
}

function isInMonth(dateStr: string, year: number, month: number) {
  const [y, m] = dateStr.split("-").map(Number);
  return y === year && m === month;
}

export type SavingsOverviewStats = {
  averageProgress: number;
  lastMonthContribution: number;
  monthlyContribution: number;
  totalGoals: number;
  totalSaved: number;
};

export function savingsOverviewStats(
  goals: Goal[],
  contributions: Contribution[],
  year: number,
  month: number,
): SavingsOverviewStats {
  const totalSaved = contributions.reduce((s, c) => s + c.amount, 0);
  const monthlyContribution = contributions.filter((c) => isInMonth(c.date, year, month)).reduce((s, c) => s + c.amount, 0);
  const lastMonthDate = new Date(year, month - 2, 1);
  const lastMonthContribution = contributions
    .filter((c) => isInMonth(c.date, lastMonthDate.getFullYear(), lastMonthDate.getMonth() + 1))
    .reduce((s, c) => s + c.amount, 0);

  const progressPcts = goals
    .filter((g): g is Goal & { targetAmount: number } => g.targetAmount !== null && g.targetAmount > 0)
    .map((g) => Math.min(1, savedAmountForGoal(g.id, contributions) / g.targetAmount));
  const averageProgress =
    progressPcts.length > 0 ? Math.round((progressPcts.reduce((s, p) => s + p, 0) / progressPcts.length) * 100) : 0;

  return { averageProgress, lastMonthContribution, monthlyContribution, totalGoals: goals.length, totalSaved };
}

export type GoalRow = {
  createdAt: Date;
  description: null | string;
  householdId: string;
  id: string;
  image: null | string;
  name: string;
  ownerMemberId: null | string;
  targetAmount: null | string;
  targetDate: null | string;
};

// Shared by SavingsGoalsPage and the Reports "Savings" tab — both need the
// exact same raw-rows-to-view-model shaping, so it lives here once rather
// than being reimplemented (and risking drift) in each page.
export function buildGoalCards(
  goalRows: GoalRow[],
  contributions: Contribution[],
  memberById: Map<string, { user: { name: string } }>,
): { goals: GoalCardData[]; statusCounts: Record<GoalStatus, number> } {
  const goals: GoalCardData[] = goalRows.map((g) => {
    const saved = savedAmountForGoal(g.id, contributions);
    const targetAmount = g.targetAmount === null ? null : Number(g.targetAmount);
    const owner = g.ownerMemberId ? memberById.get(g.ownerMemberId) : null;
    return {
      createdAt: g.createdAt,
      description: g.description,
      id: g.id,
      image: g.image,
      name: g.name,
      ownerMemberId: g.ownerMemberId,
      ownerName: owner?.user.name ?? null,
      pct: targetAmount !== null && targetAmount > 0 ? Math.round((saved / targetAmount) * 100) : null,
      saved,
      status: classifyGoal({ createdAt: g.createdAt, id: g.id, targetAmount, targetDate: g.targetDate }, saved),
      targetAmount,
      targetDate: g.targetDate,
    };
  });

  const statusCounts: Record<GoalStatus, number> = { "at-risk": 0, behind: 0, "on-track": 0 };
  for (const goal of goals) statusCounts[goal.status]++;

  return { goals, statusCounts };
}

export type ContributionRow = { amount: string; date: string; goalId: string; id: string; memberId: string };

export function buildContributionEntries(
  contributionRows: ContributionRow[],
  goalRows: { id: string; image: null | string; name: string }[],
  memberById: Map<string, { user: { name: string } }>,
  realMemberId: string,
): ContributionEntry[] {
  return contributionRows.map((c) => {
    const goal = goalRows.find((g) => g.id === c.goalId);
    const member = memberById.get(c.memberId);
    const role = c.memberId === realMemberId ? "me" : member ? "partner" : "shared";
    return {
      amount: Number(c.amount),
      date: c.date,
      goalImage: goal?.image ?? null,
      goalName: goal?.name ?? "Unknown goal",
      id: c.id,
      ownerLabel: member?.user.name ?? "Unknown",
      role,
    };
  });
}
