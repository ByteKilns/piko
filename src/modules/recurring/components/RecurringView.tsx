"use client";

import { useMemo, useState } from "react";

import { Plus, Repeat, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { EmptyState } from "@/components/EmptyState";
import { Ledger, LedgerCell } from "@/components/Ledger";
import { LineTabs } from "@/components/LineTabs";
import { Money } from "@/components/Money";
import { Monogram, type MonogramPerson } from "@/components/Monogram";
import { PageHeader } from "@/components/PageHeader";
import { RowMenu } from "@/components/RowMenu";
import { Row, type RowColumns, RowsHeader } from "@/components/Rows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DateFormat } from "@/lib/date-format-cookie";
import { formatMoney } from "@/lib/money";
import type { MonthNavModel } from "@/lib/month-nav";
import { cn } from "@/lib/utils";
import {
  completeRecurringExpenseAction,
  deleteRecurringExpenseAction,
  markRecurringExpensePaidAction,
  pauseRecurringExpenseAction,
  resumeRecurringExpenseAction,
} from "@/modules/recurring/api/recurring.actions";
import { RecurringDialog, type RecurringEditing, type RecurringOwnerKey } from "@/modules/recurring/components/RecurringDialog";
import { RecurringIconTile } from "@/modules/recurring/components/RecurringIconTile";
import type { TimelineDay, TimelineMark } from "@/modules/recurring/lib/recurring-view";

type Category = { budgetType: "fixed" | "flexible"; groupName: string; id: string; name: string };
type Member = { id: string; name: string };

export type RecurringRowModel = {
  amount: number;
  canPay: boolean;
  categoryName: string;
  editing: RecurringEditing;
  frequency: "monthly" | "quarterly" | "yearly";
  icon: string;
  id: string;
  name: string;
  ownerKey: RecurringOwnerKey;
  scheduleText: string;
  scheduleTone: "default" | "muted" | "negative";
  status: "active" | "completed" | "paused";
  sub: string;
};

type LedgerFigures = {
  due: number;
  dueSub: string;
  monthly: number;
  monthlySub: string;
  next: string;
  nextSub: string;
  paid: number;
  paidSub: string;
};

type Props = {
  categories: Category[];
  currentMemberId: string;
  dateFormat: DateFormat;
  daysInPeriod: number;
  ledger: LedgerFigures;
  members: Member[];
  monthName: string;
  monthNav: MonthNavModel;
  rows: RecurringRowModel[];
  timeline: { days: TimelineDay[]; marks: TimelineMark[] };
  todayDay: null | number;
};

type Tab = "active" | "all" | "completed" | "paused" | "upcoming";

const COLUMNS: RowColumns = {
  lg: "28px minmax(160px,1.6fr) minmax(0,0.7fr) minmax(0,1.3fr) 104px 28px",
  md: "28px minmax(140px,1.5fr) minmax(0,0.8fr) minmax(0,1.2fr) 96px 28px",
  sm: "28px minmax(130px,1.5fr) minmax(0,0.7fr) minmax(0,1.3fr) 96px 28px",
};
const FREQUENCY_LABEL = { monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly" } as const;

export function RecurringView(props: Props) {
  const { currentMemberId, members } = props;
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<{ editing: null | RecurringEditing; open: boolean }>({ editing: null, open: false });

  const me = members.find((m) => m.id === currentMemberId);
  const partner = members.find((m) => m.id !== currentMemberId) ?? null;
  const people: Record<"me" | "partner", MonogramPerson> = {
    me: { name: me?.name ?? "Me", role: "me" },
    partner: { name: partner?.name ?? "Partner", role: "partner" },
  };
  const label = (key: RecurringOwnerKey) => (key === "shared" ? "Shared" : key === "me" ? "Me" : (partner?.name ?? "Partner"));
  const monograms = (key: RecurringOwnerKey): MonogramPerson[] => {
    if (key === "shared") return partner ? [people.me, people.partner] : [people.me];
    return [people[key]];
  };

  const counts = useMemo(
    () => ({
      active: props.rows.filter((row) => row.status === "active").length,
      all: props.rows.length,
      completed: props.rows.filter((row) => row.status === "completed").length,
      paused: props.rows.filter((row) => row.status === "paused").length,
      upcoming: props.rows.filter((row) => row.status === "active" && row.canPay).length,
    }),
    [props.rows],
  );

  const q = query.trim().toLowerCase();
  const visible = props.rows.filter((row) => {
    const matchesTab =
      tab === "all" ||
      (tab === "upcoming" && row.status === "active" && row.canPay) ||
      (tab === "active" && row.status === "active") ||
      (tab === "paused" && row.status === "paused") ||
      (tab === "completed" && row.status === "completed");
    if (!matchesTab) return false;
    if (!q) return true;
    return `${row.name} ${row.sub} ${row.categoryName}`.toLowerCase().includes(q);
  });

  async function run(action: () => Promise<unknown>, done: string) {
    try {
      await action();
      toast.success(done);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function remove(row: RecurringRowModel) {
    if (!window.confirm("Delete this recurring item?")) return;
    return run(() => deleteRecurringExpenseAction(row.id), "Recurring deleted");
  }

  return (
    <div>
      <PageHeader
        actions={
          <Button className="h-9.5" onClick={() => setDialog({ editing: null, open: true })} variant="outline">
            <Plus />
            Add recurring
          </Button>
        }
        monthNav={props.monthNav}
        title="Recurring"
      />

      <Ledger data-tour="recurring-ledger">
        <LedgerCell label="Monthly commitments" lead note={props.ledger.monthlySub}>
          <Money size="lead" value={props.ledger.monthly} />
        </LedgerCell>
        <LedgerCell label="Paid this month" note={props.ledger.paidSub}>
          <Money size="cell" value={props.ledger.paid} />
        </LedgerCell>
        <LedgerCell label="Still due" note={props.ledger.dueSub}>
          <Money size="cell" value={props.ledger.due} />
        </LedgerCell>
        <LedgerCell label="Next due" note={props.ledger.nextSub}>
          <span className="text-2xl leading-none font-semibold whitespace-nowrap">{props.ledger.next}</span>
        </LedgerCell>
      </Ledger>

      <section className="mt-8" data-tour="recurring-timeline">
        <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-4">
          <span className="micro-label text-n-600">{props.monthName}, day by day</span>
            <span className="flex items-center gap-4 text-xs text-n-700">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.25 bg-ink" />
                Due
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.25 shadow-[inset_0_0_0_1.5px_var(--ink)]" />
                Paid
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.25 shadow-[inset_0_0_0_2px_var(--signal)]" />
                Today
              </span>
            </span>
          </div>
          <div className="relative pt-6.5">
            {props.timeline.marks.map((mark) => (
              <div
                className={cn(
                  "absolute top-0 box-border h-6.5 px-1.75 text-xs leading-[1.3] whitespace-nowrap text-ink",
                  mark.align === "left" ? "border-r border-ink" : "border-l border-ink",
                )}
                key={mark.day}
                style={{ left: `${((mark.day - 0.5) / props.daysInPeriod) * 100}%`, transform: mark.align === "left" ? "translateX(-100%)" : undefined }}
              >
                <span className="font-semibold">{mark.label}</span>
                <span className="text-n-600"> · {formatMoney(mark.amount, { currency: false })}</span>
              </div>
            ))}
            <div
              className="grid h-8.5 border-t border-b border-rule"
              style={{ gridTemplateColumns: `repeat(${props.daysInPeriod}, minmax(0,1fr))` }}
            >
              {props.timeline.days.map((day) => (
                <div
                  className={cn("relative grid place-items-center", day.day > 1 && "border-l border-n-300", day.isPast && "bg-ink/6")}
                  key={day.day}
                >
                  {day.isToday && <span className="absolute inset-x-0 -top-px -bottom-px shadow-[inset_0_0_0_2px_var(--signal)]" />}
                  {day.hasDue && <span className={cn("size-2.5", day.allPaid ? "shadow-[inset_0_0_0_1.5px_var(--ink)]" : "bg-ink")} />}
                </div>
              ))}
            </div>
            <div className="grid pt-1.5" style={{ gridTemplateColumns: `repeat(${props.daysInPeriod}, minmax(0,1fr))` }}>
              {props.timeline.days.map((day) => (
                <span
                  className={cn(
                    "text-center text-[11px] tabular-nums",
                    day.isToday ? "font-semibold text-signal-ink" : day.hasDue ? "font-semibold text-ink" : "text-n-500",
                  )}
                  key={day.day}
                >
                  {day.showNumber ? day.day : ""}
                </span>
              ))}
            </div>
          </div>
      </section>

      <LineTabs
        aside={
          <div className="relative min-w-45">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-3.75 -translate-y-1/2 text-n-600" />
            <Input
              aria-label="Search recurring"
              className="h-9 pl-8.5"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search recurring"
              value={query}
            />
          </div>
        }
        className="mt-9 mb-5.5"
        data-tour="recurring-tabs"
        label="Status"
        onChange={(value) => setTab(value)}
        tabs={[
          { count: counts.all, label: "All", value: "all" },
          { count: counts.upcoming, label: "Upcoming", value: "upcoming" },
          { count: counts.active, label: "Active", value: "active" },
          { count: counts.paused, label: "Paused", value: "paused" },
          { count: counts.completed, label: "Completed", value: "completed" },
        ]}
        value={tab}
      />

      <RowsHeader columns={COLUMNS}>
        <span className="col-span-2">Item</span>
        <span>For</span>
        <span>Schedule</span>
        <span className="text-right">NPR</span>
        <span />
      </RowsHeader>

      {visible.map((row) => {
        const muted = row.status !== "active";
        return (
          <Row columns={COLUMNS} key={row.id} onClick={() => setDialog({ editing: row.editing, open: true })}>
            <RecurringIconTile icon={row.icon} variant={muted || !row.canPay ? "outline" : "filled"} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className={cn("truncate text-[15px]", muted && "text-n-600")}>{row.name}</span>
              <span className="truncate text-[13px] text-n-600">{row.sub}</span>
            </div>
            <div className="flex min-w-0 items-center gap-2.5">
              <Monogram people={monograms(row.ownerKey)} />
              <span className="text-sm whitespace-nowrap">{label(row.ownerKey)}</span>
            </div>
            <div className="flex min-w-0 items-center justify-between gap-2.5">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <Repeat aria-hidden className="size-3.25" />
                  {FREQUENCY_LABEL[row.frequency]}
                </span>
                <span
                  className={cn(
                    "truncate text-xs whitespace-nowrap",
                    row.scheduleTone === "negative" ? "text-signal-ink" : row.scheduleTone === "muted" ? "text-n-600" : "text-n-700",
                  )}
                >
                  {row.scheduleText}
                </span>
              </div>
              {row.canPay && (
                <Button
                  className="h-auto shrink-0 px-1.5 py-0.75 text-[13px]"
                  onClick={(event) => {
                    event.stopPropagation();
                    void run(() => markRecurringExpensePaidAction(row.id), `${row.name} marked paid`);
                  }}
                  type="button"
                  variant="ghost"
                >
                  Mark paid
                </Button>
              )}
            </div>
            <div className={cn("text-right text-[15px]", (muted || !row.canPay) && "text-n-600")}>
              <Money tone={muted || !row.canPay ? "muted" : "default"} value={row.amount} />
            </div>
            <div className="flex justify-end">
              <RowMenu
                items={[
                  { label: "Edit", onSelect: () => setDialog({ editing: row.editing, open: true }) },
                  row.status === "paused"
                    ? { label: "Resume", onSelect: () => void run(() => resumeRecurringExpenseAction(row.id), "Recurring resumed") }
                    : { label: "Pause", onSelect: () => void run(() => pauseRecurringExpenseAction(row.id), "Recurring paused") },
                  { label: "Mark completed", onSelect: () => void run(() => completeRecurringExpenseAction(row.id), "Recurring completed") },
                  { destructive: true, label: "Delete", onSelect: () => void remove(row) },
                ]}
              />
            </div>
          </Row>
        );
      })}

      {visible.length === 0 && (
        <EmptyState
          body={q ? `Nothing matches “${query}”.` : "Add rent, subscriptions, insurance or EMIs — anything that repeats."}
          className="border-b border-n-300 px-2 pt-10 pb-9"
          title={q ? "Nothing matches" : "No recurring items yet"}
        />
      )}

      <div className="mt-11 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-6 border-t-2 border-rule pt-4.5">
        <p className="max-w-[62ch] text-sm leading-[1.55] text-n-700 text-pretty">
          Rent, subscriptions, insurance, EMIs — add anything that repeats. Each one appears in Expenses as{" "}
          <span className="font-semibold text-ink">Upcoming</span> until you mark it paid, so nothing slips.
        </p>
        <Button className="text-signal-ink" onClick={() => setDialog({ editing: null, open: true })} variant="ghost">
          <Plus />
          Add recurring
        </Button>
      </div>

      <RecurringDialog
        categories={props.categories}
        currentMemberId={currentMemberId}
        dateFormat={props.dateFormat}
        editing={dialog.editing}
        members={members}
        onOpenChange={(value) => !value && setDialog({ editing: null, open: false })}
        open={dialog.open}
      />
    </div>
  );
}
