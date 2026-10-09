import { z } from "zod";

import { RECURRING_ICONS } from "@/modules/recurring/lib/recurring-icons";

export const recurringExpenseSchema = z
  .object({
    amount: z.number().positive(),
    categoryId: z.string().uuid(),
    endDate: z.string().nullable(), // "YYYY-MM-DD"
    frequency: z.enum(["monthly", "quarterly", "yearly"]),
    icon: z.enum(RECURRING_ICONS),
    name: z.string().min(1),
    nextDueDate: z.string(), // "YYYY-MM-DD"
    ownerMemberId: z.string().uuid().nullable(),
    vendor: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.endDate && data.endDate < data.nextDueDate) {
      ctx.addIssue({ code: "custom", message: "End date can't be before the next due date", path: ["endDate"] });
    }
  });

export type RecurringExpenseInput = z.infer<typeof recurringExpenseSchema>;
