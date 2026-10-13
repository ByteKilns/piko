import { z } from "zod";

// How a person splits a month's leftover. The cushion part takes the rest; it
// is negative when the month went over.
export const settleMonthSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  parts: z.object({
    cushion: z.number(),
    funds: z.array(z.object({ amount: z.number().nonnegative(), fundId: z.string().uuid() })),
    loans: z.array(z.object({ amount: z.number().nonnegative(), loanId: z.string().uuid() })),
    savings: z.array(z.object({ amount: z.number().nonnegative(), potId: z.string().uuid() })),
  }),
});

export type SettleMonthInput = z.infer<typeof settleMonthSchema>;

// What the cushion is aiming for, and what it really holds now.
export const setCushionSchema = z.object({
  balance: z.number(),
  target: z.number().positive().nullable(),
});

export type SetCushionInput = z.infer<typeof setCushionSchema>;
