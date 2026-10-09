"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Modal } from "@/components/Modal";
import { Segmented } from "@/components/Segmented";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { createCategoryAction, updateCategoryAction } from "@/modules/categories/api/categories.actions";
import { CATEGORY_GROUPS } from "@/modules/categories/lib/category-icons";
import { IconPicker } from "@/modules/recurring/components/IconPicker";
import type { RecurringIcon } from "@/modules/recurring/lib/recurring-icons";

export type CategoryEditing = {
  archived: boolean;
  budgetType: "fixed" | "flexible";
  groupName: string;
  icon: null | string;
  id: string;
  name: string;
};

type Props = {
  category: CategoryEditing | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

const FORM_ID = "category-form";

export function CategoryDialog({ category, onOpenChange, open }: Props) {
  const [pending, setPending] = useState(false);

  return (
    <Modal
      className="sm:max-w-110"
      footer={
        <Button className="min-w-35 justify-start" disabled={pending} form={FORM_ID} type="submit">
          {pending ? "Saving..." : category ? "Save changes" : "Add category"}
        </Button>
      }
      hint="Enter to save · Esc to close"
      onOpenChange={onOpenChange}
      open={open}
      title={category ? "Edit category" : "Add category"}
    >
      <CategoryFields category={category} onDone={() => onOpenChange(false)} onPendingChange={setPending} />
    </Modal>
  );
}

function CategoryFields({
  category,
  onDone,
  onPendingChange,
}: {
  category: CategoryEditing | null;
  onDone: () => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(category?.name ?? "");
  const [groupName, setGroupName] = useState(category?.groupName ?? CATEGORY_GROUPS[0]);
  const [budgetType, setBudgetType] = useState<"fixed" | "flexible">(category?.budgetType ?? "flexible");
  const [icon, setIcon] = useState<RecurringIcon>((category?.icon as RecurringIcon) ?? "receipt");
  const [error, setError] = useState<string | undefined>();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Give it a name");
      return;
    }
    onPendingChange(true);
    try {
      const payload = { budgetType, groupName, icon, name: name.trim() };
      if (category) {
        await updateCategoryAction(category.id, payload);
        toast.success("Category updated");
      } else {
        await createCategoryAction(payload);
        toast.success("Category added");
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
        placeholder="e.g. Groceries"
        value={name}
      />
      <SelectField
        label="Group"
        onValueChange={setGroupName}
        options={CATEGORY_GROUPS.map((group) => ({ label: group, value: group }))}
        value={groupName}
      />
      <Segmented
        label="Type"
        onChange={setBudgetType}
        options={[
          { label: "Fixed", value: "fixed" },
          { label: "Flexible", value: "flexible" },
        ]}
        value={budgetType}
      />
      <IconPicker onChange={setIcon} value={icon} />
    </form>
  );
}
