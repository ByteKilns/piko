type NamedCategory = { archived: boolean; id: string; name: string };

// Two names are the same category when they differ only in capitals or spacing.
function normalize(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

// Why a new or renamed category can't be called `name`, or null when it can.
// `exceptId` is the category being renamed, which may keep its own name. An
// archived match points back to it, so a name never ends up in use twice.
export function categoryNameClash(name: string, categories: NamedCategory[], exceptId?: string): null | string {
  const wanted = normalize(name);
  const same = categories.filter((c) => c.id !== exceptId && normalize(c.name) === wanted);
  const active = same.find((c) => !c.archived);
  if (active) return `You already have a category called ${active.name}.`;
  if (same.length > 0) return `${same[0].name} is archived. Restore it from the Archived tab instead.`;
  return null;
}
