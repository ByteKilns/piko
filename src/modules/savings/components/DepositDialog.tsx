"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AmountInput } from "@/components/AmountInput";
import { Modal } from "@/components/Modal";
import { MoreDetails } from "@/components/MoreDetails";
import { NepaliDateField } from "@/components/NepaliDateField";
import { Segmented } from "@/components/Segmented";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/today";
import { addSavingsDepositAction } from "@/modules/savings/api/savings.actions";
import type { SavingsPotModel } from "@/modules/savings/components/SavingsView";

type Member = { id: string; name: string };
type Kind = "deposit" | "interest";

type Props = {
  currentMemberId: string;
  members: Member[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pot: null | SavingsPotModel;
};

const FORM_ID = "savings-deposit-form";

export function DepositDialog({ currentMemberId, members, onOpenChange, open, pot }: Props) {
  const [pending, setPending] = useState(false);

  return (
    <Modal
      className="sm:max-w-105"
      footer={
        <Button className="min-w-30 justify-start" disabled={pending} form={FORM_ID} type="submit">
          {pending ? "Adding..." : "Add"}
        </Button>
      }
      hint="Enter to add · Esc to close"
      onOpenChange={onOpenChange}
      open={open}
      subtitle={pot?.name}
      title="Add money"
    >
      {pot && (
        <DepositFields currentMemberId={currentMemberId} members={members} onDone={() => onOpenChange(false)} onPendingChange={setPending} pot={pot} />
      )}
    </Modal>
  );
}

type FieldsProps = {
  currentMemberId: string;
  members: Member[];
  onDone: () => void;
  onPendingChange: (pending: boolean) => void;
  pot: SavingsPotModel;
};

function DepositFields({ currentMemberId, members, onDone, onPendingChange, pot }: FieldsProps) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("deposit");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [memberId, setMemberId] = useState(pot.ownerMemberId ?? currentMemberId);
  const [error, setError] = useState<string | undefined>();
  const label = (m: Member) => (m.id === currentMemberId ? "Me" : m.name);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!(Number(amount) > 0)) {
      setError("Enter an amount");
      return;
    }
    onPendingChange(true);
    try {
      // Bank interest has no member; the bank put it in.
      await addSavingsDepositAction(pot.id, { amount: Number(amount), date, kind, memberId: kind === "deposit" ? memberId : null });
      toast.success(kind === "deposit" ? "Money added" : "Interest added");
      onDone();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add");
    } finally {
      onPendingChange(false);
    }
  }

  return (
    <form className="flex flex-col gap-5.5" id={FORM_ID} noValidate onSubmit={onSubmit}>
      <Segmented
        label="What is it"
        onChange={setKind}
        options={[
          { label: "Money in", value: "deposit" },
          { label: "Bank interest", value: "interest" },
        ]}
        value={kind}
      />
      <AmountInput
        data-autofocus
        error={error}
        label="Amount"
        onChange={(event) => {
          setAmount(event.target.value);
          setError(undefined);
        }}
        size="xl"
        value={amount}
      />
      <MoreDetails>
        <NepaliDateField label="Date" onChange={setDate} value={date} />
        {kind === "deposit" && pot.ownerMemberId === null && (
          <Segmented label="Put in by" onChange={setMemberId} options={members.map((m) => ({ label: label(m), value: m.id }))} value={memberId} />
        )}
      </MoreDetails>
    </form>
  );
}
