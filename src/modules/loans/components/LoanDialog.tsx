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
import { createLoanAction, updateLoanAction } from "@/modules/loans/api/loans.actions";

type Member = { id: string; name: string };
export type LoanOwnerKey = "me" | "partner" | "shared";

export type LoanEditing = {
  counterpartyName: string;
  date: string;
  direction: "given" | "taken";
  dueDate: null | string;
  id: string;
  installmentAmount: null | number;
  installmentFrequency: "monthly" | "weekly" | null;
  nextInstallmentDate: null | string;
  note: null | string;
  ownerKey: LoanOwnerKey;
  principalAmount: number;
};

type Props = {
  currentMemberId: string;
  editing: null | LoanEditing;
  members: Member[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

const FORM_ID = "loan-form";

export function LoanDialog({ currentMemberId, editing, members, onOpenChange, open }: Props) {
  const [pending, setPending] = useState(false);

  return (
    <Modal
      className="sm:max-w-120"
      footer={
        <Button className="min-w-35 justify-start" disabled={pending} form={FORM_ID} type="submit">
          {pending ? "Saving..." : editing ? "Save changes" : "Add loan"}
        </Button>
      }
      hint="Enter to save · Esc to close"
      onOpenChange={onOpenChange}
      open={open}
      title={editing ? "Edit loan" : "Add a loan"}
    >
      <LoanFields
        currentMemberId={currentMemberId}
        editing={editing}
        members={members}
        onDone={() => onOpenChange(false)}
        onPendingChange={setPending}
      />
    </Modal>
  );
}

function LoanFields({ currentMemberId, editing, members, onDone, onPendingChange }: Omit<Props, "onOpenChange" | "open"> & { onDone: () => void; onPendingChange: (pending: boolean) => void }) {
  const router = useRouter();
  const partner = members.find((m) => m.id !== currentMemberId) ?? null;

  const [direction, setDirection] = useState<"given" | "taken">(editing?.direction ?? "given");
  const [person, setPerson] = useState(editing?.counterpartyName ?? "");
  const [amount, setAmount] = useState(editing ? String(editing.principalAmount) : "");
  const [owner, setOwner] = useState<LoanOwnerKey>(editing?.ownerKey ?? "me");
  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [dueDate, setDueDate] = useState(editing?.dueDate ?? "");
  const [plan, setPlan] = useState(editing ? editing.installmentAmount !== null : false);
  const [installmentAmount, setInstallmentAmount] = useState(editing?.installmentAmount != null ? String(editing.installmentAmount) : "");
  const [installmentFrequency, setInstallmentFrequency] = useState<"monthly" | "weekly">(editing?.installmentFrequency ?? "monthly");
  const [nextInstallmentDate, setNextInstallmentDate] = useState(editing?.nextInstallmentDate ?? "");
  const [note, setNote] = useState(editing?.note ?? "");
  const [error, setError] = useState<string | undefined>();

  const memberIdFor = (key: LoanOwnerKey) => (key === "shared" ? null : key === "me" ? currentMemberId : (partner?.id ?? currentMemberId));

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!person.trim()) {
      setError("Who is it with?");
      return;
    }
    if (!(Number(amount) > 0)) {
      setError("Enter an amount");
      return;
    }

    const payload = {
      counterpartyName: person.trim(),
      date,
      direction,
      dueDate: dueDate || null,
      installmentAmount: plan && Number(installmentAmount) > 0 ? Number(installmentAmount) : null,
      installmentFrequency: plan ? installmentFrequency : null,
      nextInstallmentDate: plan ? nextInstallmentDate || null : null,
      note: note.trim() || undefined,
      ownerMemberId: memberIdFor(owner),
      principalAmount: Number(amount),
    };

    onPendingChange(true);
    try {
      if (editing) {
        await updateLoanAction(editing.id, payload);
        toast.success("Loan updated");
      } else {
        await createLoanAction(payload);
        toast.success("Loan added");
      }
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
        label="Direction"
        onChange={setDirection}
        options={[
          { label: "Lent", value: "given" },
          { label: "Borrowed", value: "taken" },
        ]}
        value={direction}
      />
      <TextField
        data-autofocus
        error={error === "Who is it with?" ? error : undefined}
        label="Person"
        onChange={(event) => {
          setPerson(event.target.value);
          setError(undefined);
        }}
        placeholder="e.g. Sita"
        value={person}
      />
      <AmountInput
        error={error === "Enter an amount" ? error : undefined}
        label="Amount"
        onChange={(event) => {
          setAmount(event.target.value);
          setError(undefined);
        }}
        size="xl"
        value={amount}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Segmented
          label="For"
          onChange={setOwner}
          options={[
            { label: "Me", value: "me" },
            ...(partner ? [{ label: partner.name, value: "partner" as const }] : []),
            { label: "Shared", value: "shared" },
          ]}
          value={owner}
        />
        <NepaliDateField label="Date" onChange={setDate} value={date} />
      </div>

      <MoreDetails>
        <NepaliDateField label="Due date" onChange={setDueDate} value={dueDate} />
        <label className="flex items-center gap-2 text-sm text-n-800">
          <input checked={plan} onChange={(event) => setPlan(event.target.checked)} type="checkbox" />
          Repay in instalments
        </label>
        {plan && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AmountInput label="Instalment amount" onChange={(event) => setInstallmentAmount(event.target.value)} value={installmentAmount} />
            <Segmented
              label="Frequency"
              onChange={setInstallmentFrequency}
              options={[
                { label: "Monthly", value: "monthly" },
                { label: "Weekly", value: "weekly" },
              ]}
              value={installmentFrequency}
            />
            <NepaliDateField label="Next instalment" onChange={setNextInstallmentDate} value={nextInstallmentDate} />
          </div>
        )}
        <TextField label="Note" onChange={(event) => setNote(event.target.value)} placeholder="Optional" value={note} />
      </MoreDetails>
    </form>
  );
}
