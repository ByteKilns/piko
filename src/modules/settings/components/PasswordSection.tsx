"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { changePasswordAction } from "@/modules/settings/api/settings.actions";
import { changePasswordSchema } from "@/modules/settings/schemas/password.schema";

// Superset of changePasswordSchema — the server action only needs
// currentPassword/newPassword, but this form also needs to validate the
// confirmation field matches before submitting.
const formSchema = changePasswordSchema.extend({ confirmPassword: z.string() }).superRefine((data, ctx) => {
  if (data.newPassword !== data.confirmPassword) {
    ctx.addIssue({
      code: "custom",
      message: "New password and confirmation don't match",
      path: ["confirmPassword"],
    });
  }
});

type FormValues = z.infer<typeof formSchema>;

export function PasswordSection() {
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<FormValues>({
    defaultValues: { confirmPassword: "", currentPassword: "", newPassword: "" },
    resolver: zodResolver(formSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await changePasswordAction({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      toast.success("Password changed");
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password");
    }
  });

  return (
    <div className="flex flex-col gap-3 border-b border-n-300 py-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-[15px]">Password</span>
        <span className="text-[13px] text-n-600">Change the password you sign in with.</span>
      </div>
      <form className="flex max-w-sm flex-col gap-3" onSubmit={onSubmit}>
        <TextField
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          id="current-password"
          label="Current password"
          type="password"
          {...register("currentPassword")}
        />
        <TextField
          autoComplete="new-password"
          error={errors.newPassword?.message}
          id="new-password"
          label="New password"
          type="password"
          {...register("newPassword")}
        />
        <TextField
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          id="confirm-password"
          label="Confirm new password"
          type="password"
          {...register("confirmPassword")}
        />
        <Button className="self-start" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Saving..." : "Change Password"}
        </Button>
      </form>
    </div>
  );
}
