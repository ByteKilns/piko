"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AmountInput } from "@/components/AmountInput";
import { Modal } from "@/components/Modal";
import { MoreDetails } from "@/components/MoreDetails";
import { NepaliDateField } from "@/components/NepaliDateField";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/today";
import { createSavingsItemAction, updateSavingsItemAction } from "@/modules/savings/api/savings.actions";
import type { SavingsItemModel } from "@/modules/savings/components/SavingsView";

type Props = {
  editing: null | SavingsItemModel;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  potId: null | string;
};

const FORM_ID = "savings-item-form";
const NAME_ERROR = "Say what you're saving for";
const COST_ERROR = "Enter what it should cost";

export function ItemDialog({ editing, onOpenChange, open, potId }: Props) {
  const [pending, setPending] = useState(false);

  return (
    <Modal
      className="sm:max-w-110"
      footer={
        <Button className="min-w-30 justify-start" disabled={pending} form={FORM_ID} type="submit">
          {pending ? "Saving..." : editing ? "Save changes" : "Add"}
        </Button>
      }
      hint="Enter to save · Esc to close"
      onOpenChange={onOpenChange}
      open={open}
      title={editing ? "Edit list item" : "Add to the list"}
    >
      {(editing !== null || potId !== null) && (
        <ItemFields editing={editing} onDone={() => onOpenChange(false)} onPendingChange={setPending} potId={potId} />
      )}
    </Modal>
  );
}

type FieldsProps = { editing: null | SavingsItemModel; onDone: () => void; onPendingChange: (pending: boolean) => void; potId: null | string };

function ItemFields({ editing, onDone, onPendingChange, potId }: FieldsProps) {
  const router = useRouter();
  const [name, setName] = useState(editing?.name ?? "");
  const [cost, setCost] = useState(editing ? String(editing.cost) : "");
  const [note, setNote] = useState(editing?.note ?? "");
  const [hasDeadline, setHasDeadline] = useState(editing?.neededBy != null);
  const [neededBy, setNeededBy] = useState(editing?.neededBy ?? todayISO());
  const [error, setError] = useState<string | undefined>();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError(NAME_ERROR);
      return;
    }
    if (!(Number(cost) > 0)) {
      setError(COST_ERROR);
      return;
    }
    const payload = { cost: Number(cost), name: name.trim(), neededBy: hasDeadline ? neededBy : null, note: note.trim() || undefined };
    onPendingChange(true);
    try {
      if (editing) await updateSavingsItemAction(editing.id, payload);
      else if (potId) await createSavingsItemAction(potId, payload);
      toast.success(editing ? "Item updated" : "Added to the list");
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
        error={error === NAME_ERROR ? error : undefined}
        label="What you're saving for"
        onChange={(event) => {
          setName(event.target.value);
          setError(undefined);
        }}
        placeholder="e.g. Mum's surgery"
        value={name}
      />
      <AmountInput
        error={error === COST_ERROR ? error : undefined}
        label="Estimated cost"
        onChange={(event) => {
          setCost(event.target.value);
          setError(undefined);
        }}
        size="xl"
        value={cost}
      />
      <label className="flex items-center gap-2 text-sm text-n-800">
        <input checked={hasDeadline} onChange={(event) => setHasDeadline(event.target.checked)} type="checkbox" />
        It&apos;s needed by a certain date
      </label>
      {hasDeadline && <NepaliDateField label="Needed by" onChange={setNeededBy} value={neededBy} />}
      <MoreDetails>
        <TextField label="Note" onChange={(event) => setNote(event.target.value)} placeholder="Optional" value={note} />
      </MoreDetails>
    </form>
  );
}
