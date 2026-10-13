"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AmountInput } from "@/components/AmountInput";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { setCushionAction } from "@/modules/cushion/api/cushion.actions";

type Props = {
  balance: number;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  target: null | number;
};

const FORM_ID = "cushion-form";

// The cushion's target, and a correction when it doesn't match the bank.
export function CushionDialog({ onOpenChange, open, ...rest }: Props) {
  const [pending, setPending] = useState(false);

  return (
    <Modal
      className="sm:max-w-100"
      footer={
        <Button className="min-w-35 justify-start" disabled={pending} form={FORM_ID} type="submit">
          {pending ? "Saving..." : "Save cushion"}
        </Button>
      }
      hint="Enter to save · Esc to close"
      onOpenChange={onOpenChange}
      open={open}
      subtitle="Money in your everyday account beyond this month's plan"
      title="Cushion"
    >
      <CushionFields {...rest} onDone={() => onOpenChange(false)} onPendingChange={setPending} />
    </Modal>
  );
}

type FieldsProps = Omit<Props, "onOpenChange" | "open"> & { onDone: () => void; onPendingChange: (pending: boolean) => void };

function CushionFields({ balance, onDone, onPendingChange, target }: FieldsProps) {
  const router = useRouter();
  const [targetText, setTargetText] = useState(target ? String(target) : "");
  const [balanceText, setBalanceText] = useState(String(balance));

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onPendingChange(true);
    try {
      await setCushionAction({ balance: Number(balanceText) || 0, target: Number(targetText) > 0 ? Number(targetText) : null });
      toast.success("Cushion saved");
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
      <div className="flex flex-col gap-1.5">
        <AmountInput data-autofocus label="Aiming for" onChange={(event) => setTargetText(event.target.value)} placeholder="e.g. one month of essentials" value={targetText} />
        <p className="text-xs leading-normal text-n-600">About one month of essentials is a good first target.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <AmountInput label="It holds" onChange={(event) => setBalanceText(event.target.value)} placeholder="0.00" value={balanceText} />
        <p className="text-xs leading-normal text-n-600">Change this only to match what&apos;s really in your account.</p>
      </div>
    </form>
  );
}
