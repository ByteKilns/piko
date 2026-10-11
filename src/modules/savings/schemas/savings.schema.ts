import { z } from "zod";

export const potPlanSchema = z.object({
  memberId: z.string().uuid(),
  monthlyAmount: z.number().min(0),
});

export const createPotSchema = z.object({
  // Whose account holds a shared pot; an individual pot is always its owner's.
  heldByMemberId: z.string().uuid().nullable(),
  name: z.string().trim().min(1),
  // What's already in the account when the pot is set up.
  openingBalance: z.number().min(0),
  ownerMemberId: z.string().uuid().nullable(),
  plans: z.array(potPlanSchema),
  reserveMinimum: z.number().min(0),
});

export type CreatePotInput = z.infer<typeof createPotSchema>;

export const updatePotSchema = createPotSchema.omit({ openingBalance: true, ownerMemberId: true });

export type UpdatePotInput = z.infer<typeof updatePotSchema>;

export const depositSchema = z.object({
  amount: z.number().positive(),
  date: z.string(), // "YYYY-MM-DD"
  kind: z.enum(["deposit", "interest"]),
  // Who put the money in; null for bank interest.
  memberId: z.string().uuid().nullable(),
});

export type DepositInput = z.infer<typeof depositSchema>;

export const itemSchema = z.object({
  cost: z.number().positive(),
  name: z.string().trim().min(1),
  neededBy: z.string().nullable(), // "YYYY-MM-DD"
  note: z.string().optional(),
});

export type ItemInput = z.infer<typeof itemSchema>;
