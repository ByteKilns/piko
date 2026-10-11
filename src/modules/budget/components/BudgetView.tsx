"use client";

import { Fragment, useState } from "react";

import { ChevronRight, Copy, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Ledger, LedgerCell } from "@/components/Ledger";
import { LineTabs } from "@/components/LineTabs";
import { Meter } from "@/components/Meter";
import { Money } from "@/components/Money";
import { Monogram, type MonogramPerson } from "@/components/Monogram";
import { PageHeader } from "@/components/PageHeader";
import { Row, type RowColumns, RowGroupHead, RowsHeader } from "@/components/Rows";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import type { MonthNavModel } from "@/lib/month-nav";
import { cn } from "@/lib/utils";
import { copyPreviousMonthBudgetAction } from "@/modules/budget/api/budget.actions";
import { BudgetDialog, type BudgetDraft, type BudgetOwnerKey } from "@/modules/budget/components/BudgetDialog";
import { SetIncomeDialog } from "@/modules/budget/components/SetIncomeDialog";
import type { BudgetLead, BudgetOwnerGroup } from "@/modules/budget/lib/budget-view";

type Category = { budgetType: "fixed" | "flexible"; groupName: string; id: string; name: string };
type Member = { id: string; name: string };

type LedgerFigures = {
  budgeted: number;
  budgetedRatio: number;
  budgetedSub: string;
  outside: number;
  outsideSub: string;
  spentIn: number;
  spentInSub: string;
  unplanned: number;
  unplannedSub: string;
};

type Props = {
  canCopy: boolean;
  categories: Category[];
  currentMemberId: string;
  groups: BudgetOwnerGroup[];
  income: number;
  incomes: Record<string, number>;
  lead: BudgetLead;
  ledger: LedgerFigures;
  members: Member[];
  month: number;
  monthNav: MonthNavModel;
  prevMonthName: string;
  savings: { planned: number; pots: { id: string; name: string; planned: number; putIn: number }[]; putIn: number };
  spentByKey: Record<string, number>;
  year: number;
};

type Tab = "all" | BudgetOwnerKey;

const COLUMNS: RowColumns = {
  lg: "minmax(170px,1.6fr) repeat(3,minmax(0,0.85fr)) minmax(140px,1.2fr)",
  md: "minmax(130px,1.4fr) repeat(3,minmax(0,0.9fr)) minmax(110px,1fr)",
  sm: "minmax(120px,1.4fr) repeat(3,minmax(0,0.9fr)) minmax(90px,1fr)",
};
const SHOWN_UNBUDGETED = 4;

function pct(ratio: number) {
  return `${Math.round(ratio * 100)}%`;
}

export function BudgetView(props: Props) {
  const { currentMemberId, groups, members } = props;
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [openUnbudgeted, setOpenUnbudgeted] = useState<Partial<Record<BudgetOwnerKey, boolean>>>({});
  const [dialog, setDialog] = useState<{ defaultCategoryId?: string; initial?: BudgetDraft; open: boolean; ownerKey: BudgetOwnerKey }>({
    open: false,
    ownerKey: "me",
  });
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [copyPending, setCopyPending] = useState(false);

  const me = members.find((m) => m.id === currentMemberId);
  const partner = members.find((m) => m.id !== currentMemberId) ?? null;
  const people: Record<"me" | "partner", MonogramPerson> = {
    me: { name: me?.name ?? "Me", role: "me" },
    partner: { name: partner?.name ?? "Partner", role: "partner" },
  };
  const monograms = (key: BudgetOwnerKey): MonogramPerson[] => {
    if (key === "shared") return partner ? [people.me, people.partner] : [people.me];
    return [people[key]];
  };

  const visible = groups.filter((group) => tab === "all" || tab === group.key);

  function openNew() {
    setDialog({ open: true, ownerKey: tab === "all" ? "me" : tab });
  }

  function openRow(group: BudgetOwnerGroup, row: BudgetOwnerGroup["rows"][number]) {
    setDialog({
      initial: { budgetType: row.budgetType, categoryId: row.categoryId, ownerKey: group.key, planned: row.planned },
      open: true,
      ownerKey: group.key,
    });
  }

  function openCategory(key: BudgetOwnerKey, categoryId: string) {
    setDialog({ defaultCategoryId: categoryId, open: true, ownerKey: key });
  }

  async function copy() {
    setCopyPending(true);
    try {
      await copyPreviousMonthBudgetAction(props.year, props.month);
      toast.success("Copied last month's budget");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to copy");
    } finally {
      setCopyPending(false);
    }
  }

  return (
    <div>
      <PageHeader
        actions={
          <>
            <Button disabled={!props.canCopy || copyPending} onClick={() => void copy()} variant="ghost">
              <Copy />
              Copy {props.prevMonthName}&apos;s budget
            </Button>
            <Button className="h-9.5" onClick={openNew} variant="outline">
              <Plus />
              Add budget
            </Button>
            <Button onClick={() => setIncomeOpen(true)} variant="ghost">
              Set income
            </Button>
          </>
        }
        monthNav={props.monthNav}
        title="Budget"
      />

      <p className="mb-6.5 max-w-[60ch] text-xl leading-[1.45] tracking-[-0.005em] text-n-800 text-pretty">
        You&apos;ve planned <strong className="text-ink">{props.lead.planned} of this month&apos;s income</strong>, yet{" "}
        <strong className="text-ink">{props.lead.outside} of spending</strong> happened outside a budget.{" "}
        <strong className="text-ink">{props.lead.strong}</strong>
        {props.lead.rest}
      </p>

      <Ledger>
        <LedgerCell
          bar={<Meter ratio={props.ledger.budgetedRatio} />}
          label="Budgeted"
          lead
          note={props.ledger.budgetedSub}
        >
          <Money size="lead" value={props.ledger.budgeted} />
        </LedgerCell>
        <LedgerCell label="Spent in budgets" note={props.ledger.spentInSub}>
          <Money size="cell" value={props.ledger.spentIn} />
        </LedgerCell>
        <LedgerCell label="Spent outside" note={props.ledger.outsideSub}>
          <Money size="cell" value={props.ledger.outside} />
        </LedgerCell>
        <LedgerCell label="Left to plan" note={props.ledger.unplannedSub}>
          <Money size="cell" value={props.ledger.unplanned} />
        </LedgerCell>
      </Ledger>

      <LineTabs
        aside="Click a row to change its budget"
        className="mt-5.5 mb-6.5"
        label="Owner"
        onChange={(value) => setTab(value)}
        tabs={[
          { label: "All", value: "all" },
          { label: "Me", value: "me" },
          ...(partner ? [{ label: partner.name, value: "partner" as const }] : []),
          { label: "Shared", value: "shared" },
        ]}
        value={tab}
      />

      <RowsHeader columns={COLUMNS}>
        <span>Category</span>
        <span className="text-right">Budget</span>
        <span className="text-right">Spent</span>
        <span className="text-right">Left</span>
        <span>Used</span>
      </RowsHeader>

      {visible.map((group, index) => {
        const usedRatio = group.budgeted > 0 ? group.spent / group.budgeted : 0;
        const left = group.budgeted - group.spent;
        const open = openUnbudgeted[group.key] ?? false;
        const shown = group.unbudgeted.slice(0, SHOWN_UNBUDGETED);
        const moreCount = group.unbudgeted.length - shown.length;
        const moreTotal = group.unbudgeted.slice(SHOWN_UNBUDGETED).reduce((sum, row) => sum + row.spent, 0);
        const preview = `${shown.map((row) => row.categoryName).join(", ")}${moreCount > 0 ? ` and ${moreCount} more` : ""}`;
        const sub =
          group.rows.length > 0
            ? `${group.rows.length} ${group.rows.length === 1 ? "budget" : "budgets"} · Rs ${formatMoney(group.totalSpent, { currency: false })} spent in all`
            : `No budgets yet · Rs ${formatMoney(group.totalSpent, { currency: false })} spent`;

        return (
          <Fragment key={group.key}>
            <RowGroupHead columns={COLUMNS} first={index === 0}>
              <div className="flex min-w-0 items-center gap-2.5">
                <Monogram people={monograms(group.key)} />
                <span className="text-[15px] font-semibold whitespace-nowrap">{group.name}</span>
                <span className="truncate text-[13px] text-n-600">{sub}</span>
              </div>
              {group.rows.length > 0 ? (
                <>
                  <div className="text-right text-[15px] font-semibold">
                    <Money value={group.budgeted} />
                  </div>
                  <div className="text-right text-[15px] font-semibold">
                    <Money value={group.spent} />
                  </div>
                  <div className={cn("text-right text-[15px] font-semibold", left < 0 && "text-signal-ink")}>
                    <Money tone={left < 0 ? "negative" : "default"} value={left} />
                  </div>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Meter className="flex-1" ratio={usedRatio} />
                    <span className={cn("w-10.5 text-right text-[13px] font-semibold", usedRatio > 1 ? "text-signal-ink" : "text-ink")}>
                      {pct(usedRatio)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="col-span-4 flex justify-end">
                  <Button className="h-auto px-1.5 py-0.75 text-[13px]" onClick={openNew} type="button" variant="ghost">
                    <Plus />
                    Set a budget
                  </Button>
                </div>
              )}
            </RowGroupHead>

            {group.rows.map((row) => {
              const rowRatio = row.planned > 0 ? row.spent / row.planned : 0;
              const rowLeft = row.planned - row.spent;
              return (
                <Row columns={COLUMNS} key={row.categoryId} onClick={() => openRow(group, row)}>
                  <div className="flex min-w-0 items-baseline gap-2.5">
                    <span className="truncate text-[15px] whitespace-nowrap">{row.categoryName}</span>
                    <span className="shrink-0 text-xs text-n-600">{row.budgetType === "fixed" ? "Fixed" : "Flexible"}</span>
                  </div>
                  <div className="text-right text-[15px]">
                    <Money value={row.planned} />
                  </div>
                  <div className="text-right text-[15px]">
                    <Money value={row.spent} />
                  </div>
                  <div className={cn("text-right text-[15px] font-semibold", rowLeft < 0 && "text-signal-ink")}>
                    <Money tone={rowLeft < 0 ? "negative" : "default"} value={rowLeft} />
                  </div>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Meter className="flex-1" ratio={rowRatio} />
                    <span className={cn("w-10.5 text-right text-[13px]", rowRatio > 1 ? "text-signal-ink" : "text-n-700")}>
                      {pct(rowRatio)}
                    </span>
                  </div>
                </Row>
              );
            })}

            {group.unbudgeted.length > 0 && (
              <>
                <Row
                  columns={COLUMNS}
                  onClick={() => setOpenUnbudgeted((prev) => ({ ...prev, [group.key]: !open }))}
                >
                  <div className="col-span-2 flex min-w-0 items-center gap-2">
                    <ChevronRight aria-hidden className={cn("size-3.5 shrink-0 text-n-600 transition-transform", open && "rotate-90")} />
                    <span className="shrink-0 text-sm text-n-800">Without a budget</span>
                    <span className="truncate text-[13px] text-n-600">{preview}</span>
                  </div>
                  <div className="text-right text-[15px]">
                    <Money value={group.unbudgetedTotal} />
                  </div>
                  <div />
                  <div className="text-[13px] text-n-600">
                    {group.unbudgeted.length} {group.unbudgeted.length === 1 ? "category" : "categories"}
                  </div>
                </Row>

                {open &&
                  shown.map((row) => (
                    <Row className="bg-ink/3" columns={COLUMNS} key={row.categoryId}>
                      <div className="col-span-2 truncate pl-5.5 text-sm text-n-800">{row.categoryName}</div>
                      <div className="text-right text-sm">
                        <Money value={row.spent} />
                      </div>
                      <div />
                      <div className="flex">
                        <Button
                          className="h-auto px-1.5 py-0.5 text-[13px]"
                          onClick={() => void openCategory(group.key, row.categoryId)}
                          type="button"
                          variant="ghost"
                        >
                          Set budget
                        </Button>
                      </div>
                    </Row>
                  ))}

                {open && moreCount > 0 && (
                  <Row className="bg-ink/3" columns={COLUMNS}>
                    <div className="col-span-2 truncate pl-5.5 text-sm text-n-800">
                      {moreCount} more {moreCount === 1 ? "category" : "categories"}
                    </div>
                    <div className="text-right text-sm">
                      <Money value={moreTotal} />
                    </div>
                    <div />
                    <div />
                  </Row>
                )}
              </>
            )}
          </Fragment>
        );
      })}

      {tab === "all" && props.savings.pots.length > 0 && (
        <>
          <RowGroupHead columns={COLUMNS}>
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="text-[15px] font-semibold whitespace-nowrap">Savings</span>
              <span className="truncate text-[13px] text-n-600">Planned against put in this month</span>
            </div>
            <div className="text-right text-[15px] font-semibold">
              <Money value={props.savings.planned} />
            </div>
            <div className="text-right text-[15px] font-semibold">
              <Money value={props.savings.putIn} />
            </div>
            <div className="text-right text-[15px] font-semibold">
              <Money value={Math.max(0, props.savings.planned - props.savings.putIn)} />
            </div>
            <div className="flex min-w-0 items-center gap-2.5">
              <Meter className="flex-1" ratio={props.savings.planned > 0 ? Math.min(1, props.savings.putIn / props.savings.planned) : 0} />
              <span className="w-10.5 text-right text-[13px] font-semibold text-ink">
                {pct(props.savings.planned > 0 ? props.savings.putIn / props.savings.planned : 0)}
              </span>
            </div>
          </RowGroupHead>
          {props.savings.pots.map((pot) => (
            <Row columns={COLUMNS} key={pot.id}>
              <span className="truncate text-[15px] whitespace-nowrap">{pot.name}</span>
              <div className="text-right text-[15px]">
                <Money value={pot.planned} />
              </div>
              <div className="text-right text-[15px]">
                <Money value={pot.putIn} />
              </div>
              <div className="text-right text-[15px]">
                <Money value={Math.max(0, pot.planned - pot.putIn)} />
              </div>
              <div className="flex min-w-0 items-center gap-2.5">
                <Meter className="flex-1" ratio={pot.planned > 0 ? Math.min(1, pot.putIn / pot.planned) : 0} />
                <span className="w-10.5 text-right text-[13px] text-n-700">{pct(pot.planned > 0 ? pot.putIn / pot.planned : 0)}</span>
              </div>
            </Row>
          ))}
        </>
      )}

      <BudgetDialog
        categories={props.categories}
        currentMemberId={currentMemberId}
        defaultCategoryId={dialog.defaultCategoryId}
        initial={dialog.initial}
        members={members}
        month={props.month}
        onOpenChange={(value) => !value && setDialog((prev) => ({ ...prev, initial: undefined, open: false }))}
        open={dialog.open}
        ownerKey={dialog.ownerKey}
        spentByKey={props.spentByKey}
        year={props.year}
      />

      <SetIncomeDialog
        currentMemberId={currentMemberId}
        incomes={props.incomes}
        members={members}
        month={props.month}
        monthLabel={props.monthNav.label}
        onOpenChange={setIncomeOpen}
        open={incomeOpen}
        year={props.year}
      />
    </div>
  );
}
