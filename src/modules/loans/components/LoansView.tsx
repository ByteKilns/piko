"use client";

import { useState } from "react";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Ledger, LedgerCell } from "@/components/Ledger";
import { LineTabs } from "@/components/LineTabs";
import { Meter } from "@/components/Meter";
import { Money } from "@/components/Money";
import { Monogram, type MonogramPerson } from "@/components/Monogram";
import { PageHeader } from "@/components/PageHeader";
import { RowMenu } from "@/components/RowMenu";
import { Row, type RowColumns, RowsHeader } from "@/components/Rows";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { deleteLoanAction, deleteLoanPaymentAction } from "@/modules/loans/api/loans.actions";
import { LoanDialog, type LoanEditing, type LoanOwnerKey } from "@/modules/loans/components/LoanDialog";
import { LoanPaymentDialog, type PaymentTarget } from "@/modules/loans/components/LoanPaymentDialog";

type Member = { id: string; name: string };

export type LoanPaymentModel = { amount: number; dateLabel: string; id: string; note: null | string };

export type LoanRowModel = {
  active: boolean;
  counterpartyName: string;
  direction: "given" | "taken";
  editing: LoanEditing;
  id: string;
  nextLabel: string;
  nextTone: "default" | "muted" | "negative";
  // What's still to come back (lent) or to pay (borrowed).
  outstanding: number;
  ownerKey: LoanOwnerKey;
  paid: number;
  payments: LoanPaymentModel[];
  pct: number;
  principal: number;
};

type LedgerFigures = { owe: number; owed: number; owedRatio: number };

type Props = {
  currentMemberId: string;
  ledger: LedgerFigures;
  members: Member[];
  rows: LoanRowModel[];
};

// Open (the default), Lent and Borrowed list loans with money still
// outstanding; finished ones are only under Settled.
type Tab = "given" | "open" | "settled" | "taken";

const COLUMNS: RowColumns = {
  lg: "minmax(180px,1.6fr) minmax(0,0.9fr) minmax(120px,1.2fr) minmax(0,1.1fr) 150px",
  md: "minmax(150px,1.5fr) minmax(max-content,0.9fr) minmax(100px,1.1fr) minmax(0,1fr) 140px",
  sm: "minmax(0,1fr) auto 28px",
};
// Below 560px Repaid and Next are said under the name, and Record payment is
// in the row's menu.
const WIDE = "@max-[559px]:hidden";

export function LoansView(props: Props) {
  const { currentMemberId, members } = props;
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("open");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dialog, setDialog] = useState<{ editing: null | LoanEditing; open: boolean }>({ editing: null, open: false });
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null);

  const me = members.find((m) => m.id === currentMemberId);
  const partner = members.find((m) => m.id !== currentMemberId) ?? null;
  const people: Record<"me" | "partner", MonogramPerson> = {
    me: { name: me?.name ?? "Me", role: "me" },
    partner: { name: partner?.name ?? "Partner", role: "partner" },
  };
  const label = (key: LoanOwnerKey) => (key === "shared" ? "Shared" : key === "me" ? "Me" : (partner?.name ?? "Partner"));
  const monograms = (key: LoanOwnerKey): MonogramPerson[] => {
    if (key === "shared") return partner ? [people.me, people.partner] : [people.me];
    return [people[key]];
  };

  const openRows = props.rows.filter((r) => r.active);
  const counts = {
    given: openRows.filter((r) => r.direction === "given").length,
    open: openRows.length,
    settled: props.rows.length - openRows.length,
    taken: openRows.filter((r) => r.direction === "taken").length,
  };
  const visible = props.rows.filter((row) => {
    if (tab === "settled") return !row.active;
    if (!row.active) return false;
    return tab === "open" || row.direction === tab;
  });
  const net = props.ledger.owed - props.ledger.owe;

  async function run(action: () => Promise<unknown>, done: string) {
    try {
      await action();
      toast.success(done);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function remove(row: LoanRowModel) {
    if (!window.confirm(`Delete the loan with ${row.counterpartyName}? Its payments are removed too.`)) return;
    return run(() => deleteLoanAction(row.id), "Loan deleted");
  }

  return (
    <div>
      <PageHeader
        actions={
          <Button className="h-9.5" onClick={() => setDialog({ editing: null, open: true })} variant="outline">
            <Plus />
            Add loan
          </Button>
        }
        subtitle="Money you've lent and borrowed"
        title="Loans"
      />

      <Ledger data-tour="loans-ledger">
        <LedgerCell bar={<Meter ratio={props.ledger.owedRatio} />} label="To get back" lead note="Still owed to you">
          <Money size="lead" value={props.ledger.owed} />
        </LedgerCell>
        <LedgerCell label="To pay" note="Still owed by you">
          <Money size="cell" value={props.ledger.owe} />
        </LedgerCell>
        <LedgerCell label="Net" note={net > 0 ? "You're owed overall" : net < 0 ? "You owe overall" : "All square"}>
          <Money size="cell" tone={net < 0 ? "negative" : "default"} value={net} />
        </LedgerCell>
      </Ledger>

      <LineTabs
        className="mt-5.5 mb-6.5"
        data-tour="loans-tabs"
        label="Direction"
        onChange={(value) => setTab(value)}
        tabs={[
          { count: counts.open, label: "Open", value: "open" },
          { count: counts.given, label: "Lent", value: "given" },
          { count: counts.taken, label: "Borrowed", value: "taken" },
          { count: counts.settled, label: "Settled", value: "settled" },
        ]}
        value={tab}
      />

      <RowsHeader columns={COLUMNS}>
        <span>Counterparty</span>
        <span className="text-right">{tab === "settled" ? "Principal" : "Left"}</span>
        <span className={WIDE}>Repaid</span>
        <span className={WIDE}>Next</span>
        <span />
      </RowsHeader>

      {visible.map((row) => {
        const open = expanded[row.id] ?? false;
        return (
          <div key={row.id}>
            <Row columns={COLUMNS} onClick={() => setExpanded((prev) => ({ ...prev, [row.id]: !open }))}>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className={cn("truncate text-[15px] font-semibold", !row.active && "text-n-600")}>{row.counterpartyName}</span>
                  <span className="shrink-0 text-xs text-n-600">{row.direction === "given" ? "Lent" : "Borrowed"}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Monogram people={monograms(row.ownerKey)} size="sm" />
                  <span className="text-[13px] text-n-600">{label(row.ownerKey)}</span>
                </span>
                <span className={cn("text-xs @min-[560px]:hidden", row.nextTone === "negative" ? "text-signal-ink" : "text-n-600")}>
                  {row.pct}% repaid{row.nextLabel === "—" ? "" : ` · ${row.nextLabel}`}
                </span>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                {row.active ? (
                  <>
                    <span className="text-[15px] font-semibold">
                      <Money value={row.outstanding} />
                    </span>
                    <span className="text-xs whitespace-nowrap text-n-600">of {formatMoney(row.principal, { currency: false })}</span>
                  </>
                ) : (
                  <span className="text-[15px] text-n-600">
                    <Money tone="muted" value={row.principal} />
                  </span>
                )}
              </div>
              <div className={cn("flex min-w-0 items-center gap-2.5", WIDE)}>
                <Meter className="flex-1" ratio={row.pct / 100} />
                <span className="w-9.5 text-right text-[13px] text-n-700 tabular-nums">{row.pct}%</span>
              </div>
              <div className={cn("flex min-w-0 flex-col gap-0.5", WIDE)}>
                <span
                  className={cn(
                    "truncate text-sm whitespace-nowrap",
                    row.nextTone === "negative" ? "text-signal-ink" : row.nextTone === "muted" ? "text-n-600" : "text-n-800",
                  )}
                >
                  {row.nextLabel}
                </span>
              </div>
              <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                {row.active && (
                  <Button
                    className={cn("h-auto px-2.5 py-1.25 text-[13px]", WIDE)}
                    onClick={() => setPaymentTarget({ id: row.id, name: row.counterpartyName })}
                    type="button"
                    variant="outline"
                  >
                    Record payment
                  </Button>
                )}
                <RowMenu
                  items={[
                    ...(row.active ? [{ label: "Record payment", onSelect: () => setPaymentTarget({ id: row.id, name: row.counterpartyName }) }] : []),
                    { label: "Edit", onSelect: () => setDialog({ editing: row.editing, open: true }) },
                    { destructive: true, label: "Delete", onSelect: () => void remove(row) },
                  ]}
                />
              </div>
            </Row>

            {open && row.payments.length > 0 && (
              <div className="border-b border-n-300 bg-ink/3 px-2 py-2">
                {row.payments.map((payment) => (
                  <div
                    className="grid grid-cols-[120px_minmax(0,1fr)_auto_auto] items-center gap-4 border-b border-n-200 py-1.5 last:border-0 @max-[559px]:grid-cols-[72px_minmax(0,1fr)_auto_auto] @max-[559px]:gap-2"
                    key={payment.id}
                  >
                    <span className="text-[13px] text-n-600">{payment.dateLabel}</span>
                    <span className="truncate text-sm">{payment.note ?? "Payment"}</span>
                    <span className="text-sm font-semibold">
                      <Money value={payment.amount} />
                    </span>
                    <Button
                      className="h-auto px-1.5 py-0.5 text-[13px]"
                      onClick={() => void run(() => deleteLoanPaymentAction(payment.id), "Payment deleted")}
                      type="button"
                      variant="ghost"
                    >
                      Delete
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {visible.length === 0 && (
        <div className="border-b border-n-300 px-2 py-9 text-sm text-n-700">
          {tab !== "settled" && counts.settled > 0 ? "Nothing outstanding. Finished loans are under Settled." : "Nothing here yet."}
        </div>
      )}

      <LoanDialog
        currentMemberId={currentMemberId}
        editing={dialog.editing}
        members={members}
        onOpenChange={(value) => !value && setDialog({ editing: null, open: false })}
        open={dialog.open}
      />

      <LoanPaymentDialog
        currentMemberId={currentMemberId}
        onOpenChange={(value) => !value && setPaymentTarget(null)}
        open={paymentTarget !== null}
        target={paymentTarget}
      />
    </div>
  );
}
