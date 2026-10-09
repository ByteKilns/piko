import { z } from "zod";

export const setBudgetItemSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  categoryId: z.string().uuid(),
  ownerMemberId: z.string().uuid().nullable(),
  plannedAmount: z.number().nonnegative(),
});

export type SetBudgetItemInput = z.infer<typeof setBudgetItemSchema>;

export const removeBudgetItemSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  categoryId: z.string().uuid(),
  ownerMemberId: z.string().uuid().nullable(),
});

export type RemoveBudgetItemInput = z.infer<typeof removeBudgetItemSchema>;
