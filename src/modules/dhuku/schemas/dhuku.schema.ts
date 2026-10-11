// src/modules/dhuku/schemas/dhuku.schema.ts
import { z } from "zod";

export const dhukuSchema = z.object({
  interestPerMonth: z.number().positive().nullable(),
  monthlyContribution: z.number().positive(),
  name: z.string().min(1),
  note: z.string().optional(),
  ownerMemberId: z.string().uuid().nullable(),
  // Taken out of every pot (e.g. the meeting's food); null = nothing.
  potDeduction: z.number().positive().nullable(),
  startDate: z.string(), // "YYYY-MM-DD"
  totalMembers: z.number().int().min(2),
});

export type DhukuInput = z.infer<typeof dhukuSchema>;

export const dhukuEntrySchema = z.object({
  amount: z.number().positive(),
  date: z.string(), // "YYYY-MM-DD"
  note: z.string().optional(),
  type: z.enum(["contribution", "payout", "fine"]),
});

export type DhukuEntryInput = z.infer<typeof dhukuEntrySchema>;
