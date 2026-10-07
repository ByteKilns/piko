"use client";

import { useRef, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Upload } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Modal } from "@/components/Modal";
import { NepaliDateField } from "@/components/NepaliDateField";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { createSavingsGoalAction, updateSavingsGoalAction } from "@/modules/savings-goals/api/savings-goals.actions";
import { type SavingsGoalInput, savingsGoalSchema } from "@/modules/savings-goals/schemas/savings-goal.schema";

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
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("Could not read image"));
    img.src = URL.createObjectURL(file);
  });
}

export type SavingsGoalEditing = SavingsGoalInput & { id: string };

type Member = { id: string; name: string };

type Props = {
  currentMemberId: string;
  editing: null | SavingsGoalEditing;
  members: Member[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

const EMPTY: SavingsGoalInput = {
  description: "",
  image: null,
  name: "",
  ownerMemberId: null,
  targetAmount: 0,
  targetDate: "",
};

export function GoalForm({ currentMemberId, editing, members, onOpenChange, open }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imagePending, setImagePending] = useState(false);
  const [hasTarget, setHasTarget] = useState(editing ? editing.targetAmount !== null : true);
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setValue,
    watch,
  } = useForm<SavingsGoalInput>({
    defaultValues: editing ?? EMPTY,
    resolver: zodResolver(savingsGoalSchema),
  });

  const image = watch("image");

  function handleTargetToggle(checked: boolean) {
    setHasTarget(checked);
    if (!checked) {
      setValue("targetAmount", null);
      setValue("targetDate", null);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImagePending(true);
    try {
      const dataUrl = await resizeToDataUrl(file);
      setValue("image", dataUrl);
    } catch {
      toast.error("Could not process that image");
    } finally {
      setImagePending(false);
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    const payload = { ...values, description: values.description?.trim() || undefined };
    try {
      if (editing) {
        await updateSavingsGoalAction(editing.id, payload);
        toast.success("Goal updated");
      } else {
        await createSavingsGoalAction(payload);
        toast.success("Goal added");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  });

  return (
    <Modal
      footer={
        <Button disabled={isSubmitting} form="goal-form" type="submit">
          {isSubmitting ? "Saving..." : editing ? "Save changes" : "Create Goal"}
        </Button>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={editing ? "Edit savings goal" : "Create savings goal"}
    >
      <form className="space-y-4" id="goal-form" onSubmit={onSubmit}>
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
            {image && <img alt="" className="h-full w-full object-cover" src={image} />}
          </div>
          <div>
            <Button disabled={imagePending} onClick={() => inputRef.current?.click()} type="button" variant="outline">
              <Upload className="h-4 w-4" />
              {imagePending ? "Uploading..." : "Add photo"}
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">Optional — JPG or PNG.</p>
          </div>
          <input accept="image/*" className="hidden" onChange={handleFileChange} ref={inputRef} type="file" />
        </div>

        <TextField error={errors.name?.message} id="goal-name" label="Name" {...register("name")} />
        <TextField id="goal-description" label="Description (optional)" {...register("description")} />

        <Controller
          control={control}
          name="ownerMemberId"
          render={({ field }) => (
            <SelectField
              label="For"
              onValueChange={(v) => field.onChange(v === "shared" ? null : v)}
              options={[
                { label: "Shared", value: "shared" },
                ...members.map((m) => ({ label: m.id === currentMemberId ? "Me" : m.name, value: m.id })),
              ]}
              value={field.value ?? "shared"}
            />
          )}
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            checked={hasTarget}
            className="h-4 w-4 rounded border-input"
            onChange={(e) => handleTargetToggle(e.target.checked)}
            type="checkbox"
          />
          This goal has a fixed target amount
        </label>
        <p className="-mt-3 text-xs text-muted-foreground">
          {hasTarget
            ? "e.g. saving for a car, house, or laptop."
            : "An ongoing pool with no target — e.g. general monthly savings."}
        </p>

        {hasTarget && (
          <div className="grid grid-cols-2 gap-3">
            <TextField
              error={errors.targetAmount?.message}
              id="goal-target-amount"
              label="Target amount"
              min={0}
              step="0.01"
              type="number"
              {...register("targetAmount", { valueAsNumber: true })}
            />
            <Controller
              control={control}
              name="targetDate"
              render={({ field }) => (
                <NepaliDateField
                  label="Target date (optional)"
                  onChange={(v) => field.onChange(v || null)}
                  value={field.value ?? ""}
                />
              )}
            />
          </div>
        )}
      </form>
    </Modal>
  );
}
