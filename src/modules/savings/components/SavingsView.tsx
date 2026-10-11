"use client";

import { useState } from "react";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { EmptyState } from "@/components/EmptyState";
import { Ledger, LedgerCell } from "@/components/Ledger";
import { Meter } from "@/components/Meter";
import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { RowMenu } from "@/components/RowMenu";
import { Row, type RowColumns, RowsHeader } from "@/components/Rows";
import { SectionHeading } from "@/components/SectionHeading";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { todayISO } from "@/lib/today";
import { ExpenseDialog } from "@/modules/expenses/components/ExpenseDialog";
import { deleteSavingsDepositAction, deleteSavingsItemAction, moveSavingsItemAction } from "@/modules/savings/api/savings.actions";
import { DepositDialog } from "@/modules/savings/components/DepositDialog";
import { ItemDialog } from "@/modules/savings/components/ItemDialog";
import { PotDialog } from "@/modules/savings/components/PotDialog";

type Member = { id: string; name: string };
type Category = { groupName: string; id: string; name: string };

export type PotOwnerKey = "me" | "partner" | "shared";
export type SavingsItemModel = {
  affordable: string;
  cost: number;
  hint: null | string;
  id: string;
  name: string;
  neededBy: null | string;
  note: null | string;
  warning: null | string;
};
export type SavingsDoneModel = { id: string; name: string; paid: number };
export type SavingsDepositModel = { amount: number; byLabel: string; dateLabel: string; id: string };
export type SavingsPotModel = {
  balance: number;
  deposits: SavingsDepositModel[];
  done: SavingsDoneModel[];
  heldByMemberId: null | string;
  id: string;
  items: SavingsItemModel[];
  name: string;
  ownerKey: PotOwnerKey;
  ownerMemberId: null | string;
  planned: number;
  plans: { memberId: string; monthlyAmount: number }[];
  putIn: number;
  reserveMinimum: number;
  reserveNote: string;
};

type Props = {
  categories: Category[];
  currentMemberId: string;
  members: Member[];
  missing: PotOwnerKey[];
  pots: SavingsPotModel[];
};

type ItemDialogState = { editing: null | SavingsItemModel; open: boolean; potId: null | string };
type PotDialogState = { editing: null | SavingsPotModel; open: boolean; ownerKey: PotOwnerKey };

const COLUMNS: RowColumns = {
  lg: "32px minmax(160px,1.6fr) minmax(0,0.9fr) minmax(0,1.1fr) 150px",
  md: "28px minmax(130px,1.4fr) minmax(0,0.9fr) minmax(0,1.1fr) 140px",
  sm: "24px minmax(110px,1.4fr) minmax(0,0.9fr) minmax(0,1fr) 128px",
};

export function SavingsView(props: Props) {
  const { currentMemberId, members } = props;
  const router = useRouter();
  const [potDialog, setPotDialog] = useState<PotDialogState>({ editing: null, open: false, ownerKey: "shared" });
  const [depositPot, setDepositPot] = useState<null | SavingsPotModel>(null);
  const [itemDialog, setItemDialog] = useState<ItemDialogState>({ editing: null, open: false, potId: null });
  const [paying, setPaying] = useState<null | { item: SavingsItemModel; pot: SavingsPotModel }>(null);

  const partner = members.find((m) => m.id !== currentMemberId) ?? null;
  const memberName = (id: null | string) => members.find((m) => m.id === id)?.name ?? null;
  const potLabel = (key: PotOwnerKey) => (key === "shared" ? "the shared pot" : key === "me" ? "my pot" : `${partner?.name ?? "Partner"}'s pot`);

  async function run(action: () => Promise<unknown>, done: string) {
    try {
      await action();
      toast.success(done);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function removeItem(item: SavingsItemModel) {
    if (!window.confirm(`Delete "${item.name}" from the list?`)) return;
    return run(() => deleteSavingsItemAction(item.id), "Item deleted");
  }

  return (
    <div>
      <PageHeader
        actions={
          props.missing.length > 0 ? (
            <>
              {props.missing.map((key) => (
                <Button
                  className="h-9.5"
                  key={key}
                  onClick={() => setPotDialog({ editing: null, open: true, ownerKey: key })}
                  type="button"
                  variant="outline"
                >
                  <Plus />
                  Set up {potLabel(key)}
                </Button>
              ))}
            </>
          ) : undefined
        }
        subtitle="What you've put aside, and when you can afford what's next"
        title="Savings"
      />

      {props.pots.length === 0 && (
        <EmptyState
          body="Set up a pot for each real savings account: the shared one, and your own if you have one. Then list what you're saving for, most important first."
          size="lg"
          title="No savings set up yet"
        />
      )}

      {props.pots.map((pot) => {
        const heldBy = memberName(pot.heldByMemberId);
        const planText =
          pot.plans.length > 0
            ? pot.plans.map((p) => `${memberName(p.memberId) ?? "Former member"} ${formatMoney(p.monthlyAmount)}`).join(" · ")
            : "Nothing planned yet";
        const short = pot.planned - pot.putIn;
        return (
          <section className="mt-11" key={pot.id}>
            <SectionHeading
              aside={
                <span className="flex items-center gap-1">
                  <Button className="h-auto px-2.5 py-1.25 text-[13px]" onClick={() => setDepositPot(pot)} type="button" variant="outline">
                    Add money
                  </Button>
                  <RowMenu items={[{ label: "Pot settings", onSelect: () => setPotDialog({ editing: pot, open: true, ownerKey: pot.ownerKey }) }]} />
                </span>
              }
              sub={heldBy ? `In ${heldBy}'s account` : undefined}
            >
              {pot.name}
            </SectionHeading>

            <Ledger>
              <LedgerCell label="Balance" lead note={`${pot.items.length} on the list`}>
                <Money size="lead" value={pot.balance} />
              </LedgerCell>
              <LedgerCell
                bar={<Meter ratio={pot.reserveMinimum > 0 ? Math.min(1, Math.max(0, pot.balance) / pot.reserveMinimum) : 1} />}
                label="Emergency reserve"
                note={pot.reserveNote}
              >
                <Money size="cell" value={pot.reserveMinimum} />
              </LedgerCell>
              <LedgerCell label="Planned a month" note={planText}>
                <Money size="cell" value={pot.planned} />
              </LedgerCell>
              <LedgerCell
                label="Put in this month"
                note={pot.planned === 0 ? "No plan set" : short > 0 ? `${formatMoney(short)} short of the plan` : "On plan"}
              >
                <Money size="cell" value={pot.putIn} />
              </LedgerCell>
            </Ledger>

            <div className="mt-8">
              <RowsHeader columns={COLUMNS}>
                <span>#</span>
                <span>Saving for</span>
                <span className="text-right">Cost</span>
                <span>Affordable</span>
                <span />
              </RowsHeader>

              {pot.items.map((item, index) => (
                <Row columns={COLUMNS} key={item.id} onClick={() => setItemDialog({ editing: item, open: true, potId: pot.id })}>
                  <span className="text-[13px] text-n-600 tabular-nums">{index + 1}</span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[15px]">{item.name}</span>
                    {item.note && <span className="truncate text-[13px] text-n-600">{item.note}</span>}
                    {item.warning && <span className="text-[13px] text-signal-ink">{item.warning}</span>}
                    {item.hint && <span className="text-[13px] text-n-600">{item.hint}</span>}
                  </div>
                  <span className="text-right text-[15px] font-semibold">
                    <Money value={item.cost} />
                  </span>
                  <span className="text-sm">{item.affordable}</span>
                  <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                    <Button className="h-auto px-1.5 py-0.75 text-[13px]" onClick={() => setPaying({ item, pot })} type="button" variant="ghost">
                      Pay for this
                    </Button>
                    <RowMenu
                      items={[
                        ...(index > 0 ? [{ label: "Move up", onSelect: () => void run(() => moveSavingsItemAction(item.id, "up"), "Moved up") }] : []),
                        ...(index < pot.items.length - 1
                          ? [{ label: "Move down", onSelect: () => void run(() => moveSavingsItemAction(item.id, "down"), "Moved down") }]
                          : []),
                        { label: "Edit", onSelect: () => setItemDialog({ editing: item, open: true, potId: pot.id }) },
                        { destructive: true, label: "Delete", onSelect: () => void removeItem(item) },
                      ]}
                    />
                  </div>
                </Row>
              ))}

              {pot.items.length === 0 && (
                <div className="border-b border-n-300 px-2 py-6 text-sm text-n-700">
                  Nothing on the list yet. Add what you&apos;re saving for, most important first.
                </div>
              )}

              <button
                className="flex w-full items-center gap-2 border-b border-n-300 px-2 py-3.5 text-left text-sm text-n-700 hover:bg-ink/4 hover:text-ink"
                onClick={() => setItemDialog({ editing: null, open: true, potId: pot.id })}
                type="button"
              >
                <Plus aria-hidden className="size-3.75" />
                Add to the list
              </button>
            </div>

            {(pot.deposits.length > 0 || pot.done.length > 0) && (
              <div className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-x-12 gap-y-8">
                {pot.deposits.length > 0 && (
                  <div className="min-w-0">
                    <div className="micro-label border-b-2 border-rule pb-2.5 text-n-600">Recent money in</div>
                    {pot.deposits.map((deposit) => (
                      <div className="grid grid-cols-[90px_minmax(0,1fr)_auto_auto] items-center gap-4 border-b border-n-300 py-2" key={deposit.id}>
                        <span className="text-[13px] text-n-600">{deposit.dateLabel}</span>
                        <span className="truncate text-sm">{deposit.byLabel}</span>
                        <span className="text-sm font-semibold">
                          <Money value={deposit.amount} />
                        </span>
                        <Button
                          className="h-auto px-1.5 py-0.5 text-[13px]"
                          onClick={() => void run(() => deleteSavingsDepositAction(deposit.id), "Entry deleted")}
                          type="button"
                          variant="ghost"
                        >
                          Delete
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {pot.done.length > 0 && (
                  <div className="min-w-0">
                    <div className="micro-label border-b-2 border-rule pb-2.5 text-n-600">Done</div>
                    {pot.done.map((item) => (
                      <div className="flex items-baseline justify-between gap-4 border-b border-n-300 py-2" key={item.id}>
                        <span className="truncate text-sm">{item.name}</span>
                        <span className="text-sm">
                          <Money value={item.paid} />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}

      <PotDialog
        currentMemberId={currentMemberId}
        editing={potDialog.editing}
        members={members}
        onOpenChange={(open) => !open && setPotDialog((prev) => ({ ...prev, editing: null, open: false }))}
        open={potDialog.open}
        ownerKey={potDialog.ownerKey}
      />

      <DepositDialog
        currentMemberId={currentMemberId}
        members={members}
        onOpenChange={(open) => !open && setDepositPot(null)}
        open={depositPot !== null}
        pot={depositPot}
      />

      <ItemDialog
        editing={itemDialog.editing}
        onOpenChange={(open) => !open && setItemDialog({ editing: null, open: false, potId: null })}
        open={itemDialog.open}
        potId={itemDialog.potId}
      />

      <ExpenseDialog
        categories={props.categories}
        currentMemberId={currentMemberId}
        initial={
          paying
            ? {
                amount: paying.item.cost,
                categoryId: "",
                date: todayISO(),
                note: paying.item.name,
                ownerMemberId: paying.pot.ownerMemberId,
                paidByMemberId: paying.pot.heldByMemberId ?? currentMemberId,
                savingsItemId: paying.item.id,
                savingsItemName: paying.item.name,
                savingsPotId: paying.pot.id,
              }
            : undefined
        }
        members={members}
        onOpenChange={(open) => !open && setPaying(null)}
        open={paying !== null}
        savingsPots={props.pots.map((pot) => ({ id: pot.id, name: pot.name }))}
      />
    </div>
  );
}
