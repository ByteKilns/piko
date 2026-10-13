"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AmountInput } from "@/components/AmountInput";
import { Modal } from "@/components/Modal";
import { Money } from "@/components/Money";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { addExtraIncomeAction, deleteIncomeAction, setPayAction } from "@/modules/budget/api/budget.actions";
import type { ExtraIncome } from "@/modules/budget/lib/income";

type Props = {
  extras: ExtraIncome[];
  memberId: string;
  month: number;
  monthLabel: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pay: number;
  // The month the pay was carried over from, e.g. "Asoj 2083", if any.
  payCarriedFrom: null | string;
  // "Your pay" or "Karuna's pay".
  title: string;
  year: number;
};

const FORM_ID = "pay-form";

// One person's pay for the month (it carries forward to later months) and
// any extra income on top. Fields unmount with the dialog, so every open
// starts from the saved figures again.
export function PayDialog({ onOpenChange, open, ...rest }: Props) {
  const [pending, setPending] = useState(false);

  return (
    <Modal
      className="sm:max-w-110"
      footer={
        <Button className="min-w-35 justify-start" disabled={pending} form={FORM_ID} type="submit">
          {pending ? "Saving..." : "Save pay"}
        </Button>
      }
      hint="Enter to save · Esc to close"
      onOpenChange={onOpenChange}
      open={open}
      subtitle={rest.monthLabel}
      title={rest.title}
    >
      <PayFields {...rest} onDone={() => onOpenChange(false)} onPendingChange={setPending} />
    </Modal>
  );
}

type FieldsProps = Omit<Props, "monthLabel" | "onOpenChange" | "open" | "title"> & {
  onDone: () => void;
  onPendingChange: (pending: boolean) => void;
};

function PayFields({ extras, memberId, month, onDone, onPendingChange, pay, payCarriedFrom, year }: FieldsProps) {
  const router = useRouter();
  const [payText, setPayText] = useState(pay > 0 ? String(pay) : "");
  const [extraText, setExtraText] = useState("");
  const [extraNote, setExtraNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(payText) || 0;
    if (amount === pay && payCarriedFrom === null) {
      onDone();
      return;
    }
    onPendingChange(true);
    try {
      await setPayAction({ amount, memberId, month, year });
      toast.success("Pay saved");
      onDone();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      onPendingChange(false);
    }
  }

  async function addExtra() {
    const amount = Number(extraText);
    if (!(amount > 0)) {
      toast.error("Enter the extra amount");
      return;
    }
    setBusy(true);
    try {
      await addExtraIncomeAction({ amount, memberId, month, note: extraNote.trim() || undefined, year });
      setExtraText("");
      setExtraNote("");
      toast.success("Extra income added");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setBusy(false);
    }
  }

  async function removeExtra(id: string) {
    setBusy(true);
    try {
      await deleteIncomeAction(id);
      toast.success("Extra income deleted");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form className="flex flex-col gap-1.5" id={FORM_ID} noValidate onSubmit={onSubmit}>
        <AmountInput data-autofocus label="Pay" onChange={(event) => setPayText(event.target.value)} placeholder="0.00" size="xl" value={payText} />
        <p className="text-xs leading-normal text-n-600">
          {payCarriedFrom
            ? `Carried over from ${payCarriedFrom}. Saving sets this month's pay, and later months follow it.`
            : "The pay you can count on. Later months use it until you change it."}
        </p>
      </form>

      <section className="flex flex-col gap-3 border-t border-n-300 pt-4">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold">Extra this month</h3>
          <p className="text-xs text-n-600">A bonus, leave encashment or a refund. It counts for this month only and never grows the plan.</p>
        </div>
        {extras.map((extra) => (
          <div className="flex items-baseline justify-between gap-3 border-b border-n-200 py-1.5" key={extra.id}>
            <span className="truncate text-sm">{extra.note ?? "Extra income"}</span>
            <span className="flex items-baseline gap-3">
              <span className="text-sm font-semibold">
                <Money value={extra.amount} />
              </span>
              <Button className="h-auto px-1.5 py-0.5 text-[13px]" disabled={busy} onClick={() => void removeExtra(extra.id)} type="button" variant="ghost">
                Delete
              </Button>
            </span>
          </div>
        ))}
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto]">
          <AmountInput label="Extra amount" onChange={(event) => setExtraText(event.target.value)} placeholder="0.00" value={extraText} />
          <TextField label="What was it?" onChange={(event) => setExtraNote(event.target.value)} placeholder="e.g. Dashain bonus" value={extraNote} />
          <Button disabled={busy} onClick={() => void addExtra()} type="button" variant="outline">
            Add extra
          </Button>
        </div>
      </section>
    </div>
  );
}
