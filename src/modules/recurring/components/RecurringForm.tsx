"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Repeat } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Modal } from "@/components/Modal";
import { NepaliDateField } from "@/components/NepaliDateField";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/today";
import {
  createRecurringExpenseAction,
  updateRecurringExpenseAction,
} from "@/modules/recurring/api/recurring.actions";
import { IconPicker } from "@/modules/recurring/components/IconPicker";
import type { RecurringIcon } from "@/modules/recurring/lib/recurring-icons";
import { type RecurringExpenseInput, recurringExpenseSchema } from "@/modules/recurring/schemas/recurring.schema";

type Category = { id: string; name: string };
type Member = { id: string; name: string };

export type RecurringExpenseEditing = RecurringExpenseInput & { id: string };

type Props = {
  categories: Category[];
  currentMemberId: string;
  editing: null | RecurringExpenseEditing;
  members: Member[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

const EMPTY: RecurringExpenseInput = {
  amount: 0,
  categoryId: "",
  endDate: null,
  frequency: "monthly",
  icon: "receipt",
  name: "",
  nextDueDate: todayISO(),
  ownerMemberId: null,
  vendor: "",
};

export function RecurringForm({ categories, currentMemberId, editing, members, onOpenChange, open }: Props) {
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<RecurringExpenseInput>({
    defaultValues: editing ?? { ...EMPTY, categoryId: categories[0]?.id ?? "" },
    resolver: zodResolver(recurringExpenseSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    const payload = { ...values, vendor: values.vendor?.trim() || undefined };
    try {
      if (editing) {
        await updateRecurringExpenseAction(editing.id, payload);
        toast.success("Recurring expense updated");
      } else {
        await createRecurringExpenseAction(payload);
        toast.success("Recurring expense added");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  });

  return (
    <Modal
      footer={
        <Button disabled={isSubmitting} form="recurring-form" type="submit">
          {isSubmitting ? "Saving..." : editing ? "Save changes" : "Add Recurring"}
        </Button>
      }
      icon={Repeat}
      onOpenChange={onOpenChange}
      open={open}
      title={editing ? "Edit recurring expense" : "Add recurring expense"}
      tone="purple"
    >
      <form className="space-y-4" id="recurring-form" onSubmit={onSubmit}>
        <TextField error={errors.name?.message} id="recurring-name" label="Name" {...register("name")} />
        <TextField id="recurring-vendor" label="Vendor / note (optional)" {...register("vendor")} />

        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <SelectField
              error={errors.categoryId?.message}
              label="Category"
              onValueChange={field.onChange}
              options={categories.map((c) => ({ label: c.name, value: c.id }))}
              value={field.value}
            />
          )}
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

        <div className="grid grid-cols-2 gap-3">
          <TextField
            error={errors.amount?.message}
            id="recurring-amount"
            label="Amount"
            min={0}
            step="0.01"
            type="number"
            {...register("amount", { valueAsNumber: true })}
          />

          <Controller
            control={control}
            name="frequency"
            render={({ field }) => (
              <SelectField
                label="Frequency"
                onValueChange={field.onChange}
                options={[
                  { label: "Monthly", value: "monthly" },
                  { label: "Yearly", value: "yearly" },
                ]}
                value={field.value}
              />
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Controller
            control={control}
            name="nextDueDate"
            render={({ field }) => (
              <NepaliDateField
                error={errors.nextDueDate?.message}
                label="Next due date"
                onChange={field.onChange}
                value={field.value}
              />
            )}
          />

          <Controller
            control={control}
            name="endDate"
            render={({ field }) => (
              <NepaliDateField
                error={errors.endDate?.message}
                label="End date (optional)"
                onChange={(v) => field.onChange(v || null)}
                value={field.value ?? ""}
              />
            )}
          />
        </div>

        <Controller
          control={control}
          name="icon"
          render={({ field }) => (
            <IconPicker onChange={(icon: RecurringIcon) => field.onChange(icon)} value={field.value as RecurringIcon} />
          )}
        />
      </form>
    </Modal>
  );
}
