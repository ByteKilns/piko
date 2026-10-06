"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { HandCoins } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Modal } from "@/components/Modal";
import { NepaliDateField } from "@/components/NepaliDateField";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/today";
import { addLoanPaymentAction } from "@/modules/loans/api/loans.actions";
import { type LoanPaymentInput, loanPaymentSchema } from "@/modules/loans/schemas/loan.schema";

type Member = { id: string; name: string };

type Props = {
  counterpartyName: string;
  currentMemberId: string;
  loanId: null | string;
  members: Member[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function LoanPaymentForm({ counterpartyName, currentMemberId, loanId, members, onOpenChange, open }: Props) {
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<LoanPaymentInput>({
    defaultValues: { amount: 0, date: todayISO(), memberId: currentMemberId, note: "" },
    resolver: zodResolver(loanPaymentSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    if (!loanId) return;
    try {
      await addLoanPaymentAction(loanId, values);
      toast.success("Payment recorded");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment");
    }
  });

  return (
    <Modal
      footer={
        <Button disabled={isSubmitting} form="loan-payment-form" type="submit">
          {isSubmitting ? "Saving..." : "Record Payment"}
        </Button>
      }
      icon={HandCoins}
      onOpenChange={onOpenChange}
      open={open}
      title={`Record payment — ${counterpartyName}`}
      tone="green"
    >
      <form className="space-y-4" id="loan-payment-form" onSubmit={onSubmit}>
        <TextField
          error={errors.amount?.message}
          id="loan-payment-amount"
          label="Amount"
          min={0}
          step="0.01"
          type="number"
          {...register("amount", { valueAsNumber: true })}
        />

        <Controller
          control={control}
          name="memberId"
          render={({ field }) => (
            <SelectField
              label="Recorded by"
              onValueChange={field.onChange}
              options={members.map((m) => ({ label: m.id === currentMemberId ? "Me" : m.name, value: m.id }))}
              value={field.value}
            />
          )}
        />

        <Controller
          control={control}
          name="date"
          render={({ field }) => (
            <NepaliDateField error={errors.date?.message} label="Date" onChange={field.onChange} value={field.value} />
          )}
        />

        <TextField id="loan-payment-note" label="Note (optional)" {...register("note")} />
      </form>
    </Modal>
  );
}
