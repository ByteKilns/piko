import { z } from "zod";

// A person's pay for one month. Later months use it until it's changed.
export const setPaySchema = z.object({
  memberId: z.string().uuid(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  amount: z.number().nonnegative(),
});

export type SetPayInput = z.infer<typeof setPaySchema>;

// Income beyond pay in one month: a bonus, leave encashment, a refund.
export const extraIncomeSchema = z.object({
  memberId: z.string().uuid(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  amount: z.number().positive(),
  note: z.string().trim().max(120).optional(),
});

export type ExtraIncomeInput = z.infer<typeof extraIncomeSchema>;
