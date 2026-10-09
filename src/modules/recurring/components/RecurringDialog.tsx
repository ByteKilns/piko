"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AmountInput } from "@/components/AmountInput";
import { CategoryComboboxField } from "@/components/CategoryComboboxField";
import { Modal } from "@/components/Modal";
import { MoreDetails } from "@/components/MoreDetails";
import { NepaliDateField } from "@/components/NepaliDateField";
import { Segmented } from "@/components/Segmented";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import type { DateFormat } from "@/lib/date-format-cookie";
import { todayISO } from "@/lib/today";
import { createRecurringExpenseAction, updateRecurringExpenseAction } from "@/modules/recurring/api/recurring.actions";
import { IconPicker } from "@/modules/recurring/components/IconPicker";
import type { RecurringIcon } from "@/modules/recurring/lib/recurring-icons";
import { nextDueDateForDay } from "@/modules/recurring/lib/recurring-view";

type Category = { budgetType: "fixed" | "flexible"; groupName: string; id: string; name: string };
type Member = { id: string; name: string };

export type RecurringOwnerKey = "me" | "partner" | "shared";

export type RecurringEditing = {
  amount: number;
  categoryId: string;
  dueDay: number;
  endDate: null | string;
  frequency: "monthly" | "quarterly" | "yearly";
  icon: string;
  id: string;
  name: string;
  ownerKey: RecurringOwnerKey;
  vendor: null | string;
};

type Props = {
  categories: Category[];
  currentMemberId: string;
  dateFormat: DateFormat;
  editing: null | RecurringEditing;
  members: Member[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

const FORM_ID = "recurring-form";

// Add / edit a recurring item. Name, amount, repeats, owner and due day are
// the visible fields; everything the schema needs but the design leaves out
// lives under More details.
export function RecurringDialog({ categories, currentMemberId, dateFormat, editing, members, onOpenChange, open }: Props) {
  const [pending, setPending] = useState(false);

  return (
    <Modal
      className="sm:max-w-120"
      footer={
        <Button className="min-w-35 justify-start" disabled={pending} form={FORM_ID} type="submit">
          {pending ? "Saving..." : editing ? "Save changes" : "Add recurring"}
        </Button>
      }
      hint="Enter to save · Esc to close"
      onOpenChange={onOpenChange}
      open={open}
      title={editing ? "Edit recurring" : "Add recurring"}
    >
      <RecurringFields
        categories={categories}
        currentMemberId={currentMemberId}
        dateFormat={dateFormat}
        editing={editing}
        members={members}
        onDone={() => onOpenChange(false)}
        onPendingChange={setPending}
      />
    </Modal>
  );
}

type FieldsProps = Omit<Props, "onOpenChange" | "open"> & { onDone: () => void; onPendingChange: (pending: boolean) => void };

function RecurringFields({ categories, currentMemberId, dateFormat, editing, members, onDone, onPendingChange }: FieldsProps) {
  const router = useRouter();
  const partner = members.find((m) => m.id !== currentMemberId) ?? null;
  const defaultCategoryId = categories.find((c) => c.budgetType === "fixed")?.id ?? categories[0]?.id ?? "";

  const [name, setName] = useState(editing?.name ?? "");
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [frequency, setFrequency] = useState<"monthly" | "quarterly" | "yearly">(editing?.frequency ?? "monthly");
  const [owner, setOwner] = useState<RecurringOwnerKey>(editing?.ownerKey ?? "me");
  const [dueDay, setDueDay] = useState(editing ? String(editing.dueDay) : "1");
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? defaultCategoryId);
  const [vendor, setVendor] = useState(editing?.vendor ?? "");
  const [icon, setIcon] = useState<RecurringIcon>((editing?.icon as RecurringIcon) ?? "receipt");
  const [exactDue, setExactDue] = useState("");
  const [endDate, setEndDate] = useState(editing?.endDate ?? "");
  const [error, setError] = useState<string | undefined>();

  const memberIdFor = (key: RecurringOwnerKey) => (key === "shared" ? null : key === "me" ? currentMemberId : (partner?.id ?? currentMemberId));

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Give it a name");
      return;
    }
    if (!(Number(amount) > 0)) {
      setError("Enter an amount");
      return;
    }

    const nextDueDate = exactDue || nextDueDateForDay(Number(dueDay) || 1, dateFormat, todayISO());
    const payload = {
      amount: Number(amount),
      categoryId,
      endDate: endDate || null,
      frequency,
      icon,
      name: name.trim(),
      nextDueDate,
      ownerMemberId: memberIdFor(owner),
      vendor: vendor.trim() || undefined,
    };

    onPendingChange(true);
    try {
      if (editing) {
        await updateRecurringExpenseAction(editing.id, payload);
        toast.success("Recurring updated");
      } else {
        await createRecurringExpenseAction(payload);
        toast.success("Recurring added");
      }
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
      <TextField
        data-autofocus
        error={error === "Give it a name" ? error : undefined}
        label="Name"
        onChange={(event) => {
          setName(event.target.value);
          setError(undefined);
        }}
        placeholder="e.g. Internet bill"
        value={name}
      />

      <AmountInput
        error={error === "Enter an amount" ? error : undefined}
        label="Amount each time"
        onChange={(event) => {
          setAmount(event.target.value);
          setError(undefined);
        }}
        size="xl"
        value={amount}
      />

      <Segmented
        label="Repeats"
        onChange={setFrequency}
        options={[
          { label: "Monthly", value: "monthly" },
          { label: "Quarterly", value: "quarterly" },
          { label: "Yearly", value: "yearly" },
        ]}
        value={frequency}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Segmented
          label="For"
          onChange={setOwner}
          options={[
            { label: "Me", value: "me" },
            ...(partner ? [{ label: partner.name, value: "partner" as const }] : []),
            { label: "Shared", value: "shared" },
          ]}
          value={owner}
        />
        <TextField
          inputMode="numeric"
          label="Due on day"
          onChange={(event) => setDueDay(event.target.value.replace(/\D/g, "").slice(0, 2))}
          placeholder="1–31"
          value={dueDay}
        />
      </div>

      <MoreDetails>
        <CategoryComboboxField
          categories={categories}
          label="Category"
          onValueChange={setCategoryId}
          value={categoryId}
        />
        <TextField label="Vendor" onChange={(event) => setVendor(event.target.value)} placeholder="Optional" value={vendor} />
        <IconPicker onChange={setIcon} value={icon} />
        <NepaliDateField label="Exact next due date" onChange={setExactDue} value={exactDue} />
        <NepaliDateField label="End date" onChange={setEndDate} value={endDate} />
      </MoreDetails>
    </form>
  );
}
