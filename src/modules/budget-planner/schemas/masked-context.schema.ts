import { z } from "zod";

// The ONLY shape that may cross the boundary to the AI provider. Everything
// here is derived: opaque category tokens, group names, fixed/flexible,
// canonical-default labels (null for custom), and shares of the envelope.
// No amounts, names, ids, dates, notes or vendor text — see
// buildMaskedContext, which is the sole producer. The brand makes it a type
// error to hand a plain object to the AI call in Phase 2.
export const maskedFinancialContextSchema = z
  .object({
    categories: z.array(
      z.object({
        budgetType: z.enum(["fixed", "flexible"]),
        group: z.string(),
        label: z.string().nullable(),
        ownerSplit: z.record(z.string(), z.number()),
        spendShares: z.array(z.number()),
        token: z.string(),
      }),
    ),
    confidence: z.enum(["high", "low", "medium"]),
    envelope: z.object({
      fixedShare: z.number(),
      flexibleShare: z.number(),
      savingsShare: z.number(),
    }),
    incomeVariability: z.enum(["high", "low", "medium", "unknown"]),
    monthsUsed: z.number().int().nonnegative(),
    owners: z.array(z.string()),
    version: z.literal(1),
  })
  .brand<"MaskedFinancialContext">();

export type MaskedFinancialContext = z.infer<typeof maskedFinancialContextSchema>;
