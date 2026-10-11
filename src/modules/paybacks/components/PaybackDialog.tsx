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
import { createPaybackAction } from "@/modules/paybacks/api/paybacks.actions";

type Member = { id: string; name: string };

export type PaybackDefaults = { amount: number; fromMemberId: string };

type Props = {
  currentMemberId: string;
  defaults: null | PaybackDefaults;
  members: Member[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

const FORM_ID = "payback-form";

export function PaybackDialog({ currentMemberId, defaults, members, onOpenChange, open }: Props) {
  const [pending, setPending] = useState(false);

  return (
    <Modal
      className="sm:max-w-105"
      footer={
        <Button className="min-w-30 justify-start" disabled={pending} form={FORM_ID} type="submit">
          {pending ? "Saving..." : "Record payback"}
        </Button>
      }
      hint="Enter to save · Esc to close"
      onOpenChange={onOpenChange}
      open={open}
      title="Record a payback"
    >
      {defaults && (
        <PaybackFields
          currentMemberId={currentMemberId}
          defaults={defaults}
          members={members}
          onDone={() => onOpenChange(false)}
          onPendingChange={setPending}
        />
      )}
    </Modal>
  );
}

type FieldsProps = {
  currentMemberId: string;
  defaults: PaybackDefaults;
  members: Member[];
  onDone: () => void;
  onPendingChange: (pending: boolean) => void;
};

function PaybackFields({ currentMemberId, defaults, members, onDone, onPendingChange }: FieldsProps) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(defaults.amount));
  const [fromMemberId, setFromMemberId] = useState(defaults.fromMemberId);
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>();
  const label = (m: Member) => (m.id === currentMemberId ? "Me" : m.name);
  const toMemberId = members.find((m) => m.id !== fromMemberId)?.id ?? "";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!(Number(amount) > 0)) {
      setError("Enter an amount");
      return;
    }
    onPendingChange(true);
    try {
      await createPaybackAction({ amount: Number(amount), date, fromMemberId, note: note.trim() || undefined, toMemberId });
      toast.success("Payback recorded");
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
      <AmountInput
        data-autofocus
        error={error}
        label="Amount paid back"
        onChange={(event) => {
          setAmount(event.target.value);
          setError(undefined);
        }}
        size="xl"
        value={amount}
      />
      <Segmented
        label="Who paid it back"
        onChange={setFromMemberId}
        options={members.map((m) => ({ label: label(m), value: m.id }))}
        value={fromMemberId}
      />
      <MoreDetails>
        <NepaliDateField label="Date" onChange={setDate} value={date} />
        <TextField label="Note" onChange={(event) => setNote(event.target.value)} placeholder="Optional" value={note} />
      </MoreDetails>
    </form>
  );
}
