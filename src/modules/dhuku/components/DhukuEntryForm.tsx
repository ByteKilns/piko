"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Users } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Modal } from "@/components/Modal";
import { NepaliDateField } from "@/components/NepaliDateField";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/today";
import { addDhukuEntryAction } from "@/modules/dhuku/api/dhuku.actions";
import type { DhukuCardData } from "@/modules/dhuku/lib/dhuku-stats";
import { type DhukuEntryInput, dhukuEntrySchema } from "@/modules/dhuku/schemas/dhuku.schema";

type Props = {
  dhuku: DhukuCardData | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function DhukuEntryForm({ dhuku, onOpenChange, open }: Props) {
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setValue,
  } = useForm<DhukuEntryInput>({
    defaultValues: { amount: dhuku?.expectedNextAmount ?? 0, date: todayISO(), note: "", type: "contribution" },
    resolver: zodResolver(dhukuEntrySchema),
  });

  function handleTypeChange(type: "contribution" | "payout") {
    setValue("type", type);
    setValue("amount", type === "contribution" ? (dhuku?.expectedNextAmount ?? 0) : 0);
  }

  const onSubmit = handleSubmit(async (values) => {
    if (!dhuku) return;
    try {
      await addDhukuEntryAction(dhuku.id, values);
      toast.success(values.type === "payout" ? "Payout recorded" : "Contribution recorded");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record entry");
    }
  });

  return (
    <Modal
      footer={
        <Button disabled={isSubmitting} form="dhuku-entry-form" type="submit">
          {isSubmitting ? "Saving..." : "Log Entry"}
        </Button>
      }
      icon={Users}
      onOpenChange={onOpenChange}
      open={open}
      title={`Log entry — ${dhuku?.name ?? ""}`}
      tone="green"
    >
      <form className="space-y-4" id="dhuku-entry-form" onSubmit={onSubmit}>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <SelectField
              label="Type"
              onValueChange={(v) => handleTypeChange(v as "contribution" | "payout")}
              options={[
                { label: "Monthly contribution", value: "contribution" },
                { label: "I received my payout", value: "payout" },
              ]}
              value={field.value}
            />
          )}
        />

        <TextField
          error={errors.amount?.message}
          id="dhuku-entry-amount"
          label="Amount"
          min={0}
          step="0.01"
          type="number"
          {...register("amount", { valueAsNumber: true })}
        />

        <Controller
          control={control}
          name="date"
          render={({ field }) => (
            <NepaliDateField error={errors.date?.message} label="Date" onChange={field.onChange} value={field.value} />
          )}
        />

        <TextField id="dhuku-entry-note" label="Note (optional)" {...register("note")} />
      </form>
    </Modal>
  );
}
