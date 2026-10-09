"use client";

import { useRef, useState } from "react";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AmountInput } from "@/components/AmountInput";
import { Modal } from "@/components/Modal";
import { MoreDetails } from "@/components/MoreDetails";
import { NepaliDateField } from "@/components/NepaliDateField";
import { Segmented } from "@/components/Segmented";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/today";
import {
  addContributionAction,
  createSavingsGoalAction,
  updateSavingsGoalAction,
} from "@/modules/savings-goals/api/savings-goals.actions";

type Member = { id: string; name: string };

export type SavingsGoalOwnerKey = "me" | "partner" | "shared";

export type SavingsGoalEditing = {
  description: null | string;
  id: string;
  image: null | string;
  name: string;
  ownerKey: SavingsGoalOwnerKey;
  targetAmount: null | number;
  targetDate: null | string;
};

export type GoalStarter = { name: string; target: null | number };

type Props = {
  currentMemberId: string;
  editing: null | SavingsGoalEditing;
  members: Member[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  starter: null | GoalStarter;
};

const FORM_ID = "goal-form";
const IMAGE_SIZE = 240;

function resizeToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = IMAGE_SIZE;
      canvas.height = IMAGE_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      const side = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("Could not read image"));
    img.src = URL.createObjectURL(file);
  });
}

export function GoalDialog({ currentMemberId, editing, members, onOpenChange, open, starter }: Props) {
  const [pending, setPending] = useState(false);

  return (
    <Modal
      className="sm:max-w-120"
      footer={
        <Button className="min-w-35 justify-start" disabled={pending} form={FORM_ID} type="submit">
          {pending ? "Saving..." : editing ? "Save changes" : "Create goal"}
        </Button>
      }
      hint="Enter to save · Esc to close"
      onOpenChange={onOpenChange}
      open={open}
      title={editing ? "Edit savings goal" : "New savings goal"}
    >
      <GoalFields
        currentMemberId={currentMemberId}
        editing={editing}
        members={members}
        onDone={() => onOpenChange(false)}
        onPendingChange={setPending}
        starter={starter}
      />
    </Modal>
  );
}

type FieldsProps = Omit<Props, "onOpenChange" | "open"> & { onDone: () => void; onPendingChange: (pending: boolean) => void };

function GoalFields({ currentMemberId, editing, members, onDone, onPendingChange, starter }: FieldsProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const partner = members.find((m) => m.id !== currentMemberId) ?? null;

  const [name, setName] = useState(editing?.name ?? starter?.name ?? "");
  const [target, setTarget] = useState(editing?.targetAmount != null ? String(editing.targetAmount) : starter?.target != null ? String(starter.target) : "");
  const [owner, setOwner] = useState<SavingsGoalOwnerKey>(editing?.ownerKey ?? "shared");
  const [targetDate, setTargetDate] = useState(editing?.targetDate ?? "");
  const [alreadySaved, setAlreadySaved] = useState("");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [image, setImage] = useState<null | string>(editing?.image ?? null);
  const [noTarget, setNoTarget] = useState(editing ? editing.targetAmount === null : false);
  const [imagePending, setImagePending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const memberIdFor = (key: SavingsGoalOwnerKey) => (key === "shared" ? null : key === "me" ? currentMemberId : (partner?.id ?? currentMemberId));

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImagePending(true);
    try {
      setImage(await resizeToDataUrl(file));
    } catch {
      toast.error("Could not process that image");
    } finally {
      setImagePending(false);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Name your goal");
      return;
    }
    if (!noTarget && !(Number(target) > 0)) {
      setError("Enter a target amount");
      return;
    }

    const payload = {
      description: description.trim() || undefined,
      image,
      name: name.trim(),
      ownerMemberId: memberIdFor(owner),
      targetAmount: noTarget ? null : Number(target),
      targetDate: noTarget ? null : targetDate || null,
    };

    onPendingChange(true);
    try {
      if (editing) {
        await updateSavingsGoalAction(editing.id, payload);
        toast.success("Goal updated");
      } else {
        const created = await createSavingsGoalAction(payload);
        if (created && Number(alreadySaved) > 0) {
          await addContributionAction(created.id, { amount: Number(alreadySaved), date: todayISO(), memberId: currentMemberId });
        }
        toast.success("Goal created");
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
        error={error === "Name your goal" ? error : undefined}
        label="What are you saving for?"
        onChange={(event) => {
          setName(event.target.value);
          setError(undefined);
        }}
        placeholder="e.g. Emergency fund"
        value={name}
      />

      {!noTarget && (
        <AmountInput
          error={error === "Enter a target amount" ? error : undefined}
          label="Target"
          onChange={(event) => {
            setTarget(event.target.value);
            setError(undefined);
          }}
          size="xl"
          value={target}
        />
      )}

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {!noTarget && <NepaliDateField label="Target date" onChange={setTargetDate} value={targetDate} />}
        {!editing && (
          <AmountInput
            label="Already saved"
            onChange={(event) => setAlreadySaved(event.target.value)}
            placeholder="Optional"
            value={alreadySaved}
          />
        )}
      </div>

      <MoreDetails>
        <TextField label="Description" onChange={(event) => setDescription(event.target.value)} placeholder="Optional" value={description} />
        <div className="flex items-center gap-4">
          <div className="size-16 shrink-0 overflow-hidden bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element -- the photo is a client-side data URL, not a remote asset */}
            {image && <img alt="" className="h-full w-full object-cover" src={image} />}
          </div>
          <Button disabled={imagePending} onClick={() => inputRef.current?.click()} type="button" variant="outline">
            <Upload />
            {imagePending ? "Uploading..." : "Add photo"}
          </Button>
          <input accept="image/*" className="hidden" onChange={handleFile} ref={inputRef} type="file" />
        </div>
        <label className="flex items-center gap-2 text-sm text-n-800">
          <input checked={noTarget} onChange={(event) => setNoTarget(event.target.checked)} type="checkbox" />
          No fixed target — an ongoing pool
        </label>
      </MoreDetails>
    </form>
  );
}
