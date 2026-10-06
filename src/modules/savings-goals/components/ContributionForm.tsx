"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PiggyBank } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Modal } from "@/components/Modal";
import { NepaliDateField } from "@/components/NepaliDateField";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/today";
import { addContributionAction } from "@/modules/savings-goals/api/savings-goals.actions";
import { type ContributionInput, contributionSchema } from "@/modules/savings-goals/schemas/savings-goal.schema";

type Member = { id: string; name: string };

type Props = {
  currentMemberId: string;
  goalId: null | string;
  goalName: string;
  members: Member[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function ContributionForm({ currentMemberId, goalId, goalName, members, onOpenChange, open }: Props) {
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<ContributionInput>({
    defaultValues: { amount: 0, date: todayISO(), memberId: currentMemberId },
    resolver: zodResolver(contributionSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    if (!goalId) return;
    try {
      await addContributionAction(goalId, values);
      toast.success("Contribution added");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add contribution");
    }
  });

  return (
    <Modal
      footer={
        <Button disabled={isSubmitting} form="contribution-form" type="submit">
          {isSubmitting ? "Saving..." : "Add Contribution"}
        </Button>
      }
      icon={PiggyBank}
      onOpenChange={onOpenChange}
      open={open}
      title={`Add money to ${goalName}`}
      tone="green"
    >
      <form className="space-y-4" id="contribution-form" onSubmit={onSubmit}>
        <TextField
          error={errors.amount?.message}
          id="contribution-amount"
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
              label="Contributed by"
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
      </form>
    </Modal>
  );
}
