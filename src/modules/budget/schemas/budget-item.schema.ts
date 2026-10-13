import { z } from "zod";

export const setBudgetItemSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  categoryId: z.string().uuid(),
  // Each person plans their own money, so a new line always has an owner.
  ownerMemberId: z.string().uuid(),
  plannedAmount: z.number().nonnegative(),
  kind: z.enum(["fixed", "essential", "can_cut"]),
});

export type SetBudgetItemInput = z.infer<typeof setBudgetItemSchema>;

export const removeBudgetItemSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  categoryId: z.string().uuid(),
  // null removes an old shared line.
  ownerMemberId: z.string().uuid().nullable(),
});

export type RemoveBudgetItemInput = z.infer<typeof removeBudgetItemSchema>;
