"use client";

import { useState } from "react";

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
import { PayDialog } from "@/modules/budget/components/PayDialog";
import type { ExtraIncome } from "@/modules/budget/lib/income";
import { CushionDialog } from "@/modules/cushion/components/CushionDialog";
import { SettleCard, type SettleOptions } from "@/modules/cushion/components/SettleCard";
import { RecentExpensesList } from "@/modules/expenses/components/RecentExpensesList";
import type { RecentGroup } from "@/modules/expenses/lib/recent-groups";
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

export type HomeSavingsPot = { balance: number; id: string; name: string; next: null | string; reserveFull: boolean };

export type HomeBalanceRow = { amount: number; id: string; label: string; sub: string };

export type HomeEssential = { categoryName: string; planned: number; spent: number };

// Last month's leftover, waiting to be decided on.
export type HomeSettle = SettleOptions & { amount: number; canSettle: boolean; month: number; monthLabel: string; year: number };

export type HomePacing = {
  carryIn: number;
  nextWeekAllowance: number;
  nextWeekday: null | string;
  over: boolean;
  // Set when another line went over (or money went outside a budget) and was
  // taken from the can-cut money.
  overrunNote: null | string;
  safeToday: number;
  weekLeft: number;
  weeklyAllowance: number;
};

export type HomePaybackRow = { amount: number; dateLabel: string; fromName: string; id: string; toName: string };

type Props = {
  balances: HomeBalanceRow[];
  currentMemberId: string;
  // The viewer's cushion; canEdit only when it's the person signed in.
  cushion: { balance: number; canEdit: boolean; target: null | number };
  daysLeft: number;
  // The essential lines of the person viewing Home.
  essentials: HomeEssential[];
  // The figures of the person viewing Home.
  ledger: {
    moved: { dhuku: number; funds: number; loans: number; savings: number; total: number };
    paidFromFunds: number;
    paidFromSavings: number;
    pay: number;
    payNote: null | string;
    spent: number;
    spentMeterRatio: number;
    spentPctOfPay: null | number;
    spentTrendPct: null | number;
    unallocated: number;
  };
  members: { id: string; name: string }[];
  month: number;
  monthNav: MonthNavModel;
  owners: HomeOwnerRow[];
  pacing: HomePacing | null;
  // The pay of the person viewing Home, for the Pay & extra dialog.
  pay: { amount: number; carriedFrom: null | string; extras: ExtraIncome[] };
  payback: null | PaybackBalance;
  prevMonthName: string;
  recent: RecentGroup[];
  recentPaybacks: HomePaybackRow[];
  savings: HomeSavingsPot[];
  settle: HomeSettle | null;
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
  const [cushionOpen, setCushionOpen] = useState(false);
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

      {props.settle && <SettleCard {...props.settle} />}

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
                  : "Spend up to this today on things you can cut and the week stays on plan. Anything you don't use carries into tomorrow."}
              </p>
              {pacing.overrunNote && <p className="max-w-[52ch] text-[13px] leading-normal text-signal-ink text-pretty">{pacing.overrunNote}</p>}
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
                    "Your can-cut lines (things like lunches out, shopping and dates) are split into weekly allowances. Safe to spend is what's left of this week's allowance, divided by the days remaining in the week. Money you don't spend becomes next week's buffer. When another line goes over, or money goes outside a budget, the difference comes out of what's left for the rest of the month."
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
              body="Mark lines like lunch, shopping or dates as Can cut on Budget, and this works out how much you can safely spend on them each day."
              title="No can-cut budget yet"
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
          bar={<Meter label={`Spent ${ledger.spentPctOfPay ?? 0}% of pay`} ratio={ledger.spentMeterRatio} />}
          label={`Spent in ${props.spentMonthName}`}
          lead
          note={
            <>
              {ledger.spentPctOfPay !== null && (
                <span className={ledger.spentPctOfPay > 100 ? "text-signal-ink" : undefined}>{ledger.spentPctOfPay}% of pay</span>
              )}
              {spentTrend && <span>{spentTrend}</span>}
              {ledger.paidFromSavings > 0 && <span>{formatMoney(ledger.paidFromSavings)} paid from savings</span>}
              {ledger.paidFromFunds > 0 && <span>{formatMoney(ledger.paidFromFunds)} paid from funds</span>}
            </>
          }
        >
          <Money size="lead" value={ledger.spent} />
        </LedgerCell>
        <LedgerCell label="Pay" note={ledger.payNote} onSelect={() => setIncomeOpen(true)}>
          <Money size="cell" value={ledger.pay} />
        </LedgerCell>
        <LedgerCell
          label="Moved this month"
          note={
            ledger.moved.total > 0
              ? `Savings ${formatMoney(ledger.moved.savings)} · Dhuku ${formatMoney(ledger.moved.dhuku)} · Loans ${formatMoney(ledger.moved.loans)} · Funds ${formatMoney(ledger.moved.funds)}`
              : "Nothing moved yet"
          }
        >
          <Money size="cell" value={ledger.moved.total} />
        </LedgerCell>
        <LedgerCell label="Unallocated" note={ledger.unallocated < 0 ? "Spent and moved more than pay and extra" : "Ready to assign"}>
          <Money size="cell" tone={ledger.unallocated < 0 ? "negative" : "default"} value={ledger.unallocated} />
        </LedgerCell>
      </Ledger>

      {props.essentials.length > 0 && (
        <section className="mt-9 max-w-160">
          <SectionHeading sub="Can't really be cut, so watch they stay within plan">Essentials</SectionHeading>
          {props.essentials.map((row) => {
            const over = row.spent - row.planned;
            return (
              <div className="flex items-baseline justify-between gap-4 border-b border-n-300 py-3" key={row.categoryName}>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[15px]">{row.categoryName}</span>
                  <span className="text-[13px] text-n-600">
                    {formatMoney(row.spent)} of {formatMoney(row.planned)}
                  </span>
                </span>
                <span className={cn("text-[13px] font-semibold", over > 0 ? "text-signal-ink" : "text-n-700")}>
                  {over > 0 ? `${formatMoney(over)} over` : `${formatMoney(-over)} left`}
                </span>
              </div>
            );
          })}
        </section>
      )}

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

      <section className="mt-13 max-w-160">
        <SectionHeading sub="Where your money stands, apart from this month's spending">Balances</SectionHeading>
        <div className="flex items-baseline justify-between gap-4 border-b border-n-300 py-3">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[15px]">Cushion</span>
            <span className="text-[13px] text-n-600">
              {props.cushion.target === null ? "Money beyond this month's plan" : `Aiming for ${formatMoney(props.cushion.target)}`}
            </span>
          </span>
          <span className="flex items-baseline gap-3">
            {props.cushion.canEdit && (
              <Button className="h-auto px-1.5 py-0.5 text-[13px]" onClick={() => setCushionOpen(true)} type="button" variant="ghost">
                Change
              </Button>
            )}
            <span className={cn("text-[15px] font-semibold", props.cushion.balance < 0 && "text-signal-ink")}>
              <Money tone={props.cushion.balance < 0 ? "negative" : "default"} value={props.cushion.balance} />
            </span>
          </span>
        </div>
        {props.balances.map((row) => (
            <div className="flex items-baseline justify-between gap-4 border-b border-n-300 py-3" key={row.id}>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[15px]">{row.label}</span>
                <span className="text-[13px] text-n-600">{row.sub}</span>
              </span>
              <span className={cn("text-[15px] font-semibold", row.amount < 0 && "text-signal-ink")}>
                <Money tone={row.amount < 0 ? "negative" : "default"} value={row.amount} />
              </span>
            </div>
          ))}
      </section>

      <div className="mt-13 grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-12">
        <section className="min-w-0">
          <SectionHeading aside={<ArrowLink href="/expenses">All expenses</ArrowLink>}>Recent expenses</SectionHeading>
          {props.recent.length === 0 ? (
            <EmptyState body="Expenses you record will show up here." title="No expenses yet" />
          ) : (
            <RecentExpensesList groups={props.recent} rowHref="/expenses" />
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

      <PayDialog
        extras={props.pay.extras}
        memberId={props.currentMemberId}
        month={props.month}
        monthLabel={props.monthNav.label}
        onOpenChange={setIncomeOpen}
        open={incomeOpen}
        pay={props.pay.amount}
        payCarriedFrom={props.pay.carriedFrom}
        title="Pay & extra"
        year={props.year}
      />

      <CushionDialog balance={props.cushion.balance} onOpenChange={setCushionOpen} open={cushionOpen} target={props.cushion.target} />

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
