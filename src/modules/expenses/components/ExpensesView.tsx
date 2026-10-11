"use client";

import { Fragment, type ReactNode, useMemo, useState } from "react";

import { ArrowUpRight, ChevronDown, FileDown, ListPlus, Repeat, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { EmptyState } from "@/components/EmptyState";
import { FilterMenu } from "@/components/FilterMenu";
import { Ledger, LedgerCell } from "@/components/Ledger";
import { Meter } from "@/components/Meter";
import { Money } from "@/components/Money";
import { Monogram, type MonogramPerson } from "@/components/Monogram";
import { PageHeader } from "@/components/PageHeader";
import { RowMenu } from "@/components/RowMenu";
import { GroupLabel, Row, type RowColumns, RowGroupHead, RowsHeader } from "@/components/Rows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadExpensesCsv, type ExpenseExportRow } from "@/lib/csv-export";
import { formatShortDate } from "@/lib/date-format";
import type { DateFormat } from "@/lib/date-format-cookie";
import type { MonthNavModel } from "@/lib/month-nav";
import { CategoryIcon } from "@/modules/categories/components/CategoryIcon";
import { createExpenseAction, deleteExpenseAction } from "@/modules/expenses/api/expenses.actions";
import { BulkAddExpenseModal } from "@/modules/expenses/components/BulkAddExpenseModal";
import { ExpenseDialog } from "@/modules/expenses/components/ExpenseDialog";
import {
  type DateRange,
  type ExpenseFilter,
  type ExpenseItem,
  filterExpenses,
  groupByDay,
  NO_FILTER,
  type OwnerTab,
  ownerTotals,
  visibleNote,
} from "@/modules/expenses/lib/expense-view";
import { roleForOwner } from "@/modules/expenses/lib/member-tone";
import { markRecurringExpensePaidAction } from "@/modules/recurring/api/recurring.actions";

type Category = { groupName: string; icon?: null | string; id: string; name: string };
type Member = { id: string; name: string };

export type ExpenseRecord = Omit<ExpenseItem, "categoryName"> & { payBackAmount: null | number; recurringExpenseId: null | string };

export type UpcomingBill = {
  amount: number;
  categoryId: string;
  frequency: "monthly" | "quarterly" | "yearly";
  id: string;
  name: string;
  nextDueDate: string;
  ownerMemberId: null | string;
};

type Props = {
  categories: Category[];
  currentMemberId: string;
  dateFormat: DateFormat;
  daysLeft: null | number;
  expenses: ExpenseRecord[];
  exportRows: ExpenseExportRow[];
  income: number;
  members: Member[];
  monthLabel: string;
  monthNav: MonthNavModel;
  quickCategoryIds: string[];
  recurringFrequencies: Record<string, "monthly" | "quarterly" | "yearly">;
  today: string;
  upcoming: UpcomingBill[];
};

type ListRow = ExpenseItem & { categoryGroupName: string; recurring: null | string; upcomingBillId: null | string };

const COLUMNS: RowColumns = {
  lg: "28px minmax(170px,1fr) minmax(0,230px) 104px 28px",
  md: "28px minmax(140px,1fr) minmax(0,180px) 96px 28px",
  sm: "28px minmax(0,1fr) 96px 28px",
};
const FIRST_DAYS_SHOWN = 7;
const FREQUENCY_LABEL = { monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly" } as const;
const RANGE_LABEL: Record<DateRange, string> = { month: "Whole month", today: "Today", week: "Last 7 days" };

function percent(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

function plural(count: number) {
  return `${count} ${count === 1 ? "expense" : "expenses"}`;
}

export function ExpensesView(props: Props) {
  const { categories, currentMemberId, dateFormat, expenses, members, today } = props;
  const router = useRouter();
  const [filter, setFilter] = useState<ExpenseFilter>(NO_FILTER);
  const [daysShown, setDaysShown] = useState(FIRST_DAYS_SHOWN);
  const [editing, setEditing] = useState<ExpenseRecord | null>(null);
  const [bulkKey, setBulkKey] = useState<null | number>(null);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const me = members.find((m) => m.id === currentMemberId);
  const partner = members.find((m) => m.id !== currentMemberId) ?? null;
  const ctx = { meId: currentMemberId, today };

  const people: Record<"me" | "partner", MonogramPerson> = {
    me: { name: me?.name ?? "Me", role: "me" },
    partner: { name: partner?.name ?? "Partner", role: "partner" },
  };
  const personLabel = (memberId: string) => (memberId === currentMemberId ? "Me" : (partner?.name ?? "Partner"));

  const rows: ListRow[] = useMemo(
    () =>
      expenses.map((e) => ({
        ...e,
        categoryGroupName: categoryById.get(e.categoryId)?.groupName ?? "",
        categoryName: categoryById.get(e.categoryId)?.name ?? "Unknown",
        recurring: e.recurringExpenseId ? (FREQUENCY_LABEL[props.recurringFrequencies[e.recurringExpenseId]] ?? null) : null,
        upcomingBillId: null,
      })),
    [expenses, categoryById, props.recurringFrequencies],
  );

  const upcomingRows: ListRow[] = props.upcoming.map((bill) => ({
    amount: bill.amount,
    categoryGroupName: categoryById.get(bill.categoryId)?.groupName ?? "",
    categoryId: bill.categoryId,
    categoryName: categoryById.get(bill.categoryId)?.name ?? "Unknown",
    date: bill.nextDueDate,
    id: `bill-${bill.id}`,
    note: bill.name,
    ownerMemberId: bill.ownerMemberId,
    paidByMemberId: bill.ownerMemberId ?? currentMemberId,
    recurring: `${FREQUENCY_LABEL[bill.frequency]} · due ${formatShortDate(bill.nextDueDate, dateFormat)}`,
    upcomingBillId: bill.id,
  }));

  const totals = ownerTotals(rows, currentMemberId);
  const ownerSelected = filter.owner;
  const visible = filterExpenses(rows, filter, ctx);
  const visibleUpcoming = filter.range === "today" ? [] : filterExpenses(upcomingRows, { ...filter, range: "month" }, ctx);
  const dayGroups = groupByDay(visible, { dateFormat, today });
  const shownGroups = dayGroups.slice(0, daysShown);
  const shownCount = shownGroups.reduce((sum, g) => sum + g.rows.length, 0);
  const anyFilter = filter.categoryId !== null || filter.payerId !== null || filter.range !== "month" || filter.query.trim() !== "";
  const incomeShare = percent(totals.all, props.income);

  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.categoryId, (counts.get(row.categoryId) ?? 0) + 1);
    return [...counts.entries()]
      .map(([id, count]) => ({ count, label: categoryById.get(id)?.name ?? "Unknown", value: id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows, categoryById]);

  function update(patch: Partial<ExpenseFilter>) {
    setFilter((prev) => ({ ...prev, ...patch }));
  }

  function selectOwner(owner: OwnerTab) {
    update({ owner });
  }

  async function run(action: () => Promise<unknown>, done: string) {
    try {
      await action();
      toast.success(done);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function repeatToday(row: ListRow) {
    return run(
      () =>
        createExpenseAction({
          amount: row.amount,
          categoryId: row.categoryId,
          date: today,
          note: row.note ?? undefined,
          ownerMemberId: row.ownerMemberId,
          paidByMemberId: row.paidByMemberId,
        }),
      "Added again for today",
    );
  }

  function remove(row: ListRow) {
    if (!window.confirm("Delete this expense?")) return;
    return run(() => deleteExpenseAction(row.id), "Expense deleted");
  }

  function ownerCell(row: ListRow) {
    const role = roleForOwner(row.ownerMemberId, currentMemberId);
    const monogram = role === "shared" ? [people.me, people.partner] : [people[role]];
    const ownerLabel = role === "shared" ? "Shared" : role === "me" ? "Me" : people.partner.name;
    const paidNote = role === "shared" || row.ownerMemberId !== row.paidByMemberId ? `paid by ${personLabel(row.paidByMemberId)}` : "";
    return (
      <div className="flex min-w-0 items-center gap-2.5 overflow-hidden @max-[559px]:hidden">
        <Monogram people={monogram} />
        <span className="shrink-0 text-sm whitespace-nowrap">{ownerLabel}</span>
        {paidNote && <span className="truncate text-[13px] text-n-600">{paidNote}</span>}
      </div>
    );
  }

  function renderRow(row: ListRow) {
    const upcoming = row.upcomingBillId !== null;
    const note = visibleNote(row.note, row.categoryName);
    const record = upcoming ? null : expenses.find((e) => e.id === row.id) ?? null;

    return (
      <Row columns={COLUMNS} key={row.id} onClick={record ? () => setEditing(record) : undefined}>
        <CategoryIcon groupName={row.categoryGroupName} icon={categoryById.get(row.categoryId)?.icon} name={row.categoryName} variant={upcoming ? "outline" : "filled"} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex min-w-0 items-baseline gap-2.5 overflow-hidden">
            <span className="shrink-0 text-[15px] whitespace-nowrap">{row.categoryName}</span>
            {note && <span className="truncate text-[13px] text-n-600">{note}</span>}
          </div>
          {row.recurring && (
            <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5">
              <span className="inline-flex items-center gap-1.25 text-xs text-n-700">
                <Repeat aria-hidden className="size-3" />
                {row.recurring}
              </span>
              {upcoming && (
                <Button
                  className="h-auto px-1 py-px text-xs"
                  onClick={(event) => {
                    event.stopPropagation();
                    void run(() => markRecurringExpensePaidAction(row.upcomingBillId!), `${row.note ?? "Bill"} marked paid`);
                  }}
                  type="button"
                  variant="ghost"
                >
                  Mark paid
                </Button>
              )}
            </div>
          )}
        </div>
        {ownerCell(row)}
        <span className="text-right text-[15px]">
          <Money tone={upcoming ? "muted" : "default"} value={row.amount} />
        </span>
        <div className="flex justify-end">
          {record && (
            <RowMenu
              items={[
                { label: "Edit", onSelect: () => setEditing(record) },
                { label: "Repeat today", onSelect: () => void repeatToday(row) },
                { destructive: true, label: "Delete", onSelect: () => void remove(row) },
              ]}
            />
          )}
        </div>
      </Row>
    );
  }

  const groupsToRender: { key: string; label: string; muted: boolean; rows: ListRow[]; sub: string; total: number }[] = [
    ...(visibleUpcoming.length > 0
      ? [
          {
            key: "upcoming",
            label: "Upcoming",
            muted: true,
            rows: visibleUpcoming,
            sub: "Scheduled from Recurring",
            total: visibleUpcoming.reduce((sum, r) => sum + r.amount, 0),
          },
        ]
      : []),
    ...shownGroups.map((g) => ({ key: g.date, label: g.label, muted: false, rows: g.rows, sub: g.sub, total: g.total })),
  ];

  const ownerCellLabel = (swatch: string, text: string): ReactNode => (
    <>
      <span aria-hidden className={`size-2 ${swatch}`} />
      {text}
    </>
  );

  return (
    <div>
      <PageHeader
        actions={
          <>
            <Button asChild variant="ghost">
              <Link href="/reports">
                Full report
                <ArrowUpRight />
              </Link>
            </Button>
            <Button className="h-9.5" onClick={() => setBulkKey(Date.now())} type="button" variant="outline">
              <ListPlus />
              Bulk add
            </Button>
            <Button className="h-9.5" onClick={() => downloadExpensesCsv(props.exportRows, props.monthLabel)} type="button" variant="outline">
              <FileDown />
              Export
            </Button>
          </>
        }
        meta={props.daysLeft !== null ? `${props.daysLeft} ${props.daysLeft === 1 ? "day" : "days"} left in the month` : undefined}
        monthNav={props.monthNav}
        title="Expenses"
      />

      <Ledger>
        <LedgerCell
          bar={
            <Meter
              segments={[
                { tone: "ink", value: totals.me },
                { tone: "partner", value: totals.partner },
                { tone: "shared", value: totals.shared },
              ]}
            />
          }
          label="All expenses"
          lead
          note={
            <>
              <span>{plural(rows.length)}</span>
              {incomeShare !== null && <span className={incomeShare > 100 ? "text-signal-ink" : undefined}>{incomeShare}% of income</span>}
            </>
          }
          onSelect={() => selectOwner("all")}
          selected={ownerSelected === "all"}
        >
          <Money size="lead" value={totals.all} />
        </LedgerCell>
        <LedgerCell
          label={ownerCellLabel("bg-ink", "Me")}
          note={`${percent(totals.me, totals.all) ?? 0}% of total`}
          onSelect={() => selectOwner("me")}
          selected={ownerSelected === "me"}
        >
          <Money size="cell" value={totals.me} />
        </LedgerCell>
        {partner && (
          <LedgerCell
            label={ownerCellLabel("bg-n-600", partner.name)}
            note={`${percent(totals.partner, totals.all) ?? 0}% of total`}
            onSelect={() => selectOwner("partner")}
            selected={ownerSelected === "partner"}
          >
            <Money size="cell" value={totals.partner} />
          </LedgerCell>
        )}
        <LedgerCell
          label={ownerCellLabel("bg-n-300", "Shared")}
          note={`${percent(totals.shared, totals.all) ?? 0}% of total`}
          onSelect={() => selectOwner("shared")}
          selected={ownerSelected === "shared"}
        >
          <Money size="cell" value={totals.shared} />
        </LedgerCell>
      </Ledger>

      <div className="flex flex-wrap items-center gap-1 pt-4 pb-7.5">
        <div className="relative mr-2.5 min-w-50 flex-[0_1_290px]">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-n-600" />
          <Input
            aria-label="Search expenses"
            className="pl-9"
            onChange={(event) => update({ query: event.target.value })}
            placeholder="Search notes or categories"
            value={filter.query}
          />
        </div>
        <FilterMenu
          active={filter.categoryId !== null}
          label={filter.categoryId ? (categoryById.get(filter.categoryId)?.name ?? "Category") : "Category"}
          onSelect={(value) => update({ categoryId: filter.categoryId === value ? null : value })}
          options={categoryOptions}
          value={filter.categoryId}
        />
        <FilterMenu
          active={filter.payerId !== null}
          label={filter.payerId ? `Paid by ${personLabel(filter.payerId)}` : "Paid by"}
          onSelect={(value) => update({ payerId: filter.payerId === value ? null : value })}
          options={[...(me ? [me] : []), ...(partner ? [partner] : [])].map((m) => ({ label: personLabel(m.id), value: m.id }))}
          value={filter.payerId}
        />
        <FilterMenu
          active={filter.range !== "month"}
          label={filter.range === "month" ? "Dates" : RANGE_LABEL[filter.range]}
          onSelect={(value) => update({ range: value as DateRange })}
          options={(["month", "week", "today"] as const).map((range) => ({ label: RANGE_LABEL[range], value: range }))}
          value={filter.range}
        />
        {(anyFilter || ownerSelected !== "all") && (
          <Button className="ml-1 text-[13px]" onClick={() => setFilter(NO_FILTER)} size="sm" type="button" variant="ghost">
            Clear
          </Button>
        )}
        {(anyFilter || ownerSelected !== "all") && <span className="ml-auto text-[13px] text-n-600">{plural(visible.length)} shown</span>}
      </div>

      <RowsHeader columns={COLUMNS}>
        <span className="col-span-2">Expense</span>
        <span className="@max-[559px]:hidden">For · paid by</span>
        <span className="text-right">NPR</span>
        <span />
      </RowsHeader>

      {groupsToRender.map((group, index) => (
        <Fragment key={group.key}>
          <RowGroupHead columns={COLUMNS} first={index === 0}>
            <GroupLabel className="col-[1/-3]" label={group.label} sub={group.sub} />
            <span className="text-right text-[15px]">
              <Money tone={group.muted ? "muted" : "default"} value={group.total} />
            </span>
            <span />
          </RowGroupHead>
          {group.rows.map(renderRow)}
        </Fragment>
      ))}

      {groupsToRender.length === 0 && (
        <EmptyState
          action={
            anyFilter || ownerSelected !== "all" ? (
              <Button onClick={() => setFilter(NO_FILTER)} type="button" variant="outline">
                Clear filters
              </Button>
            ) : undefined
          }
          body={
            anyFilter
              ? filter.query
                ? `No expense in ${props.monthLabel} mentions “${filter.query}”. Try a broader word, or clear filters.`
                : "Try a different combination, or clear filters to see the whole month."
              : `Nothing recorded in ${props.monthLabel} yet. Press N or use Add expense to log one.`
          }
          className="border-b border-n-300 px-2 pt-14 pb-12"
          title={anyFilter ? "Nothing matches these filters" : "No expenses yet"}
        />
      )}

      <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t-2 border-rule pt-4">
        <span className="text-[13px] text-n-600">
          Showing {shownCount} of {plural(visible.length)}
        </span>
        {dayGroups.length > daysShown && (
          <Button className="h-9.5" onClick={() => setDaysShown((n) => n + FIRST_DAYS_SHOWN)} type="button" variant="outline">
            Show earlier days
            <ChevronDown />
          </Button>
        )}
      </div>

      <ExpenseDialog
        categories={categories}
        currentMemberId={currentMemberId}
        expenseId={editing?.id}
        initial={
          editing
            ? {
                amount: editing.amount,
                categoryId: editing.categoryId,
                date: editing.date,
                note: editing.note,
                ownerMemberId: editing.ownerMemberId,
                paidByMemberId: editing.paidByMemberId,
                payBackAmount: editing.payBackAmount,
              }
            : undefined
        }
        members={members}
        onOpenChange={(open) => !open && setEditing(null)}
        open={editing !== null}
        quickCategoryIds={props.quickCategoryIds}
      />

      {bulkKey !== null && (
        <BulkAddExpenseModal
          categories={categories}
          currentMemberId={currentMemberId}
          key={bulkKey}
          members={members}
          onOpenChange={(open) => !open && setBulkKey(null)}
          open
        />
      )}
    </div>
  );
}
