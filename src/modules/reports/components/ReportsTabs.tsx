"use client";

import { useState } from "react";

import { TabSwitcher } from "@/components/TabSwitcher";
import type { DateFormat } from "@/lib/date-format-cookie";
import { DailyCashFlowChart } from "@/modules/dashboard/components/DailyCashFlowChart";
import type { DayPoint } from "@/modules/dashboard/lib/cash-flow";
import { formatNPR } from "@/modules/dashboard/lib/format";
import { ExpenseSummaryCard } from "@/modules/expenses/components/ExpenseSummaryCard";
import type { OwnerSlice } from "@/modules/expenses/lib/expense-breakdown";
import { BudgetVsActualCard } from "@/modules/reports/components/BudgetVsActualCard";
import { CategoryChangesCard } from "@/modules/reports/components/CategoryChangesCard";
import { ExpenseBreakdownCard } from "@/modules/reports/components/ExpenseBreakdownCard";
import { GoalSummaryRow } from "@/modules/reports/components/GoalSummaryRow";
import { IncomeBreakdownCard } from "@/modules/reports/components/IncomeBreakdownCard";
import { IncomeExpenseTrendCard } from "@/modules/reports/components/IncomeExpenseTrendCard";
import { SmartInsightCard } from "@/modules/reports/components/SmartInsightCard";
import { SpendingPaceCard } from "@/modules/reports/components/SpendingPaceCard";
import { type TopExpense, TopExpensesCard } from "@/modules/reports/components/TopExpensesCard";
import type { BudgetLine, CategoryChange, CategorySlice, MonthPoint, PacePoint } from "@/modules/reports/lib/reports-stats";
import type { GoalCardData } from "@/modules/savings-goals/components/GoalCard";
import { GoalProgressOverviewCard } from "@/modules/savings-goals/components/GoalProgressOverviewCard";
import { type ContributionEntry, RecentContributionsCard } from "@/modules/savings-goals/components/RecentContributionsCard";
import { SavingsOverviewCard } from "@/modules/savings-goals/components/SavingsOverviewCard";
import type { GoalStatus } from "@/modules/savings-goals/lib/savings-stats";

type Tab = "expenses" | "income" | "savings";

type Props = {
  budgetHref: string;
  budgetLines: BudgetLine[];
  categoryChanges: CategoryChange[];
  combinedIncome: number;
  dailyPoints: DayPoint[];
  dateFormat: DateFormat;
  expenseSlices: CategorySlice[];
  goals: GoalCardData[];
  goalStatusCounts: Record<GoalStatus, number>;
  incomeSlices: OwnerSlice[];
  insightMessage: string;
  largestExpenses: TopExpense[];
  monthLabel: string;
  ownerSlices: OwnerSlice[];
  pacePoints: PacePoint[];
  pctOfIncome: null | number;
  previousLabel: string;
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
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          <div className="lg:col-span-3">
            <SmartInsightCard message={props.insightMessage} />
          </div>

          <div className="lg:col-span-2">
            <BudgetVsActualCard budgetHref={props.budgetHref} lines={props.budgetLines} />
          </div>
          <ExpenseSummaryCard pctOfIncome={props.pctOfIncome} slices={props.ownerSlices} total={props.totalExpenses} />

          {/* Full width on large screens (the card sets its own col-span). */}
          <SpendingPaceCard points={props.pacePoints} totalPlanned={props.totalPlanned} />

          <div className="lg:col-span-2">
            <DailyCashFlowChart dateFormat={props.dateFormat} monthLabel={props.monthLabel} points={props.dailyPoints} />
          </div>
          <CategoryChangesCard changes={props.categoryChanges} previousLabel={props.previousLabel} />

          <div className="lg:col-span-2">
            <ExpenseBreakdownCard slices={props.expenseSlices} total={props.totalExpenses} />
          </div>
          <TopExpensesCard dateFormat={props.dateFormat} expenses={props.largestExpenses} />
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
