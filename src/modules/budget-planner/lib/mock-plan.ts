import type { RawPlan } from "../schemas/budget-plan.schema";
import type { MaskedFinancialContext } from "../schemas/masked-context.schema";

// Deterministic stand-in for the AI, used by tests and by e2e
// (AI_BUDGET_PLANNER=mock). Spreads the flexible pool across flexible
// categories in proportion to their historical spend, so every flexible
// category gets a non-zero share. No randomness, no network.
export function mockPlan(masked: MaskedFinancialContext): RawPlan {
  const flexible = masked.categories.filter((c) => c.budgetType === "flexible");
  const weights = flexible.map((c) => c.spendShares.reduce((s, v) => s + v, 0));
  const totalWeight = weights.reduce((s, v) => s + v, 0);

  const allocations = flexible
    .map((category, index) => {
      const weight = totalWeight > 0 ? weights[index] / totalWeight : 1 / flexible.length;
      return {
        owner: dominantOwner(category.ownerSplit, masked.owners),
        rationale: `Mock allocation based on ${category.group} spending history.`,
        shareOfEnvelope: Number((masked.envelope.flexibleShare * weight).toFixed(3)),
        token: category.token,
      };
    })
    // Skip categories with no history (weight 0) — the plan stays readable.
    .filter((allocation) => allocation.shareOfEnvelope > 0);

  return { allocations, summary: "Mock plan (deterministic — for tests and e2e)." };
}

function dominantOwner(ownerSplit: Record<string, number>, owners: string[]): string {
  const entries = Object.entries(ownerSplit);
  if (entries.length === 0) return owners.includes("shared") ? "shared" : (owners[0] ?? "shared");
  return [...entries].sort((a, b) => b[1] - a[1])[0][0];
}
