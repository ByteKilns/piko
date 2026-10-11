import { z } from "zod";

export const expenseSchema = z
  .object({
    amount: z.number().positive(),
    categoryId: z.string().uuid(),
    ownerMemberId: z.string().uuid().nullable(),
    paidByMemberId: z.string().uuid(),
    date: z.string(), // "YYYY-MM-DD"
    note: z.string().optional(),
    // The part of `amount` the other member will pay back ("pay back later").
    // Omitted = leave it as it is (edits); null = nothing to pay back.
    payBackAmount: z.number().positive().nullable().optional(),
  })
  .refine((expense) => expense.payBackAmount == null || expense.payBackAmount <= expense.amount, {
    message: "The amount to pay back can't be more than the expense",
    path: ["payBackAmount"],
  });

export type ExpenseInput = z.infer<typeof expenseSchema>;
