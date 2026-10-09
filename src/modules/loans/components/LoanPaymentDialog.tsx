"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AmountInput } from "@/components/AmountInput";
import { Modal } from "@/components/Modal";
import { MoreDetails } from "@/components/MoreDetails";
import { NepaliDateField } from "@/components/NepaliDateField";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/today";
import { addLoanPaymentAction } from "@/modules/loans/api/loans.actions";

export type PaymentTarget = { id: string; name: string };

type Props = {
  currentMemberId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  target: null | PaymentTarget;
};

const FORM_ID = "loan-payment-form";

export function LoanPaymentDialog({ currentMemberId, onOpenChange, open, target }: Props) {
  const [pending, setPending] = useState(false);

  return (
    <Modal
      className="sm:max-w-105"
      footer={
        <Button className="min-w-30 justify-start" disabled={pending} form={FORM_ID} type="submit">
          {pending ? "Saving..." : "Record payment"}
        </Button>
      }
      hint="Enter to save · Esc to close"
      onOpenChange={onOpenChange}
      open={open}
      subtitle={target?.name}
      title="Record payment"
    >
      {target && (
        <PaymentFields
          currentMemberId={currentMemberId}
          loanId={target.id}
          onDone={() => onOpenChange(false)}
          onPendingChange={setPending}
        />
      )}
    </Modal>
  );
}

function PaymentFields({
  currentMemberId,
  loanId,
  onDone,
  onPendingChange,
}: {
  currentMemberId: string;
  loanId: string;
  onDone: () => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!(Number(amount) > 0)) {
      setError("Enter an amount");
      return;
    }
    onPendingChange(true);
    try {
      await addLoanPaymentAction(loanId, { amount: Number(amount), date, memberId: currentMemberId, note: note.trim() || undefined });
      toast.success("Payment recorded");
      onDone();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record");
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
        <TextField label="Note" onChange={(event) => setNote(event.target.value)} placeholder="Optional" value={note} />
      </MoreDetails>
    </form>
  );
}
