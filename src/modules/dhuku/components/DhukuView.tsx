"use client";

import { useState } from "react";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Ledger, LedgerCell } from "@/components/Ledger";
import { LineTabs } from "@/components/LineTabs";
import { Money } from "@/components/Money";
import { Monogram, type MonogramPerson } from "@/components/Monogram";
import { PageHeader } from "@/components/PageHeader";
import { RowMenu } from "@/components/RowMenu";
import { Row, type RowColumns, RowsHeader } from "@/components/Rows";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deleteDhukuAction, deleteDhukuEntryAction } from "@/modules/dhuku/api/dhuku.actions";
import { DhukuDialog, type DhukuEditing, type DhukuOwnerKey } from "@/modules/dhuku/components/DhukuDialog";
import { LogEntryDialog, type LogEntryTarget } from "@/modules/dhuku/components/LogEntryDialog";
import type { DhukuCell } from "@/modules/dhuku/lib/dhuku-view";

type Member = { id: string; name: string };

export type DhukuEntryModel = { amount: number; dateLabel: string; id: string; type: "contribution" | "payout" };

export type DhukuRowModel = {
  active: boolean;
  cells: DhukuCell[];
  completed: boolean;
  contributed: number;
  editing: DhukuEditing;
  entries: DhukuEntryModel[];
  id: string;
  monthly: number;
  monthText: string;
  name: string;
  nextLabel: string;
  nextSub: string;
  nextTone: "default" | "muted" | "negative";
  ownerKey: DhukuOwnerKey;
  pct: number;
  pot: number;
};

type LedgerFigures = {
  active: string;
  activeSub: string;
  contributed: number;
  due: number;
  dueSub: string;
  received: number;
  recvSub: string;
};

type Props = {
  currentMemberId: string;
  defaultStartDate: string;
  ledger: LedgerFigures;
  members: Member[];
  rows: DhukuRowModel[];
};

type Tab = "active" | "all" | "completed";

const COLUMNS: RowColumns = {
  lg: "minmax(170px,1.3fr) minmax(170px,1.3fr) minmax(0,0.9fr) minmax(0,1fr) 128px",
  md: "minmax(140px,1.2fr) minmax(130px,1.1fr) minmax(0,0.9fr) minmax(0,1fr) 120px",
  sm: "minmax(120px,1.2fr) minmax(100px,1fr) minmax(0,0.9fr) minmax(0,1fr) 116px",
};

const CELL_STYLE: Record<DhukuCell["state"], string> = {
  next: "shadow-[inset_0_0_0_1.5px_var(--ink)]",
  paid: "bg-ink",
  payout: "bg-signal",
  upcoming: "shadow-[inset_0_0_0_1px_var(--n-400)]",
};

export function DhukuView(props: Props) {
  const { currentMemberId, members } = props;
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dialog, setDialog] = useState<{ editing: null | DhukuEditing; open: boolean }>({ editing: null, open: false });
  const [logTarget, setLogTarget] = useState<LogEntryTarget | null>(null);

  const me = members.find((m) => m.id === currentMemberId);
  const partner = members.find((m) => m.id !== currentMemberId) ?? null;
  const people: Record<"me" | "partner", MonogramPerson> = {
    me: { name: me?.name ?? "Me", role: "me" },
    partner: { name: partner?.name ?? "Partner", role: "partner" },
  };
  const label = (key: DhukuOwnerKey) => (key === "shared" ? "Shared" : key === "me" ? "Me" : (partner?.name ?? "Partner"));
  const monograms = (key: DhukuOwnerKey): MonogramPerson[] => {
    if (key === "shared") return partner ? [people.me, people.partner] : [people.me];
    return [people[key]];
  };

  const counts = {
    active: props.rows.filter((row) => row.active).length,
    all: props.rows.length,
    completed: props.rows.filter((row) => row.completed).length,
  };
  const visible = props.rows.filter((row) => tab === "all" || (tab === "active" ? row.active : row.completed));

  async function run(action: () => Promise<unknown>, done: string) {
    try {
      await action();
      toast.success(done);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function remove(row: DhukuRowModel) {
    if (!window.confirm(`Delete "${row.name}"? Its entries are removed too.`)) return;
    return run(() => deleteDhukuAction(row.id), "Dhuku deleted");
  }

  return (
    <div>
      <PageHeader
        actions={
          <Button onClick={() => setDialog({ editing: null, open: true })} variant="secondary">
            <Plus />
            Add dhuku
          </Button>
        }
        subtitle="Rotating savings groups you're part of"
        title="Dhuku"
      />

      <Ledger>
        <LedgerCell label="Due this month" lead note={props.ledger.dueSub}>
          <Money size="lead" value={props.ledger.due} />
        </LedgerCell>
        <LedgerCell label="Contributed" note="All-time">
          <Money size="cell" value={props.ledger.contributed} />
        </LedgerCell>
        <LedgerCell label="Received" note={props.ledger.recvSub}>
          <Money size="cell" value={props.ledger.received} />
        </LedgerCell>
        <LedgerCell label="Active groups" note={props.ledger.activeSub}>
          <span className="text-2xl leading-none font-semibold tabular-nums">{props.ledger.active}</span>
        </LedgerCell>
      </Ledger>

      <LineTabs
        aside={
          <span className="flex items-center gap-4 text-xs text-n-700">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.25 bg-ink" />
              Paid
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.25 bg-signal" />
              Payout received
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.25 shadow-[inset_0_0_0_1px_var(--n-500)]" />
              To come
            </span>
          </span>
        }
        className="mt-5.5"
        label="Status"
        onChange={(value) => setTab(value)}
        tabs={[
          { count: counts.all, label: "All", value: "all" },
          { count: counts.active, label: "Active", value: "active" },
          { count: counts.completed, label: "Completed", value: "completed" },
        ]}
        value={tab}
      />

      <RowsHeader columns={COLUMNS}>
        <span>Group</span>
        <span>Months</span>
        <span className="text-right">Contributed</span>
        <span>Next payment</span>
        <span />
      </RowsHeader>

      {visible.map((row) => {
        const open = expanded[row.id] ?? false;
        return (
          <div key={row.id}>
            <Row columns={COLUMNS} onClick={() => setExpanded((prev) => ({ ...prev, [row.id]: !open }))}>
              <div className="flex min-w-0 flex-col gap-1">
                <span className={cn("truncate text-[15px] font-semibold", row.completed && "text-n-600")}>{row.name}</span>
                <span className="flex min-w-0 items-center gap-2">
                  <Monogram people={monograms(row.ownerKey)} size="sm" />
                  <span className="truncate text-[13px] text-n-600">
                    {label(row.ownerKey)} · Rs {Math.round(row.monthly).toLocaleString("en-US")} a month
                  </span>
                </span>
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="flex gap-0.75">
                  {row.cells.map((cell, index) => (
                    <span
                      className={cn("h-3 max-w-4 flex-1", CELL_STYLE[cell.state])}
                      key={index}
                      title={cell.title}
                    />
                  ))}
                </span>
                <span className="text-xs text-n-700 tabular-nums">{row.monthText}</span>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[15px] font-semibold">
                  <Money value={row.contributed} />
                </span>
                <span className="text-xs whitespace-nowrap text-n-600">
                  of {Math.round(row.pot).toLocaleString("en-US")} · {row.pct}%
                </span>
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm whitespace-nowrap">{row.nextLabel}</span>
                <span
                  className={cn(
                    "text-xs whitespace-nowrap",
                    row.nextTone === "negative" ? "text-signal-ink" : row.nextTone === "muted" ? "text-n-600" : "text-n-600",
                  )}
                >
                  {row.nextSub}
                </span>
              </div>
              <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                {row.active && (
                  <Button
                    className="h-auto px-2.5 py-1.25 text-[13px]"
                    onClick={() => setLogTarget({ id: row.id, monthly: row.monthly, name: row.name, pot: row.pot })}
                    type="button"
                    variant="secondary"
                  >
                    Log entry
                  </Button>
                )}
                <RowMenu
                  items={[
                    { label: "Edit", onSelect: () => setDialog({ editing: row.editing, open: true }) },
                    { destructive: true, label: "Delete", onSelect: () => void remove(row) },
                  ]}
                />
              </div>
            </Row>

            {open && row.entries.length > 0 && (
              <div className="border-b border-n-300 bg-ink/3 px-2 py-2">
                {row.entries.map((entry) => (
                  <div className="grid grid-cols-[120px_minmax(0,1fr)_auto_auto] items-center gap-4 border-b border-n-200 py-1.5 last:border-0" key={entry.id}>
                    <span className="text-[13px] text-n-600">{entry.dateLabel}</span>
                    <span className="text-sm">{entry.type === "payout" ? "Payout received" : "Contribution"}</span>
                    <span className="text-sm font-semibold">
                      <Money value={entry.amount} />
                    </span>
                    <Button
                      className="h-auto px-1.5 py-0.5 text-[13px]"
                      onClick={() => void run(() => deleteDhukuEntryAction(entry.id), "Entry deleted")}
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
          {tab === "completed" ? "No completed dhukus yet." : "No dhukus here yet."}
        </div>
      )}

      <button
        className="flex w-full items-center gap-2 border-b border-n-300 px-2 py-3.5 text-left text-sm text-n-700 hover:bg-ink/4 hover:text-ink"
        onClick={() => setDialog({ editing: null, open: true })}
        type="button"
      >
        <Plus aria-hidden className="size-3.75" />
        Add a dhuku
      </button>

      <DhukuDialog
        currentMemberId={currentMemberId}
        defaultStartDate={props.defaultStartDate}
        editing={dialog.editing}
        members={members}
        onOpenChange={(value) => !value && setDialog({ editing: null, open: false })}
        open={dialog.open}
      />

      <LogEntryDialog onOpenChange={(value) => !value && setLogTarget(null)} open={logTarget !== null} target={logTarget} />
    </div>
  );
}
