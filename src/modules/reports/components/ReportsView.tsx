"use client";

import { useState } from "react";

import { Download } from "lucide-react";
import Link from "next/link";

import { ArrowLink } from "@/components/ArrowLink";
import { Ledger, LedgerCell } from "@/components/Ledger";
import { LineTabs } from "@/components/LineTabs";
import { Meter } from "@/components/Meter";
import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { SectionHeading } from "@/components/SectionHeading";
import { Button } from "@/components/ui/button";
import { downloadExpensesCsv, type ExpenseExportRow } from "@/lib/csv-export";
import { formatMoney } from "@/lib/money";
import type { MonthNavModel } from "@/lib/month-nav";
import { cn } from "@/lib/utils";
import type { BudgetLine, CategoryChange, CategorySlice, PacePoint } from "@/modules/reports/lib/reports-stats";
import type { ExpenseLead } from "@/modules/reports/lib/reports-view";

type OwnerSlice = { amount: number; key: "me" | "partner" | "shared"; label: string; pct: number };
type ChangeRow = CategoryChange;
type LargestRow = { amount: number; categoryName: string; dateLabel: string; id: string; name: string };
type MonthRow = { income: number; label: string; left: number; spent: number };
type GoalRow = { id: string; name: string; pct: number; saved: number; target: null | number };
type ContributionRow = { amount: number; dateLabel: string; goalName: string; id: string };

type PaceData = {
  annotation: null | { amount: number; day: number; label: string };
  daily: number[];
  daysInPeriod: number;
  points: PacePoint[];
  todayDay: null | number;
  totalPlanned: number;
};

type Props = {
  budgetHref: string;
  expenses: {
    budgetLines: BudgetLine[];
    changes: ChangeRow[];
    largest: LargestRow[];
    lead: ExpenseLead;
    ownerSlices: OwnerSlice[];
    pace: PaceData;
    slices: CategorySlice[];
    spent: number;
    spentPctOfIncome: null | number;
    spentTrendPct: null | number;
    unbudgeted: null | { count: number; names: string[] };
  };
  exportRows: ExpenseExportRow[];
  income: {
    members: { amount: number; key: "me" | "partner"; label: string; trendPct: null | number }[];
    months: MonthRow[];
    overspend: number;
    spentPct: null | number;
    total: number;
    trendPct: null | number;
  };
  monthLabel: string;
  monthNav: MonthNavModel;
  prevMonthName: string;
  savings: {
    averageProgress: number;
    contributions: ContributionRow[];
    goalCount: number;
    goals: GoalRow[];
    monthlyContribution: number;
    totalSaved: number;
  };
};

type Tab = "Expenses" | "Income" | "Savings";

const SHADE = ["bg-ink", "bg-n-700", "bg-n-600", "bg-n-500", "bg-n-400", "bg-n-300"];
const DAY_NUMBERS = [1, 5, 10, 15, 20, 25];

function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(value));
  const n = value / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return nice * pow;
}

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export function ReportsView(props: Props) {
  const [tab, setTab] = useState<Tab>("Expenses");

  return (
    <div>
      <PageHeader
        actions={
          <Button onClick={() => downloadExpensesCsv(props.exportRows, props.monthLabel)} variant="secondary">
            <Download />
            Export
          </Button>
        }
        meta={`Compared with ${props.prevMonthName}`}
        monthNav={props.monthNav}
        title="Reports"
      />

      <LineTabs
        className="mb-7"
        label="Report"
        onChange={(value) => setTab(value)}
        tabs={[
          { label: "Expenses", value: "Expenses" },
          { label: "Income", value: "Income" },
          { label: "Savings", value: "Savings" },
        ]}
        value={tab}
      />

      {tab === "Expenses" && <ExpensesReport {...props.expenses} budgetHref={props.budgetHref} monthLabel={props.monthLabel} prevMonthName={props.prevMonthName} />}
      {tab === "Income" && <IncomeReport {...props.income} monthLabel={props.monthLabel} />}
      {tab === "Savings" && <SavingsReport {...props.savings} />}
    </div>
  );
}

function ExpensesReport({
  budgetLines,
  budgetHref,
  changes,
  largest,
  lead,
  monthLabel,
  ownerSlices,
  pace,
  prevMonthName,
  slices,
  spent,
  spentPctOfIncome,
  spentTrendPct,
  unbudgeted,
}: Props["expenses"] & { budgetHref: string; monthLabel: string; prevMonthName: string }) {
  const topBudget = budgetLines.slice(0, 4);
  const rest = slices.slice(5);
  const restAmount = rest.reduce((sum, s) => sum + s.amount, 0);
  const changeMax = Math.max(1, ...changes.map((c) => Math.abs(c.delta)));

  return (
    <>
      <p className="mb-7 max-w-[62ch] text-xl leading-[1.45] tracking-[-0.005em] text-n-800 text-pretty">
        {lead.overall} <strong className="text-ink">{lead.exceptionStrong}</strong>
        {lead.exceptionRest}
      </p>

      <Ledger>
        <LedgerCell
          bar={
            <Meter
              segments={ownerSlices.map((s) => ({ tone: s.key === "me" ? "ink" : s.key === "partner" ? "partner" : "shared", value: s.amount }))}
            />
          }
          label={`Spent in ${monthLabel.split(" ")[0]}`}
          lead
          note={
            <>
              {spentPctOfIncome !== null && (
                <span className={spentPctOfIncome > 100 ? "text-signal-ink" : undefined}>{spentPctOfIncome}% of income</span>
              )}
              {spentTrendPct !== null && <span className="text-n-700">{spentTrendPct === 0 ? `About the same as ${prevMonthName}` : `${Math.abs(spentTrendPct)}% ${spentTrendPct > 0 ? "more" : "less"} than ${prevMonthName}`}</span>}
            </>
          }
        >
          <Money size="lead" value={spent} />
        </LedgerCell>
        {ownerSlices.map((slice) => (
          <LedgerCell
            key={slice.key}
            label={
              <>
                <span aria-hidden className={cn("size-2", slice.key === "me" ? "bg-ink" : slice.key === "partner" ? "bg-n-600" : "bg-n-300")} />
                {slice.label}
              </>
            }
            note={`${slice.pct}% of total`}
          >
            <Money size="cell" value={slice.amount} />
          </LedgerCell>
        ))}
      </Ledger>

      <SpendingPace pace={pace} />

      <div className="mt-14 grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-x-14 gap-y-13">
        <section className="min-w-0">
          <SectionHeading aside={<ArrowLink href={budgetHref}>Budget</ArrowLink>}>Budget vs actual</SectionHeading>
          {topBudget.map((line) => {
            const over = line.spent - line.planned;
            const ratio = line.planned > 0 ? line.spent / line.planned : line.spent > 0 ? Number.POSITIVE_INFINITY : 0;
            return (
              <div className="flex flex-col gap-2 border-b border-n-300 py-3.5" key={line.categoryId}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="text-[15px]">{line.name}</span>
                    <span className="text-xs text-n-600">{line.planned > 0 ? "Fixed" : "No budget"}</span>
                  </span>
                  <span className={cn("text-[13px] font-semibold whitespace-nowrap", over > 0 ? "text-signal-ink" : "text-n-700")}>
                    {over > 0 ? `Over by ${Math.round(over).toLocaleString("en-US")}` : `${Math.round(-over).toLocaleString("en-US")} left`}
                  </span>
                </div>
                <Meter ratio={ratio} />
                <span className="text-[13px] text-n-600 tabular-nums">
                  {Math.round(line.spent).toLocaleString("en-US")} of {Math.round(line.planned).toLocaleString("en-US")} · {line.planned > 0 ? percent(line.spent, line.planned) : 100}%
                </span>
              </div>
            );
          })}
          {unbudgeted && (
            <p className="mt-3.5 text-[13px] leading-[1.55] text-n-700 text-pretty">
              {unbudgeted.names.join(", ")}
              {unbudgeted.count > unbudgeted.names.length ? ` and ${unbudgeted.count - unbudgeted.names.length} more` : ""} — your biggest
              categories with no budget. <Link className="font-semibold text-signal-ink" href={budgetHref}>Set budgets</Link>
            </p>
          )}
        </section>

        <section className="min-w-0">
          <SectionHeading aside={<span>vs {prevMonthName}</span>}>Biggest changes</SectionHeading>
          {changes.map((change) => {
            const width = (Math.abs(change.delta) / changeMax) * 50;
            return (
              <div className="grid grid-cols-[minmax(0,1fr)_112px_92px] items-center gap-4 border-b border-n-300 py-3.5" key={change.categoryId}>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[15px]">{change.name}</span>
                  <span className="text-xs whitespace-nowrap text-n-600 tabular-nums">
                    {Math.round(change.previous).toLocaleString("en-US")} → {Math.round(change.current).toLocaleString("en-US")}
                  </span>
                </span>
                <span className="relative h-2.5">
                  <span className="absolute top-0 bottom-0 left-1/2 border-l border-n-400" />
                  <span
                    className={cn("absolute top-0 bottom-0", change.delta > 0 ? "left-1/2 bg-ink" : "right-1/2 bg-n-400")}
                    style={{ width: `${width}%` }}
                  />
                </span>
                <span className="flex flex-col items-end gap-0.5 tabular-nums">
                  <span className="text-sm font-semibold">{change.delta > 0 ? "+" : "−"}{Math.abs(Math.round(change.delta)).toLocaleString("en-US")}</span>
                  <span className="text-xs text-n-600">{change.pct === null ? "new" : `${change.pct > 0 ? "+" : "−"}${Math.abs(change.pct)}%`}</span>
                </span>
              </div>
            );
          })}
          <p className="mt-3.5 text-[13px] text-n-600">Ink bars spent more than last month; grey bars spent less.</p>
        </section>

        <section className="min-w-0">
          <SectionHeading aside={<span>Share of {formatMoney(spent, { currency: false })}</span>}>Where it went</SectionHeading>
          <span className="mt-4.5 mb-1.5 flex h-3.5 gap-0.5">
            {slices.slice(0, 5).map((slice, i) => (
              <span className={SHADE[i]} key={slice.categoryId} style={{ flex: `${slice.amount} 1 0` }} />
            ))}
            {restAmount > 0 && <span className={SHADE[5]} style={{ flex: `${restAmount} 1 0` }} />}
          </span>
          {slices.slice(0, 5).map((slice, i) => (
            <div className="grid grid-cols-[10px_minmax(0,1fr)_auto_40px] items-baseline gap-3 border-b border-n-300 py-2.75" key={slice.categoryId}>
              <span className={cn("size-2.5", SHADE[i])} />
              <span className="text-[15px]">{slice.name}</span>
              <span className="text-[15px] tabular-nums">{Math.round(slice.amount).toLocaleString("en-US")}</span>
              <span className="text-right text-[13px] text-n-600 tabular-nums">{percent(slice.amount, spent)}%</span>
            </div>
          ))}
          {restAmount > 0 && (
            <div className="grid grid-cols-[10px_minmax(0,1fr)_auto_40px] items-baseline gap-3 border-b border-n-300 py-2.75">
              <span className={cn("size-2.5", SHADE[5])} />
              <span className="text-[15px] text-n-700">
                {rest.length} other {rest.length === 1 ? "category" : "categories"}
              </span>
              <span className="text-[15px] tabular-nums">{Math.round(restAmount).toLocaleString("en-US")}</span>
              <span className="text-right text-[13px] text-n-600 tabular-nums">{percent(restAmount, spent)}%</span>
            </div>
          )}
        </section>

        <section className="min-w-0">
          <SectionHeading aside={<ArrowLink href="/expenses">All expenses</ArrowLink>}>Largest expenses</SectionHeading>
          {largest.map((row, index) => (
            <div className="grid grid-cols-[26px_minmax(0,1fr)_auto] items-baseline gap-3 border-b border-n-300 py-3" key={row.id}>
              <span className="text-xs font-semibold text-n-500 tabular-nums">{String(index + 1).padStart(2, "0")}</span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[15px]">{row.name}</span>
                <span className="text-xs text-n-600">{row.dateLabel} · {row.categoryName}</span>
              </span>
              <span className="text-[15px]">
                <Money value={row.amount} />
              </span>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}

function SpendingPace({ pace }: { pace: PaceData }) {
  const { points, daily, daysInPeriod, todayDay, totalPlanned, annotation } = pace;
  const finalActual = [...points].reverse().find((p) => p.actual !== null)?.actual ?? 0;
  const yMax = niceCeil(Math.max(totalPlanned, finalActual, 1));
  const grid = [0.25, 0.5, 0.75].map((f) => ({ b: f * 100, label: `${Math.round((yMax * f) / 1000)}k` }));
  const paceY2 = 100 - (totalPlanned / yMax) * 100;
  const segments: { x1: number; x2: number; y1: number; y2: number }[] = [];
  let prevCum = 0;
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    if (point.actual === null) continue;
    segments.push({ x1: (i / daysInPeriod) * 100, x2: ((i + 1) / daysInPeriod) * 100, y1: 100 - (prevCum / yMax) * 100, y2: 100 - (point.actual / yMax) * 100 });
    prevCum = point.actual;
  }
  const day = todayDay ?? daysInPeriod;
  const todayPoint = points[day - 1];
  const todayValue = todayPoint?.actual ?? 0;
  const todayMultiple = todayPoint && todayPoint.pace > 0 ? todayValue / todayPoint.pace : null;
  const maxDaily = Math.max(1, ...daily);

  return (
    <section className="mt-13">
      <div className="flex flex-wrap items-baseline justify-between gap-4 border-b-2 border-rule pb-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl leading-tight font-extrabold tracking-[-0.01em]">Spending pace</h2>
          <span className="text-[13px] text-n-600">
            Running total for the month against an even pace through your {formatMoney(totalPlanned, { currency: false })} budget
          </span>
        </div>
        <span className="flex items-center gap-4 text-xs text-n-700">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-ink" />
            Actual
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 border-t-[1.5px] border-dashed border-n-500" />
            Even pace
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2 bg-n-400" />
            Each day
          </span>
        </span>
      </div>

      <div className="relative mt-5.5 h-57.5">
        {grid.map((line) => (
          <div className="absolute right-0 left-0 border-t border-dashed border-n-300" key={line.b} style={{ bottom: `${line.b}%` }}>
            <span className="absolute right-0 bottom-1 text-[11px] text-n-500 tabular-nums">{line.label}</span>
          </div>
        ))}
        <div className="absolute right-0 bottom-0 left-0 border-t border-rule" />
        <svg className="absolute inset-0 overflow-visible" height="100%" width="100%">
          <line stroke="var(--n-500)" strokeDasharray="5 4" strokeWidth={1.5} x1="0%" x2="100%" y1="100%" y2={`${paceY2}%`} />
          {segments.map((seg, i) => (
            <line key={i} stroke="var(--ink)" strokeLinecap="square" strokeWidth={2} x1={`${seg.x1}%`} x2={`${seg.x2}%`} y1={`${seg.y1}%`} y2={`${seg.y2}%`} />
          ))}
        </svg>
        <div className="absolute top-[-8px] bottom-0 border-l border-signal" style={{ left: `${(day / daysInPeriod) * 100}%` }} />
        <div className="absolute size-2 translate-x-[-50%] translate-y-1/2 bg-ink" style={{ bottom: `${100 - (todayValue / yMax) * 100}%`, left: `${(day / daysInPeriod) * 100}%` }} />
        <div className="absolute flex translate-x-3.5 translate-y-1/2 flex-col gap-0.5 whitespace-nowrap" style={{ bottom: `${100 - (todayValue / yMax) * 100}%`, left: `${(day / daysInPeriod) * 100}%` }}>
          <span className="text-[15px] font-extrabold tabular-nums">{formatMoney(todayValue)}</span>
          <span className="text-xs text-n-700">Today{todayMultiple !== null ? ` · ${todayMultiple.toFixed(1)}× the even pace` : ""}</span>
        </div>
        {annotation && (
          <div className="absolute flex flex-col items-start gap-0.5 whitespace-nowrap" style={{ bottom: "24%", left: `calc(${(annotation.day / daysInPeriod) * 100}% + 10px)` }}>
            <span className="text-xs font-semibold">{annotation.label}</span>
            <span className="text-xs text-n-600">Rs {Math.round(annotation.amount).toLocaleString("en-US")}</span>
          </div>
        )}
      </div>

      <div className="mt-2.5 flex h-14 items-end gap-0.5 border-b border-rule">
        {Array.from({ length: daysInPeriod }, (_, i) => (
          <span
            className={cn("flex-1", i + 1 === day ? "bg-ink" : "bg-n-400")}
            key={i}
            style={{ height: `${Math.max(((daily[i] ?? 0) / maxDaily) * 100, 3)}%` }}
          />
        ))}
      </div>
      <div className="flex gap-0.5 pt-1.5">
        {Array.from({ length: daysInPeriod }, (_, i) => {
          const d = i + 1;
          const show = DAY_NUMBERS.includes(d) || d === daysInPeriod || d === day;
          return (
            <span
              className={cn(
                "flex-1 text-center text-[11px] tabular-nums",
                d === day ? "font-bold text-signal-ink" : d > day ? "text-n-400" : "text-n-600",
              )}
              key={d}
            >
              {show ? d : ""}
            </span>
          );
        })}
      </div>
    </section>
  );
}

function IncomeReport({ members, months, overspend, spentPct, total, trendPct, monthLabel }: Props["income"] & { monthLabel: string }) {
  return (
    <>
      <Ledger>
        <LedgerCell
          label={`Income in ${monthLabel.split(" ")[0]}`}
          lead
          note={trendPct === null ? "No prior month to compare" : trendPct === 0 ? "About the same as last month" : `${Math.abs(trendPct)}% ${trendPct > 0 ? "more" : "less"} than last month`}
        >
          <Money size="lead" value={total} />
        </LedgerCell>
        {members.map((member) => (
          <LedgerCell key={member.key} label={member.label} note={member.trendPct === null ? "—" : `${Math.abs(member.trendPct)}% ${member.trendPct > 0 ? "more" : "less"} than last month`}>
            <Money size="cell" value={member.amount} />
          </LedgerCell>
        ))}
        <LedgerCell label="Spent of income" note={spentPct !== null && spentPct > 100 ? `${formatMoney(overspend)} more than earned` : "Within income"}>
          <span className={cn("text-2xl leading-none font-semibold tabular-nums", spentPct !== null && spentPct > 100 && "text-signal-ink")}>
            {spentPct ?? 0}%
          </span>
        </LedgerCell>
      </Ledger>

      <section className="mt-13">
        <SectionHeading>Last 6 months</SectionHeading>
        {months.map((row) => (
          <div className="grid grid-cols-[minmax(80px,1fr)_repeat(3,minmax(0,1fr))] items-center gap-4 border-b border-n-300 px-2 py-3.5" key={row.label}>
            <span className="text-sm font-semibold">{row.label}</span>
            <span className="text-right text-[15px]">
              <Money value={row.income} />
            </span>
            <span className="text-right text-[15px]">
              <Money value={row.spent} />
            </span>
            <span className={cn("text-right text-[15px] font-semibold", row.left < 0 && "text-signal-ink")}>
              <Money tone={row.left < 0 ? "negative" : "default"} value={row.left} />
            </span>
          </div>
        ))}
      </section>
    </>
  );
}

function SavingsReport({ averageProgress, contributions, goalCount, goals, monthlyContribution, totalSaved }: Props["savings"]) {
  if (contributions.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 border-t-2 border-ink pt-6">
        <h2 className="text-[28px] leading-[1.1] font-extrabold tracking-[-0.02em]">No savings recorded this month.</h2>
        <p className="max-w-[52ch] text-[15px] leading-[1.55] text-n-800 text-pretty">
          Once money goes toward a savings goal, this report shows how much you set aside each month and how close each goal is.
        </p>
        <Button asChild className="mt-1.5" variant="secondary">
          <Link href="/savings-goals">Go to Savings goals</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <Ledger>
        <LedgerCell label="Saved this month" lead note={`Across ${goalCount} ${goalCount === 1 ? "goal" : "goals"}`}>
          <Money size="lead" value={monthlyContribution} />
        </LedgerCell>
        <LedgerCell label="Saved all-time" note="Every contribution">
          <Money size="cell" value={totalSaved} />
        </LedgerCell>
        <LedgerCell label="Goals" note="All active">
          <span className="text-2xl leading-none font-semibold tabular-nums">{goalCount}</span>
        </LedgerCell>
        <LedgerCell label="Average progress" note="Toward each target">
          <span className="text-2xl leading-none font-semibold tabular-nums">{averageProgress}%</span>
        </LedgerCell>
      </Ledger>

      <div className="mt-13 grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-x-14 gap-y-13">
        <section className="min-w-0">
          <SectionHeading>Goal progress</SectionHeading>
          {goals.map((goal) => (
            <div className="flex flex-col gap-2 border-b border-n-300 py-3.5" key={goal.id}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[15px]">{goal.name}</span>
                <span className="text-[13px] text-n-600">
                  {goal.target !== null ? `${Math.round(goal.saved).toLocaleString("en-US")} of ${Math.round(goal.target).toLocaleString("en-US")}` : "Ongoing"}
                </span>
              </div>
              {goal.target !== null && <Meter ratio={goal.pct / 100} />}
            </div>
          ))}
        </section>
        <section className="min-w-0">
          <SectionHeading>This month&apos;s contributions</SectionHeading>
          {contributions.map((contribution) => (
            <div className="grid grid-cols-[90px_minmax(0,1fr)_auto] items-baseline gap-4 border-b border-n-300 py-2.75" key={contribution.id}>
              <span className="text-[13px] text-n-600">{contribution.dateLabel}</span>
              <span className="truncate text-[15px]">{contribution.goalName}</span>
              <span className="text-[15px] font-semibold tabular-nums">+{Math.round(contribution.amount).toLocaleString("en-US")}</span>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
