// Words that say nothing about what was bought, in English and in romanised
// Nepali.
const FILLER = new Set([
  "a", "an", "and", "at", "by", "for", "from", "in", "is", "me", "my", "of", "on", "or", "our", "the", "to", "was", "with",
  "bata", "ka", "ki", "ko", "lagi", "lai", "le", "ma", "ra",
]);

// How many of a word's latest uses decide its category.
const LAST_USES = 5;

// The words of a note, lowercased: runs of letters (with their accents and
// vowel signs, so Devanagari stays whole) and digits, at least two long,
// without filler words or bare numbers. The app splits notes the same way.
export function noteWords(note: string): string[] {
  const words = note.toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
  return words.filter((word) => word.length >= 2 && !FILLER.has(word) && !/^\p{N}+$/u.test(word));
}

// The category used most often in `uses` (newest first); a tie goes to the
// most recent.
function mostUsed(uses: string[]): string {
  const counts = new Map<string, number>();
  for (const id of uses) counts.set(id, (counts.get(id) ?? 0) + 1);
  const top = Math.max(...counts.values());
  return uses.find((id) => counts.get(id) === top)!;
}

// For each word the household has written in a note (`samples`, newest
// first), the category its last five uses point to. Only active categories
// count. Words found in exactly one category's name fill the gaps, so
// "petrol" suggests Petrol before anyone has written it in a note.
export function noteCategoryTable(
  samples: { categoryId: string; note: string }[],
  categories: { id: string; name: string }[],
): Record<string, string> {
  const active = new Set(categories.map((c) => c.id));
  const uses = new Map<string, string[]>();
  for (const sample of samples) {
    if (!active.has(sample.categoryId)) continue;
    for (const word of new Set(noteWords(sample.note))) {
      const list = uses.get(word) ?? [];
      if (list.length < LAST_USES) uses.set(word, [...list, sample.categoryId]);
    }
  }

  const table = new Map([...uses].map(([word, list]) => [word, mostUsed(list)]));

  const owners = new Map<string, Set<string>>();
  for (const category of categories) {
    for (const word of noteWords(category.name)) owners.set(word, (owners.get(word) ?? new Set()).add(category.id));
  }
  for (const [word, ids] of owners) {
    if (ids.size === 1 && !table.has(word)) table.set(word, [...ids][0]);
  }

  return Object.fromEntries(table);
}
