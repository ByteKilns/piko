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
import { updateCategoryAction } from "@/modules/categories/api/categories.actions";

type Category = { budgetType: "fixed" | "flexible"; groupName: string; id: string; name: string };
type Member = { id: string; name: string };

export type BudgetOwnerKey = "me" | "partner" | "shared";

export type BudgetDraft = {
  budgetType: "fixed" | "flexible";
  categoryId: string;
  ownerKey: BudgetOwnerKey;
  planned: number;
};

type Props = {
  categories: Category[];
  currentMemberId: string;
  defaultCategoryId?: string;
  initial?: BudgetDraft;
  members: Member[];
  month: number;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  ownerKey: BudgetOwnerKey;
  spentByKey: Record<string, number>;
  year: number;
};

const FORM_ID = "budget-form";
const AMOUNT_ERROR = "Enter a monthly amount";

// Set / change a category's budget for one owner. The category's Type also
// updates the shared category (spec §3.3), so every owner's budget for it
// reads the same.
export function BudgetDialog({ categories, currentMemberId, defaultCategoryId, initial, members, month, onOpenChange, open, ownerKey, spentByKey, year }: Props) {
  const [pending, setPending] = useState(false);

  return (
    <Modal
      className="sm:max-w-120"
      footer={
        <>
          <Button className="min-w-35 justify-start" disabled={pending} form={FORM_ID} type="submit">
            {pending ? "Saving..." : "Save budget"}
          </Button>
          {initial && (
            <Button disabled={pending} form={FORM_ID} type="submit" value="remove" variant="destructive">
              Remove budget
            </Button>
          )}
        </>
      }
      hint="Enter to save · Esc to close"
      onOpenChange={onOpenChange}
      open={open}
      title={initial ? "Change budget" : "Set a budget"}
    >
      <BudgetFields
        categories={categories}
        currentMemberId={currentMemberId}
        defaultCategoryId={defaultCategoryId}
        initial={initial}
        members={members}
        month={month}
        onDone={() => onOpenChange(false)}
        onPendingChange={setPending}
        ownerKey={ownerKey}
        spentByKey={spentByKey}
        year={year}
      />
    </Modal>
  );
}

type FieldsProps = Omit<Props, "onOpenChange" | "open"> & { onDone: () => void; onPendingChange: (pending: boolean) => void };

function BudgetFields({ categories, currentMemberId, defaultCategoryId, initial, members, month, onDone, onPendingChange, ownerKey, spentByKey, year }: FieldsProps) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? defaultCategoryId ?? "");
  const [owner, setOwner] = useState<BudgetOwnerKey>(initial?.ownerKey ?? ownerKey);
  const [amount, setAmount] = useState(initial ? String(initial.planned) : "");
  const [budgetType, setBudgetType] = useState<"fixed" | "flexible">(
    () => initial?.budgetType ?? categories.find((c) => c.id === defaultCategoryId)?.budgetType ?? "flexible",
  );
  const [error, setError] = useState<string | undefined>();

  const partner = members.find((m) => m.id !== currentMemberId) ?? null;
  const memberIdFor = (key: BudgetOwnerKey) => (key === "shared" ? null : key === "me" ? currentMemberId : (partner?.id ?? currentMemberId));

  const selectedCategory = categories.find((c) => c.id === categoryId) ?? null;
  const spent = categoryId ? (spentByKey[`${categoryId}::${owner}`] ?? 0) : 0;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const intent = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ?? "save";

    onPendingChange(true);
    try {
      if (intent === "remove") {
        await removeBudgetItemAction({ categoryId, month, ownerMemberId: memberIdFor(owner), year });
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

      if (selectedCategory.budgetType !== budgetType) {
        await updateCategoryAction(selectedCategory.id, {
          budgetType,
          groupName: selectedCategory.groupName,
          name: selectedCategory.name,
        });
      }
      await setBudgetItemAction({ categoryId: selectedCategory.id, month, ownerMemberId: memberIdFor(owner), plannedAmount: value, year });
      toast.success("Budget saved");
      onDone();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      onPendingChange(false);
    }
  }

  const ownerOptions = [
    { label: "Me", value: "me" as const },
    ...(partner ? [{ label: partner.name, value: "partner" as const }] : []),
    { label: "Shared", value: "shared" as const },
  ];

  return (
    <form className="flex flex-col gap-5.5" id={FORM_ID} noValidate onSubmit={onSubmit}>
      <div>
        <CategoryComboboxField
          categories={categories}
          error={error === "Choose a category" ? error : undefined}
          label="Category"
          onValueChange={(value) => {
            setCategoryId(value);
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

      <Segmented label="For" onChange={setOwner} options={ownerOptions} value={owner} />

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
        <Segmented
          label="Type"
          onChange={setBudgetType}
          options={[
            { label: "Fixed", value: "fixed" },
            { label: "Flexible", value: "flexible" },
          ]}
          value={budgetType}
        />
        <p className="mt-1.5 text-xs leading-normal text-n-600">
          Fixed is the same every month, like a loan payment. Flexible changes, like groceries.
        </p>
      </div>
    </form>
  );
}
