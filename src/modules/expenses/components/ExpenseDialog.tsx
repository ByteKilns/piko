"use client";

import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { AmountInput } from "@/components/AmountInput";
import { CategoryComboboxField } from "@/components/CategoryComboboxField";
import { Modal } from "@/components/Modal";
import { NepaliDateField } from "@/components/NepaliDateField";
import { Segmented } from "@/components/Segmented";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { todayISO } from "@/lib/today";
import { cn } from "@/lib/utils";
import { createExpenseAction, updateExpenseAction } from "@/modules/expenses/api/expenses.actions";
import { type ExpenseInput, expenseSchema } from "@/modules/expenses/schemas/expense.schema";

type Member = { id: string; name: string };
type Category = { groupName: string; id: string; name: string };

export type ExpenseDraft = {
  amount: number;
  categoryId: string;
  date: string;
  fundAmount?: null | number;
  fundId?: null | string;
  note: null | string;
  ownerMemberId: null | string;
  paidByMemberId: string;
  payBackAmount?: null | number;
  savingsItemId?: null | string;
  savingsItemName?: null | string;
  savingsPotId?: null | string;
};

type Props = {
  categories: Category[];
  currentMemberId: string;
  // Edit mode when set; otherwise the dialog adds a new expense.
  expenseId?: string;
  // Funds that can pay, with what each holds now. Only the payer's own show.
  funds?: { balance: number; id: string; name: string; ownerMemberId: string }[];
  initial?: ExpenseDraft;
  members: Member[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  // Most-used categories, offered as one-tap chips under the picker.
  quickCategoryIds?: string[];
  // Savings pots that can pay for this expense. Leave out to hide "Paid from".
  savingsPots?: { id: string; name: string }[];
};

const FORM_ID = "expense-form";
const SHARED = "shared";
const PAY = "pay";
const QUICK_CHIPS = 5;

// The Add / Edit expense dialog from the Expenses mockup. Its fields unmount
// with the dialog (Radix unmounts closed content), so every open starts from
// `initial` again; only the pending flag lives up here, for the footer button.
export function ExpenseDialog({ expenseId, onOpenChange, open, ...rest }: Props) {
  const [pending, setPending] = useState(false);
  const editing = Boolean(expenseId);

  return (
    <Modal
      className="sm:max-w-125"
      footer={
        <Button className="min-w-37.5 justify-start" disabled={pending} form={FORM_ID} type="submit">
          {pending ? "Saving..." : editing ? "Save changes" : "Add expense"}
        </Button>
      }
      hint="Enter to save · Esc to close"
      onOpenChange={onOpenChange}
      open={open}
      title={editing ? "Edit expense" : "Add expense"}
    >
      <ExpenseFields {...rest} expenseId={expenseId} onDone={() => onOpenChange(false)} onPendingChange={setPending} />
    </Modal>
  );
}

export type ExpenseFieldsProps = Omit<Props, "onOpenChange" | "open"> & {
  // Ties the form to a submit button outside it. Two forms on one page (the
  // dialog and the demo's phone) need different ids.
  formId?: string;
  onDone: () => void;
  onPendingChange: (pending: boolean) => void;
};

// The form inside the dialog, also used on its own (the demo's phone). It lays
// out against its own width, so it fits a narrow panel on a wide screen.
export function ExpenseFields({
  categories,
  currentMemberId,
  expenseId,
  formId = FORM_ID,
  funds = [],
  initial,
  members,
  onDone,
  onPendingChange,
  quickCategoryIds = [],
  savingsPots = [],
}: ExpenseFieldsProps) {
  const router = useRouter();
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [payBack, setPayBack] = useState(initial?.payBackAmount != null);
  const [payBackText, setPayBackText] = useState(initial?.payBackAmount != null ? String(initial.payBackAmount) : "");
  const [paidFrom, setPaidFrom] = useState<string>(
    initial?.savingsPotId ? `pot:${initial.savingsPotId}` : initial?.fundId ? `fund:${initial.fundId}` : PAY,
  );
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    setValue,
    watch,
  } = useForm<ExpenseInput>({
    defaultValues: {
      amount: initial?.amount,
      categoryId: initial?.categoryId ?? "",
      date: initial?.date ?? todayISO(),
      note: initial?.note ?? "",
      ownerMemberId: initial ? initial.ownerMemberId : currentMemberId,
      paidByMemberId: initial?.paidByMemberId ?? currentMemberId,
    },
    resolver: zodResolver(expenseSchema),
  });

  const ownerMemberId = watch("ownerMemberId");
  const paidByMemberId = watch("paidByMemberId");
  const categoryId = watch("categoryId");
  const amount = Number(watch("amount")) || 0;
  const label = (m: Member) => (m.id === currentMemberId ? "Me" : m.name);
  const people = [...members.filter((m) => m.id === currentMemberId), ...members.filter((m) => m.id !== currentMemberId)];

  // Only the payer's own funds can pay, so switching who paid drops a fund
  // that isn't theirs back to pay.
  const payerFunds = funds.filter((fund) => fund.ownerMemberId === paidByMemberId);
  const source = paidFrom.startsWith("fund:") && !payerFunds.some((fund) => `fund:${fund.id}` === paidFrom) ? PAY : paidFrom;
  const potId = source.startsWith("pot:") ? source.slice(4) : null;
  const fund = payerFunds.find((f) => `fund:${f.id}` === source) ?? null;
  // An edited expense's own earlier share comes back to the fund first.
  const available = fund ? fund.balance + (initial?.fundId === fund.id ? (initial.fundAmount ?? 0) : 0) : 0;
  const paidFromOptions = [
    { label: "Pay", value: PAY },
    ...savingsPots.map((pot) => ({ label: `${pot.name} (savings)`, value: `pot:${pot.id}` })),
    ...payerFunds.map((f) => ({ label: `${f.name} (fund)`, value: `fund:${f.id}` })),
  ];

  // The list item only stays linked while the expense stays on that item's pot.
  const keepsItem = potId !== null && Boolean(initial?.savingsItemId) && potId === initial?.savingsPotId;

  // "Pay back later" needs exactly two people: the one who paid, and the
  // other one, who owes it. Money from savings or a fund is never paid back.
  const payer = members.find((m) => m.id === paidByMemberId);
  const other = members.length === 2 && source === PAY ? (members.find((m) => m.id !== paidByMemberId) ?? null) : null;
  const payBackLabel = paidByMemberId === currentMemberId ? `${other?.name ?? "They"} will pay me back` : `I'll pay ${payer?.name ?? "them"} back`;

  const quick = (quickCategoryIds.length > 0 ? quickCategoryIds : categories.map((c) => c.id))
    .map((id) => categoryOptions.find((c) => c.id === id))
    .filter((c): c is Category => c !== undefined)
    .slice(0, QUICK_CHIPS);

  function chooseOwner(value: string) {
    setValue("ownerMemberId", value === SHARED ? null : value);
    // Someone's own expense is usually paid by them; Shared keeps whoever was picked.
    if (value !== SHARED) setValue("paidByMemberId", value);
  }

  const onSubmit = handleSubmit(async (values) => {
    let payBackAmount: null | number = null;
    if (other && payBack) {
      payBackAmount = payBackText.trim() === "" ? values.amount : Number(payBackText);
      if (!(payBackAmount > 0) || payBackAmount > values.amount) {
        toast.error("The amount to pay back must be above 0 and no more than the expense");
        return;
      }
    }
    onPendingChange(true);
    const payload = {
      ...values,
      fundId: fund?.id ?? null,
      note: values.note?.trim() || undefined,
      payBackAmount,
      savingsItemId: keepsItem ? (initial?.savingsItemId ?? null) : null,
      savingsPotId: potId,
    };
    try {
      if (expenseId) {
        await updateExpenseAction(expenseId, payload);
      } else {
        await createExpenseAction(payload);
      }
      onDone();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      onPendingChange(false);
    }
  });

  return (
    <form className="@container flex flex-col gap-5.5" id={formId} noValidate onSubmit={onSubmit}>
      <AmountInput
        data-autofocus
        error={errors.amount ? "Enter an amount to continue" : undefined}
        label="Amount"
        size="xl"
        {...register("amount", { setValueAs: (value) => (value === "" || value === undefined ? Number.NaN : Number(value)) })}
      />

      <div>
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <CategoryComboboxField
              categories={categoryOptions}
              error={errors.categoryId ? "Choose a category" : undefined}
              label="Category"
              onCategoriesChange={(category) =>
                setCategoryOptions((prev) => (prev.some((c) => c.id === category.id) ? prev : [...prev, category]))
              }
              onValueChange={field.onChange}
              placeholder="Start typing — Lunch, Groceries…"
              value={field.value}
            />
          )}
        />
        {quick.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {quick.map((category) => (
              <button
                className={cn(
                  "border px-2.25 py-0.75 text-xs",
                  category.id === categoryId ? "border-signal text-signal-ink" : "border-n-300 text-n-800 hover:border-ink",
                )}
                key={category.id}
                onClick={() => setValue("categoryId", category.id, { shouldValidate: Boolean(errors.categoryId) })}
                type="button"
              >
                {category.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 @min-[420px]:grid-cols-2">
        <Segmented
          label="For"
          onChange={chooseOwner}
          options={[...people.map((m) => ({ label: label(m), value: m.id })), { label: "Shared", value: SHARED }]}
          value={ownerMemberId ?? SHARED}
        />
        <Segmented
          label="Paid by"
          onChange={(value) => setValue("paidByMemberId", value)}
          options={people.map((m) => ({ label: label(m), value: m.id }))}
          value={paidByMemberId}
        />
      </div>

      {paidFromOptions.length > 1 && (
        <div className="flex flex-col gap-2">
          <SelectField label="Paid from" onValueChange={setPaidFrom} options={paidFromOptions} value={source} />
          {keepsItem && <p className="text-[13px] text-n-700">For list item: {initial?.savingsItemName ?? "a savings item"}</p>}
          {fund && amount > available && (
            <p className="text-[13px] text-n-700">
              {fund.name} has {formatMoney(Math.max(0, available))}. The other {formatMoney(amount - Math.max(0, available))} counts as this
              month&apos;s spending.
            </p>
          )}
        </div>
      )}

      {other && (
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm text-n-800">
            <input checked={payBack} onChange={(event) => setPayBack(event.target.checked)} type="checkbox" />
            {payBackLabel}
          </label>
          {payBack && (
            <AmountInput
              label="Amount to pay back"
              onChange={(event) => setPayBackText(event.target.value)}
              placeholder="Leave empty for the full amount"
              value={payBackText}
            />
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 @min-[420px]:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Controller
          control={control}
          name="date"
          render={({ field }) => <NepaliDateField error={errors.date?.message} label="Date" onChange={field.onChange} value={field.value} />}
        />
        <TextField id="note" label="Note" placeholder="Optional — e.g. tea with Ram" {...register("note")} />
      </div>
    </form>
  );
}
