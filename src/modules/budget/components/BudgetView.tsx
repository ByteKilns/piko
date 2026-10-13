"use client";

import { Fragment, useState } from "react";

import { ChevronRight, Plus, Repeat } from "lucide-react";
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
import { fillBudgetFromRecurringAction } from "@/modules/budget/api/budget.actions";
import { BudgetDialog, type BudgetDraft } from "@/modules/budget/components/BudgetDialog";
import { SetIncomeDialog } from "@/modules/budget/components/SetIncomeDialog";
import type { BudgetLead, PersonPlan, PlanRow, SharedRow } from "@/modules/budget/lib/budget-view";
import type { BudgetLineKind } from "@/modules/budget/lib/plan-lines";

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

export type PersonView = {
  // Set when this month shows a plan carried over from an earlier month.
  carriedFrom: null | string;
  key: "me" | "partner";
  lastKinds: Record<string, BudgetLineKind>;
  lead: BudgetLead;
  ledger: LedgerFigures;
  memberId: string;
  name: string;
  plan: PersonPlan;
  savings: { planned: number; pots: { id: string; name: string; planned: number; putIn: number }[]; putIn: number };
  spentByCategory: Record<string, number>;
};

type Props = {
  categories: Category[];
  currentMemberId: string;
  incomes: Record<string, number>;
  members: Member[];
  month: number;
  monthLabel: string;
  monthNav: MonthNavModel;
  people: PersonView[];
  shared: SharedRow[];
  year: number;
};

type Tab = "me" | "partner" | "shared";

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
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("me");
  const [openUnbudgeted, setOpenUnbudgeted] = useState(false);
  const [dialog, setDialog] = useState<{ defaultCategoryId?: string; initial?: BudgetDraft; open: boolean }>({ open: false });
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [fillPending, setFillPending] = useState(false);

  const person = tab === "shared" ? null : (props.people.find((p) => p.key === tab) ?? props.people[0]);
  const monogram = (p: PersonView): MonogramPerson[] => [{ name: p.name, role: p.key }];

  function openNew() {
    setDialog({ open: true });
  }

  function openRow(row: PlanRow) {
    setDialog({ initial: { categoryId: row.categoryId, kind: row.kind, planned: row.planned }, open: true });
  }

  function openCategory(categoryId: string) {
    setDialog({ defaultCategoryId: categoryId, open: true });
  }

  async function fillFromRecurring() {
    if (!person) return;
    setFillPending(true);
    try {
      const added = await fillBudgetFromRecurringAction(props.year, props.month, person.memberId);
      toast.success(added > 0 ? `Added ${added} ${added === 1 ? "line" : "lines"} from recurring bills` : "Nothing new to add from recurring bills");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fill");
    } finally {
      setFillPending(false);
    }
  }

  const tabs = [
    ...props.people.map((p) => ({ label: p.key === "me" ? "Me" : p.name, value: p.key })),
    ...(props.shared.length > 0 ? [{ label: "Shared", value: "shared" as const }] : []),
  ];

  return (
    <div>
      <PageHeader
        actions={
          <>
            {person && (
              <>
                <Button disabled={fillPending} onClick={() => void fillFromRecurring()} variant="ghost">
                  <Repeat />
                  Fill from recurring
                </Button>
                <Button className="h-9.5" onClick={openNew} variant="outline">
                  <Plus />
                  Add budget
                </Button>
              </>
            )}
            <Button onClick={() => setIncomeOpen(true)} variant="ghost">
              Set income
            </Button>
          </>
        }
        monthNav={props.monthNav}
        title="Budget"
      />

      {person && (
        <>
          <p className="mb-6.5 max-w-[60ch] text-xl leading-[1.45] tracking-[-0.005em] text-n-800 text-pretty">
            {person.key === "me" ? "You've" : `${person.name} has`} planned{" "}
            <strong className="text-ink">{person.lead.planned} of this month&apos;s income</strong>, yet{" "}
            <strong className="text-ink">{person.lead.outside} of spending</strong> happened outside a budget.{" "}
            <strong className="text-ink">{person.lead.strong}</strong>
            {person.lead.rest}
          </p>

          <Ledger>
            <LedgerCell bar={<Meter ratio={person.ledger.budgetedRatio} />} label="Budgeted" lead note={person.ledger.budgetedSub}>
              <Money size="lead" value={person.ledger.budgeted} />
            </LedgerCell>
            <LedgerCell label="Spent in budgets" note={person.ledger.spentInSub}>
              <Money size="cell" value={person.ledger.spentIn} />
            </LedgerCell>
            <LedgerCell label="Spent outside" note={person.ledger.outsideSub}>
              <Money size="cell" value={person.ledger.outside} />
            </LedgerCell>
            <LedgerCell
              label="Left to plan"
              note={<span className={cn(person.ledger.unplanned < 0 && "text-signal-ink")}>{person.ledger.unplannedSub}</span>}
            >
              <Money size="cell" tone={person.ledger.unplanned < 0 ? "negative" : "default"} value={person.ledger.unplanned} />
            </LedgerCell>
          </Ledger>
        </>
      )}

      <LineTabs
        aside={person ? "Click a row to change its budget" : undefined}
        className="mt-5.5 mb-6.5"
        label="Whose plan"
        onChange={(value) => setTab(value)}
        tabs={tabs}
        value={tab}
      />

      {person?.carriedFrom && (
        <p className="mb-4 text-[13px] text-n-700">
          Carried over from {person.carriedFrom}. Changing a line makes this month&apos;s plan its own.
        </p>
      )}

      <RowsHeader columns={COLUMNS}>
        <span>Category</span>
        <span className="text-right">Budget</span>
        <span className="text-right">Spent</span>
        <span className="text-right">Left</span>
        <span>Used</span>
      </RowsHeader>

      {person && <PersonRows monogram={monogram(person)} onCategory={openCategory} onNew={openNew} onRow={openRow} openUnbudgeted={openUnbudgeted} person={person} setOpenUnbudgeted={setOpenUnbudgeted} />}

      {tab === "shared" && (
        <>
          <RowGroupHead columns={COLUMNS} first>
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="text-[15px] font-semibold whitespace-nowrap">Shared</span>
              <span className="truncate text-[13px] text-n-600">From before plans were per person. Spending now counts against whoever paid.</span>
            </div>
            <div className="text-right text-[15px] font-semibold">
              <Money value={props.shared.reduce((sum, row) => sum + row.planned, 0)} />
            </div>
            <div />
            <div />
            <div />
          </RowGroupHead>
          {props.shared.map((row) => (
            <Row columns={COLUMNS} key={row.categoryId}>
              <span className="truncate text-[15px] whitespace-nowrap">{row.categoryName}</span>
              <div className="text-right text-[15px]">
                <Money value={row.planned} />
              </div>
              <div className="text-right text-[15px] text-n-500">—</div>
              <div className="text-right text-[15px] text-n-500">—</div>
              <div />
            </Row>
          ))}
        </>
      )}

      {person && person.savings.pots.length > 0 && (
        <>
          <RowGroupHead columns={COLUMNS}>
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="text-[15px] font-semibold whitespace-nowrap">Savings</span>
              <span className="truncate text-[13px] text-n-600">Planned against put in this month</span>
            </div>
            <div className="text-right text-[15px] font-semibold">
              <Money value={person.savings.planned} />
            </div>
            <div className="text-right text-[15px] font-semibold">
              <Money value={person.savings.putIn} />
            </div>
            <div className="text-right text-[15px] font-semibold">
              <Money value={Math.max(0, person.savings.planned - person.savings.putIn)} />
            </div>
            <div className="flex min-w-0 items-center gap-2.5">
              <Meter className="flex-1" ratio={person.savings.planned > 0 ? Math.min(1, person.savings.putIn / person.savings.planned) : 0} />
              <span className="w-10.5 text-right text-[13px] font-semibold text-ink">
                {pct(person.savings.planned > 0 ? person.savings.putIn / person.savings.planned : 0)}
              </span>
            </div>
          </RowGroupHead>
          {person.savings.pots.map((pot) => (
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

      {person && (
        <BudgetDialog
          categories={props.categories}
          defaultCategoryId={dialog.defaultCategoryId}
          initial={dialog.initial}
          lastKinds={person.lastKinds}
          month={props.month}
          onOpenChange={(value) => !value && setDialog({ open: false })}
          open={dialog.open}
          ownerMemberId={person.memberId}
          planLabel={person.key === "me" ? "Your plan" : `${person.name}'s plan`}
          spentByCategory={person.spentByCategory}
          year={props.year}
        />
      )}

      <SetIncomeDialog
        currentMemberId={props.currentMemberId}
        incomes={props.incomes}
        members={props.members}
        month={props.month}
        monthLabel={props.monthLabel}
        onOpenChange={setIncomeOpen}
        open={incomeOpen}
        year={props.year}
      />
    </div>
  );
}

type PersonRowsProps = {
  monogram: MonogramPerson[];
  onCategory: (categoryId: string) => void;
  onNew: () => void;
  onRow: (row: PlanRow) => void;
  openUnbudgeted: boolean;
  person: PersonView;
  setOpenUnbudgeted: (open: boolean) => void;
};

// One person's plan: a group per kind (fixed, essential, can cut), then their
// spending in categories without a line.
function PersonRows({ monogram, onCategory, onNew, onRow, openUnbudgeted, person, setOpenUnbudgeted }: PersonRowsProps) {
  const { plan } = person;
  const shown = plan.unbudgeted.slice(0, SHOWN_UNBUDGETED);
  const moreCount = plan.unbudgeted.length - shown.length;
  const moreTotal = plan.unbudgeted.slice(SHOWN_UNBUDGETED).reduce((sum, row) => sum + row.spent, 0);
  const preview = `${shown.map((row) => row.categoryName).join(", ")}${moreCount > 0 ? ` and ${moreCount} more` : ""}`;

  return (
    <>
      {plan.groups.length === 0 && (
        <RowGroupHead columns={COLUMNS} first>
          <div className="flex min-w-0 items-center gap-2.5">
            <Monogram people={monogram} />
            <span className="text-[15px] font-semibold whitespace-nowrap">{person.key === "me" ? "Me" : person.name}</span>
            <span className="truncate text-[13px] text-n-600">
              No budgets yet · Rs {formatMoney(plan.totalSpent, { currency: false })} spent
            </span>
          </div>
          <div className="col-span-4 flex justify-end">
            <Button className="h-auto px-1.5 py-0.75 text-[13px]" onClick={onNew} type="button" variant="ghost">
              <Plus />
              Set a budget
            </Button>
          </div>
        </RowGroupHead>
      )}

      {plan.groups.map((group, index) => {
        const usedRatio = group.planned > 0 ? group.spent / group.planned : 0;
        const left = group.planned - group.spent;
        return (
          <Fragment key={group.kind}>
            <RowGroupHead columns={COLUMNS} first={index === 0}>
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="text-[15px] font-semibold whitespace-nowrap">{group.label}</span>
                <span className="truncate text-[13px] text-n-600">
                  {group.rows.length} {group.rows.length === 1 ? "line" : "lines"}
                </span>
              </div>
              <div className="text-right text-[15px] font-semibold">
                <Money value={group.planned} />
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
            </RowGroupHead>

            {group.rows.map((row) => {
              const rowRatio = row.planned > 0 ? row.spent / row.planned : 0;
              const rowLeft = row.planned - row.spent;
              return (
                <Row columns={COLUMNS} key={row.categoryId} onClick={() => onRow(row)}>
                  <span className="truncate text-[15px] whitespace-nowrap">{row.categoryName}</span>
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
                    <span className={cn("w-10.5 text-right text-[13px]", rowRatio > 1 ? "text-signal-ink" : "text-n-700")}>{pct(rowRatio)}</span>
                  </div>
                </Row>
              );
            })}
          </Fragment>
        );
      })}

      {plan.unbudgeted.length > 0 && (
        <>
          <Row columns={COLUMNS} onClick={() => setOpenUnbudgeted(!openUnbudgeted)}>
            <div className="col-span-2 flex min-w-0 items-center gap-2">
              <ChevronRight aria-hidden className={cn("size-3.5 shrink-0 text-n-600 transition-transform", openUnbudgeted && "rotate-90")} />
              <span className="shrink-0 text-sm text-n-800">Without a budget</span>
              <span className="truncate text-[13px] text-n-600">{preview}</span>
            </div>
            <div className="text-right text-[15px]">
              <Money value={plan.unbudgetedTotal} />
            </div>
            <div />
            <div className="text-[13px] text-n-600">
              {plan.unbudgeted.length} {plan.unbudgeted.length === 1 ? "category" : "categories"}
            </div>
          </Row>

          {openUnbudgeted &&
            shown.map((row) => (
              <Row className="bg-ink/3" columns={COLUMNS} key={row.categoryId}>
                <div className="col-span-2 truncate pl-5.5 text-sm text-n-800">{row.categoryName}</div>
                <div className="text-right text-sm">
                  <Money value={row.spent} />
                </div>
                <div />
                <div className="flex">
                  <Button className="h-auto px-1.5 py-0.5 text-[13px]" onClick={() => onCategory(row.categoryId)} type="button" variant="ghost">
                    Set budget
                  </Button>
                </div>
              </Row>
            ))}

          {openUnbudgeted && moreCount > 0 && (
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
    </>
  );
}
