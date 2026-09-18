"use client";

import { useState } from "react";

import { TabSwitcher } from "@/components/TabSwitcher";
import type { DateFormat } from "@/lib/date-format-cookie";
import { DailyCashFlowChart } from "@/modules/dashboard/components/DailyCashFlowChart";
import type { DayPoint } from "@/modules/dashboard/lib/cash-flow";
import { formatNPR } from "@/modules/dashboard/lib/format";
import { ExpenseSummaryCard } from "@/modules/expenses/components/ExpenseSummaryCard";
import { ExpenseTable } from "@/modules/expenses/components/ExpenseTable";
import type { ExpenseRow } from "@/modules/expenses/hooks/useExpenseTableColumns";
import type { OwnerSlice } from "@/modules/expenses/lib/expense-breakdown";
import { ExpenseBreakdownCard } from "@/modules/reports/components/ExpenseBreakdownCard";
import { GoalSummaryRow } from "@/modules/reports/components/GoalSummaryRow";
import { IncomeBreakdownCard } from "@/modules/reports/components/IncomeBreakdownCard";
import { IncomeExpenseTrendCard } from "@/modules/reports/components/IncomeExpenseTrendCard";
import { SmartInsightCard } from "@/modules/reports/components/SmartInsightCard";
import { SpendingPaceCard } from "@/modules/reports/components/SpendingPaceCard";
import type { CategorySlice, MonthPoint, PacePoint } from "@/modules/reports/lib/reports-stats";
import type { GoalCardData } from "@/modules/savings-goals/components/GoalCard";
import { GoalProgressOverviewCard } from "@/modules/savings-goals/components/GoalProgressOverviewCard";
import { type ContributionEntry, RecentContributionsCard } from "@/modules/savings-goals/components/RecentContributionsCard";
import { SavingsOverviewCard } from "@/modules/savings-goals/components/SavingsOverviewCard";
import type { GoalStatus } from "@/modules/savings-goals/lib/savings-stats";

type Tab = "expenses" | "income" | "savings";

type Props = {
  categories: { groupName: string; id: string; name: string }[];
  combinedIncome: number;
  dailyPoints: DayPoint[];
  dateFormat: DateFormat;
  expenseRows: ExpenseRow[];
  expenseSlices: CategorySlice[];
  goals: GoalCardData[];
  goalStatusCounts: Record<GoalStatus, number>;
  incomeSlices: OwnerSlice[];
  insightMessage: string;
  members: { id: string; name: string }[];
  monthLabel: string;
  ownerSlices: OwnerSlice[];
  pacePoints: PacePoint[];
  partnerName: null | string;
  pctOfIncome: null | number;
  realMemberId: string;
  recentContributions: ContributionEntry[];
  savingsAverageProgress: number;
  savingsMonthlyContribution: number;
  savingsPoints: { cumulative: number; label: string }[];
  savingsVsLastMonthPct: null | number;
  totalExpenses: number;
  totalPlanned: number;
  trendPoints: MonthPoint[];
};

export function ReportsTabs(props: Props) {
  const [tab, setTab] = useState<Tab>("expenses");

  return (
    <div className="space-y-4">
      <TabSwitcher
        onValueChange={(v) => setTab(v as Tab)}
        tabs={[
          { label: "Expenses", value: "expenses" },
          { label: "Income", value: "income" },
          { label: "Savings", value: "savings" },
        ]}
        value={tab}
      />

      {tab === "expenses" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <SpendingPaceCard points={props.pacePoints} totalPlanned={props.totalPlanned} />

          <div className="space-y-6 lg:col-span-2">
            <ExpenseTable
              categories={props.categories}
              dateFormat={props.dateFormat}
              members={props.members}
              partnerName={props.partnerName}
              realMemberId={props.realMemberId}
              rows={props.expenseRows}
            />
            <DailyCashFlowChart dateFormat={props.dateFormat} monthLabel={props.monthLabel} points={props.dailyPoints} />
          </div>
          <div className="space-y-6">
            <ExpenseSummaryCard pctOfIncome={props.pctOfIncome} slices={props.ownerSlices} total={props.totalExpenses} />
            <ExpenseBreakdownCard slices={props.expenseSlices} total={props.totalExpenses} />
            <SmartInsightCard message={props.insightMessage} />
          </div>
        </div>
      )}

      {tab === "income" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <IncomeExpenseTrendCard combinedIncome={props.combinedIncome} points={props.trendPoints} totalExpenses={props.totalExpenses} />
          </div>
          <div className="space-y-6">
            <IncomeBreakdownCard slices={props.incomeSlices} total={props.combinedIncome} />
            <p className="text-sm text-muted-foreground">
              Total income this month: <span className="font-medium text-foreground">{formatNPR(props.combinedIncome)}</span>.
              Manage income amounts from the Budget page.
            </p>
          </div>
        </div>
      )}

      {tab === "savings" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            {props.goals.length === 0 && <p className="text-sm text-muted-foreground">No savings goals yet.</p>}
            {props.goals.map((goal) => (
              <GoalSummaryRow goal={goal} key={goal.id} realMemberId={props.realMemberId} />
            ))}
          </div>
          <div className="space-y-6">
            <SavingsOverviewCard
              monthlyContribution={props.savingsMonthlyContribution}
              points={props.savingsPoints}
              vsLastMonthPct={props.savingsVsLastMonthPct}
            />
            <GoalProgressOverviewCard averageProgress={props.savingsAverageProgress} counts={props.goalStatusCounts} />
            <RecentContributionsCard dateFormat={props.dateFormat} items={props.recentContributions} />
          </div>
        </div>
      )}
    </div>
  );
}
