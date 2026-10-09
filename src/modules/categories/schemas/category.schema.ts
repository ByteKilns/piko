import { z } from "zod";

export const categorySchema = z.object({
  budgetType: z.enum(["fixed", "flexible"]),
  groupName: z.string().min(1),
  icon: z.string().nullable().optional(),
  name: z.string().min(1),
});

export type CategoryInput = z.infer<typeof categorySchema>;
