import { type MaskedFinancialContext, maskedFinancialContextSchema } from "../schemas/masked-context.schema";
import type { FinancialProfile } from "./profile";
import { roundTo, shareOf } from "./stats";

// Defensive cap so a pathological category list can't produce an oversized
// payload.
const MAX_CATEGORY_TOKENS = 40;

// Turns a local FinancialProfile into the masked payload that may be sent to
// the AI. This is the privacy boundary and the only producer of
// MaskedFinancialContext:
//   - money becomes shares of the envelope (3dp), never amounts;
//   - categories become opaque per-request tokens (c1, c2, …), with a real
//     name only for canonical defaults;
//   - owners become m1, m2, … plus "shared";
//   - dates, notes, vendors, ids and names are never read from the profile.
// A no-leak unit test asserts sentinel values from the source data cannot
// appear in the serialized result.
export function buildMaskedContext(profile: FinancialProfile): MaskedFinancialContext {
  const { envelope, periods } = profile;
  const income = envelope.income;

  const categoryEntries = [...profile.categories]
    .sort((a, b) => a.groupName.localeCompare(b.groupName) || a.categoryId.localeCompare(b.categoryId))
    .slice(0, MAX_CATEGORY_TOKENS)
    .map((category, index) => ({ category, token: `c${index + 1}` }));

  const ownerKeys = new Set<string>();
  for (const category of profile.categories) {
    for (const split of category.ownerSplit) ownerKeys.add(split.ownerMemberId ?? "shared");
  }
  for (const owner of profile.fixedFloor.byOwner) ownerKeys.add(owner.ownerMemberId ?? "shared");

  const memberKeys = [...ownerKeys].filter((k) => k !== "shared").sort();
  const ownerToken = (key: string) => (key === "shared" ? "shared" : `m${memberKeys.indexOf(key) + 1}`);
  const owners = [...memberKeys.map((_, i) => `m${i + 1}`), ...(ownerKeys.has("shared") ? ["shared"] : [])];

  const masked = {
    categories: categoryEntries.map(({ category, token }) => ({
      budgetType: category.budgetType,
      group: category.groupName,
      label: category.label,
      ownerSplit: Object.fromEntries(
        category.ownerSplit.map((split) => [ownerToken(split.ownerMemberId ?? "shared"), roundTo(split.share, 3)]),
      ),
      spendShares: category.spendByPeriod.map((spend) => roundTo(shareOf(spend, income), 3)),
      token,
    })),
    confidence: profile.incomeAnchor.confidence,
    envelope: {
      fixedShare: roundTo(shareOf(envelope.fixed, income), 3),
      flexibleShare: roundTo(shareOf(envelope.flexible, income), 3),
      savingsShare: roundTo(shareOf(envelope.savings, income), 3),
    },
    incomeVariability: profile.incomeVariability.band,
    monthsUsed: periods.length,
    owners,
    version: 1 as const,
  };

  // Parse through the schema so the shape is guaranteed (and so the returned
  // value carries the brand).
  return maskedFinancialContextSchema.parse(masked);
}
