import type { MaskedFinancialContext } from "../schemas/masked-context.schema";

// Builds the instruction sent with the masked payload. Pure and unit-tested:
// it must reference only tokens, groups and shares — never amounts or names.
export function buildPlanPrompt(masked: MaskedFinancialContext): string {
  const categoryLines = masked.categories
    .map((c) => {
      const shares = c.spendShares.map((s) => `${(s * 100).toFixed(1)}%`).join(", ");
      return `${c.token} | ${c.label ?? "(custom category)"} | group: ${c.group} | ${c.budgetType} | historical spend shares: [${shares}]`;
    })
    .join("\n");

  return `You are a household budgeting assistant for a two-person household.

All figures are shares of the monthly income envelope (0..1). You do NOT know any currency amounts and must not invent or mention any.

Envelope: fixed commitments ${masked.envelope.fixedShare}, savings target ${masked.envelope.savingsShare}, flexible pool ${masked.envelope.flexibleShare}.
Income variability: ${masked.incomeVariability}. History: ${masked.monthsUsed} months. Confidence: ${masked.confidence}.
Owner tokens: ${masked.owners.join(", ")}.

Categories:
${categoryLines}

Allocate the flexible pool across the categories. Return each allocation as a share of the ENVELOPE (not of the flexible pool).

Rules:
- Use only the given category tokens and owner tokens.
- The sum of all shareOfEnvelope values must be <= the flexible pool share.
- Never allocate 0 to a flexible category that has spending history — a plan people abandon is worse than a slightly generous one.
- Respect spending history and the fixed/flexible split; prefer stability over drastic cuts.
- Give each allocation a short, concrete rationale.`;
}
