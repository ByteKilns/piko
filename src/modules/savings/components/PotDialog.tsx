"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AmountInput } from "@/components/AmountInput";
import { Modal } from "@/components/Modal";
import { Segmented } from "@/components/Segmented";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { createSavingsPotAction, updateSavingsPotAction } from "@/modules/savings/api/savings.actions";
import type { PotOwnerKey, SavingsPotModel } from "@/modules/savings/components/SavingsView";

type Member = { id: string; name: string };

type Props = {
  currentMemberId: string;
  editing: null | SavingsPotModel;
  members: Member[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  ownerKey: PotOwnerKey;
};

const FORM_ID = "savings-pot-form";

export function PotDialog({ onOpenChange, open, ...rest }: Props) {
  const [pending, setPending] = useState(false);

  return (
    <Modal
      className="sm:max-w-120"
      footer={
        <Button className="min-w-35 justify-start" disabled={pending} form={FORM_ID} type="submit">
          {pending ? "Saving..." : rest.editing ? "Save changes" : "Set up pot"}
        </Button>
      }
      hint="Enter to save · Esc to close"
      onOpenChange={onOpenChange}
      open={open}
      title={rest.editing ? "Pot settings" : "Set up a savings pot"}
    >
      <PotFields {...rest} onDone={() => onOpenChange(false)} onPendingChange={setPending} />
    </Modal>
  );
}

type FieldsProps = Omit<Props, "onOpenChange" | "open"> & { onDone: () => void; onPendingChange: (pending: boolean) => void };

function PotFields({ currentMemberId, editing, members, onDone, onPendingChange, ownerKey }: FieldsProps) {
  const router = useRouter();
  const partner = members.find((m) => m.id !== currentMemberId) ?? null;
  const key = editing?.ownerKey ?? ownerKey;
  const ownerMemberId = key === "shared" ? null : key === "me" ? currentMemberId : (partner?.id ?? currentMemberId);
  // A shared pot takes money from both; an individual pot only from its owner.
  const contributors = key === "shared" ? members : members.filter((m) => m.id === ownerMemberId);
  const defaultName = key === "shared" ? "Shared savings" : key === "me" ? "My savings" : `${partner?.name ?? "Partner"}'s savings`;
  const label = (m: Member) => (m.id === currentMemberId ? "Me" : m.name);
  const planFor = (memberId: string) => editing?.plans.find((p) => p.memberId === memberId)?.monthlyAmount;

  const [name, setName] = useState(editing?.name ?? defaultName);
  const [heldBy, setHeldBy] = useState(editing?.heldByMemberId ?? currentMemberId);
  const [opening, setOpening] = useState("");
  const [reserve, setReserve] = useState(editing ? String(editing.reserveMinimum) : "");
  const [plans, setPlans] = useState<Record<string, string>>(() =>
    Object.fromEntries(contributors.map((m) => [m.id, planFor(m.id) !== undefined ? String(planFor(m.id)) : ""])),
  );
  const [error, setError] = useState<string | undefined>();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Name the pot");
      return;
    }
    const common = {
      heldByMemberId: key === "shared" ? heldBy : ownerMemberId,
      name: name.trim(),
      plans: contributors.map((m) => ({ memberId: m.id, monthlyAmount: Number(plans[m.id]) || 0 })),
      reserveMinimum: Number(reserve) || 0,
    };
    onPendingChange(true);
    try {
      if (editing) {
        await updateSavingsPotAction(editing.id, common);
        toast.success("Pot updated");
      } else {
        await createSavingsPotAction({ ...common, openingBalance: Number(opening) || 0, ownerMemberId });
        toast.success("Pot set up");
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
        error={error}
        label="Name"
        onChange={(event) => {
          setName(event.target.value);
          setError(undefined);
        }}
        value={name}
      />
      {key === "shared" && members.length > 1 && (
        <Segmented label="Whose account holds it" onChange={setHeldBy} options={members.map((m) => ({ label: label(m), value: m.id }))} value={heldBy} />
      )}
      {!editing && <AmountInput label="In the account today" onChange={(event) => setOpening(event.target.value)} placeholder="0" value={opening} />}
      <div className="flex flex-col gap-1.5">
        <AmountInput label="Emergency reserve (minimum)" onChange={(event) => setReserve(event.target.value)} placeholder="0" value={reserve} />
        <p className="text-[13px] text-n-700">This fills first, and the list never touches it.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {contributors.map((m) => (
          <AmountInput
            key={m.id}
            label={`Monthly plan · ${label(m)}`}
            onChange={(event) => setPlans((prev) => ({ ...prev, [m.id]: event.target.value }))}
            placeholder="0"
            value={plans[m.id] ?? ""}
          />
        ))}
      </div>
    </form>
  );
}
