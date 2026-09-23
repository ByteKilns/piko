import type { RawPlan } from "../schemas/budget-plan.schema";
import type { FinancialProfile } from "./profile";
import { roundTo, shareOf } from "./stats";
import { tokenize, type TokenizedProfile } from "./tokens";

export type PlanRow = {
  categoryId: string;
  categoryName: string;
  ownerMemberId: null | string;
  ownerName: string;
  plannedAmount: number;
  rationale: string;
  share: number;
  token: string;
};

export type BuiltPlan = {
  month: number;
  rows: PlanRow[];
  summary: string;
  totalPlanned: number;
  warnings: string[];
  year: number;
};

// Small tolerance so a sum that is over by rounding noise isn't "scaled down".
const SHARE_EPSILON = 0.01;

export type BuildPlanInput = {
  categoryNameById: Map<string, string>;
  ownerNameById: Map<string, string>;
  profile: FinancialProfile;
  raw: RawPlan;
};

// Maps the AI's token-keyed shares back to real categories/owners and converts
// them to NPR amounts. This is where the model's answer is made safe: unknown
// tokens/owners are dropped, duplicates ignored, and an over-allocation is
// scaled back into the flexible pool.
export function buildPlan(input: BuildPlanInput): BuiltPlan {
  const { categoryNameById, ownerNameById, profile, raw } = input;
  const tokens = tokenize(profile);
  const income = profile.envelope.income;
  const warnings: string[] = [];

  const categoryByToken = new Map(tokens.categories.map((c) => [c.token, c.category]));

  const seen = new Set<string>();
  const rows: PlanRow[] = [];
  for (const allocation of raw.allocations) {
    const category = categoryByToken.get(allocation.token);
    if (!category) {
      warnings.push(`Ignored unknown category token "${allocation.token}".`);
      continue;
    }
    const ownerMemberId = resolveOwner(allocation.owner, tokens);
    if (ownerMemberId === undefined) {
      warnings.push(`Ignored unknown owner token "${allocation.owner}".`);
      continue;
    }
    const dedupeKey = `${allocation.token}::${allocation.owner}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    rows.push({
      categoryId: category.categoryId,
      categoryName: categoryNameById.get(category.categoryId) ?? category.label ?? "Custom category",
      ownerMemberId,
      ownerName: ownerMemberId === null ? "Shared" : (ownerNameById.get(ownerMemberId) ?? "Member"),
      plannedAmount: Math.round(allocation.shareOfEnvelope * income),
      rationale: allocation.rationale,
      share: allocation.shareOfEnvelope,
      token: allocation.token,
    });
  }

  const flexibleShare = shareOf(profile.envelope.flexible, income);
  const totalShare = rows.reduce((s, r) => s + r.share, 0);
  if (totalShare > flexibleShare + SHARE_EPSILON) {
    const factor = flexibleShare / totalShare;
    for (const row of rows) {
      row.share = roundTo(row.share * factor, 4);
      row.plannedAmount = Math.round(row.share * income);
    }
    warnings.push("Suggested allocations exceeded the flexible pool and were scaled down.");
  }

  // Soft guard: a flexible category with history but no allocation is the
  // classic abandoned-budget trap. Warn rather than silently invent a number.
  const allocatedTokens = new Set(rows.map((r) => r.token));
  for (const { category, token } of tokens.categories) {
    if (category.budgetType !== "flexible" || category.medianSpend <= 0) continue;
    if (!allocatedTokens.has(token)) {
      const name = categoryNameById.get(category.categoryId) ?? category.label ?? "A flexible category";
      warnings.push(`${name} had spending history but no allocation.`);
    }
  }

  rows.sort((a, b) => b.plannedAmount - a.plannedAmount || a.categoryName.localeCompare(b.categoryName));

  return {
    month: profile.planningPeriod.month,
    rows,
    summary: raw.summary,
    totalPlanned: rows.reduce((s, r) => s + r.plannedAmount, 0),
    warnings,
    year: profile.planningPeriod.year,
  };
}

// undefined = unknown token (drop the row); null = shared.
function resolveOwner(token: string, tokens: TokenizedProfile): null | string | undefined {
  if (token === "shared") return tokens.owners.includes("shared") ? null : undefined;
  return tokens.memberByToken.get(token);
}
