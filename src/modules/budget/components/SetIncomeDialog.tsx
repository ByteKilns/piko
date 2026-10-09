"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AmountInput } from "@/components/AmountInput";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { setIncomeAction } from "@/modules/budget/api/budget.actions";

type Member = { id: string; name: string };

type Props = {
  currentMemberId: string;
  incomes: Record<string, number>;
  members: Member[];
  month: number;
  monthLabel: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  year: number;
};

const FORM_ID = "set-income-form";

// One amount per household member, saved together. Its fields unmount with
// the dialog (Radix unmounts closed content), so every open starts from the
// current incomes again; only the pending flag lives up here for the footer.
export function SetIncomeDialog({ currentMemberId, incomes, members, month, monthLabel, onOpenChange, open, year }: Props) {
  const [pending, setPending] = useState(false);

  return (
    <Modal
      className="sm:max-w-100"
      footer={
        <Button className="min-w-37.5 justify-start" disabled={pending} form={FORM_ID} type="submit">
          {pending ? "Saving..." : "Save income"}
        </Button>
      }
      hint="Enter to save · Esc to close"
      onOpenChange={onOpenChange}
      open={open}
      subtitle={monthLabel}
      title="Set income"
    >
      <SetIncomeFields
        currentMemberId={currentMemberId}
        incomes={incomes}
        members={members}
        month={month}
        onDone={() => onOpenChange(false)}
        onPendingChange={setPending}
        year={year}
      />
    </Modal>
  );
}

type FieldsProps = Omit<Props, "monthLabel" | "onOpenChange" | "open"> & { onDone: () => void; onPendingChange: (pending: boolean) => void };

function SetIncomeFields({ currentMemberId, incomes, members, month, onDone, onPendingChange, year }: FieldsProps) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(members.map((m) => [m.id, incomes[m.id] ? String(incomes[m.id]) : ""])),
  );

  const label = (member: Member) => (member.id === currentMemberId ? "Me" : member.name);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const changed = members.filter((m) => (Number(values[m.id]) || 0) !== (incomes[m.id] ?? 0));
    if (changed.length === 0) {
      onDone();
      return;
    }

    onPendingChange(true);
    try {
      await Promise.all(
        changed.map((m) => setIncomeAction({ amount: Number(values[m.id]) || 0, memberId: m.id, month, year })),
      );
      toast.success("Income saved");
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
      {members.map((member) => (
        <AmountInput
          data-autofocus={member.id === currentMemberId ? true : undefined}
          key={member.id}
          label={`${label(member)} income`}
          onChange={(event) => setValues((prev) => ({ ...prev, [member.id]: event.target.value }))}
          placeholder="0.00"
          value={values[member.id] ?? ""}
        />
      ))}
    </form>
  );
}
