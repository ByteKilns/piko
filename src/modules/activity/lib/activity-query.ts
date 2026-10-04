export type ActivityCursor = { createdAt: Date; id: string };

export type ActivityFilterParams = {
  action?: string;
  cursor?: string;
  from?: string;
  member?: string;
  q?: string;
  section?: string;
  to?: string;
};

const CURSOR_PATTERN = /^(\d{1,15})_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

// "<createdAt ms>_<id>" — the last row on a page; the next page is everything
// strictly older in (createdAt desc, id desc) order.
export function encodeCursor({ createdAt, id }: ActivityCursor): string {
  return `${createdAt.getTime()}_${id}`;
}

export function decodeCursor(raw: string): ActivityCursor | null {
  const match = CURSOR_PATTERN.exec(raw);
  if (!match) return null;
  return { createdAt: new Date(Number(match[1])), id: match[2] };
}

// So a search for "100%" or "a_b" matches literally under ILIKE (whose default
// escape character is backslash).
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// "/activity?…" with empty params dropped, so filtered URLs stay short and shareable.
export function activityHref(params: ActivityFilterParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params).sort(([a], [b]) => a.localeCompare(b))) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `/activity?${query}` : "/activity";
}
