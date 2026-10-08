"use client";

import { useState } from "react";

import { ChevronDown, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type Control, Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { CategoryComboboxField } from "@/components/CategoryComboboxField";
import { Modal } from "@/components/Modal";
import { NepaliDateField } from "@/components/NepaliDateField";
import { Button } from "@/components/ui/button";
import { formatMoney, sanitizeAmountInput } from "@/lib/money";
import { todayISO } from "@/lib/today";
import { cn } from "@/lib/utils";
import { createExpensesBulkAction } from "@/modules/expenses/api/expenses.actions";
import { type BulkRow, parseBulkRows, SHARED_OWNER } from "@/modules/expenses/lib/bulk-rows";

type Member = { id: string; name: string };

type Props = {
  categories: { groupName: string; id: string; name: string }[];
  currentMemberId: string;
  members: Member[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type BulkForm = { rows: BulkRow[] };

const FORM_ID = "bulk-expense-form";
const STARTING_ROWS = 3;
const GRID = "grid min-w-225 grid-cols-[164px_minmax(0,1.3fr)_120px_118px_118px_minmax(0,1fr)_40px]";
const CELL =
  "h-11 w-full min-w-0 border-0 border-r border-n-300 bg-transparent px-3 text-sm text-ink outline-none focus:bg-surface focus:shadow-[inset_0_-2px_0_var(--signal)]";
// The picker components bring their own border/height; flatten them into cells.
const FIELD_CELL = "h-11 border-0 px-3 text-sm hover:border-0 focus-visible:border-0 focus-visible:bg-surface";

function blankRow(memberId: string, date = todayISO()): BulkRow {
  return { amount: "", categoryId: "", date, note: "", owner: memberId, paidByMemberId: memberId };
}

function plural(count: number) {
  return `${count} ${count === 1 ? "expense" : "expenses"}`;
}

// "Add in bulk" from the Expenses mockup: a spreadsheet you tab across. Rows
// without an amount are skipped. Mount it with a fresh `key` per open so it
// starts from blank rows each time.
export function BulkAddExpenseModal({ categories, currentMemberId, members, onOpenChange, open }: Props) {
  const router = useRouter();
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const {
    control,
    formState: { isSubmitting },
    getValues,
    handleSubmit,
    register,
  } = useForm<BulkForm>({
    defaultValues: { rows: Array.from({ length: STARTING_ROWS }, () => blankRow(currentMemberId)) },
  });
  const { append, fields, remove } = useFieldArray({ control, name: "rows" });
  const people = [...members.filter((m) => m.id === currentMemberId), ...members.filter((m) => m.id !== currentMemberId)];
  const label = (m: Member) => (m.id === currentMemberId ? "Me" : m.name);

  const onSubmit = handleSubmit(async ({ rows }) => {
    const { inputs, missingCategoryRows } = parseBulkRows(rows);
    if (missingCategoryRows.length > 0) {
      toast.error(`Pick a category for row ${missingCategoryRows.join(", ")}`);
      return;
    }
    if (inputs.length === 0) return;
    try {
      await createExpensesBulkAction(inputs);
      toast.success(`${plural(inputs.length)} added`);
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  });

  return (
    <Modal
      className="sm:max-w-270"
      footer={<BulkFooter control={control} pending={isSubmitting} />}
      onOpenChange={onOpenChange}
      open={open}
      subtitle="Tab across like a spreadsheet. Rows without an amount are skipped."
      title="Add in bulk"
    >
      <form id={FORM_ID} noValidate onSubmit={onSubmit}>
        <div className="overflow-x-auto">
          <div className={cn(GRID, "micro-label border-t-2 border-b-2 border-t-ink border-b-rule text-n-600")}>
            {["Date", "Category", "Amount", "For", "Paid by", "Note"].map((heading) => (
              <span className={cn("px-3 py-2.5", heading === "Amount" && "text-right")} key={heading}>
                {heading}
              </span>
            ))}
            <span />
          </div>

          {fields.map((field, index) => {
            const amount = register(`rows.${index}.amount`);
            return (
              <div className={cn(GRID, "border-b border-n-300")} key={field.id}>
                <Controller
                  control={control}
                  name={`rows.${index}.date`}
                  render={({ field: f }) => (
                    <NepaliDateField containerClassName="space-y-0 border-r border-n-300" inputClassName={FIELD_CELL} onChange={f.onChange} value={f.value} />
                  )}
                />
                <Controller
                  control={control}
                  name={`rows.${index}.categoryId`}
                  render={({ field: f }) => (
                    <CategoryComboboxField
                      categories={categoryOptions}
                      containerClassName="space-y-0 border-r border-n-300"
                      inputClassName={FIELD_CELL}
                      onCategoriesChange={(category) =>
                        setCategoryOptions((prev) => (prev.some((c) => c.id === category.id) ? prev : [...prev, category]))
                      }
                      onValueChange={f.onChange}
                      placeholder="Category"
                      value={f.value}
                    />
                  )}
                />
                <input
                  aria-label={`Amount, row ${index + 1}`}
                  className={cn(CELL, "text-right font-semibold tabular-nums")}
                  inputMode="decimal"
                  placeholder="0.00"
                  {...amount}
                  onChange={(event) => {
                    event.target.value = sanitizeAmountInput(event.target.value);
                    return amount.onChange(event);
                  }}
                />
                <div className="relative">
                  <select aria-label={`For, row ${index + 1}`} className={cn(CELL, "appearance-none pr-7")} {...register(`rows.${index}.owner`)}>
                    {people.map((m) => (
                      <option key={m.id} value={m.id}>
                        {label(m)}
                      </option>
                    ))}
                    <option value={SHARED_OWNER}>Shared</option>
                  </select>
                  <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-n-600" />
                </div>
                <div className="relative">
                  <select aria-label={`Paid by, row ${index + 1}`} className={cn(CELL, "appearance-none pr-7")} {...register(`rows.${index}.paidByMemberId`)}>
                    {people.map((m) => (
                      <option key={m.id} value={m.id}>
                        {label(m)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-n-600" />
                </div>
                <input aria-label={`Note, row ${index + 1}`} className={CELL} placeholder="Optional" {...register(`rows.${index}.note`)} />
                <button
                  aria-label={`Remove row ${index + 1}`}
                  className="grid place-items-center text-n-500 hover:text-ink disabled:opacity-30"
                  disabled={fields.length <= 1}
                  onClick={() => remove(index)}
                  type="button"
                >
                  <X className="size-4" />
                </button>
              </div>
            );
          })}
        </div>

        <Button
          className="mt-2.5 -ml-2.5"
          onClick={() => append(blankRow(currentMemberId, getValues("rows").at(-1)?.date))}
          type="button"
          variant="ghost"
        >
          <Plus />
          Add row
        </Button>
      </form>
    </Modal>
  );
}

// Live "3 expenses · Rs 1,250.00" plus the save button, which counts only the
// rows that will actually be saved.
function BulkFooter({ control, pending }: { control: Control<BulkForm>; pending: boolean }) {
  const rows = useWatch({ control, name: "rows" });
  const { inputs } = parseBulkRows(rows ?? []);
  const total = inputs.reduce((sum, input) => sum + input.amount, 0);

  return (
    <>
      <span className="mr-auto text-sm text-n-700 tabular-nums">
        {inputs.length > 0 ? `${plural(inputs.length)} · ${formatMoney(total)}` : "Nothing to save yet"}
      </span>
      <Button className="min-w-40 justify-start" disabled={pending || inputs.length === 0} form={FORM_ID} type="submit">
        {pending ? "Saving..." : inputs.length > 0 ? `Save ${plural(inputs.length)}` : "Save"}
      </Button>
    </>
  );
}
