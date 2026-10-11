import { z } from "zod";

export const paybackSchema = z
  .object({
    amount: z.number().positive(),
    date: z.string(), // "YYYY-MM-DD"
    fromMemberId: z.string().uuid(),
    note: z.string().optional(),
    toMemberId: z.string().uuid(),
  })
  .refine((payback) => payback.fromMemberId !== payback.toMemberId, {
    message: "Choose two different people",
    path: ["toMemberId"],
  });

export type PaybackInput = z.infer<typeof paybackSchema>;
