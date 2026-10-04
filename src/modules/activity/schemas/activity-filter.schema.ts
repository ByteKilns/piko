import { z } from "zod";

import { type ActivityCursor, decodeCursor } from "../lib/activity-query";
import { ACTION_GROUP_VALUES, type ActionGroup, type ActivitySection, SECTION_VALUES } from "../lib/sections";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_QUERY_LENGTH = 100;

// Rejects shape-valid but impossible dates like 2026-02-31.
function isRealDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

const dateKey = z.string().regex(DATE_KEY).refine(isRealDate).optional().catch(undefined);

// These come straight from a user-editable URL, so each field is parsed on its
// own and a bad value is dropped (= that filter is off) rather than failing
// the page.
const activityFilterSchema = z.object({
  action: z.enum(ACTION_GROUP_VALUES).optional().catch(undefined),
  cursor: z.string().optional().catch(undefined),
  from: dateKey,
  member: z.string().uuid().optional().catch(undefined),
  q: z
    .string()
    .trim()
    .transform((value) => value.slice(0, MAX_QUERY_LENGTH))
    .optional()
    .catch(undefined),
  section: z.enum(SECTION_VALUES).optional().catch(undefined),
  to: dateKey,
});

export type ActivityFilters = {
  action?: ActionGroup;
  cursor?: ActivityCursor;
  from?: string;
  member?: string;
  q?: string;
  section?: ActivitySection;
  to?: string;
};

export function parseActivityFilters(
  raw: Record<string, string | string[] | undefined>,
  memberIds: ReadonlySet<string>,
): ActivityFilters {
  const firstValues = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
  const parsed = activityFilterSchema.parse(firstValues);
  const cursor = parsed.cursor ? decodeCursor(parsed.cursor) : null;

  const filters: ActivityFilters = {
    action: parsed.action,
    cursor: cursor ?? undefined,
    from: parsed.from,
    // Only this household's members — a member id from elsewhere is ignored.
    member: parsed.member && memberIds.has(parsed.member) ? parsed.member : undefined,
    q: parsed.q || undefined,
    section: parsed.section,
    to: parsed.to,
  };
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined)) as ActivityFilters;
}
