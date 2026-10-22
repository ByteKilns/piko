"use client";

import { Fragment, type ReactNode, useState } from "react";

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
import { PayDialog } from "@/modules/budget/components/PayDialog";
import type { BudgetLead, PersonPlan, PlanRow, SharedRow } from "@/modules/budget/lib/budget-view";
import type { ExtraIncome } from "@/modules/budget/lib/income";
import type { BudgetLineKind } from "@/modules/budget/lib/plan-lines";
import type { SetAsideRow } from "@/modules/budget/lib/set-aside";
import { FundDialog, type FundView } from "@/modules/funds/components/FundDialog";
import type { YearMonth } from "@/modules/funds/lib/fund-math";

type Category = { budgetType: "fixed" | "flexible"; groupName: string; id: string; name: string };

type LedgerFigures = {
  budgeted: number;
  budgetedSub: string;
  pay: number;
  paySub: null | string;
  // How much of pay the plan uses: set aside plus budgeted, over pay.
  plannedRatio: number;
  setAside: number;
  setAsideSub: string;
  unplanned: number;
  unplannedSub: string;
};

export type PersonView = {
  // Set when this month shows a plan carried over from an earlier month.
  carriedFrom: null | string;
  funds: FundView[];
  key: "me" | "partner";
  lastKinds: Record<string, BudgetLineKind>;
  lead: BudgetLead;
  ledger: LedgerFigures;
  memberId: string;
  name: string;
  pay: { amount: number; carriedFrom: null | string; extras: ExtraIncome[] };
  plan: PersonPlan;
  setAside: { done: number; planned: number; rows: SetAsideRow[] };
  spentByCategory: Record<string, number>;
};

type Props = {
  categories: Category[];
  // Months a fund can be needed by.
  dueOptions: { label: string; value: string }[];
  month: number;
  monthLabel: string;
  monthNav: MonthNavModel;
  now: YearMonth;
  people: PersonView[];
  shared: SharedRow[];
  year: number;
};

type Tab = "me" | "partner" | "shared";

const COLUMNS: RowColumns = {
  lg: "minmax(170px,1.6fr) repeat(3,minmax(0,0.85fr)) minmax(140px,1.2fr)",
  md: "minmax(0,1fr) auto",
  sm: "minmax(0,1fr) auto",
};
const SHOWN_UNBUDGETED = 4;

// Below 780px (a phone, a tablet) a row is just its name and what's left:
// Budget, Spent and the Used bar don't fit next to six-figure amounts, so
// they're hidden (WIDE) and said in a line under the name (PhoneNote).
const WIDE = "@max-[779px]:hidden";

function PhoneNote({ children }: { children: ReactNode }) {
  return <span className="truncate text-xs text-n-600 @min-[780px]:hidden">{children}</span>;
}

function spentOf(spent: number, planned: number, ratio: number) {
  return `${formatMoney(spent, { currency: false })} of ${formatMoney(planned, { currency: false })} · ${pct(ratio)}`;
}

function pct(ratio: number) {
  return `${Math.round(ratio * 100)}%`;
}

export function BudgetView(props: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("me");
  const [openUnbudgeted, setOpenUnbudgeted] = useState(false);
  const [dialog, setDialog] = useState<{ defaultCategoryId?: string; initial?: BudgetDraft; open: boolean }>({ open: false });
  const [payOpen, setPayOpen] = useState(false);
  // The fund is looked up by id on every render, so its balance updates after "Add money".
  const [fundDialog, setFundDialog] = useState<{ fundId?: string; open: boolean }>({ open: false });
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
                <Button onClick={() => setPayOpen(true)} variant="ghost">
                  Pay &amp; extra
                </Button>
              </>
            )}
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

          <Ledger data-tour="budget-ledger">
            <LedgerCell
              bar={<Meter ratio={person.ledger.plannedRatio} />}
              label="Left to plan"
              lead
              note={<span className={cn(person.ledger.unplanned < 0 && "text-signal-ink")}>{person.ledger.unplannedSub}</span>}
            >
              <Money size="lead" tone={person.ledger.unplanned < 0 ? "negative" : "default"} value={person.ledger.unplanned} />
            </LedgerCell>
            <LedgerCell label="Pay" note={person.ledger.paySub} onSelect={() => setPayOpen(true)}>
              <Money size="cell" value={person.ledger.pay} />
            </LedgerCell>
            <LedgerCell label="Set aside first" note={person.ledger.setAsideSub}>
              <Money size="cell" value={person.ledger.setAside} />
            </LedgerCell>
            <LedgerCell label="Budgeted" note={person.ledger.budgetedSub}>
              <Money size="cell" value={person.ledger.budgeted} />
            </LedgerCell>
          </Ledger>
        </>
      )}

      <div data-tour="budget-whose">
        <LineTabs
          aside={person ? "Click a row to change its budget" : undefined}
          className="mt-5.5 mb-6.5"
          label="Whose plan"
          onChange={(value) => setTab(value)}
          tabs={tabs}
          value={tab}
        />
      </div>

      {person?.carriedFrom && (
        <p className="mb-4 text-[13px] text-n-700">
          Carried over from {person.carriedFrom}. Changing a line makes this month&apos;s plan its own.
        </p>
      )}

      <RowsHeader columns={COLUMNS}>
        <span>Category</span>
        <span className={cn("text-right", WIDE)}>Budget</span>
        <span className={cn("text-right", WIDE)}>Spent</span>
        <span className="text-right">Left</span>
        <span className={WIDE}>Used</span>
      </RowsHeader>

      {person && person.setAside.rows.length > 0 && <SetAsideRows setAside={person.setAside} />}

      {person && (
        <PersonRows
          afterSetAside={person.setAside.rows.length > 0}
          monogram={monogram(person)}
          onCategory={openCategory}
          onNew={openNew}
          onRow={openRow}
          openUnbudgeted={openUnbudgeted}
          person={person}
          setOpenUnbudgeted={setOpenUnbudgeted}
        />
      )}

      {person && (
        <FundRows
          canEdit={person.key === "me"}
          funds={person.funds}
          onAdd={() => setFundDialog({ open: true })}
          onFund={(fund) => setFundDialog({ fundId: fund.id, open: true })}
        />
      )}

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
            <div className={WIDE} />
            <div className={WIDE} />
            <div className={WIDE} />
          </RowGroupHead>
          {props.shared.map((row) => (
            <Row columns={COLUMNS} key={row.categoryId}>
              <span className="truncate text-[15px] whitespace-nowrap">{row.categoryName}</span>
              <div className="text-right text-[15px]">
                <Money value={row.planned} />
              </div>
              <div className={cn("text-right text-[15px] text-n-500", WIDE)}>—</div>
              <div className={cn("text-right text-[15px] text-n-500", WIDE)}>—</div>
              <div className={WIDE} />
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

      {person?.key === "me" && (
        <FundDialog
          dueOptions={props.dueOptions}
          fund={person.funds.find((f) => f.id === fundDialog.fundId)}
          now={props.now}
          onOpenChange={(value) => !value && setFundDialog({ open: false })}
          open={fundDialog.open}
        />
      )}

      {person && (
        <PayDialog
          extras={person.pay.extras}
          memberId={person.memberId}
          month={props.month}
          monthLabel={props.monthLabel}
          onOpenChange={setPayOpen}
          open={payOpen}
          pay={person.pay.amount}
          payCarriedFrom={person.pay.carriedFrom}
          title={person.key === "me" ? "Your pay" : `${person.name}'s pay`}
          year={props.year}
        />
      )}
    </div>
  );
}

// "Set aside first": savings plans, dhukus, loan installments (and later
// funds), filled in from what Piko already knows. Done is what has actually
// gone in this month.
function SetAsideRows({ setAside }: { setAside: PersonView["setAside"] }) {
  const ratio = setAside.planned > 0 ? setAside.done / setAside.planned : 0;
  return (
    <div data-tour="budget-set-aside">
      <RowGroupHead columns={COLUMNS} first>
        <div className="flex min-w-0 flex-col">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="text-[15px] font-semibold whitespace-nowrap">Set aside first</span>
            <span className="truncate text-[13px] text-n-600">Filled in from savings, dhuku, loans and funds</span>
          </div>
          <PhoneNote>{spentOf(setAside.done, setAside.planned, ratio)}</PhoneNote>
        </div>
        <div className={cn("text-right text-[15px] font-semibold", WIDE)}>
          <Money value={setAside.planned} />
        </div>
        <div className={cn("text-right text-[15px] font-semibold", WIDE)}>
          <Money value={setAside.done} />
        </div>
        <div className="text-right text-[15px] font-semibold">
          <Money value={Math.max(0, setAside.planned - setAside.done)} />
        </div>
        <div className={cn("flex min-w-0 items-center gap-2.5", WIDE)}>
          <Meter className="flex-1" ratio={Math.min(1, ratio)} />
          <span className="w-10.5 text-right text-[13px] font-semibold text-ink">{pct(ratio)}</span>
        </div>
      </RowGroupHead>
      {setAside.rows.map((row) => {
        const rowRatio = row.planned > 0 ? row.done / row.planned : 0;
        return (
          <Row columns={COLUMNS} key={row.id}>
            <div className="flex min-w-0 flex-col">
              <div className="flex min-w-0 items-baseline gap-2.5">
                <span className="truncate text-[15px] whitespace-nowrap">{row.label}</span>
                <span className="shrink-0 text-xs text-n-600">{row.sub}</span>
              </div>
              <PhoneNote>{spentOf(row.done, row.planned, rowRatio)}</PhoneNote>
            </div>
            <div className={cn("text-right text-[15px]", WIDE)}>
              <Money value={row.planned} />
            </div>
            <div className={cn("text-right text-[15px]", WIDE)}>
              <Money value={row.done} />
            </div>
            <div className="text-right text-[15px]">
              <Money value={Math.max(0, row.planned - row.done)} />
            </div>
            <div className={cn("flex min-w-0 items-center gap-2.5", WIDE)}>
              <Meter className="flex-1" ratio={Math.min(1, rowRatio)} />
              <span className="w-10.5 text-right text-[13px] text-n-700">{pct(rowRatio)}</span>
            </div>
          </Row>
        );
      })}
    </div>
  );
}

type FundRowsProps = {
  // Funds are their owner's: only your own can be added to or changed.
  canEdit: boolean;
  funds: FundView[];
  onAdd: () => void;
  onFund: (fund: FundView) => void;
};

// Funds: each one's monthly set-aside, what it holds, and its target.
function FundRows({ canEdit, funds, onAdd, onFund }: FundRowsProps) {
  if (!canEdit && funds.length === 0) return null;
  return (
    <>
      <RowGroupHead columns={COLUMNS}>
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="text-[15px] font-semibold whitespace-nowrap">Funds</span>
          <span className="truncate text-[13px] text-n-600">
            {funds.length === 0 ? "Money set aside for occasional costs" : "Monthly, holds, target"}
          </span>
        </div>
        <div className="col-span-4 flex justify-end @max-[779px]:col-span-1">
          {canEdit && (
            <Button className="h-auto px-1.5 py-0.75 text-[13px]" onClick={onAdd} type="button" variant="ghost">
              <Plus />
              Add fund
            </Button>
          )}
        </div>
      </RowGroupHead>
      {funds.map((fund) => {
        const ratio = fund.target ? Math.max(0, fund.balance / fund.target) : 0;
        const short = fund.suggested !== null && fund.suggested > fund.monthlyAmount;
        return (
          <Row columns={COLUMNS} key={fund.id} onClick={canEdit ? () => onFund(fund) : undefined}>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[15px] whitespace-nowrap">{fund.name}</span>
              {fund.dueLabel && (
                <span className={cn("truncate text-xs", short ? "text-signal-ink" : "text-n-600")}>
                  Needed by {fund.dueLabel}
                  {short && fund.suggested !== null ? ` · needs ${formatMoney(fund.suggested)} a month` : ""}
                </span>
              )}
              <PhoneNote>
                {formatMoney(fund.monthlyAmount, { currency: false })} a month
                {fund.target !== null && ` · target ${formatMoney(fund.target, { currency: false })}`}
              </PhoneNote>
            </div>
            <div className={cn("text-right text-[15px]", WIDE)}>
              <Money value={fund.monthlyAmount} />
            </div>
            <div className="text-right text-[15px]">
              <Money tone={fund.balance < 0 ? "negative" : "default"} value={fund.balance} />
            </div>
            <div className={cn("text-right text-[15px]", WIDE)}>
              {fund.target === null ? <span className="text-n-500">—</span> : <Money value={fund.target} />}
            </div>
            <div className={cn("flex min-w-0 items-center gap-2.5", WIDE)}>
              {fund.target !== null && (
                <>
                  <Meter className="flex-1" ratio={Math.min(1, ratio)} />
                  <span className="w-10.5 text-right text-[13px] text-n-700">{pct(ratio)}</span>
                </>
              )}
            </div>
          </Row>
        );
      })}
    </>
  );
}

type PersonRowsProps = {
  // The "Set aside first" group sits above, so the first kind group isn't first on the page.
  afterSetAside: boolean;
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
function PersonRows({ afterSetAside, monogram, onCategory, onNew, onRow, openUnbudgeted, person, setOpenUnbudgeted }: PersonRowsProps) {
  const { plan } = person;
  const shown = plan.unbudgeted.slice(0, SHOWN_UNBUDGETED);
  const moreCount = plan.unbudgeted.length - shown.length;
  const moreTotal = plan.unbudgeted.slice(SHOWN_UNBUDGETED).reduce((sum, row) => sum + row.spent, 0);
  const preview = `${shown.map((row) => row.categoryName).join(", ")}${moreCount > 0 ? ` and ${moreCount} more` : ""}`;

  return (
    <>
      {plan.groups.length === 0 && (
        <RowGroupHead columns={COLUMNS} first={!afterSetAside}>
          <div className="flex min-w-0 items-center gap-2.5">
            <Monogram people={monogram} />
            <span className="text-[15px] font-semibold whitespace-nowrap">{person.key === "me" ? "Me" : person.name}</span>
            <span className="truncate text-[13px] text-n-600">
              No budgets yet · Rs {formatMoney(plan.totalSpent, { currency: false })} spent
            </span>
          </div>
          <div className="col-span-4 flex justify-end @max-[779px]:col-span-1">
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
            <RowGroupHead columns={COLUMNS} first={index === 0 && !afterSetAside}>
              <div className="flex min-w-0 flex-col">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="text-[15px] font-semibold whitespace-nowrap">{group.label}</span>
                  <span className="truncate text-[13px] text-n-600">
                    {group.rows.length} {group.rows.length === 1 ? "line" : "lines"}
                  </span>
                </div>
                <PhoneNote>{spentOf(group.spent, group.planned, usedRatio)}</PhoneNote>
              </div>
              <div className={cn("text-right text-[15px] font-semibold", WIDE)}>
                <Money value={group.planned} />
              </div>
              <div className={cn("text-right text-[15px] font-semibold", WIDE)}>
                <Money value={group.spent} />
              </div>
              <div className={cn("text-right text-[15px] font-semibold", left < 0 && "text-signal-ink")}>
                <Money tone={left < 0 ? "negative" : "default"} value={left} />
              </div>
              <div className={cn("flex min-w-0 items-center gap-2.5", WIDE)}>
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
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-[15px] whitespace-nowrap">{row.categoryName}</span>
                    <PhoneNote>{spentOf(row.spent, row.planned, rowRatio)}</PhoneNote>
                  </div>
                  <div className={cn("text-right text-[15px]", WIDE)}>
                    <Money value={row.planned} />
                  </div>
                  <div className={cn("text-right text-[15px]", WIDE)}>
                    <Money value={row.spent} />
                  </div>
                  <div className={cn("text-right text-[15px] font-semibold", rowLeft < 0 && "text-signal-ink")}>
                    <Money tone={rowLeft < 0 ? "negative" : "default"} value={rowLeft} />
                  </div>
                  <div className={cn("flex min-w-0 items-center gap-2.5", WIDE)}>
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
            <div className="col-span-2 flex min-w-0 items-center gap-2 @max-[779px]:col-span-1">
              <ChevronRight aria-hidden className={cn("size-3.5 shrink-0 text-n-600 transition-transform", openUnbudgeted && "rotate-90")} />
              <span className="shrink-0 text-sm text-n-800">Without a budget</span>
              <span className="truncate text-[13px] text-n-600">{preview}</span>
            </div>
            <div className="text-right text-[15px]">
              <Money value={plan.unbudgetedTotal} />
            </div>
            <div className={WIDE} />
            <div className={cn("text-[13px] text-n-600", WIDE)}>
              {plan.unbudgeted.length} {plan.unbudgeted.length === 1 ? "category" : "categories"}
            </div>
          </Row>

          {openUnbudgeted &&
            shown.map((row) => (
              <Row className="bg-ink/3" columns={COLUMNS} key={row.categoryId}>
                <div className="col-span-2 truncate pl-5.5 text-sm text-n-800 @max-[779px]:col-span-1">{row.categoryName}</div>
                <div className="text-right text-sm">
                  <Money value={row.spent} />
                </div>
                <div className={WIDE} />
                <div className="flex @max-[779px]:col-span-full @max-[779px]:pl-4">
                  <Button className="h-auto px-1.5 py-0.5 text-[13px]" onClick={() => onCategory(row.categoryId)} type="button" variant="ghost">
                    Set budget
                  </Button>
                </div>
              </Row>
            ))}

          {openUnbudgeted && moreCount > 0 && (
            <Row className="bg-ink/3" columns={COLUMNS}>
              <div className="col-span-2 truncate pl-5.5 text-sm text-n-800 @max-[779px]:col-span-1">
                {moreCount} more {moreCount === 1 ? "category" : "categories"}
              </div>
              <div className="text-right text-sm">
                <Money value={moreTotal} />
              </div>
              <div className={WIDE} />
              <div className={WIDE} />
            </Row>
          )}
        </>
      )}
    </>
  );
}
