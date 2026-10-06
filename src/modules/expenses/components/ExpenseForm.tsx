"use client";

import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { CategoryComboboxField } from "@/components/CategoryComboboxField";
import { NepaliDateField } from "@/components/NepaliDateField";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/today";
import { createExpenseAction, updateExpenseAction } from "@/modules/expenses/api/expenses.actions";
import { type ExpenseInput, expenseSchema } from "@/modules/expenses/schemas/expense.schema";

type Member = { id: string; name: string };
type Category = { groupName: string; id: string; name: string };

type Props = {
  categories: Category[];
  currentMemberId: string;
  expenseId?: string;
  initial?: {
    amount: number;
    categoryId: string;
    date: string;
    note: string | null;
    ownerMemberId: string | null;
    paidByMemberId: string;
  };
  members: Member[];
  // Defaults to navigating to /expenses (the standalone new/edit pages).
  // The Add Expense modal overrides this to just close itself instead.
  onSuccess?: () => void;
};

export function ExpenseForm({ categories, currentMemberId, expenseId, initial, members, onSuccess }: Props) {
  const router = useRouter();
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setValue,
    watch,
  } = useForm<ExpenseInput>({
    defaultValues: {
      amount: initial?.amount ?? 0,
      categoryId: initial?.categoryId ?? categories[0]?.id ?? "",
      date: initial?.date ?? todayISO(),
      note: initial?.note ?? "",
      ownerMemberId: initial?.ownerMemberId ?? currentMemberId,
      paidByMemberId: initial?.paidByMemberId ?? currentMemberId,
    },
    resolver: zodResolver(expenseSchema),
  });

  const [categoryOptions, setCategoryOptions] = useState(categories);

  const owner = watch("ownerMemberId");

  function handleOwnerChange(value: string) {
    setValue("ownerMemberId", value === "shared" ? null : value);
    // Owner = Me or Partner auto-defaults Paid by to the same member.
    // Owner = Shared leaves the payer for the user to choose explicitly.
    if (value !== "shared") {
      setValue("paidByMemberId", value);
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    const payload = { ...values, note: values.note?.trim() || undefined };
    try {
      if (expenseId) {
        await updateExpenseAction(expenseId, payload);
      } else {
        await createExpenseAction(payload);
      }
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/expenses");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  });

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <TextField
        error={errors.amount?.message}
        id="amount"
        label="Amount"
        min={0}
        step="0.01"
        type="number"
        {...register("amount", { valueAsNumber: true })}
      />

      <Controller
        control={control}
        name="categoryId"
        render={({ field }) => (
          <CategoryComboboxField
            categories={categoryOptions}
            error={errors.categoryId?.message}
            label="Category"
            onCategoriesChange={(category) =>
              setCategoryOptions((prev) => (prev.some((c) => c.id === category.id) ? prev : [...prev, category]))
            }
            onValueChange={field.onChange}
            value={field.value}
          />
        )}
      />

      <SelectField
        label="For"
        onValueChange={handleOwnerChange}
        options={[
          { label: "Shared", value: "shared" },
          ...members.map((m) => ({ label: m.id === currentMemberId ? "Me" : m.name, value: m.id })),
        ]}
        value={owner ?? "shared"}
      />

      <Controller
        control={control}
        name="paidByMemberId"
        render={({ field }) => (
          <SelectField
            disabled={owner !== null}
            error={errors.paidByMemberId?.message}
            label="Paid by"
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

      <TextField id="note" label="Note (optional)" {...register("note")} />

      <Button className="w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Saving..." : expenseId ? "Save changes" : "Add Expense"}
      </Button>
    </form>
  );
}
