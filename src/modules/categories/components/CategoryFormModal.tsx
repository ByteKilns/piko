"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Modal } from "@/components/Modal";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { createCategoryAction, updateCategoryAction } from "@/modules/categories/api/categories.actions";
import { CATEGORY_GROUPS } from "@/modules/categories/lib/category-icons";
import { type CategoryInput, categorySchema } from "@/modules/categories/schemas/category.schema";

type Category = { archived: boolean; budgetType: "fixed" | "flexible"; groupName: string; id: string; name: string };

type Props = {
  category: Category | null;
  defaultName?: string;
  onCreated?: (category: Category) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

const EMPTY: CategoryInput = { budgetType: "flexible", groupName: CATEGORY_GROUPS[0], name: "" };

export function CategoryFormModal({ category, defaultName, onCreated, onOpenChange, open }: Props) {
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<CategoryInput>({
    defaultValues: category ?? { ...EMPTY, name: defaultName ?? "" },
    resolver: zodResolver(categorySchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (category) {
        const taken = await updateCategoryAction(category.id, values);
        if (taken) {
          setError("name", { message: taken.error });
          return;
        }
        toast.success("Category updated");
      } else {
        const result = await createCategoryAction(values);
        if (!result.ok) {
          setError("name", { message: result.error });
          return;
        }
        toast.success("Category added");
        onCreated?.(result.category);
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save category");
    }
  });

  return (
    <Modal
      footer={
        <Button disabled={isSubmitting} form="category-form" type="submit">
          {isSubmitting ? "Saving..." : "Save Category"}
        </Button>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={category ? "Edit category" : "Add category"}
    >
      <form className="space-y-4" id="category-form" onSubmit={onSubmit}>
        <TextField error={errors.name?.message} id="category-name" label="Name" {...register("name")} />

        <Controller
          control={control}
          name="groupName"
          render={({ field }) => (
            <SelectField
              error={errors.groupName?.message}
              id="category-group"
              label="Group"
              onValueChange={field.onChange}
              options={CATEGORY_GROUPS.map((g) => ({ label: g, value: g }))}
              value={field.value}
            />
          )}
        />

        <Controller
          control={control}
          name="budgetType"
          render={({ field }) => (
            <SelectField
              error={errors.budgetType?.message}
              id="category-type"
              label="Type"
              onValueChange={field.onChange}
              options={[
                { label: "Flexible", value: "flexible" },
                { label: "Fixed", value: "fixed" },
              ]}
              value={field.value}
            />
          )}
        />
      </form>
    </Modal>
  );
}
