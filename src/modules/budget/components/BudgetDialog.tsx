"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AmountInput } from "@/components/AmountInput";
import { CategoryComboboxField } from "@/components/CategoryComboboxField";
import { Modal } from "@/components/Modal";
import { Segmented } from "@/components/Segmented";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { removeBudgetItemAction, setBudgetItemAction } from "@/modules/budget/api/budget.actions";
import { type BudgetLineKind, kindOf, LINE_KINDS } from "@/modules/budget/lib/plan-lines";

type Category = { budgetType: "fixed" | "flexible"; groupName: string; id: string; name: string };

export type BudgetDraft = { categoryId: string; kind: BudgetLineKind; planned: number };

type Props = {
  categories: Category[];
  defaultCategoryId?: string;
  initial?: BudgetDraft;
  // The kind this person last gave each category, so a new line starts the same way.
  lastKinds: Record<string, BudgetLineKind>;
  month: number;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  ownerMemberId: string;
  // "Your plan" or "Karuna's plan".
  planLabel: string;
  spentByCategory: Record<string, number>;
  year: number;
};

const FORM_ID = "budget-form";
const AMOUNT_ERROR = "Enter a monthly amount";

const KIND_HELP: Record<BudgetLineKind, string> = {
  can_cut: "Money you can choose not to spend, like lunches out or shopping. Home's safe to spend is worked out from these.",
  essential: "Changes month to month but can't really be cut, like petrol or groceries.",
  fixed: "The same every month, like rent, a loan payment or a bill.",
};

// Set or change one line of one person's plan.
export function BudgetDialog({ onOpenChange, open, ...rest }: Props) {
  const [pending, setPending] = useState(false);

  return (
    <Modal
      className="sm:max-w-120"
      footer={
        <>
          <Button className="min-w-35 justify-start" disabled={pending} form={FORM_ID} type="submit">
            {pending ? "Saving..." : "Save budget"}
          </Button>
          {rest.initial && (
            <Button disabled={pending} form={FORM_ID} type="submit" value="remove" variant="destructive">
              Remove budget
            </Button>
          )}
        </>
      }
      hint="Enter to save · Esc to close"
      onOpenChange={onOpenChange}
      open={open}
      subtitle={rest.planLabel}
      title={rest.initial ? "Change budget" : "Set a budget"}
    >
      <BudgetFields {...rest} onDone={() => onOpenChange(false)} onPendingChange={setPending} />
    </Modal>
  );
}

type FieldsProps = Omit<Props, "onOpenChange" | "open"> & { onDone: () => void; onPendingChange: (pending: boolean) => void };

function BudgetFields({
  categories,
  defaultCategoryId,
  initial,
  lastKinds,
  month,
  onDone,
  onPendingChange,
  ownerMemberId,
  spentByCategory,
  year,
}: FieldsProps) {
  const router = useRouter();
  const defaultKind = (categoryId: string) => lastKinds[categoryId] ?? kindOf(null, categories.find((c) => c.id === categoryId)?.budgetType);
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? defaultCategoryId ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.planned) : "");
  const [kind, setKind] = useState<BudgetLineKind>(() => initial?.kind ?? defaultKind(initial?.categoryId ?? defaultCategoryId ?? ""));
  const [error, setError] = useState<string | undefined>();

  const selectedCategory = categories.find((c) => c.id === categoryId) ?? null;
  const spent = categoryId ? (spentByCategory[categoryId] ?? 0) : 0;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const intent = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ?? "save";

    onPendingChange(true);
    try {
      if (intent === "remove") {
        await removeBudgetItemAction({ categoryId, month, ownerMemberId, year });
        toast.success("Budget removed");
        onDone();
        router.refresh();
        return;
      }

      if (!selectedCategory) {
        setError("Choose a category");
        return;
      }
      const value = Number(amount);
      if (!(value > 0)) {
        setError(AMOUNT_ERROR);
        return;
      }

      await setBudgetItemAction({ categoryId: selectedCategory.id, kind, month, ownerMemberId, plannedAmount: value, year });
      toast.success("Budget saved");
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
      <div>
        <CategoryComboboxField
          categories={categories}
          error={error === "Choose a category" ? error : undefined}
          label="Category"
          onValueChange={(value) => {
            setCategoryId(value);
            // A new line starts as this person last had it for the category.
            if (!initial) setKind(defaultKind(value));
            setError(undefined);
          }}
          placeholder="Search categories..."
          value={categoryId}
        />
        {spent > 0 && selectedCategory && (
          <p className="mt-1.5 text-xs text-n-600">
            Rs {formatMoney(spent, { currency: false })} already spent on {selectedCategory.name} this month
          </p>
        )}
      </div>

      <AmountInput
        data-autofocus
        error={error === AMOUNT_ERROR ? error : undefined}
        label="Monthly budget"
        onChange={(event) => {
          setAmount(event.target.value);
          setError(undefined);
        }}
        size="xl"
        value={amount}
      />

      <div>
        <Segmented label="Kind" onChange={setKind} options={LINE_KINDS} value={kind} />
        <p className="mt-1.5 text-xs leading-normal text-n-600">{KIND_HELP[kind]}</p>
      </div>
    </form>
  );
}
