"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AmountInput } from "@/components/AmountInput";
import { Modal } from "@/components/Modal";
import { MoreDetails } from "@/components/MoreDetails";
import { NepaliDateField } from "@/components/NepaliDateField";
import { Segmented } from "@/components/Segmented";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { createDhukuAction, updateDhukuAction } from "@/modules/dhuku/api/dhuku.actions";

type Member = { id: string; name: string };

export type DhukuOwnerKey = "me" | "partner" | "shared";

export type DhukuEditing = {
  id: string;
  interestPerMonth: null | number;
  monthlyContribution: number;
  name: string;
  note: null | string;
  ownerKey: DhukuOwnerKey;
  startDate: string;
  totalMembers: number;
};

type Props = {
  currentMemberId: string;
  defaultStartDate: string;
  editing: null | DhukuEditing;
  members: Member[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

const FORM_ID = "dhuku-form";

export function DhukuDialog({ currentMemberId, defaultStartDate, editing, members, onOpenChange, open }: Props) {
  const [pending, setPending] = useState(false);

  return (
    <Modal
      className="sm:max-w-120"
      footer={
        <Button className="min-w-35 justify-start" disabled={pending} form={FORM_ID} type="submit">
          {pending ? "Saving..." : editing ? "Save changes" : "Add dhuku"}
        </Button>
      }
      hint="Enter to save · Esc to close"
      onOpenChange={onOpenChange}
      open={open}
      title={editing ? "Edit dhuku" : "Add a dhuku"}
    >
      <DhukuFields
        currentMemberId={currentMemberId}
        defaultStartDate={defaultStartDate}
        editing={editing}
        members={members}
        onDone={() => onOpenChange(false)}
        onPendingChange={setPending}
      />
    </Modal>
  );
}

type FieldsProps = Omit<Props, "onOpenChange" | "open"> & { onDone: () => void; onPendingChange: (pending: boolean) => void };

function DhukuFields({ currentMemberId, defaultStartDate, editing, members, onDone, onPendingChange }: FieldsProps) {
  const router = useRouter();
  const partner = members.find((m) => m.id !== currentMemberId) ?? null;

  const [name, setName] = useState(editing?.name ?? "");
  const [monthly, setMonthly] = useState(editing ? String(editing.monthlyContribution) : "");
  const [months, setMonths] = useState(editing ? String(editing.totalMembers) : "12");
  const [owner, setOwner] = useState<DhukuOwnerKey>(editing?.ownerKey ?? "me");
  const [startDate, setStartDate] = useState(editing?.startDate ?? defaultStartDate);
  const [hasInterest, setHasInterest] = useState(editing ? editing.interestPerMonth !== null : false);
  const [interest, setInterest] = useState(editing?.interestPerMonth != null ? String(editing.interestPerMonth) : "");
  const [note, setNote] = useState(editing?.note ?? "");
  const [error, setError] = useState<string | undefined>();

  const memberIdFor = (key: DhukuOwnerKey) => (key === "shared" ? null : key === "me" ? currentMemberId : (partner?.id ?? currentMemberId));
  const monthlyValue = Number(monthly) || 0;
  const monthsValue = Number(months) || 0;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Name the group");
      return;
    }
    if (!(monthlyValue > 0)) {
      setError("Enter the monthly contribution");
      return;
    }
    if (monthsValue < 2) {
      setError("Enter at least 2 months");
      return;
    }

    const payload = {
      interestPerMonth: hasInterest && Number(interest) > 0 ? Number(interest) : null,
      monthlyContribution: monthlyValue,
      name: name.trim(),
      note: note.trim() || undefined,
      ownerMemberId: memberIdFor(owner),
      startDate,
      totalMembers: Math.round(monthsValue),
    };

    onPendingChange(true);
    try {
      if (editing) {
        await updateDhukuAction(editing.id, payload);
        toast.success("Dhuku updated");
      } else {
        await createDhukuAction(payload);
        toast.success("Dhuku added");
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
        error={error === "Name the group" ? error : undefined}
        label="Group name"
        onChange={(event) => {
          setName(event.target.value);
          setError(undefined);
        }}
        placeholder="e.g. Office Dhuku"
        value={name}
      />

      <AmountInput
        error={error === "Enter the monthly contribution" ? error : undefined}
        label="Monthly contribution"
        onChange={(event) => {
          setMonthly(event.target.value);
          setError(undefined);
        }}
        size="xl"
        value={monthly}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <TextField
          error={error === "Enter at least 2 months" ? error : undefined}
          inputMode="numeric"
          label="Months"
          onChange={(event) => {
            setMonths(event.target.value.replace(/\D/g, "").slice(0, 2));
            setError(undefined);
          }}
          value={months}
        />
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
      </div>

      <p className="text-[13px] text-n-700">
        {monthlyValue > 0 && monthsValue > 0
          ? `Pot when it's your turn: ${formatMoney(monthlyValue * monthsValue)}`
          : "The pot is the monthly amount × number of months."}
      </p>

      <MoreDetails>
        <NepaliDateField label="Start date" onChange={setStartDate} value={startDate} />
        <label className="flex items-center gap-2 text-sm text-n-800">
          <input checked={hasInterest} onChange={(event) => setHasInterest(event.target.checked)} type="checkbox" />
          I&apos;ve taken (or will take) my payout, and owe interest
        </label>
        {hasInterest && <AmountInput label="Interest per month" onChange={(event) => setInterest(event.target.value)} value={interest} />}
        <TextField label="Note" onChange={(event) => setNote(event.target.value)} placeholder="Optional" value={note} />
      </MoreDetails>
    </form>
  );
}
