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
import { addContributionAction } from "@/modules/savings-goals/api/savings-goals.actions";

type Member = { id: string; name: string };

type Props = {
  currentMemberId: string;
  goal: null | { id: string; name: string };
  members: Member[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

const FORM_ID = "add-money-form";

export function AddMoneyDialog({ currentMemberId, goal, members, onOpenChange, open }: Props) {
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
      subtitle={goal?.name}
      title="Add money"
    >
      {goal && (
        <AddMoneyFields
          currentMemberId={currentMemberId}
          goalId={goal.id}
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
  goalId: string;
  members: Member[];
  onDone: () => void;
  onPendingChange: (pending: boolean) => void;
};

function AddMoneyFields({ currentMemberId, goalId, members, onDone, onPendingChange }: FieldsProps) {
  const router = useRouter();
  const partner = members.find((m) => m.id !== currentMemberId) ?? null;
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [memberId, setMemberId] = useState(currentMemberId);
  const [error, setError] = useState<string | undefined>();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!(Number(amount) > 0)) {
      setError("Enter an amount");
      return;
    }
    onPendingChange(true);
    try {
      await addContributionAction(goalId, { amount: Number(amount), date, memberId });
      toast.success("Money added");
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
        <Segmented
          label="Added by"
          onChange={setMemberId}
          options={[
            { label: "Me", value: currentMemberId },
            ...(partner ? [{ label: partner.name, value: partner.id }] : []),
          ]}
          value={memberId}
        />
      </MoreDetails>
    </form>
  );
}
