import type { CategoryProfile, FinancialProfile } from "./profile";

// Defensive cap so a pathological category list can't produce an oversized
// payload.
export const MAX_CATEGORY_TOKENS = 40;

export type TokenizedProfile = {
  categories: { category: CategoryProfile; token: string }[];
  memberByToken: Map<string, string>;
  owners: string[];
  tokenByCategoryId: Map<string, string>;
  tokenByOwnerKey: Map<string, string>;
};

// The single source of truth for the opaque per-request tokens. Both the
// masker (which puts tokens in the payload) and buildPlan (which maps the
// AI's answer back to real categories/owners) call this, so the two can never
// disagree about what "c1" or "m2" means.
export function tokenize(profile: FinancialProfile): TokenizedProfile {
  const categories = [...profile.categories]
    .sort((a, b) => a.groupName.localeCompare(b.groupName) || a.categoryId.localeCompare(b.categoryId))
    .slice(0, MAX_CATEGORY_TOKENS)
    .map((category, index) => ({ category, token: `c${index + 1}` }));

  const ownerKeySet = new Set<string>();
  for (const category of profile.categories) {
    for (const split of category.ownerSplit) ownerKeySet.add(split.ownerMemberId ?? "shared");
  }
  for (const owner of profile.fixedFloor.byOwner) ownerKeySet.add(owner.ownerMemberId ?? "shared");

  const memberIds = [...ownerKeySet].filter((k) => k !== "shared").sort();

  const tokenByOwnerKey = new Map<string, string>();
  const memberByToken = new Map<string, string>();
  memberIds.forEach((id, index) => {
    tokenByOwnerKey.set(id, `m${index + 1}`);
    memberByToken.set(`m${index + 1}`, id);
  });
  if (ownerKeySet.has("shared")) tokenByOwnerKey.set("shared", "shared");

  return {
    categories,
    memberByToken,
    owners: [...memberIds.map((_, i) => `m${i + 1}`), ...(ownerKeySet.has("shared") ? ["shared"] : [])],
    tokenByCategoryId: new Map(categories.map((c) => [c.category.categoryId, c.token])),
    tokenByOwnerKey,
  };
}
