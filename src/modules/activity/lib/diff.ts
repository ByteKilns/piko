import type { ActivityChange } from "@/db/schema";

export type FieldSpec<T> = {
  format: (value: unknown) => null | string;
  key: keyof T & string;
  label: string;
};

// Compares *formatted* values so representation-only differences — "1200.00"
// from a DB numeric vs 1200 from a parsed form, "" vs null — never show up as
// phantom edits.
export function diffFields<T>(before: T, after: T, specs: FieldSpec<T>[]): ActivityChange[] {
  const changes: ActivityChange[] = [];
  for (const spec of specs) {
    const from = spec.format(before[spec.key]);
    const to = spec.format(after[spec.key]);
    if (from !== to) changes.push({ field: spec.label, from, to });
  }
  return changes;
}
