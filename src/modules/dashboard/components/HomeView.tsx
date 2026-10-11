"use client";

import { Fragment, useState } from "react";

import { ArrowUpRight, ChevronDown, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ArrowLink } from "@/components/ArrowLink";
import { EmptyState } from "@/components/EmptyState";
import { Ledger, LedgerCell } from "@/components/Ledger";
import { Meter } from "@/components/Meter";
import { Money } from "@/components/Money";
import { Monogram, type MonogramPerson } from "@/components/Monogram";
import { PageHeader } from "@/components/PageHeader";
import { Row, type RowColumns, RowsHeader } from "@/components/Rows";
import { SectionHeading } from "@/components/SectionHeading";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import type { MonthNavModel } from "@/lib/month-nav";
import { cn } from "@/lib/utils";
import { SetIncomeDialog } from "@/modules/budget/components/SetIncomeDialog";
import { CategoryIcon } from "@/modules/categories/components/CategoryIcon";
import { deletePaybackAction } from "@/modules/paybacks/api/paybacks.actions";
import { PaybackDialog } from "@/modules/paybacks/components/PaybackDialog";
import type { PaybackBalance } from "@/modules/paybacks/lib/payback-balance";

export type HomeOwnerRow = {
  income: null | number;
  incomeTrendPct: null | number;
  incomeUsedPct: null | number;
  incomeUsedRatio: null | number;
  key: "me" | "partner" | "shared";
  label: string;
  left: null | number;
  leftNote: null | string;
  monogram: MonogramPerson[];
  spent: number;
};

export type HomeRecentRow = {
  amount: number;
  categoryGroupName: string;
  categoryIcon: null | string;
  categoryName: string;
  id: string;
  note: null | string;
};

export type HomeRecentGroup = { key: string; label: string; rows: HomeRecentRow[]; sub: string; total: number };

export type HomeSavingsPot = { balance: number; id: string; name: string; next: null | string; reserveFull: boolean };

export type HomePacing = {
  carryIn: number;
  nextWeekAllowance: number;
  nextWeekday: null | string;
  over: boolean;
  safeToday: number;
  weekLeft: number;
  weeklyAllowance: number;
};

export type HomePaybackRow = { amount: number; dateLabel: string; fromName: string; id: string; toName: string };

type Props = {
  currentMemberId: string;
  daysLeft: number;
  incomes: Record<string, number>;
  ledger: {
    income: number;
    incomeTrendPct: null | number;
    paidFromSavings: number;
    saved: number;
    savedNote: string;
    spent: number;
    spentMeterRatio: number;
    spentPctOfIncome: null | number;
    spentTrendPct: null | number;
    unallocated: number;
  };
  members: { id: string; name: string }[];
  month: number;
  monthNav: MonthNavModel;
  owners: HomeOwnerRow[];
  pacing: HomePacing | null;
  payback: null | PaybackBalance;
  prevMonthName: string;
  recent: HomeRecentGroup[];
  recentPaybacks: HomePaybackRow[];
  savings: HomeSavingsPot[];
  spentMonthName: string;
  year: number;
};

const PEOPLE_COLUMNS: RowColumns = {
  lg: "minmax(140px,1.2fr) repeat(3,minmax(0,1fr)) minmax(150px,1.3fr)",
  md: "minmax(110px,1fr) repeat(3,minmax(0,1fr)) minmax(120px,1.2fr)",
  sm: "minmax(84px,1fr) repeat(3,minmax(0,0.85fr)) minmax(84px,1fr)",
};

function trendText(pct: null | number, prevMonthName: string): null | string {
  if (pct === null) return null;
  if (pct === 0) return `About the same as ${prevMonthName}`;
  return pct > 0 ? `${pct}% more than ${prevMonthName}` : `${Math.abs(pct)}% less than ${prevMonthName}`;
}

export function HomeView(props: Props) {
  const { ledger, pacing } = props;
  const [explain, setExplain] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [paybackOpen, setPaybackOpen] = useState(false);
  const router = useRouter();
  const nameOf = (id: string) => props.members.find((m) => m.id === id)?.name ?? "Partner";

  async function removePayback(id: string) {
    try {
      await deletePaybackAction(id);
      toast.success("Payback deleted");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  const spentTrend = trendText(ledger.spentTrendPct, props.prevMonthName);
  const incomeTrend = trendText(ledger.incomeTrendPct, props.prevMonthName);

  return (
    <div>
      <PageHeader
        actions={
          <Button asChild variant="ghost">
            <Link href="/reports">
              Full report
              <ArrowUpRight />
            </Link>
          </Button>
        }
        meta={`${props.daysLeft} ${props.daysLeft === 1 ? "day" : "days"} left in the month`}
        monthNav={props.monthNav}
        title="Home"
      />

      <section className="grid grid-cols-1 gap-x-14 gap-y-5 border-t-2 border-ink pt-5 pb-2 @min-[780px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-2.5">
          {pacing ? (
            <>
              <div className="flex flex-wrap items-center gap-3.5">
                <span className="micro-label text-n-600">Safe to spend today</span>
                {pacing.over ? (
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-signal-ink">
                    <span className="size-1.5 bg-signal" />
                    Over budget
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                    <span className="size-1.5 bg-ink" />
                    On track
                  </span>
                )}
              </div>
              <Money size="hero" value={pacing.safeToday} />
              <p className="max-w-[46ch] text-[15px] leading-normal text-n-800 text-pretty">
                {pacing.over
                  ? `This week's allowance is fully spent. A new weekly allowance of ${formatMoney(pacing.nextWeekAllowance)} starts on ${pacing.nextWeekday ?? "the next week"}.`
                  : "Spend up to this today and the week stays on plan. Anything you don't use carries into tomorrow."}
              </p>
              <button
                className="-ml-1.5 inline-flex items-center gap-1.5 self-start px-1.5 py-1 text-[13px] text-n-700 hover:bg-ink/6 hover:text-ink"
                onClick={() => setExplain((value) => !value)}
                type="button"
              >
                {explain ? "Hide explanation" : "How is this worked out?"}
                <ChevronDown aria-hidden className={cn("size-3.25 transition-transform", explain && "rotate-180")} />
              </button>
              {explain && (
                <p className="max-w-[52ch] text-[13px] leading-[1.55] text-n-700 text-pretty">
                  {
                    "Your monthly plan is split into weekly allowances. Safe to spend is what's left of this week's allowance, divided by the days remaining in the week. Money you don't spend becomes next week's buffer."
                  }
                </p>
              )}
            </>
          ) : (
            <EmptyState
              action={
                <Button asChild variant="outline">
                  <Link href="/budget">Go to Budget</Link>
                </Button>
              }
              body="Once you set a flexible budget, this page works out how much you can safely spend each day of the week."
              title="No flexible budget yet"
            />
          )}
        </div>

        {pacing && (
          <dl className="flex min-w-0 flex-col self-end">
            <div className="flex items-baseline justify-between gap-4 border-b border-n-300 py-3">
              <dt className="text-sm text-n-700">This week left</dt>
              <dd className="text-[17px] font-semibold">
                <Money value={pacing.weekLeft} />
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-b border-n-300 py-3">
              <dt className="text-sm text-n-700">Weekly allowance</dt>
              <dd className="text-[17px] font-semibold">
                <Money value={pacing.weeklyAllowance} />
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-sm text-n-700">Buffer from last week</dt>
              <dd className="text-[17px] font-semibold">
                <Money value={pacing.carryIn} />
              </dd>
            </div>
          </dl>
        )}
      </section>

      <Ledger className="mt-9">
        <LedgerCell
          bar={<Meter label={`Spent ${ledger.spentPctOfIncome ?? 0}% of income`} ratio={ledger.spentMeterRatio} />}
          label={`Spent in ${props.spentMonthName}`}
          lead
          note={
            <>
              {ledger.spentPctOfIncome !== null && (
                <span className={ledger.spentPctOfIncome > 100 ? "text-signal-ink" : undefined}>
                  {ledger.spentPctOfIncome}% of income
                </span>
              )}
              {spentTrend && <span>{spentTrend}</span>}
              {ledger.paidFromSavings > 0 && <span>{formatMoney(ledger.paidFromSavings)} paid from savings</span>}
            </>
          }
        >
          <Money size="lead" value={ledger.spent} />
        </LedgerCell>
        <LedgerCell label="Income" note={incomeTrend} onSelect={() => setIncomeOpen(true)}>
          <Money size="cell" value={ledger.income} />
        </LedgerCell>
        <LedgerCell label="Saved" note={ledger.savedNote}>
          <Money size="cell" value={ledger.saved} />
        </LedgerCell>
        <LedgerCell label="Unallocated" note={ledger.unallocated < 0 ? "Spending is above income" : "Ready to assign"}>
          <Money size="cell" tone={ledger.unallocated < 0 ? "negative" : "default"} value={ledger.unallocated} />
        </LedgerCell>
      </Ledger>

      {props.members.length === 2 && (props.payback !== null || props.recentPaybacks.length > 0) && (
        <section className="mt-9 border-t border-n-300 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[15px]">
              {props.payback === null ? (
                "You're square. Nobody owes anything."
              ) : props.payback.debtorId === props.currentMemberId ? (
                <>
                  You owe {nameOf(props.payback.creditorId)} <strong className="font-semibold">{formatMoney(props.payback.amount)}</strong>
                </>
              ) : (
                <>
                  {nameOf(props.payback.debtorId)} owes you <strong className="font-semibold">{formatMoney(props.payback.amount)}</strong>
                </>
              )}
            </p>
            {props.payback !== null && (
              <Button className="h-9.5" onClick={() => setPaybackOpen(true)} type="button" variant="outline">
                Record a payback
              </Button>
            )}
          </div>
          {props.recentPaybacks.length > 0 && (
            <div className="mt-3 flex flex-col">
              {props.recentPaybacks.map((row) => (
                <div
                  className="grid grid-cols-[90px_minmax(0,1fr)_auto_auto] items-center gap-4 border-b border-n-200 py-1.5 last:border-0"
                  key={row.id}
                >
                  <span className="text-[13px] text-n-600">{row.dateLabel}</span>
                  <span className="truncate text-sm">
                    {row.fromName} paid back {row.toName}
                  </span>
                  <span className="text-sm font-semibold">
                    <Money value={row.amount} />
                  </span>
                  <Button
                    className="h-auto px-1.5 py-0.5 text-[13px]"
                    onClick={() => void removePayback(row.id)}
                    type="button"
                    variant="ghost"
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="mt-13">
        <div className="mb-3.5 flex items-baseline justify-between gap-4">
          <h2 className="text-xl leading-tight font-extrabold tracking-[-0.01em]">By person</h2>
          <span className="text-[13px] text-n-600">Spent is what came out of each person&apos;s own money</span>
        </div>
        <RowsHeader columns={PEOPLE_COLUMNS}>
          <span>Person</span>
          <span className="text-right">Income</span>
          <span className="text-right">Spent</span>
          <span className="text-right">Left</span>
          <span>Income used</span>
        </RowsHeader>
        {props.owners.map((owner) => {
          const ownerIncomeTrend = trendText(owner.incomeTrendPct, props.prevMonthName);
          return (
            <Row columns={PEOPLE_COLUMNS} key={owner.key}>
              <div className="flex min-w-0 items-center gap-2.5">
                <Monogram people={owner.monogram} />
                <span className="text-[15px] font-semibold">{owner.label}</span>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                {owner.income === null ? (
                  <span className="text-[15px] text-n-500">—</span>
                ) : (
                  <>
                    <span className="text-[15px] font-semibold">
                      <Money value={owner.income} />
                    </span>
                    {ownerIncomeTrend && <span className="text-xs whitespace-nowrap text-n-600">{ownerIncomeTrend}</span>}
                  </>
                )}
              </div>
              <div className="text-right text-[15px] font-semibold">
                <Money value={owner.spent} />
              </div>
              <div className="flex flex-col items-end gap-0.5">
                {owner.left === null ? (
                  <span className="text-[15px] text-n-500">—</span>
                ) : (
                  <>
                    <span className={cn("text-[15px] font-semibold", owner.left < 0 && "text-signal-ink")}>
                      <Money tone={owner.left < 0 ? "negative" : "default"} value={owner.left} />
                    </span>
                    {owner.leftNote && <span className="text-xs whitespace-nowrap text-n-600">{owner.leftNote}</span>}
                  </>
                )}
              </div>
              <div className="flex min-w-0 items-center gap-2.5">
                {owner.key === "shared" ? (
                  <span className="text-[13px] text-n-600">Already counted under whoever paid</span>
                ) : (
                  <>
                    <Meter className="flex-1" ratio={owner.incomeUsedRatio ?? 0} />
                    <span
                      className={cn(
                        "w-10 text-right text-[13px] font-semibold",
                        (owner.incomeUsedPct ?? 0) > 100 && "text-signal-ink",
                      )}
                    >
                      {owner.incomeUsedPct ?? 0}%
                    </span>
                  </>
                )}
              </div>
            </Row>
          );
        })}
      </section>

      <div className="mt-13 grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-12">
        <section className="min-w-0">
          <SectionHeading aside={<ArrowLink href="/expenses">All expenses</ArrowLink>}>Recent expenses</SectionHeading>
          {props.recent.length === 0 ? (
            <EmptyState body="Expenses you record will show up here." title="No expenses yet" />
          ) : (
            props.recent.map((group) => (
              <Fragment key={group.key}>
                <div className="flex items-baseline justify-between border-b border-rule pt-3.5 pb-2">
                  <span className="flex items-baseline gap-2.5">
                    <span className="text-sm font-semibold">{group.label}</span>
                    <span className="text-[13px] text-n-600">{group.sub}</span>
                  </span>
                  <span className="text-sm font-semibold">
                    <Money value={group.total} />
                  </span>
                </div>
                {group.rows.map((row) => (
                  <Link
                    className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3.5 border-b border-n-300 py-2.5 text-ink no-underline hover:bg-ink/4"
                    href="/expenses"
                    key={row.id}
                  >
                    <CategoryIcon groupName={row.categoryGroupName} icon={row.categoryIcon} name={row.categoryName} />
                    <span className="flex min-w-0 items-baseline gap-2.5">
                      <span className="text-[15px]">{row.categoryName}</span>
                      {row.note && <span className="truncate text-[13px] text-n-600">{row.note}</span>}
                    </span>
                    <span className="text-[15px]">
                      <Money value={row.amount} />
                    </span>
                  </Link>
                ))}
              </Fragment>
            ))
          )}
        </section>

        <section className="min-w-0">
          <SectionHeading aside={<ArrowLink href="/savings">All savings</ArrowLink>}>Savings</SectionHeading>
          {props.savings.length === 0 ? (
            <EmptyState
              action={
                <Button asChild variant="outline">
                  <Link href="/savings">
                    <Plus />
                    Set up savings
                  </Link>
                </Button>
              }
              body="Set up a pot for your savings account and list what you're saving for. Piko shows when each one becomes affordable."
              title="No savings set up yet"
            />
          ) : (
            <div className="flex flex-col">
              {props.savings.map((pot) => (
                <div className="flex flex-col gap-1 border-b border-n-300 py-4" key={pot.id}>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-[15px] font-semibold">{pot.name}</span>
                    <span className="text-[15px] font-semibold">
                      <Money value={pot.balance} />
                    </span>
                  </div>
                  <span className="text-[13px] text-n-600">
                    {pot.reserveFull ? "Reserve full" : "Filling the reserve first"}
                    {pot.next ? ` · ${pot.next}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <SetIncomeDialog
        currentMemberId={props.currentMemberId}
        incomes={props.incomes}
        members={props.members}
        month={props.month}
        monthLabel={props.monthNav.label}
        onOpenChange={setIncomeOpen}
        open={incomeOpen}
        year={props.year}
      />

      <PaybackDialog
        currentMemberId={props.currentMemberId}
        defaults={props.payback ? { amount: props.payback.amount, fromMemberId: props.payback.debtorId } : null}
        members={props.members}
        onOpenChange={setPaybackOpen}
        open={paybackOpen}
      />
    </div>
  );
}
