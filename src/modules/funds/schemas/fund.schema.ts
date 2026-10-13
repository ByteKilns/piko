import { z } from "zod";

export const fundSchema = z.object({
  name: z.string().trim().min(1).max(60),
  // Set aside every month from now on.
  monthlyAmount: z.number().nonnegative(),
  // Optional: how much is needed, and by which household-calendar month.
  target: z.number().positive().nullable(),
  due: z.object({ month: z.number().int().min(1).max(12), year: z.number().int() }).nullable(),
});

export type FundInput = z.infer<typeof fundSchema>;

export const fundTopUpSchema = z.object({
  amount: z.number().positive(),
  note: z.string().trim().max(120).optional(),
});

export type FundTopUpInput = z.infer<typeof fundTopUpSchema>;
