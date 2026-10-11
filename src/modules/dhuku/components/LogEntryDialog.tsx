"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AmountInput } from "@/components/AmountInput";
import { Modal } from "@/components/Modal";
import { MoreDetails } from "@/components/MoreDetails";
import { NepaliDateField } from "@/components/NepaliDateField";
import { Segmented } from "@/components/Segmented";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/today";
import { addDhukuEntryAction } from "@/modules/dhuku/api/dhuku.actions";

export type LogEntryTarget = { id: string; monthly: number; name: string; pot: number };

type EntryKind = "contribution" | "fine" | "payout";

type Props = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  target: null | LogEntryTarget;
};

const FORM_ID = "dhuku-entry-form";

const AMOUNT_LABEL: Record<EntryKind, string> = {
  contribution: "Amount paid in",
  fine: "Fine paid",
  payout: "Amount received",
};

export function LogEntryDialog({ onOpenChange, open, target }: Props) {
  const [pending, setPending] = useState(false);

  return (
    <Modal
      className="sm:max-w-115"
      footer={
        <Button className="min-w-30 justify-start" disabled={pending} form={FORM_ID} type="submit">
          {pending ? "Saving..." : "Save entry"}
        </Button>
      }
      hint="Enter to save · Esc to close"
      onOpenChange={onOpenChange}
      open={open}
      subtitle={target?.name}
      title="Log entry"
    >
      {target && <LogEntryFields onDone={() => onOpenChange(false)} onPendingChange={setPending} target={target} />}
    </Modal>
  );
}

function LogEntryFields({ onDone, onPendingChange, target }: { onDone: () => void; onPendingChange: (pending: boolean) => void; target: LogEntryTarget }) {
  const router = useRouter();
  const [kind, setKind] = useState<EntryKind>("contribution");
  const [amount, setAmount] = useState(String(target.monthly));
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>();

  function chooseKind(value: EntryKind) {
    setKind(value);
    // A fine has no usual amount, so it starts empty.
    setAmount(value === "contribution" ? String(target.monthly) : value === "payout" ? String(target.pot) : "");
    setError(undefined);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!(Number(amount) > 0)) {
      setError("Enter an amount");
      return;
    }
    onPendingChange(true);
    try {
      await addDhukuEntryAction(target.id, { amount: Number(amount), date, note: note.trim() || undefined, type: kind });
      toast.success("Entry saved");
      onDone();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      onPendingChange(false);
    }
  }

  return (
    <form className="flex flex-col gap-5.5" id={FORM_ID} noValidate onSubmit={onSubmit}>
      <Segmented
        label="Entry type"
        onChange={chooseKind}
        options={[
          { label: "Contribution", value: "contribution" },
          { label: "Payout received", value: "payout" },
          { label: "Fine", value: "fine" },
        ]}
        value={kind}
      />
      <AmountInput
        data-autofocus
        error={error}
        label={AMOUNT_LABEL[kind]}
        onChange={(event) => {
          setAmount(event.target.value);
          setError(undefined);
        }}
        size="xl"
        value={amount}
      />
      <NepaliDateField label="Date" onChange={setDate} value={date} />
      <MoreDetails>
        <TextField label="Note" onChange={(event) => setNote(event.target.value)} placeholder="Optional" value={note} />
      </MoreDetails>
    </form>
  );
}
