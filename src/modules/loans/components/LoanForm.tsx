"use client";

import { useState } from "react";

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
import { createLoanAction, updateLoanAction } from "@/modules/loans/api/loans.actions";
import { type LoanInput, loanSchema } from "@/modules/loans/schemas/loan.schema";

export type LoanEditing = LoanInput & { id: string };

type Member = { id: string; name: string };

type Props = {
  currentMemberId: string;
  editing: LoanEditing | null;
  members: Member[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

const EMPTY: LoanInput = {
  counterpartyName: "",
  date: todayISO(),
  direction: "given",
  dueDate: null,
  installmentAmount: null,
  installmentFrequency: null,
  nextInstallmentDate: null,
  note: "",
  ownerMemberId: null,
  principalAmount: 0,
};

export function LoanForm({ currentMemberId, editing, members, onOpenChange, open }: Props) {
  const [hasPlan, setHasPlan] = useState(editing ? editing.installmentFrequency !== null : false);
  const {
    control,
    formState: { errors, isSubmitting },
    getValues,
    handleSubmit,
    register,
    setValue,
  } = useForm<LoanInput>({
    defaultValues: editing ?? EMPTY,
    resolver: zodResolver(loanSchema),
  });

  function handlePlanToggle(checked: boolean) {
    setHasPlan(checked);
    if (!checked) {
      setValue("installmentAmount", null);
      setValue("installmentFrequency", null);
      setValue("nextInstallmentDate", null);
    } else {
      setValue("installmentFrequency", "monthly");
      setValue("nextInstallmentDate", getValues("nextInstallmentDate") ?? getValues("date"));
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    const payload = { ...values, note: values.note?.trim() || undefined };
    try {
      if (editing) {
        await updateLoanAction(editing.id, payload);
        toast.success("Loan updated");
      } else {
        await createLoanAction(payload);
        toast.success("Loan added");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  });

  return (
    <Modal
      footer={
        <Button disabled={isSubmitting} form="loan-form" type="submit">
          {isSubmitting ? "Saving..." : editing ? "Save changes" : "Add Loan"}
        </Button>
      }
      icon={HandCoins}
      onOpenChange={onOpenChange}
      open={open}
      title={editing ? "Edit loan" : "Add a loan"}
      tone="blue"
    >
      <form className="space-y-4" id="loan-form" onSubmit={onSubmit}>
        <Controller
          control={control}
          name="direction"
          render={({ field }) => (
            <SelectField
              label="Type"
              onValueChange={field.onChange}
              options={[
                { label: "I lent money (they owe me)", value: "given" },
                { label: "I borrowed money (I owe them)", value: "taken" },
              ]}
              value={field.value}
            />
          )}
        />

        <TextField
          error={errors.counterpartyName?.message}
          id="loan-counterparty"
          label="Counterparty name"
          {...register("counterpartyName")}
        />

        <div className="grid grid-cols-2 gap-3">
          <TextField
            error={errors.principalAmount?.message}
            id="loan-principal"
            label="Amount"
            min={0}
            step="0.01"
            type="number"
            {...register("principalAmount", { valueAsNumber: true })}
          />
          <Controller
            control={control}
            name="ownerMemberId"
            render={({ field }) => (
              <SelectField
                label="For"
                onValueChange={(v) => field.onChange(v === "shared" ? null : v)}
                options={[
                  { label: "Shared", value: "shared" },
                  ...members.map((m) => ({ label: m.id === currentMemberId ? "Me" : m.name, value: m.id })),
                ]}
                value={field.value ?? "shared"}
              />
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Controller
            control={control}
            name="date"
            render={({ field }) => (
              <NepaliDateField error={errors.date?.message} label="Date" onChange={field.onChange} value={field.value} />
            )}
          />
          <Controller
            control={control}
            name="dueDate"
            render={({ field }) => (
              <NepaliDateField
                label="Due date (optional)"
                onChange={(v) => field.onChange(v || null)}
                value={field.value ?? ""}
              />
            )}
          />
        </div>

        <TextField id="loan-note" label="Note (optional)" {...register("note")} />

        <label className="flex items-center gap-2 text-sm">
          <input
            checked={hasPlan}
            className="h-4 w-4 rounded border-input"
            onChange={(e) => handlePlanToggle(e.target.checked)}
            type="checkbox"
          />
          Set up a repayment plan
        </label>
        <p className="-mt-3 text-xs text-muted-foreground">
          Get a reminder a few days before each installment is due.
        </p>

        {hasPlan && (
          <div className="grid grid-cols-2 gap-3">
            <TextField
              error={errors.installmentAmount?.message}
              id="loan-installment-amount"
              label="Installment amount"
              min={0}
              step="0.01"
              type="number"
              {...register("installmentAmount", { valueAsNumber: true })}
            />
            <Controller
              control={control}
              name="installmentFrequency"
              render={({ field }) => (
                <SelectField
                  label="Frequency"
                  onValueChange={(v) => field.onChange(v)}
                  options={[
                    { label: "Weekly", value: "weekly" },
                    { label: "Monthly", value: "monthly" },
                  ]}
                  value={field.value ?? "monthly"}
                />
              )}
            />
            <Controller
              control={control}
              name="nextInstallmentDate"
              render={({ field }) => (
                <NepaliDateField
                  containerClassName="col-span-2"
                  error={errors.nextInstallmentDate?.message}
                  label="Next installment date"
                  onChange={field.onChange}
                  value={field.value ?? ""}
                />
              )}
            />
          </div>
        )}
      </form>
    </Modal>
  );
}
