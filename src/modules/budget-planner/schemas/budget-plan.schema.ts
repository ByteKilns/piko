import { z } from "zod";

// The AI's raw answer, before we map tokens back to real categories/owners and
// convert shares to amounts. Kept separate from the masked input schema so the
// provider contract is explicit and testable on its own.
export const rawPlanSchema = z.object({
  allocations: z.array(
    z.object({
      owner: z.string(),
      rationale: z.string(),
      shareOfEnvelope: z.number().nonnegative(),
      token: z.string(),
    }),
  ),
  summary: z.string(),
});

export type RawPlan = z.infer<typeof rawPlanSchema>;
