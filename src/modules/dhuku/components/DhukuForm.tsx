"use client";

import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Users } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Modal } from "@/components/Modal";
import { NepaliDateField } from "@/components/NepaliDateField";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/today";
import { createDhukuAction, updateDhukuAction } from "@/modules/dhuku/api/dhuku.actions";
import { type DhukuInput, dhukuSchema } from "@/modules/dhuku/schemas/dhuku.schema";

export type DhukuEditing = DhukuInput & { id: string };

type Member = { id: string; name: string };

type Props = {
  currentMemberId: string;
  editing: DhukuEditing | null;
  members: Member[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

const EMPTY: DhukuInput = {
  interestPerMonth: null,
  monthlyContribution: 0,
  name: "",
  note: "",
  ownerMemberId: null,
  startDate: todayISO(),
  totalMembers: 10,
};

// interestPerMonth is guarded by an explicit toggle (like LoanForm's
// installment-plan checkbox) rather than always rendering the number
// input: an empty number input becomes NaN via RHF's valueAsNumber, and
// zod's z.number() rejects NaN outright, so an always-visible optional
// number field would block submission with a confusing error the moment
// it's left blank. The toggle sidesteps that — when off, the field is
// never rendered and is explicitly set to null.
export function DhukuForm({ currentMemberId, editing, members, onOpenChange, open }: Props) {
  const [hasInterest, setHasInterest] = useState(editing ? editing.interestPerMonth !== null : false);
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setValue,
  } = useForm<DhukuInput>({
    defaultValues: editing ?? EMPTY,
    resolver: zodResolver(dhukuSchema),
  });

  function handleInterestToggle(checked: boolean) {
    setHasInterest(checked);
    if (!checked) {
      setValue("interestPerMonth", null);
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    const payload = { ...values, note: values.note?.trim() || undefined };
    try {
      if (editing) {
        await updateDhukuAction(editing.id, payload);
        toast.success("Dhuku updated");
      } else {
        await createDhukuAction(payload);
        toast.success("Dhuku added");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  });

  return (
    <Modal
      footer={
        <Button disabled={isSubmitting} form="dhuku-form" type="submit">
          {isSubmitting ? "Saving..." : editing ? "Save changes" : "Add Dhuku"}
        </Button>
      }
      icon={Users}
      onOpenChange={onOpenChange}
      open={open}
      title={editing ? "Edit dhuku" : "Add a dhuku"}
      tone="blue"
    >
      <form className="space-y-4" id="dhuku-form" onSubmit={onSubmit}>
        <TextField error={errors.name?.message} id="dhuku-name" label="Group name" {...register("name")} />

        <div className="grid grid-cols-2 gap-3">
          <TextField
            error={errors.totalMembers?.message}
            id="dhuku-total-members"
            label="Members (cycle length)"
            min={2}
            step="1"
            type="number"
            {...register("totalMembers", { valueAsNumber: true })}
          />
          <TextField
            error={errors.monthlyContribution?.message}
            id="dhuku-monthly-contribution"
            label="Monthly contribution"
            min={0}
            step="0.01"
            type="number"
            {...register("monthlyContribution", { valueAsNumber: true })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
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
          <Controller
            control={control}
            name="startDate"
            render={({ field }) => (
              <NepaliDateField error={errors.startDate?.message} label="Start date" onChange={field.onChange} value={field.value} />
            )}
          />
        </div>

        <TextField id="dhuku-note" label="Note (optional)" {...register("note")} />

        <label className="flex items-center gap-2 text-sm">
          <input
            checked={hasInterest}
            className="h-4 w-4 rounded border-input"
            onChange={(e) => handleInterestToggle(e.target.checked)}
            type="checkbox"
          />
          I&apos;ve taken (or will take) my payout, and owe interest
        </label>
        <p className="-mt-3 text-xs text-muted-foreground">
          Set the fixed extra amount owed per month for the rest of the cycle.
        </p>

        {hasInterest && (
          <TextField
            error={errors.interestPerMonth?.message}
            id="dhuku-interest"
            label="Interest per month"
            min={0}
            step="0.01"
            type="number"
            {...register("interestPerMonth", { valueAsNumber: true })}
          />
        )}
      </form>
    </Modal>
  );
}
