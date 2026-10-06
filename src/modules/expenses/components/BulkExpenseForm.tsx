"use client";

import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { CategoryComboboxField } from "@/components/CategoryComboboxField";
import { NepaliDateField } from "@/components/NepaliDateField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { todayISO } from "@/lib/today";
import { createExpensesBulkAction } from "@/modules/expenses/api/expenses.actions";
import { expenseSchema } from "@/modules/expenses/schemas/expense.schema";

type Member = { id: string; name: string };
type Category = { groupName: string; id: string; name: string };

const bulkExpenseSchema = z.object({ rows: z.array(expenseSchema).min(1) });
type BulkExpenseInput = z.infer<typeof bulkExpenseSchema>;

const DATE_INPUT_CLASS = "h-8 w-32 min-w-0 px-2 text-sm";

function emptyRow(currentMemberId: string, categoryId: string) {
  return {
    amount: 0,
    categoryId,
    date: todayISO(),
    note: "",
    ownerMemberId: currentMemberId as string | null,
    paidByMemberId: currentMemberId,
  };
}

type Props = {
  categories: Category[];
  currentMemberId: string;
  members: Member[];
  // Defaults to navigating to /expenses. The Bulk Add modal overrides this
  // to just close itself and refresh instead, matching ExpenseForm's own
  // onSuccess convention.
  onSuccess?: () => void;
};

export function BulkExpenseForm({ categories, currentMemberId, members, onSuccess }: Props) {
  const router = useRouter();
  const defaultCategoryId = categories[0]?.id ?? "";
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<BulkExpenseInput>({
    defaultValues: {
      rows: [emptyRow(currentMemberId, defaultCategoryId)],
    },
    resolver: zodResolver(bulkExpenseSchema),
  });
  const { append, fields, remove } = useFieldArray({ control, name: "rows" });
  const [categoryOptions, setCategoryOptions] = useState(categories);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createExpensesBulkAction(values.rows.map((r) => ({ ...r, note: r.note?.trim() || undefined })));
      toast.success(`${values.rows.length} expense${values.rows.length === 1 ? "" : "s"} added`);
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
      <div className="overflow-visible rounded-2xl border bg-card">
        <Table containerClassName="overflow-visible rounded-2xl">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-36">Date</TableHead>
              <TableHead className="min-w-40">Category</TableHead>
              <TableHead className="min-w-28">Amount</TableHead>
              <TableHead className="min-w-32">For</TableHead>
              <TableHead className="min-w-32">Paid by</TableHead>
              <TableHead className="min-w-40">Note</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field, index) => (
              <TableRow className="hover:bg-transparent" key={field.id}>
                <TableCell>
                  <Controller
                    control={control}
                    name={`rows.${index}.date`}
                    render={({ field: f }) => (
                      <NepaliDateField
                        error={errors.rows?.[index]?.date?.message}
                        inputClassName={DATE_INPUT_CLASS}
                        onChange={f.onChange}
                        value={f.value}
                      />
                    )}
                  />
                </TableCell>

                <TableCell>
                  <Controller
                    control={control}
                    name={`rows.${index}.categoryId`}
                    render={({ field: f }) => (
                      <CategoryComboboxField
                        categories={categoryOptions}
                        containerClassName="w-full"
                        error={errors.rows?.[index]?.categoryId?.message}
                        onCategoriesChange={(category) =>
                          setCategoryOptions((prev) => (prev.some((c) => c.id === category.id) ? prev : [...prev, category]))
                        }
                        onValueChange={f.onChange}
                        value={f.value}
                      />
                    )}
                  />
                </TableCell>

                <TableCell>
                  <Input
                    aria-invalid={Boolean(errors.rows?.[index]?.amount)}
                    className="w-24"
                    min={0}
                    step="0.01"
                    type="number"
                    {...register(`rows.${index}.amount`, { valueAsNumber: true })}
                  />
                </TableCell>

                <TableCell>
                  <Controller
                    control={control}
                    name={`rows.${index}.ownerMemberId`}
                    render={({ field: f }) => (
                      <Select onValueChange={(v) => f.onChange(v === "shared" ? null : v)} value={f.value ?? "shared"}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="shared">Shared</SelectItem>
                          {members.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.id === currentMemberId ? "Me" : m.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </TableCell>

                <TableCell>
                  <Controller
                    control={control}
                    name={`rows.${index}.paidByMemberId`}
                    render={({ field: f }) => (
                      <Select onValueChange={f.onChange} value={f.value}>
                        <SelectTrigger aria-invalid={Boolean(errors.rows?.[index]?.paidByMemberId)} className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {members.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.id === currentMemberId ? "Me" : m.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </TableCell>

                <TableCell>
                  <Input className="w-40" placeholder="Optional" {...register(`rows.${index}.note`)} />
                </TableCell>

                <TableCell>
                  <button
                    aria-label={`Remove row ${index + 1}`}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
                    disabled={fields.length <= 1}
                    onClick={() => remove(index)}
                    type="button"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <Button onClick={() => append(emptyRow(currentMemberId, defaultCategoryId))} type="button" variant="outline">
          <Plus className="h-4 w-4" />
          Add more
        </Button>

        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? "Saving..." : `Save ${fields.length} Expense${fields.length === 1 ? "" : "s"}`}
        </Button>
      </div>
    </form>
  );
}
