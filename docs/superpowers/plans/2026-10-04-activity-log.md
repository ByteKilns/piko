# Activity Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record every household data change (who, what, when, web/mobile, and field-level diffs for edits) in an `activity_logs` table and show it on a filterable `/activity` page.

**Architecture:** A new `src/modules/activity/` slice owns the table's write helper (`logActivity`), the list query, pure formatting/diff libs and the page. Every existing mutation calls `logActivity` after its write, with the actor taken from the session. Each domain module keeps a small pure `lib/<x>-activity.ts` that turns its rows into a summary string and a diff, so field knowledge lives next to the fields.

**Tech Stack:** Next.js 16 App Router (server components + server actions), Drizzle ORM / Postgres, Zod v4, Vitest, Playwright, Tailwind v4 + shadcn, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-04-activity-log-design.md`

## Global Constraints

- Every domain query is scoped by `householdId`; writes derive it from the session (`getCurrentMember()` / `requireMobileAuth`), never from client input.
- `logActivity` is called **after** the domain write succeeds; if the row to update/delete isn't found in the household, nothing is written and nothing is logged.
- An `updated` entry whose diff is empty is not stored (`changes: []` → skipped; `changes` omitted → always stored).
- Diff/summary values are display strings resolved at write time (category/member names, "Shared", `formatNPR` money, household BS/AD dates) — never raw IDs, never `id`/`householdId`/`createdAt`/`updatedAt`, never image data URLs.
- Not logged: notification read state/preferences, accent colour, viewing-as cookie, voice parsing, planner generation, app-release publishing.
- `activity_logs.createdAt` is `timestamp(…, { precision: 3, withTimezone: true })`.
- Page times and day headings are shown in `Asia/Kathmandu`; date filters are Kathmandu day bounds.
- 50 rows per page; keyset cursor `${createdAt ms}_${id}` in the `cursor` query param.
- Imports/props/object keys are alphabetical (ESLint perfectionist) — run `npm run lint -- --fix` before each commit.
- Never commit with `--no-verify`; the pre-commit hook runs `tsc --noEmit` and `npm run build` (~25s).
- File naming: kebab-case folders, PascalCase components, `*.schema.ts`, `*.actions.ts`.
- After code changes, run `graphify update .`.

- Snapshot types mark nullable fields optional (`?: null | …`) so both DB rows (`null`) and parsed form input (`undefined`) satisfy them.

## Review Focus

1. **Search text containing `%` or `_`** (e.g. "100%") must match literally, not act as a wildcard — `escapeLike` test in Task 1.
2. **Two entries created in the same millisecond** (bulk add) straddling a page boundary must not be skipped or duplicated by "Older activity" — ms-precision column + `(createdAt, id)` tiebreak; cursor round-trip test in Task 1, ordering by `id desc` in Task 2.
3. **Hand-edited/garbage URL params** (`?member=<other household's id>`, `?from=2026-02-31`, `?section=nope`, repeated `?q=a&q=b`) must be ignored per-field, never crash the page or leak another household's data — parse tests in Task 2.
4. **Editing without changing anything** (save an expense form untouched; "1200.00" in DB vs `1200` from the form; `null` vs `""` note) must not produce an "edited" entry — formatted-value comparison test in Task 1 and expense no-op test in Task 3.
5. **Entries near midnight Kathmandu time** must land under the right day heading regardless of the server's timezone (UTC on Vercel) — `kathmanduDateKey` test at 18:20 UTC (= 00:05 NPT next day) in Task 1 and day-grouping test in Task 10.

---

### Task 1: Activity table + pure helpers

**Files:**
- Create: `src/db/schema/activityLogs.ts`
- Modify: `src/db/schema/index.ts`
- Create (generated): `drizzle/0013_*.sql` + `drizzle/meta/*`
- Create: `src/modules/activity/lib/diff.ts`, `diff.test.ts`
- Create: `src/modules/activity/lib/activity-values.ts`, `activity-values.test.ts`
- Create: `src/modules/activity/lib/test-formatters.ts`
- Create: `src/modules/activity/lib/sections.ts`, `sections.test.ts`
- Create: `src/modules/activity/lib/activity-format.ts`, `activity-format.test.ts`
- Create: `src/modules/activity/lib/activity-time.ts`, `activity-time.test.ts`
- Create: `src/modules/activity/lib/activity-query.ts`, `activity-query.test.ts`

**Interfaces:**
- Produces:
  - Schema: `activityLogs`, `ActivityLog` (`$inferSelect`), `ActivityEntityType`, `ActivityAction`, `ActivitySource`, `ActivityChange = { field: string; from: null | string; to: null | string }` — all exported from `@/db/schema`.
  - `diffFields<T>(before: T, after: T, specs: FieldSpec<T>[]): ActivityChange[]`; `FieldSpec<T> = { format: (value: unknown) => null | string; key: keyof T & string; label: string }`.
  - `activityFormatters(labels: ActivityLabels)` → `{ category, date, member, money, owner, period(year, month), text }`; `ActivityFormatters`; `ActivityLabels = { categoryNames: Map<string,string>; dateFormat: DateFormat; memberNames: Map<string,string> }`.
  - `testFormatters()` (test-only fixture: categories `cat-1`→Groceries, `cat-2`→Dining; members `m-1`→Asha, `m-2`→Ravi; dateFormat `english`).
  - `ACTIVITY_SECTIONS`, `ACTION_GROUPS`, `ActivitySection`, `ActionGroup`, `SECTION_VALUES`, `ACTION_GROUP_VALUES`, `entityTypesForSection(section)`, `actionsForGroup(group)`, `sectionForEntityType(entityType)`.
  - `describeActivity(action, entityType): string`.
  - `kathmanduDateKey(date): string`, `formatKathmanduTime(date): string`, `kathmanduDayStart(dateKey): Date`, `kathmanduNextDayStart(dateKey): Date`.
  - `encodeCursor({ createdAt, id }): string`, `decodeCursor(raw): ActivityCursor | null`, `escapeLike(term): string`, `activityHref(params: ActivityFilterParams): string`, `ActivityFilterParams`, `ActivityCursor`.

- [ ] **Step 1: Add the table**

`src/db/schema/activityLogs.ts`:

```ts
import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { householdMembers } from "./householdMembers";
import { households } from "./households";

export const activityEntityTypeEnum = pgEnum("activity_entity_type", [
  "account",
  "budget_item",
  "category",
  "dhuku",
  "dhuku_entry",
  "expense",
  "household_settings",
  "income",
  "loan",
  "loan_payment",
  "recurring_expense",
  "savings_contribution",
  "savings_goal",
]);
export const activityActionEnum = pgEnum("activity_action", [
  "archived",
  "completed",
  "created",
  "deleted",
  "paid",
  "paused",
  "restored",
  "resumed",
  "updated",
]);
export const activitySourceEnum = pgEnum("activity_source", ["mobile", "web"]);

export type ActivityAction = (typeof activityActionEnum.enumValues)[number];
export type ActivityEntityType = (typeof activityEntityTypeEnum.enumValues)[number];
export type ActivitySource = (typeof activitySourceEnum.enumValues)[number];
// One field's before/after on an "updated" entry, already formatted for display.
export type ActivityChange = { field: string; from: null | string; to: null | string };

// Append-only audit trail of household data changes (see
// src/modules/activity). Rows are written by the mutating actions themselves,
// so the actor and source come from the session, not the database.
export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    // set null so a removed member's history survives; actorName is the snapshot
    actorMemberId: uuid("actor_member_id").references(() => householdMembers.id, { onDelete: "set null" }),
    actorName: text("actor_name").notNull(),
    entityType: activityEntityTypeEnum("entity_type").notNull(),
    // No FK: the entity may be deleted later and its log must remain.
    entityId: uuid("entity_id"),
    action: activityActionEnum("action").notNull(),
    // Display text written at log time, e.g. "Groceries · RS 1,200 · Shared".
    summary: text("summary").notNull(),
    changes: jsonb("changes").$type<ActivityChange[]>(),
    source: activitySourceEnum("source").notNull(),
    // Millisecond precision (not Postgres' default microseconds) so a JS Date
    // round-trips exactly — the "Older activity" keyset cursor compares
    // against it, and a truncated cursor would skip rows in the same ms.
    createdAt: timestamp("created_at", { precision: 3, withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("activity_logs_household_created_idx").on(table.householdId, table.createdAt.desc(), table.id.desc()),
  ],
);

export type ActivityLog = typeof activityLogs.$inferSelect;
```

Append to `src/db/schema/index.ts`:

```ts
export * from "./activityLogs";
```

- [ ] **Step 2: Generate and apply the migration**

Run: `npm run db:generate`
Expected: a new `drizzle/0013_<name>.sql` containing `CREATE TYPE "public"."activity_entity_type"`, `CREATE TABLE "activity_logs"`, the two FKs and `CREATE INDEX "activity_logs_household_created_idx"`. Open it and confirm `created_at timestamp (3) with time zone`.

Run: `npm run db:migrate`
Expected: completes without error (applies to the `.env.local` dev database — confirm `DATABASE_URL` points at dev first).

- [ ] **Step 3: Write failing tests for the pure helpers**

`src/modules/activity/lib/test-formatters.ts`:

```ts
import { activityFormatters } from "./activity-values";

// Shared fixture for the per-module *-activity tests.
export function testFormatters() {
  return activityFormatters({
    categoryNames: new Map([
      ["cat-1", "Groceries"],
      ["cat-2", "Dining"],
    ]),
    dateFormat: "english",
    memberNames: new Map([
      ["m-1", "Asha"],
      ["m-2", "Ravi"],
    ]),
  });
}
```

`src/modules/activity/lib/diff.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { diffFields, type FieldSpec } from "./diff";
import { testFormatters } from "./test-formatters";

type Snapshot = { amount: number | string; note?: null | string; ownerMemberId: null | string };

const f = testFormatters();
const specs: FieldSpec<Snapshot>[] = [
  { format: f.money, key: "amount", label: "Amount" },
  { format: f.owner, key: "ownerMemberId", label: "For" },
  { format: f.text, key: "note", label: "Note" },
];

describe("diffFields", () => {
  it("reports only fields whose formatted value changed", () => {
    const changes = diffFields<Snapshot>(
      { amount: "1200.00", note: null, ownerMemberId: null },
      { amount: 1500, note: undefined, ownerMemberId: null },
      specs,
    );
    expect(changes).toEqual([{ field: "Amount", from: "RS 1,200", to: "RS 1,500" }]);
  });

  it("treats DB numeric strings, blank notes and null as equal to their parsed forms", () => {
    const changes = diffFields<Snapshot>(
      { amount: "1200.00", note: null, ownerMemberId: "m-1" },
      { amount: 1200, note: "   ", ownerMemberId: "m-1" },
      specs,
    );
    expect(changes).toEqual([]);
  });

  it("reports null ↔ value transitions", () => {
    const changes = diffFields<Snapshot>(
      { amount: 1, note: null, ownerMemberId: null },
      { amount: 1, note: "rent", ownerMemberId: "m-2" },
      specs,
    );
    expect(changes).toEqual([
      { field: "For", from: "Shared", to: "Ravi" },
      { field: "Note", from: null, to: "rent" },
    ]);
  });
});
```

`src/modules/activity/lib/activity-values.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { testFormatters } from "./test-formatters";

const f = testFormatters();

describe("activityFormatters", () => {
  it("formats money from numbers and numeric strings", () => {
    expect(f.money(1200)).toBe("RS 1,200");
    expect(f.money("1200.00")).toBe("RS 1,200");
    expect(f.money(null)).toBeNull();
  });

  it("resolves owners, members and categories to names", () => {
    expect(f.owner(null)).toBe("Shared");
    expect(f.owner("m-1")).toBe("Asha");
    expect(f.owner("gone")).toBe("Former member");
    expect(f.member("m-2")).toBe("Ravi");
    expect(f.member(null)).toBeNull();
    expect(f.category("cat-2")).toBe("Dining");
    expect(f.category("gone")).toBe("Unknown category");
  });

  it("formats dates and periods in the household calendar", () => {
    expect(f.date("2026-08-15")).toBe("15 August 2026");
    expect(f.date(null)).toBeNull();
    expect(f.period(2026, 8)).toBe("August 2026");
  });

  it("trims text and collapses blanks to null", () => {
    expect(f.text("  rent ")).toBe("rent");
    expect(f.text("")).toBeNull();
    expect(f.text(undefined)).toBeNull();
  });
});
```

`src/modules/activity/lib/sections.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { activityActionEnum, activityEntityTypeEnum } from "@/db/schema";

import { ACTION_GROUPS, ACTIVITY_SECTIONS, actionsForGroup, entityTypesForSection, sectionForEntityType } from "./sections";

describe("activity sections", () => {
  it("puts every entity type in exactly one section", () => {
    for (const entityType of activityEntityTypeEnum.enumValues) {
      const owners = ACTIVITY_SECTIONS.filter((s) => (s.entityTypes as readonly string[]).includes(entityType));
      expect(owners, entityType).toHaveLength(1);
    }
  });

  it("puts every action in exactly one action group", () => {
    for (const action of activityActionEnum.enumValues) {
      const owners = ACTION_GROUPS.filter((g) => (g.actions as readonly string[]).includes(action));
      expect(owners, action).toHaveLength(1);
    }
  });

  it("maps sections and groups to their members", () => {
    expect(entityTypesForSection("savings")).toEqual(["savings_goal", "savings_contribution"]);
    expect(actionsForGroup("updated")).toEqual(["updated"]);
    expect(sectionForEntityType("loan_payment")).toBe("loans");
  });
});
```

`src/modules/activity/lib/activity-format.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { describeActivity } from "./activity-format";

describe("describeActivity", () => {
  it("builds a verb phrase for the action and entity", () => {
    expect(describeActivity("created", "expense")).toBe("added an expense");
    expect(describeActivity("updated", "savings_goal")).toBe("edited a savings goal");
    expect(describeActivity("archived", "category")).toBe("archived a category");
    expect(describeActivity("paid", "recurring_expense")).toBe("marked a recurring bill paid");
  });
});
```

`src/modules/activity/lib/activity-time.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { formatKathmanduTime, kathmanduDateKey, kathmanduDayStart, kathmanduNextDayStart } from "./activity-time";

describe("activity time helpers", () => {
  it("keys dates by the Kathmandu calendar day, not UTC", () => {
    // 18:20 UTC is 00:05 the next day in Kathmandu (UTC+05:45).
    expect(kathmanduDateKey(new Date("2026-10-03T18:20:00Z"))).toBe("2026-10-04");
    expect(kathmanduDateKey(new Date("2026-10-03T18:10:00Z"))).toBe("2026-10-03");
  });

  it("formats a time of day in Kathmandu", () => {
    expect(formatKathmanduTime(new Date("2026-10-04T09:20:00Z"))).toMatch(/^3:05\sPM$/);
  });

  it("returns Kathmandu day bounds as UTC instants", () => {
    expect(kathmanduDayStart("2026-10-04").toISOString()).toBe("2026-10-03T18:15:00.000Z");
    expect(kathmanduNextDayStart("2026-10-04").toISOString()).toBe("2026-10-04T18:15:00.000Z");
  });
});
```

`src/modules/activity/lib/activity-query.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { activityHref, decodeCursor, encodeCursor, escapeLike } from "./activity-query";

const ID = "3f1c2a4e-9b7d-4c1a-8e2f-0a1b2c3d4e5f";

describe("activity cursor", () => {
  it("round-trips createdAt (to the ms) and id", () => {
    const createdAt = new Date("2026-10-04T09:20:00.123Z");
    expect(decodeCursor(encodeCursor({ createdAt, id: ID }))).toEqual({ createdAt, id: ID });
  });

  it("rejects malformed cursors", () => {
    expect(decodeCursor("nope")).toBeNull();
    expect(decodeCursor(`123_not-a-uuid`)).toBeNull();
    expect(decodeCursor(`${"9".repeat(20)}_${ID}`)).toBeNull();
  });
});

describe("escapeLike", () => {
  it("escapes LIKE wildcards and the escape character", () => {
    expect(escapeLike("100%")).toBe("100\\%");
    expect(escapeLike("a_b")).toBe("a\\_b");
    expect(escapeLike("c\\d")).toBe("c\\\\d");
  });
});

describe("activityHref", () => {
  it("omits empty params and orders keys", () => {
    expect(activityHref({})).toBe("/activity");
    expect(activityHref({ q: "rent", section: "expenses", to: undefined })).toBe("/activity?q=rent&section=expenses");
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run src/modules/activity`
Expected: FAIL — cannot resolve `./diff`, `./activity-values`, `./sections`, `./activity-format`, `./activity-time`, `./activity-query`.

- [ ] **Step 5: Implement the helpers**

`src/modules/activity/lib/diff.ts`:

```ts
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
```

`src/modules/activity/lib/activity-values.ts`:

```ts
import { formatDate } from "@/lib/date-format";
import type { DateFormat } from "@/lib/date-format-cookie";
import { formatPeriodLabel } from "@/lib/month-period";
import { formatNPR } from "@/modules/dashboard/lib/format";

export type ActivityLabels = {
  categoryNames: Map<string, string>;
  dateFormat: DateFormat;
  memberNames: Map<string, string>;
};

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === "";
}

// Turns raw row/input values into the display strings stored in activity
// summaries and diffs. Resolved at write time, so a later rename or deletion
// doesn't rewrite history.
export function activityFormatters(labels: ActivityLabels) {
  const memberName = (id: string) => labels.memberNames.get(id) ?? "Former member";

  return {
    category: (value: unknown) =>
      isBlank(value) ? null : (labels.categoryNames.get(String(value)) ?? "Unknown category"),
    date: (value: unknown) => (isBlank(value) ? null : formatDate(String(value), labels.dateFormat)),
    member: (value: unknown) => (isBlank(value) ? null : memberName(String(value))),
    money: (value: unknown) => (isBlank(value) ? null : formatNPR(Number(value))),
    owner: (value: unknown) => (isBlank(value) ? "Shared" : memberName(String(value))),
    period: (year: number, month: number) => formatPeriodLabel(year, month, labels.dateFormat),
    text: (value: unknown) => (isBlank(value) ? null : String(value).trim()),
  };
}

export type ActivityFormatters = ReturnType<typeof activityFormatters>;
```

`src/modules/activity/lib/sections.ts`:

```ts
import type { ActivityAction, ActivityEntityType } from "@/db/schema";

// How the Activity page groups entity types into its "Section" filter.
export const ACTIVITY_SECTIONS = [
  { entityTypes: ["expense"], label: "Expenses", value: "expenses" },
  { entityTypes: ["budget_item", "income"], label: "Income & budget", value: "budget" },
  { entityTypes: ["savings_goal", "savings_contribution"], label: "Savings", value: "savings" },
  { entityTypes: ["loan", "loan_payment"], label: "Loans", value: "loans" },
  { entityTypes: ["dhuku", "dhuku_entry"], label: "Dhuku", value: "dhuku" },
  { entityTypes: ["recurring_expense"], label: "Recurring", value: "recurring" },
  { entityTypes: ["category"], label: "Categories", value: "categories" },
  { entityTypes: ["household_settings", "account"], label: "Settings", value: "settings" },
] as const satisfies readonly { entityTypes: readonly ActivityEntityType[]; label: string; value: string }[];

export const ACTION_GROUPS = [
  { actions: ["created"], label: "Created", value: "created" },
  { actions: ["updated"], label: "Edited", value: "updated" },
  { actions: ["deleted"], label: "Deleted", value: "deleted" },
  {
    actions: ["archived", "completed", "paid", "paused", "restored", "resumed"],
    label: "Other",
    value: "other",
  },
] as const satisfies readonly { actions: readonly ActivityAction[]; label: string; value: string }[];

export type ActionGroup = (typeof ACTION_GROUPS)[number]["value"];
export type ActivitySection = (typeof ACTIVITY_SECTIONS)[number]["value"];

export const ACTION_GROUP_VALUES = ACTION_GROUPS.map((g) => g.value) as [ActionGroup, ...ActionGroup[]];
export const SECTION_VALUES = ACTIVITY_SECTIONS.map((s) => s.value) as [ActivitySection, ...ActivitySection[]];

export function entityTypesForSection(section: ActivitySection): ActivityEntityType[] {
  return [...(ACTIVITY_SECTIONS.find((s) => s.value === section)?.entityTypes ?? [])];
}

export function actionsForGroup(group: ActionGroup): ActivityAction[] {
  return [...(ACTION_GROUPS.find((g) => g.value === group)?.actions ?? [])];
}

export function sectionForEntityType(entityType: ActivityEntityType): ActivitySection {
  const section = ACTIVITY_SECTIONS.find((s) => (s.entityTypes as readonly ActivityEntityType[]).includes(entityType));
  if (!section) throw new Error(`No activity section for ${entityType}`);
  return section.value;
}
```

`src/modules/activity/lib/activity-format.ts`:

```ts
import type { ActivityAction, ActivityEntityType } from "@/db/schema";

const ENTITY_NOUNS: Record<ActivityEntityType, string> = {
  account: "their account",
  budget_item: "a budget line",
  category: "a category",
  dhuku: "a dhuku",
  dhuku_entry: "a dhuku entry",
  expense: "an expense",
  household_settings: "household settings",
  income: "income",
  loan: "a loan",
  loan_payment: "a loan payment",
  recurring_expense: "a recurring bill",
  savings_contribution: "a savings contribution",
  savings_goal: "a savings goal",
};

const ACTION_VERBS: Record<Exclude<ActivityAction, "paid">, string> = {
  archived: "archived",
  completed: "completed",
  created: "added",
  deleted: "deleted",
  paused: "paused",
  restored: "restored",
  resumed: "resumed",
  updated: "edited",
};

// "added an expense", "marked a recurring bill paid" — follows the actor's name.
export function describeActivity(action: ActivityAction, entityType: ActivityEntityType): string {
  const noun = ENTITY_NOUNS[entityType];
  return action === "paid" ? `marked ${noun} paid` : `${ACTION_VERBS[action]} ${noun}`;
}
```

`src/modules/activity/lib/activity-time.ts`:

```ts
// Nepal is UTC+05:45 year-round (no DST) and the household lives there, so log
// times are shown — and date filters interpreted — in Kathmandu time whatever
// the server's own timezone is (UTC on Vercel).
const TIME_ZONE = "Asia/Kathmandu";
const UTC_OFFSET = "+05:45";
const DAY_MS = 24 * 60 * 60 * 1000;

// en-CA formats as YYYY-MM-DD.
const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: TIME_ZONE,
  year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: TIME_ZONE });

export function kathmanduDateKey(date: Date): string {
  return dateKeyFormatter.format(date);
}

export function formatKathmanduTime(date: Date): string {
  return timeFormatter.format(date);
}

export function kathmanduDayStart(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00${UTC_OFFSET}`);
}

export function kathmanduNextDayStart(dateKey: string): Date {
  return new Date(kathmanduDayStart(dateKey).getTime() + DAY_MS);
}
```

`src/modules/activity/lib/activity-query.ts`:

```ts
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
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/modules/activity`
Expected: PASS (all 6 files).

- [ ] **Step 7: Lint and commit**

```bash
npm run lint -- --fix
git add src/db/schema drizzle src/modules/activity
git commit -m "feat(activity): activity_logs table and pure formatting helpers"
```

---

### Task 2: Activity write/read API + filter parsing

**Files:**
- Create: `src/modules/activity/api/activity.ts`
- Create: `src/modules/activity/schemas/activity-filter.schema.ts`, `activity-filter.schema.test.ts`

**Interfaces:**
- Consumes: everything Task 1 produces; `getHouseholdMembers`, `CurrentMember` (`@/lib/session`); `listCategories(householdId, { includeArchived: true })`; `getDateFormatPref(householdId)`.
- Produces:
  - `ActivityActor = Pick<CurrentMember, "householdId" | "memberId" | "name"> & { source: ActivitySource }`
  - `activityActor(member: CurrentMember, source?: ActivitySource): ActivityActor` (default `"web"`)
  - `ActivityEntry = { action; changes?: ActivityChange[]; entityId: null | string; entityType; summary: string }`
  - `logActivity(actor, entry): Promise<void>`, `logActivities(actor, entries): Promise<void>`
  - `loadActivityFormatters(householdId): Promise<ActivityFormatters>`
  - `listActivity(householdId, filters: ActivityFilters): Promise<{ entries: ActivityLog[]; nextCursor: null | string }>`, `ACTIVITY_PAGE_SIZE = 50`
  - `ActivityFilters = { action?: ActionGroup; cursor?: ActivityCursor; from?: string; member?: string; q?: string; section?: ActivitySection; to?: string }`
  - `parseActivityFilters(raw: Record<string, string | string[] | undefined>, memberIds: ReadonlySet<string>): ActivityFilters`

- [ ] **Step 1: Write the failing filter-parsing test**

`src/modules/activity/schemas/activity-filter.schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { parseActivityFilters } from "./activity-filter.schema";

const MEMBER = "3f1c2a4e-9b7d-4c1a-8e2f-0a1b2c3d4e5f";
const OTHER_HOUSEHOLD_MEMBER = "7a2b3c4d-1e2f-4a3b-9c4d-5e6f7a8b9c0d";
const members = new Set([MEMBER]);

describe("parseActivityFilters", () => {
  it("returns no filters for an empty query", () => {
    expect(parseActivityFilters({}, members)).toEqual({});
  });

  it("parses every valid filter", () => {
    const filters = parseActivityFilters(
      {
        action: "deleted",
        cursor: `1759569600123_${MEMBER}`,
        from: "2026-10-01",
        member: MEMBER,
        q: "  rent  ",
        section: "expenses",
        to: "2026-10-04",
      },
      members,
    );
    expect(filters).toEqual({
      action: "deleted",
      cursor: { createdAt: new Date(1759569600123), id: MEMBER },
      from: "2026-10-01",
      member: MEMBER,
      q: "rent",
      section: "expenses",
      to: "2026-10-04",
    });
  });

  it("drops invalid values field by field instead of failing", () => {
    const filters = parseActivityFilters(
      {
        action: "exploded",
        cursor: "garbage",
        from: "2026-02-31",
        member: OTHER_HOUSEHOLD_MEMBER,
        q: "   ",
        section: "nope",
        to: "yesterday",
      },
      members,
    );
    expect(filters).toEqual({});
  });

  it("uses the first value of repeated params and caps search length", () => {
    const filters = parseActivityFilters({ q: ["first", "second"], section: ["loans", "dhuku"] }, members);
    expect(filters).toEqual({ q: "first", section: "loans" });
    expect(parseActivityFilters({ q: "x".repeat(300) }, members).q).toHaveLength(100);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/modules/activity/schemas`
Expected: FAIL — cannot resolve `./activity-filter.schema`.

- [ ] **Step 3: Implement the filter schema**

`src/modules/activity/schemas/activity-filter.schema.ts`:

```ts
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
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/modules/activity/schemas`
Expected: PASS.

- [ ] **Step 5: Implement the API module**

`src/modules/activity/api/activity.ts` (no `"use server"` — imported by other modules' server actions, like `categories/api/categories.ts`):

```ts
import { and, desc, eq, gte, ilike, inArray, lt, or, type SQL } from "drizzle-orm";

import { db } from "@/db/client";
import {
  type ActivityAction,
  type ActivityChange,
  type ActivityEntityType,
  type ActivityLog,
  activityLogs,
  type ActivitySource,
} from "@/db/schema";
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { type CurrentMember, getHouseholdMembers } from "@/lib/session";
import { listCategories } from "@/modules/categories/api/categories";

import { encodeCursor, escapeLike } from "../lib/activity-query";
import { kathmanduDayStart, kathmanduNextDayStart } from "../lib/activity-time";
import { type ActivityFormatters, activityFormatters } from "../lib/activity-values";
import { actionsForGroup, entityTypesForSection } from "../lib/sections";
import type { ActivityFilters } from "../schemas/activity-filter.schema";

export const ACTIVITY_PAGE_SIZE = 50;

export type ActivityActor = Pick<CurrentMember, "householdId" | "memberId" | "name"> & { source: ActivitySource };

export type ActivityEntry = {
  action: ActivityAction;
  // Omit for entries that aren't field edits. An empty array means "saved,
  // but nothing actually changed" and the entry is skipped.
  changes?: ActivityChange[];
  entityId: null | string;
  entityType: ActivityEntityType;
  summary: string;
};

export function activityActor(member: CurrentMember, source: ActivitySource = "web"): ActivityActor {
  return { householdId: member.householdId, memberId: member.memberId, name: member.name, source };
}

// Call after the domain write has succeeded. householdId always comes from the
// actor (i.e. the session), never from the entry.
export async function logActivities(actor: ActivityActor, entries: ActivityEntry[]) {
  const toInsert = entries.filter((entry) => entry.changes === undefined || entry.changes.length > 0);
  if (toInsert.length === 0) return;

  await db.insert(activityLogs).values(
    toInsert.map((entry) => ({
      action: entry.action,
      actorMemberId: actor.memberId,
      actorName: actor.name,
      changes: entry.changes ?? null,
      entityId: entry.entityId,
      entityType: entry.entityType,
      householdId: actor.householdId,
      source: actor.source,
      summary: entry.summary,
    })),
  );
}

export async function logActivity(actor: ActivityActor, entry: ActivityEntry) {
  await logActivities(actor, [entry]);
}

export async function loadActivityFormatters(householdId: string): Promise<ActivityFormatters> {
  const [members, categories, dateFormat] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId, { includeArchived: true }),
    getDateFormatPref(householdId),
  ]);

  return activityFormatters({
    categoryNames: new Map(categories.map((c) => [c.id, c.name])),
    dateFormat,
    memberNames: new Map(members.map((m) => [m.id, m.user.name])),
  });
}

export async function listActivity(
  householdId: string,
  filters: ActivityFilters,
): Promise<{ entries: ActivityLog[]; nextCursor: null | string }> {
  const conditions: SQL[] = [eq(activityLogs.householdId, householdId)];
  if (filters.member) conditions.push(eq(activityLogs.actorMemberId, filters.member));
  if (filters.section) conditions.push(inArray(activityLogs.entityType, entityTypesForSection(filters.section)));
  if (filters.action) conditions.push(inArray(activityLogs.action, actionsForGroup(filters.action)));
  if (filters.from) conditions.push(gte(activityLogs.createdAt, kathmanduDayStart(filters.from)));
  if (filters.to) conditions.push(lt(activityLogs.createdAt, kathmanduNextDayStart(filters.to)));
  if (filters.q) conditions.push(ilike(activityLogs.summary, `%${escapeLike(filters.q)}%`));
  if (filters.cursor) {
    const { createdAt, id } = filters.cursor;
    const olderThanCursor = or(
      lt(activityLogs.createdAt, createdAt),
      and(eq(activityLogs.createdAt, createdAt), lt(activityLogs.id, id)),
    );
    if (olderThanCursor) conditions.push(olderThanCursor);
  }

  // One extra row tells us whether an older page exists.
  const rows = await db
    .select()
    .from(activityLogs)
    .where(and(...conditions))
    .orderBy(desc(activityLogs.createdAt), desc(activityLogs.id))
    .limit(ACTIVITY_PAGE_SIZE + 1);

  const entries = rows.slice(0, ACTIVITY_PAGE_SIZE);
  const last = entries.at(-1);
  return { entries, nextCursor: rows.length > ACTIVITY_PAGE_SIZE && last ? encodeCursor(last) : null };
}
```

- [ ] **Step 6: Type-check, test, lint, commit**

Run: `npx tsc --noEmit && npx vitest run src/modules/activity`
Expected: no type errors; PASS.

```bash
npm run lint -- --fix
git add src/modules/activity
git commit -m "feat(activity): logActivity, listActivity and URL filter parsing"
```

---

### Task 3: Log expense changes (web, bulk, mobile)

**Files:**
- Create: `src/modules/expenses/lib/expense-activity.ts`, `expense-activity.test.ts`
- Modify: `src/modules/expenses/api/expenses.actions.ts`
- Modify: `src/app/api/mobile/expenses/route.ts:37-40`

**Interfaces:**
- Consumes: `ActivityActor`, `activityActor`, `loadActivityFormatters`, `logActivity`, `logActivities` (Task 2); `diffFields`, `FieldSpec`, `ActivityFormatters`, `testFormatters` (Task 1).
- Produces:
  - `ExpenseSnapshot = { amount: number | string; categoryId: string; date: string; note?: null | string; ownerMemberId: null | string; paidByMemberId: string }`
  - `expenseSummary(f, expense: ExpenseSnapshot): string` (Task 8 reuses it)
  - `expenseChanges(f, before: ExpenseSnapshot, after: ExpenseSnapshot): ActivityChange[]`
  - `createExpenseForHousehold(input: ExpenseInput, actor: ActivityActor)` — **signature change** from `{ actorName, householdId }`.

- [ ] **Step 1: Write the failing test**

`src/modules/expenses/lib/expense-activity.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { testFormatters } from "@/modules/activity/lib/test-formatters";

import { expenseChanges, expenseSummary, type ExpenseSnapshot } from "./expense-activity";

const f = testFormatters();
const stored: ExpenseSnapshot = {
  amount: "1200.00",
  categoryId: "cat-1",
  date: "2026-08-15",
  note: "weekly veg",
  ownerMemberId: null,
  paidByMemberId: "m-1",
};

describe("expense activity", () => {
  it("summarises category, amount, owner and note", () => {
    expect(expenseSummary(f, stored)).toBe("Groceries · RS 1,200 · Shared — weekly veg");
    expect(expenseSummary(f, { ...stored, note: null, ownerMemberId: "m-2" })).toBe("Groceries · RS 1,200 · Ravi");
  });

  it("diffs the editable fields with readable values", () => {
    const changes = expenseChanges(f, stored, { ...stored, amount: 1500, categoryId: "cat-2", ownerMemberId: "m-1" });
    expect(changes).toEqual([
      { field: "Amount", from: "RS 1,200", to: "RS 1,500" },
      { field: "Category", from: "Groceries", to: "Dining" },
      { field: "For", from: "Shared", to: "Asha" },
    ]);
  });

  it("reports no changes when the form is saved untouched", () => {
    expect(expenseChanges(f, stored, { ...stored, amount: 1200 })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/modules/expenses/lib/expense-activity.test.ts`
Expected: FAIL — cannot resolve `./expense-activity`.

- [ ] **Step 3: Implement the expense activity helpers**

`src/modules/expenses/lib/expense-activity.ts`:

```ts
import type { ActivityFormatters } from "@/modules/activity/lib/activity-values";
import { diffFields, type FieldSpec } from "@/modules/activity/lib/diff";

export type ExpenseSnapshot = {
  amount: number | string;
  categoryId: string;
  date: string;
  note?: null | string;
  ownerMemberId: null | string;
  paidByMemberId: string;
};

function expenseFields(f: ActivityFormatters): FieldSpec<ExpenseSnapshot>[] {
  return [
    { format: f.money, key: "amount", label: "Amount" },
    { format: f.category, key: "categoryId", label: "Category" },
    { format: f.owner, key: "ownerMemberId", label: "For" },
    { format: f.member, key: "paidByMemberId", label: "Paid by" },
    { format: f.date, key: "date", label: "Date" },
    { format: f.text, key: "note", label: "Note" },
  ];
}

// "Groceries · RS 1,200 · Shared — weekly veg"
export function expenseSummary(f: ActivityFormatters, expense: ExpenseSnapshot): string {
  const base = [f.category(expense.categoryId), f.money(expense.amount), f.owner(expense.ownerMemberId)]
    .filter(Boolean)
    .join(" · ");
  const note = f.text(expense.note);
  return note ? `${base} — ${note}` : base;
}

export function expenseChanges(f: ActivityFormatters, before: ExpenseSnapshot, after: ExpenseSnapshot) {
  return diffFields(before, after, expenseFields(f));
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/modules/expenses/lib/expense-activity.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire logging into the expense actions**

In `src/modules/expenses/api/expenses.actions.ts`:

Add imports (keep perfectionist order — `lint --fix` will sort):

```ts
import { type ActivityActor, activityActor, loadActivityFormatters, logActivities, logActivity } from "@/modules/activity/api/activity";

import { expenseChanges, expenseSummary } from "../lib/expense-activity";
```

Add a scoped lookup below `assertCategoryInHousehold`:

```ts
async function findExpenseInHousehold(householdId: string, id: string) {
  const [row] = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.householdId, householdId)));
  return row;
}
```

Change `createExpenseForHousehold`'s signature and log after the insert (keep the body otherwise identical):

```ts
export async function createExpenseForHousehold(input: ExpenseInput, actor: ActivityActor) {
  const { householdId, name: actorName } = actor;
  // ...existing validation, insert, notification, threshold check unchanged...

  const f = await loadActivityFormatters(householdId);
  await logActivity(actor, {
    action: "created",
    entityId: created.id,
    entityType: "expense",
    summary: expenseSummary(f, created),
  });

  revalidatePath("/expenses");
  revalidatePath("/dashboard");

  return created;
}

export async function createExpenseAction(input: ExpenseInput) {
  await createExpenseForHousehold(input, activityActor(await getCurrentMember()));
}
```

In `createExpensesBulkAction`, replace `const { householdId, name: actorName } = await getCurrentMember();` with:

```ts
  const member = await getCurrentMember();
  const { householdId, name: actorName } = member;
```

and after the threshold loop, before `revalidatePath`:

```ts
  const f = await loadActivityFormatters(householdId);
  await logActivities(
    activityActor(member),
    created.map((row) => ({
      action: "created" as const,
      entityId: row.id,
      entityType: "expense" as const,
      summary: expenseSummary(f, row),
    })),
  );
```

Replace `updateExpenseAction` and `deleteExpenseAction`:

```ts
export async function updateExpenseAction(id: string, input: ExpenseInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = expenseSchema.parse(input);
  await assertCategoryInHousehold(householdId, parsed.categoryId);
  await assertMemberInHousehold(householdId, parsed.paidByMemberId);
  if (parsed.ownerMemberId) {
    await assertMemberInHousehold(householdId, parsed.ownerMemberId);
  }

  const before = await findExpenseInHousehold(householdId, id);
  if (!before) return;

  await db
    .update(expenses)
    .set({
      amount: String(parsed.amount),
      categoryId: parsed.categoryId,
      ownerMemberId: parsed.ownerMemberId,
      paidByMemberId: parsed.paidByMemberId,
      date: parsed.date,
      note: parsed.note ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(expenses.id, id), eq(expenses.householdId, householdId)));

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "updated",
    changes: expenseChanges(f, before, parsed),
    entityId: id,
    entityType: "expense",
    summary: expenseSummary(f, parsed),
  });

  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}

export async function deleteExpenseAction(id: string) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const before = await findExpenseInHousehold(householdId, id);
  if (!before) return;

  await db
    .delete(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.householdId, householdId)));

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "deleted",
    entityId: id,
    entityType: "expense",
    summary: expenseSummary(f, before),
  });

  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}
```

- [ ] **Step 6: Pass a mobile actor from the mobile route**

In `src/app/api/mobile/expenses/route.ts`, add `import { activityActor } from "@/modules/activity/api/activity";` and replace the call:

```ts
    const created = await createExpenseForHousehold(parsed.data, activityActor(auth, "mobile"));
```

- [ ] **Step 7: Verify and commit**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors (any other caller of `createExpenseForHousehold` would surface here — `grep -rn createExpenseForHousehold src` should show only the action file and the mobile route); all tests PASS.

```bash
npm run lint -- --fix
git add src/modules/expenses src/app/api/mobile/expenses
git commit -m "feat(activity): log expense create/edit/delete from web and mobile"
```

---

### Task 4: Log budget lines and income

**Files:**
- Create: `src/modules/budget/lib/budget-activity.ts`, `budget-activity.test.ts`
- Modify: `src/modules/budget/api/budget.actions.ts`

**Interfaces:**
- Consumes: Task 1 + Task 2 APIs.
- Produces: `BudgetItemSnapshot`, `budgetItemSummary(f, item, period)`, `budgetItemChanges(f, before, after)`, `IncomeSnapshot`, `incomeSummary(f, income)`, `incomeChanges(f, before, after)`.

- [ ] **Step 1: Write the failing test**

`src/modules/budget/lib/budget-activity.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { testFormatters } from "@/modules/activity/lib/test-formatters";

import { budgetItemChanges, budgetItemSummary, incomeChanges, incomeSummary } from "./budget-activity";

const f = testFormatters();

describe("budget activity", () => {
  it("summarises a budget line with its period", () => {
    const item = { categoryId: "cat-1", ownerMemberId: null, plannedAmount: 8000 };
    expect(budgetItemSummary(f, item, { month: 10, year: 2026 })).toBe("Groceries · Shared · October 2026 · RS 8,000");
  });

  it("diffs planned amount and owner", () => {
    const before = { categoryId: "cat-1", ownerMemberId: null, plannedAmount: "8000.00" };
    expect(budgetItemChanges(f, before, { ...before, ownerMemberId: "m-1", plannedAmount: 9000 })).toEqual([
      { field: "Planned", from: "RS 8,000", to: "RS 9,000" },
      { field: "For", from: "Shared", to: "Asha" },
    ]);
  });

  it("summarises and diffs income", () => {
    const before = { amount: "90000.00", memberId: "m-2", month: 10, note: null, year: 2026 };
    expect(incomeSummary(f, before)).toBe("Ravi · October 2026 · RS 90,000");
    expect(incomeChanges(f, before, { ...before, amount: 95000, note: "bonus" })).toEqual([
      { field: "Amount", from: "RS 90,000", to: "RS 95,000" },
      { field: "Note", from: null, to: "bonus" },
    ]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/modules/budget/lib/budget-activity.test.ts`
Expected: FAIL — cannot resolve `./budget-activity`.

- [ ] **Step 3: Implement**

`src/modules/budget/lib/budget-activity.ts`:

```ts
import type { ActivityFormatters } from "@/modules/activity/lib/activity-values";
import { diffFields } from "@/modules/activity/lib/diff";

export type BudgetItemSnapshot = { categoryId: string; ownerMemberId: null | string; plannedAmount: number | string };
export type IncomeSnapshot = { amount: number | string; memberId: string; month: number; note?: null | string; year: number };

// "Groceries · Shared · Ashwin 2083 · RS 8,000"
export function budgetItemSummary(
  f: ActivityFormatters,
  item: BudgetItemSnapshot,
  period: { month: number; year: number },
): string {
  return [f.category(item.categoryId), f.owner(item.ownerMemberId), f.period(period.year, period.month), f.money(item.plannedAmount)]
    .filter(Boolean)
    .join(" · ");
}

export function budgetItemChanges(f: ActivityFormatters, before: BudgetItemSnapshot, after: BudgetItemSnapshot) {
  return diffFields(before, after, [
    { format: f.money, key: "plannedAmount", label: "Planned" },
    { format: f.owner, key: "ownerMemberId", label: "For" },
  ]);
}

// "Ravi · Ashwin 2083 · RS 90,000"
export function incomeSummary(f: ActivityFormatters, income: IncomeSnapshot): string {
  return [f.member(income.memberId), f.period(income.year, income.month), f.money(income.amount)].filter(Boolean).join(" · ");
}

export function incomeChanges(f: ActivityFormatters, before: IncomeSnapshot, after: IncomeSnapshot) {
  return diffFields(before, after, [
    { format: f.money, key: "amount", label: "Amount" },
    { format: f.text, key: "note", label: "Note" },
  ]);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/modules/budget/lib/budget-activity.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire logging into the budget actions**

In `src/modules/budget/api/budget.actions.ts` add:

```ts
import { activityActor, loadActivityFormatters, logActivities, logActivity } from "@/modules/activity/api/activity";

import { budgetItemChanges, budgetItemSummary, incomeChanges, incomeSummary } from "../lib/budget-activity";
```

`setBudgetItemAction`: replace `const { householdId } = await getCurrentMember();` with `const member = await getCurrentMember(); const { householdId } = member;`. After `const budget = await getOrCreateMonthlyBudget(...)`, read the current row for this category/month (any owner — the transaction below collapses them to one):

```ts
  const [before] = await db
    .select()
    .from(budgetItems)
    .where(and(eq(budgetItems.monthlyBudgetId, budget.id), eq(budgetItems.categoryId, parsed.categoryId)));
```

Make the transaction return the written row's id — change `await db.transaction(async (tx) => {` to `const itemId = await db.transaction(async (tx) => {` and in its three write branches:

```ts
      if (existing) {
        await tx
          .update(budgetItems)
          .set({ plannedAmount: String(parsed.plannedAmount) })
          .where(eq(budgetItems.id, existing.id));
        return existing.id;
      }
      const [inserted] = await tx
        .insert(budgetItems)
        .values({
          monthlyBudgetId: budget.id,
          categoryId: parsed.categoryId,
          ownerMemberId: null,
          plannedAmount: String(parsed.plannedAmount),
        })
        .returning({ id: budgetItems.id });
      return inserted.id;
```

and for the non-null-owner branch:

```ts
      const [upserted] = await tx
        .insert(budgetItems)
        .values({
          monthlyBudgetId: budget.id,
          categoryId: parsed.categoryId,
          ownerMemberId: parsed.ownerMemberId,
          plannedAmount: String(parsed.plannedAmount),
        })
        .onConflictDoUpdate({
          target: [budgetItems.monthlyBudgetId, budgetItems.categoryId, budgetItems.ownerMemberId],
          set: { plannedAmount: String(parsed.plannedAmount) },
        })
        .returning({ id: budgetItems.id });
      return upserted.id;
```

(The shared branch's `if (existing) {…} else {…}` becomes `if (existing) {… return existing.id; }` followed by the insert — drop the `else`.) Then before `revalidatePath`:

```ts
  const f = await loadActivityFormatters(householdId);
  const after = { categoryId: parsed.categoryId, ownerMemberId: parsed.ownerMemberId, plannedAmount: parsed.plannedAmount };
  const summary = budgetItemSummary(f, after, { month: parsed.month, year: parsed.year });
  await logActivity(
    activityActor(member),
    before
      ? { action: "updated", changes: budgetItemChanges(f, before, after), entityId: itemId, entityType: "budget_item", summary }
      : { action: "created", entityId: itemId, entityType: "budget_item", summary },
  );
```

`copyPreviousMonthBudgetAction`: use `const member = await getCurrentMember(); const { householdId } = member;` and replace the insert block:

```ts
  if (toInsert.length > 0) {
    const inserted = await db.insert(budgetItems).values(toInsert).returning();
    const f = await loadActivityFormatters(householdId);
    await logActivities(
      activityActor(member),
      inserted.map((item) => ({
        action: "created" as const,
        entityId: item.id,
        entityType: "budget_item" as const,
        summary: budgetItemSummary(f, item, { month, year }),
      })),
    );
  }
```

`setIncomeAction`: use `const member = …; const { householdId } = member;`. Before the upsert:

```ts
  const [before] = await db
    .select()
    .from(incomes)
    .where(
      and(
        eq(incomes.householdId, householdId),
        eq(incomes.memberId, parsed.memberId),
        eq(incomes.year, parsed.year),
        eq(incomes.month, parsed.month),
      ),
    );
```

Add `.returning({ id: incomes.id })` to the upsert and capture it as `const [saved] = await db.insert(incomes)…`. Then:

```ts
  const f = await loadActivityFormatters(householdId);
  const after = { amount: parsed.amount, memberId: parsed.memberId, month: parsed.month, note: parsed.note, year: parsed.year };
  await logActivity(
    activityActor(member),
    before
      ? { action: "updated", changes: incomeChanges(f, before, after), entityId: saved.id, entityType: "income", summary: incomeSummary(f, after) }
      : { action: "created", entityId: saved.id, entityType: "income", summary: incomeSummary(f, after) },
  );
```

- [ ] **Step 6: Verify and commit**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; PASS.

```bash
npm run lint -- --fix
git add src/modules/budget
git commit -m "feat(activity): log budget line and income changes"
```

---

### Task 5: Log savings goals and contributions

**Files:**
- Create: `src/modules/savings-goals/lib/savings-activity.ts`, `savings-activity.test.ts`
- Modify: `src/modules/savings-goals/api/savings-goals.actions.ts`

**Interfaces:**
- Consumes: Task 1 + Task 2 APIs.
- Produces: `SavingsGoalSnapshot`, `goalSummary(f, goal)`, `goalChanges(f, before, after)`, `contributionSummary(f, contribution, goalName)`.

- [ ] **Step 1: Write the failing test**

`src/modules/savings-goals/lib/savings-activity.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { testFormatters } from "@/modules/activity/lib/test-formatters";

import { contributionSummary, goalChanges, goalSummary, type SavingsGoalSnapshot } from "./savings-activity";

const f = testFormatters();
const goal: SavingsGoalSnapshot = {
  description: null,
  name: "Emergency fund",
  ownerMemberId: null,
  targetAmount: "500000.00",
  targetDate: null,
};

describe("savings activity", () => {
  it("summarises a goal, with the target only when it has one", () => {
    expect(goalSummary(f, goal)).toBe("Emergency fund · Shared · target RS 500,000");
    expect(goalSummary(f, { ...goal, targetAmount: null })).toBe("Emergency fund · Shared");
  });

  it("diffs goal fields", () => {
    expect(goalChanges(f, goal, { ...goal, name: "Rainy day", targetDate: "2027-01-01" })).toEqual([
      { field: "Name", from: "Emergency fund", to: "Rainy day" },
      { field: "Target date", from: null, to: "1 January 2027" },
    ]);
  });

  it("summarises a contribution", () => {
    expect(contributionSummary(f, { amount: "5000.00", memberId: "m-1" }, "Emergency fund")).toBe(
      "RS 5,000 to Emergency fund · by Asha",
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/modules/savings-goals/lib/savings-activity.test.ts`
Expected: FAIL — cannot resolve `./savings-activity`.

- [ ] **Step 3: Implement**

`src/modules/savings-goals/lib/savings-activity.ts`:

```ts
import type { ActivityFormatters } from "@/modules/activity/lib/activity-values";
import { diffFields } from "@/modules/activity/lib/diff";

export type SavingsGoalSnapshot = {
  description?: null | string;
  name: string;
  ownerMemberId: null | string;
  targetAmount?: null | number | string;
  targetDate?: null | string;
};

// "Emergency fund · Shared · target RS 500,000"
export function goalSummary(f: ActivityFormatters, goal: SavingsGoalSnapshot): string {
  const target = f.money(goal.targetAmount);
  return [goal.name, f.owner(goal.ownerMemberId), target && `target ${target}`].filter(Boolean).join(" · ");
}

// The goal image is deliberately not diffed — it's a data URL, not something
// a person can read in a log.
export function goalChanges(f: ActivityFormatters, before: SavingsGoalSnapshot, after: SavingsGoalSnapshot) {
  return diffFields(before, after, [
    { format: f.text, key: "name", label: "Name" },
    { format: f.text, key: "description", label: "Description" },
    { format: f.owner, key: "ownerMemberId", label: "For" },
    { format: f.money, key: "targetAmount", label: "Target" },
    { format: f.date, key: "targetDate", label: "Target date" },
  ]);
}

// "RS 5,000 to Emergency fund · by Asha"
export function contributionSummary(
  f: ActivityFormatters,
  contribution: { amount: number | string; memberId: string },
  goalName: string,
): string {
  return `${f.money(contribution.amount)} to ${goalName} · by ${f.member(contribution.memberId)}`;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/modules/savings-goals/lib/savings-activity.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire logging into the savings actions**

In `src/modules/savings-goals/api/savings-goals.actions.ts` add:

```ts
import { activityActor, loadActivityFormatters, logActivity } from "@/modules/activity/api/activity";
import { contributionSummary, goalChanges, goalSummary } from "@/modules/savings-goals/lib/savings-activity";
```

Add a lookup that returns `undefined` instead of throwing (the existing `getGoalInHousehold` throws and stays for contributions):

```ts
async function findGoalInHousehold(householdId: string, goalId: string) {
  const [goal] = await db
    .select()
    .from(savingsGoals)
    .where(and(eq(savingsGoals.id, goalId), eq(savingsGoals.householdId, householdId)));
  return goal;
}
```

Then (each action switches to `const member = await getCurrentMember(); const { householdId } = member;`):

`createSavingsGoalAction` — capture the row and log:

```ts
  const [created] = await db
    .insert(savingsGoals)
    .values({ /* unchanged values */ })
    .returning();

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "created",
    entityId: created.id,
    entityType: "savings_goal",
    summary: goalSummary(f, created),
  });
```

`updateSavingsGoalAction` — after validation, `const before = await findGoalInHousehold(householdId, id); if (!before) return;`, keep the update, then:

```ts
  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "updated",
    changes: goalChanges(f, before, parsed),
    entityId: id,
    entityType: "savings_goal",
    summary: goalSummary(f, parsed),
  });
```

`deleteSavingsGoalAction`:

```ts
export async function deleteSavingsGoalAction(id: string) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const before = await findGoalInHousehold(householdId, id);
  if (!before) return;

  await db.delete(savingsGoals).where(and(eq(savingsGoals.id, id), eq(savingsGoals.householdId, householdId)));

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "deleted",
    entityId: id,
    entityType: "savings_goal",
    summary: goalSummary(f, before),
  });

  revalidateSavingsGoalsPaths();
}
```

`addContributionAction` — replace `const { householdId, name: actorName } = await getCurrentMember();` with `const member = await getCurrentMember(); const { householdId, name: actorName } = member;` and after `insertNotification(...)`:

```ts
  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "created",
    entityId: created.id,
    entityType: "savings_contribution",
    summary: contributionSummary(f, created, goal.name),
  });
```

- [ ] **Step 6: Verify and commit**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; PASS.

```bash
npm run lint -- --fix
git add src/modules/savings-goals
git commit -m "feat(activity): log savings goal and contribution changes"
```

---

### Task 6: Log loans and loan payments

**Files:**
- Create: `src/modules/loans/lib/loan-activity.ts`, `loan-activity.test.ts`
- Modify: `src/modules/loans/api/loans.actions.ts`

**Interfaces:**
- Consumes: Task 1 + Task 2 APIs.
- Produces: `LoanSnapshot`, `loanSummary(f, loan)`, `loanChanges(f, before, after)`, `loanPaymentSummary(f, payment, loan)`.

- [ ] **Step 1: Write the failing test**

`src/modules/loans/lib/loan-activity.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { testFormatters } from "@/modules/activity/lib/test-formatters";

import { loanChanges, loanPaymentSummary, type LoanSnapshot, loanSummary } from "./loan-activity";

const f = testFormatters();
const loan: LoanSnapshot = {
  counterpartyName: "Hari",
  date: "2026-08-01",
  direction: "given",
  dueDate: null,
  installmentAmount: null,
  installmentFrequency: null,
  nextInstallmentDate: null,
  note: null,
  ownerMemberId: "m-1",
  principalAmount: "50000.00",
};

describe("loan activity", () => {
  it("summarises a loan by direction", () => {
    expect(loanSummary(f, loan)).toBe("Lent to Hari · RS 50,000 · Asha");
    expect(loanSummary(f, { ...loan, direction: "taken", ownerMemberId: null })).toBe("Borrowed from Hari · RS 50,000 · Shared");
  });

  it("diffs loan fields with readable direction", () => {
    expect(loanChanges(f, loan, { ...loan, direction: "taken", principalAmount: 60000 })).toEqual([
      { field: "Type", from: "Lent", to: "Borrowed" },
      { field: "Amount", from: "RS 50,000", to: "RS 60,000" },
    ]);
  });

  it("summarises a payment", () => {
    expect(loanPaymentSummary(f, { amount: "5000.00", memberId: "m-2" }, loan)).toBe("RS 5,000 received from Hari · by Ravi");
    expect(loanPaymentSummary(f, { amount: 5000, memberId: "m-2" }, { ...loan, direction: "taken" })).toBe(
      "RS 5,000 paid to Hari · by Ravi",
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/modules/loans/lib/loan-activity.test.ts`
Expected: FAIL — cannot resolve `./loan-activity`.

- [ ] **Step 3: Implement**

`src/modules/loans/lib/loan-activity.ts`:

```ts
import type { ActivityFormatters } from "@/modules/activity/lib/activity-values";
import { diffFields } from "@/modules/activity/lib/diff";

export type LoanSnapshot = {
  counterpartyName: string;
  date: string;
  direction: string;
  dueDate?: null | string;
  installmentAmount?: null | number | string;
  installmentFrequency?: null | string;
  nextInstallmentDate?: null | string;
  note?: null | string;
  ownerMemberId: null | string;
  principalAmount: number | string;
};

function directionLabel(value: unknown): null | string {
  if (value === "given") return "Lent";
  if (value === "taken") return "Borrowed";
  return null;
}

// "Lent to Hari · RS 50,000 · Asha"
export function loanSummary(f: ActivityFormatters, loan: LoanSnapshot): string {
  const lead = `${loan.direction === "given" ? "Lent to" : "Borrowed from"} ${loan.counterpartyName}`;
  return [lead, f.money(loan.principalAmount), f.owner(loan.ownerMemberId)].filter(Boolean).join(" · ");
}

export function loanChanges(f: ActivityFormatters, before: LoanSnapshot, after: LoanSnapshot) {
  return diffFields(before, after, [
    { format: f.text, key: "counterpartyName", label: "Person" },
    { format: directionLabel, key: "direction", label: "Type" },
    { format: f.money, key: "principalAmount", label: "Amount" },
    { format: f.date, key: "date", label: "Date" },
    { format: f.date, key: "dueDate", label: "Due date" },
    { format: f.money, key: "installmentAmount", label: "Installment" },
    { format: f.text, key: "installmentFrequency", label: "Installment frequency" },
    { format: f.date, key: "nextInstallmentDate", label: "Next installment" },
    { format: f.owner, key: "ownerMemberId", label: "For" },
    { format: f.text, key: "note", label: "Note" },
  ]);
}

// "RS 5,000 received from Hari · by Ravi" — same wording as the payment notification.
export function loanPaymentSummary(
  f: ActivityFormatters,
  payment: { amount: number | string; memberId: string },
  loan: Pick<LoanSnapshot, "counterpartyName" | "direction">,
): string {
  const verb = loan.direction === "given" ? "received from" : "paid to";
  return `${f.money(payment.amount)} ${verb} ${loan.counterpartyName} · by ${f.member(payment.memberId)}`;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/modules/loans/lib/loan-activity.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire logging into the loan actions**

In `src/modules/loans/api/loans.actions.ts` add:

```ts
import { activityActor, loadActivityFormatters, logActivity } from "@/modules/activity/api/activity";
import { loanChanges, loanPaymentSummary, loanSummary } from "@/modules/loans/lib/loan-activity";
```

and a non-throwing lookup:

```ts
async function findLoanInHousehold(householdId: string, loanId: string) {
  const [loan] = await db.select().from(loans).where(and(eq(loans.id, loanId), eq(loans.householdId, householdId)));
  return loan;
}
```

Each action uses `const member = await getCurrentMember(); const { householdId } = member;` (keep `name: actorName` where it's already destructured).

- `createLoanAction`: `const [created] = await db.insert(loans).values({ …unchanged… }).returning();` then log `{ action: "created", entityId: created.id, entityType: "loan", summary: loanSummary(f, created) }`.
- `updateLoanAction`: after validation `const before = await findLoanInHousehold(householdId, id); if (!before) return;`, keep the update, then log `{ action: "updated", changes: loanChanges(f, before, parsed), entityId: id, entityType: "loan", summary: loanSummary(f, parsed) }`.
- `deleteLoanAction`: `const before = await findLoanInHousehold(householdId, id); if (!before) return;`, keep the delete, then log `{ action: "deleted", entityId: id, entityType: "loan", summary: loanSummary(f, before) }`.
- `addLoanPaymentAction`: after `insertNotification(...)` log `{ action: "created", entityId: created.id, entityType: "loan_payment", summary: loanPaymentSummary(f, created, loan) }`.
- `deleteLoanPaymentAction`: change `await getLoanInHousehold(householdId, payment.loanId);` to `const loan = await getLoanInHousehold(householdId, payment.loanId);`, keep the delete, then log `{ action: "deleted", entityId: id, entityType: "loan_payment", summary: loanPaymentSummary(f, payment, loan) }`.

Every log call has the shape:

```ts
  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), { /* entry above */ });
```

placed after the write and before the `revalidateLoansPaths()` call.

- [ ] **Step 6: Verify and commit**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; PASS.

```bash
npm run lint -- --fix
git add src/modules/loans
git commit -m "feat(activity): log loan and loan payment changes"
```

---

### Task 7: Log dhukus and dhuku entries

**Files:**
- Create: `src/modules/dhuku/lib/dhuku-activity.ts`, `dhuku-activity.test.ts`
- Modify: `src/modules/dhuku/api/dhuku.actions.ts`

**Interfaces:**
- Consumes: Task 1 + Task 2 APIs.
- Produces: `DhukuSnapshot`, `dhukuSummary(f, dhuku)`, `dhukuChanges(f, before, after)`, `dhukuEntrySummary(f, entry, dhukuName)`.

- [ ] **Step 1: Write the failing test**

`src/modules/dhuku/lib/dhuku-activity.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { testFormatters } from "@/modules/activity/lib/test-formatters";

import { dhukuChanges, dhukuEntrySummary, type DhukuSnapshot, dhukuSummary } from "./dhuku-activity";

const f = testFormatters();
const dhuku: DhukuSnapshot = {
  interestPerMonth: null,
  monthlyContribution: "10000.00",
  name: "Office dhuku",
  note: null,
  ownerMemberId: null,
  startDate: "2026-01-01",
  totalMembers: 12,
};

describe("dhuku activity", () => {
  it("summarises a dhuku", () => {
    expect(dhukuSummary(f, dhuku)).toBe("Office dhuku · RS 10,000/month · 12 members");
  });

  it("diffs dhuku fields", () => {
    expect(dhukuChanges(f, dhuku, { ...dhuku, interestPerMonth: 500, totalMembers: 10 })).toEqual([
      { field: "Members", from: "12", to: "10" },
      { field: "Interest per month", from: null, to: "RS 500" },
    ]);
  });

  it("summarises an entry by type", () => {
    expect(dhukuEntrySummary(f, { amount: "120000.00", type: "payout" }, "Office dhuku")).toBe("Payout · RS 120,000 · Office dhuku");
    expect(dhukuEntrySummary(f, { amount: 10000, type: "contribution" }, "Office dhuku")).toBe(
      "Contribution · RS 10,000 · Office dhuku",
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/modules/dhuku/lib/dhuku-activity.test.ts`
Expected: FAIL — cannot resolve `./dhuku-activity`.

- [ ] **Step 3: Implement**

`src/modules/dhuku/lib/dhuku-activity.ts`:

```ts
import type { ActivityFormatters } from "@/modules/activity/lib/activity-values";
import { diffFields } from "@/modules/activity/lib/diff";

export type DhukuSnapshot = {
  interestPerMonth?: null | number | string;
  monthlyContribution: number | string;
  name: string;
  note?: null | string;
  ownerMemberId: null | string;
  startDate: string;
  totalMembers: number;
};

// "Office dhuku · RS 10,000/month · 12 members"
export function dhukuSummary(f: ActivityFormatters, dhuku: DhukuSnapshot): string {
  return `${dhuku.name} · ${f.money(dhuku.monthlyContribution)}/month · ${dhuku.totalMembers} members`;
}

export function dhukuChanges(f: ActivityFormatters, before: DhukuSnapshot, after: DhukuSnapshot) {
  return diffFields(before, after, [
    { format: f.text, key: "name", label: "Name" },
    { format: f.text, key: "totalMembers", label: "Members" },
    { format: f.money, key: "monthlyContribution", label: "Monthly contribution" },
    { format: f.money, key: "interestPerMonth", label: "Interest per month" },
    { format: f.date, key: "startDate", label: "Start date" },
    { format: f.owner, key: "ownerMemberId", label: "For" },
    { format: f.text, key: "note", label: "Note" },
  ]);
}

// "Payout · RS 120,000 · Office dhuku"
export function dhukuEntrySummary(
  f: ActivityFormatters,
  entry: { amount: number | string; type: string },
  dhukuName: string,
): string {
  return `${entry.type === "payout" ? "Payout" : "Contribution"} · ${f.money(entry.amount)} · ${dhukuName}`;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/modules/dhuku/lib/dhuku-activity.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire logging into the dhuku actions**

In `src/modules/dhuku/api/dhuku.actions.ts` add:

```ts
import { activityActor, loadActivityFormatters, logActivity } from "@/modules/activity/api/activity";
import { dhukuChanges, dhukuEntrySummary, dhukuSummary } from "@/modules/dhuku/lib/dhuku-activity";
```

and:

```ts
async function findDhukuInHousehold(householdId: string, dhukuId: string) {
  const [dhuku] = await db.select().from(dhukus).where(and(eq(dhukus.id, dhukuId), eq(dhukus.householdId, householdId)));
  return dhuku;
}
```

Each action uses `const member = await getCurrentMember(); const { householdId } = member;`, and each log is

```ts
  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), { /* entry */ });
```

after the write, before `revalidateDhukuPaths()`:

- `createDhukuAction`: `const [created] = await db.insert(dhukus).values({ …unchanged… }).returning();` → `{ action: "created", entityId: created.id, entityType: "dhuku", summary: dhukuSummary(f, created) }`.
- `updateDhukuAction`: `const before = await findDhukuInHousehold(householdId, id); if (!before) return;` → `{ action: "updated", changes: dhukuChanges(f, before, parsed), entityId: id, entityType: "dhuku", summary: dhukuSummary(f, parsed) }`.
- `deleteDhukuAction`: `const before = await findDhukuInHousehold(householdId, id); if (!before) return;` → `{ action: "deleted", entityId: id, entityType: "dhuku", summary: dhukuSummary(f, before) }`.
- `addDhukuEntryAction` (after the notification): `{ action: "created", entityId: created.id, entityType: "dhuku_entry", summary: dhukuEntrySummary(f, created, dhuku.name) }`.
- `deleteDhukuEntryAction`: `const dhuku = await getDhukuInHousehold(householdId, entry.dhukuId);` → `{ action: "deleted", entityId: id, entityType: "dhuku_entry", summary: dhukuEntrySummary(f, entry, dhuku.name) }`.

- [ ] **Step 6: Verify and commit**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; PASS.

```bash
npm run lint -- --fix
git add src/modules/dhuku
git commit -m "feat(activity): log dhuku and dhuku entry changes"
```

---

### Task 8: Log recurring bills (incl. mark paid)

**Files:**
- Create: `src/modules/recurring/lib/recurring-activity.ts`, `recurring-activity.test.ts`
- Modify: `src/modules/recurring/api/recurring.actions.ts`

**Interfaces:**
- Consumes: Task 1 + Task 2 APIs; `expenseSummary` (Task 3).
- Produces: `RecurringSnapshot`, `recurringSummary(f, item)`, `recurringChanges(f, before, after)`.

- [ ] **Step 1: Write the failing test**

`src/modules/recurring/lib/recurring-activity.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { testFormatters } from "@/modules/activity/lib/test-formatters";

import { recurringChanges, type RecurringSnapshot, recurringSummary } from "./recurring-activity";

const f = testFormatters();
const item: RecurringSnapshot = {
  amount: "1500.00",
  categoryId: "cat-1",
  endDate: null,
  frequency: "monthly",
  icon: "wifi",
  name: "Internet",
  nextDueDate: "2026-10-15",
  ownerMemberId: null,
  vendor: null,
};

describe("recurring activity", () => {
  it("summarises a recurring bill", () => {
    expect(recurringSummary(f, item)).toBe("Internet · RS 1,500 monthly · Groceries");
  });

  it("diffs recurring fields", () => {
    expect(recurringChanges(f, item, { ...item, amount: 1800, nextDueDate: "2026-10-20", vendor: "WorldLink" })).toEqual([
      { field: "Amount", from: "RS 1,500", to: "RS 1,800" },
      { field: "Next due", from: "15 October 2026", to: "20 October 2026" },
      { field: "Vendor", from: null, to: "WorldLink" },
    ]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/modules/recurring/lib/recurring-activity.test.ts`
Expected: FAIL — cannot resolve `./recurring-activity`.

- [ ] **Step 3: Implement**

`src/modules/recurring/lib/recurring-activity.ts`:

```ts
import type { ActivityFormatters } from "@/modules/activity/lib/activity-values";
import { diffFields } from "@/modules/activity/lib/diff";

export type RecurringSnapshot = {
  amount: number | string;
  categoryId: string;
  endDate?: null | string;
  frequency: string;
  icon: string;
  name: string;
  nextDueDate: string;
  ownerMemberId: null | string;
  vendor?: null | string;
};

// "Internet · RS 1,500 monthly · Bills"
export function recurringSummary(f: ActivityFormatters, item: RecurringSnapshot): string {
  return [item.name, `${f.money(item.amount)} ${item.frequency}`, f.category(item.categoryId)].filter(Boolean).join(" · ");
}

export function recurringChanges(f: ActivityFormatters, before: RecurringSnapshot, after: RecurringSnapshot) {
  return diffFields(before, after, [
    { format: f.text, key: "name", label: "Name" },
    { format: f.money, key: "amount", label: "Amount" },
    { format: f.category, key: "categoryId", label: "Category" },
    { format: f.text, key: "frequency", label: "Frequency" },
    { format: f.date, key: "nextDueDate", label: "Next due" },
    { format: f.date, key: "endDate", label: "Ends" },
    { format: f.owner, key: "ownerMemberId", label: "For" },
    { format: f.text, key: "vendor", label: "Vendor" },
    { format: f.text, key: "icon", label: "Icon" },
  ]);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/modules/recurring/lib/recurring-activity.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire logging into the recurring actions**

In `src/modules/recurring/api/recurring.actions.ts` add:

```ts
import { activityActor, loadActivityFormatters, logActivities, logActivity } from "@/modules/activity/api/activity";
import { expenseSummary } from "@/modules/expenses/lib/expense-activity";
import { recurringChanges, recurringSummary } from "@/modules/recurring/lib/recurring-activity";
```

and:

```ts
async function findRecurringInHousehold(householdId: string, id: string) {
  const [item] = await db
    .select()
    .from(recurringExpenses)
    .where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.householdId, householdId)));
  return item;
}
```

- `createRecurringExpenseAction`: `const member = …`; `const [created] = await db.insert(recurringExpenses).values({ …unchanged… }).returning();` → log `{ action: "created", entityId: created.id, entityType: "recurring_expense", summary: recurringSummary(f, created) }`.
- `updateRecurringExpenseAction`: `const before = await findRecurringInHousehold(householdId, id); if (!before) return;` → log `{ action: "updated", changes: recurringChanges(f, before, parsed), entityId: id, entityType: "recurring_expense", summary: recurringSummary(f, parsed) }`.
- `deleteRecurringExpenseAction`: `const before = …; if (!before) return;` → log `{ action: "deleted", entityId: id, entityType: "recurring_expense", summary: recurringSummary(f, before) }`.

Replace `setRecurringStatus` and its three callers:

```ts
async function setRecurringStatus(
  id: string,
  status: "active" | "completed" | "paused",
  action: "completed" | "paused" | "resumed",
) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const before = await findRecurringInHousehold(householdId, id);
  if (!before || before.status === status) return;

  await db
    .update(recurringExpenses)
    .set({ status })
    .where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.householdId, householdId)));

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action,
    entityId: id,
    entityType: "recurring_expense",
    summary: recurringSummary(f, before),
  });

  revalidateRecurringPaths();
}

export async function pauseRecurringExpenseAction(id: string) {
  await setRecurringStatus(id, "paused", "paused");
}

export async function resumeRecurringExpenseAction(id: string) {
  await setRecurringStatus(id, "active", "resumed");
}

export async function completeRecurringExpenseAction(id: string) {
  await setRecurringStatus(id, "completed", "completed");
}
```

`markRecurringExpensePaidAction`: replace `const { householdId, memberId } = await getCurrentMember();` with `const member = await getCurrentMember(); const { householdId, memberId } = member;`. Make the transaction return the created expense:

```ts
  const createdExpense = await db.transaction(async (tx) => {
    const [expense] = await tx
      .insert(expenses)
      .values({ /* unchanged values */ })
      .returning();

    await tx
      .update(recurringExpenses)
      .set({ nextDueDate, status: isLastOccurrence ? "completed" : item.status })
      .where(eq(recurringExpenses.id, id));

    return expense;
  });

  // Two entries: the bill being marked paid, and the real expense it created
  // (so the expense also shows up under the Expenses section filter).
  const f = await loadActivityFormatters(householdId);
  await logActivities(activityActor(member), [
    {
      action: "paid",
      entityId: item.id,
      entityType: "recurring_expense",
      summary: `${recurringSummary(f, item)} · for ${f.date(item.nextDueDate)}`,
    },
    {
      action: "created",
      entityId: createdExpense.id,
      entityType: "expense",
      summary: expenseSummary(f, createdExpense),
    },
  ]);
```

- [ ] **Step 6: Verify and commit**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; PASS.

```bash
npm run lint -- --fix
git add src/modules/recurring
git commit -m "feat(activity): log recurring bill changes and payments"
```

---

### Task 9: Log categories, household settings and account changes

**Files:**
- Create: `src/modules/categories/lib/category-activity.ts`, `category-activity.test.ts`
- Create: `src/modules/settings/lib/settings-activity.ts`, `settings-activity.test.ts`
- Modify: `src/modules/categories/api/categories.actions.ts`
- Modify: `src/modules/settings/api/settings.actions.ts`

**Interfaces:**
- Consumes: Task 1 + Task 2 APIs.
- Produces: `CategorySnapshot`, `categorySummary(category)`, `categoryChanges(before, after)`, `dateFormatChanges(before, after)`, `plannerChanges(before, after)`, `dateFormatLabel(value)`.

- [ ] **Step 1: Write the failing tests**

`src/modules/categories/lib/category-activity.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { categoryChanges, categorySummary } from "./category-activity";

const category = { budgetType: "flexible", groupName: "Household", name: "Groceries" };

describe("category activity", () => {
  it("summarises a category", () => {
    expect(categorySummary(category)).toBe("Groceries · Household · Flexible");
  });

  it("diffs name, group and type", () => {
    expect(categoryChanges(category, { ...category, budgetType: "fixed", name: "Food" })).toEqual([
      { field: "Name", from: "Groceries", to: "Food" },
      { field: "Type", from: "Flexible", to: "Fixed" },
    ]);
  });
});
```

`src/modules/settings/lib/settings-activity.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { dateFormatChanges, dateFormatLabel, plannerChanges } from "./settings-activity";

describe("settings activity", () => {
  it("labels date formats", () => {
    expect(dateFormatLabel("nepali")).toBe("Nepali (BS)");
    expect(dateFormatLabel("english")).toBe("English (AD)");
  });

  it("diffs the date format and planner toggle, or reports nothing when unchanged", () => {
    expect(dateFormatChanges("nepali", "english")).toEqual([{ field: "Date format", from: "Nepali (BS)", to: "English (AD)" }]);
    expect(dateFormatChanges("nepali", "nepali")).toEqual([]);
    expect(plannerChanges(false, true)).toEqual([{ field: "AI budget planner", from: "Off", to: "On" }]);
    expect(plannerChanges(true, true)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/modules/categories/lib/category-activity.test.ts src/modules/settings/lib/settings-activity.test.ts`
Expected: FAIL — cannot resolve modules.

- [ ] **Step 3: Implement**

`src/modules/categories/lib/category-activity.ts`:

```ts
import { diffFields } from "@/modules/activity/lib/diff";

export type CategorySnapshot = { budgetType: string; groupName: string; name: string };

function budgetTypeLabel(value: unknown): null | string {
  if (value === "fixed") return "Fixed";
  if (value === "flexible") return "Flexible";
  return null;
}

function text(value: unknown): null | string {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

// "Groceries · Household · Flexible"
export function categorySummary(category: CategorySnapshot): string {
  return [category.name, category.groupName, budgetTypeLabel(category.budgetType)].filter(Boolean).join(" · ");
}

export function categoryChanges(before: CategorySnapshot, after: CategorySnapshot) {
  return diffFields(before, after, [
    { format: text, key: "name", label: "Name" },
    { format: text, key: "groupName", label: "Group" },
    { format: budgetTypeLabel, key: "budgetType", label: "Type" },
  ]);
}
```

`src/modules/settings/lib/settings-activity.ts`:

```ts
import { diffFields } from "@/modules/activity/lib/diff";

export function dateFormatLabel(value: unknown): null | string {
  if (value === "nepali") return "Nepali (BS)";
  if (value === "english") return "English (AD)";
  return null;
}

function onOff(value: unknown): string {
  return value ? "On" : "Off";
}

export function dateFormatChanges(before: string, after: string) {
  return diffFields({ dateFormat: before }, { dateFormat: after }, [
    { format: dateFormatLabel, key: "dateFormat", label: "Date format" },
  ]);
}

export function plannerChanges(before: boolean, after: boolean) {
  return diffFields({ plannerEnabled: before }, { plannerEnabled: after }, [
    { format: onOff, key: "plannerEnabled", label: "AI budget planner" },
  ]);
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run src/modules/categories/lib/category-activity.test.ts src/modules/settings/lib/settings-activity.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire logging into categories**

In `src/modules/categories/api/categories.actions.ts` add:

```ts
import { activityActor, logActivity } from "@/modules/activity/api/activity";

import { categoryChanges, categorySummary } from "../lib/category-activity";
```

and:

```ts
async function findCategoryInHousehold(householdId: string, id: string) {
  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.householdId, householdId)));
  return category;
}

async function setCategoryArchived(id: string, archived: boolean) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const before = await findCategoryInHousehold(householdId, id);
  if (!before || before.archived === archived) return;

  await db
    .update(categories)
    .set({ archived })
    .where(and(eq(categories.id, id), eq(categories.householdId, householdId)));

  await logActivity(activityActor(member), {
    action: archived ? "archived" : "restored",
    entityId: id,
    entityType: "category",
    summary: categorySummary(before),
  });

  revalidateCategoryPaths();
}
```

Replace the bodies of `archiveCategoryAction` / `restoreCategoryAction` (keep the existing "archived, never hard-deleted" comment above `archiveCategoryAction`) with `await setCategoryArchived(id, true);` / `await setCategoryArchived(id, false);`.

`createCategoryAction`: `const member = await getCurrentMember(); const { householdId } = member;`, then after the insert:

```ts
  await logActivity(activityActor(member), {
    action: "created",
    entityId: category.id,
    entityType: "category",
    summary: categorySummary(category),
  });
```

`updateCategoryAction`: `const before = await findCategoryInHousehold(householdId, id); if (!before) return;`, keep the update, then:

```ts
  await logActivity(activityActor(member), {
    action: "updated",
    changes: categoryChanges(before, parsed),
    entityId: id,
    entityType: "category",
    summary: categorySummary(parsed),
  });
```

- [ ] **Step 6: Wire logging into settings**

In `src/modules/settings/api/settings.actions.ts` add:

```ts
import { activityActor, logActivity } from "@/modules/activity/api/activity";

import { dateFormatChanges, dateFormatLabel, plannerChanges } from "../lib/settings-activity";
```

`changePasswordAction`: `const member = await getCurrentMember(); const { userId } = member;` and after the password update:

```ts
  // No detail beyond the fact it happened.
  await logActivity(activityActor(member), {
    action: "updated",
    entityId: member.memberId,
    entityType: "account",
    summary: "Changed their password",
  });
```

`updateProfileImageAction`: same pattern, `summary: "Changed their profile photo"`, before `revalidatePath`.

`setDateFormatAction`:

```ts
export async function setDateFormatAction(format: string) {
  if (!isDateFormat(format)) throw new Error("Invalid date format");

  const member = await getCurrentMember();
  const { householdId } = member;
  const [before] = await db.select().from(households).where(eq(households.id, householdId));
  await db.update(households).set({ dateFormat: format }).where(eq(households.id, householdId));

  await logActivity(activityActor(member), {
    action: "updated",
    changes: dateFormatChanges(before.dateFormat, format),
    entityId: householdId,
    entityType: "household_settings",
    summary: `Date format → ${dateFormatLabel(format)}`,
  });
  revalidatePath("/", "layout");
}
```

`setPlannerEnabledAction`: same shape with `plannerChanges(before.plannerEnabled, enabled)` and `summary: \`AI budget planner → ${enabled ? "On" : "Off"}\``.

- [ ] **Step 7: Verify and commit**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; PASS. Then confirm coverage: `grep -rn "db\.\(insert\|update\|delete\)\|tx\.\(insert\|update\|delete\)" src/modules/*/api/*.actions.ts` — every hit is either followed by a `logActivity`/`logActivities` call in the same function or is in the spec's "Not logged" list (notifications, app-releases, `getOrCreateMonthlyBudget`, loan `nextInstallmentDate` roll-forward inside the payment transaction).

```bash
npm run lint -- --fix
git add src/modules/categories src/modules/settings
git commit -m "feat(activity): log category, household settings and account changes"
```

---

### Task 10: Activity page, route and nav

**Files:**
- Create: `src/modules/activity/lib/activity-days.ts`, `activity-days.test.ts`
- Create: `src/modules/activity/components/ActivityFilters.tsx`
- Create: `src/modules/activity/components/ActivityRow.tsx`
- Create: `src/modules/activity/components/ActivityTimeline.tsx`
- Create: `src/modules/activity/pages/ActivityPage.tsx`
- Create: `src/modules/activity/index.tsx`
- Create: `src/app/(app)/activity/page.tsx`
- Modify: `src/components/nav/SidebarNav.tsx` (NAV_ITEMS + lucide import)
- Modify: `src/components/nav/BottomNav.tsx` (MORE_ITEMS + lucide import)
- Modify: `src/components/RowActionsMenu.tsx` (add `aria-label="Row actions"` to the trigger button — used by the Task 11 e2e test, and an a11y fix)
- Modify: `e2e/navigation.spec.ts` (routes list)

**Interfaces:**
- Consumes: `listActivity`, `ACTIVITY_PAGE_SIZE` (Task 2); `parseActivityFilters` (Task 2); `activityHref`, `ActivityFilterParams` (Task 1); `ACTIVITY_SECTIONS`, `ACTION_GROUPS`, `sectionForEntityType` (Task 1); `describeActivity` (Task 1); `formatKathmanduTime`, `kathmanduDateKey` (Task 1); `ActivityLog` (Task 1); `ToneIcon`, `Avatar`, `Badge`.
- Produces: `groupActivityByDay<T extends { createdAt: Date }>(entries: T[], dateFormat: DateFormat, now: Date): ActivityDay<T>[]`; route `/activity`.

- [ ] **Step 1: Write the failing day-grouping test**

`src/modules/activity/lib/activity-days.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { groupActivityByDay } from "./activity-days";

// 2026-10-04 10:00 in Kathmandu.
const NOW = new Date("2026-10-04T04:15:00Z");

describe("groupActivityByDay", () => {
  it("groups newest-first entries under Kathmandu-day headings", () => {
    const entries = [
      { createdAt: new Date("2026-10-04T02:00:00Z"), id: "a" },
      { createdAt: new Date("2026-10-03T18:20:00Z"), id: "b" }, // 00:05 on the 4th in Kathmandu
      { createdAt: new Date("2026-10-03T18:10:00Z"), id: "c" }, // 23:55 on the 3rd
      { createdAt: new Date("2026-09-28T06:00:00Z"), id: "d" },
    ];

    const days = groupActivityByDay(entries, "english", NOW);

    expect(days.map((d) => [d.label, d.entries.map((e) => e.id)])).toEqual([
      ["Today", ["a", "b"]],
      ["Yesterday", ["c"]],
      ["28 September 2026", ["d"]],
    ]);
  });

  it("uses the household's BS calendar for older days", () => {
    const days = groupActivityByDay([{ createdAt: new Date("2026-09-28T06:00:00Z") }], "nepali", NOW);
    expect(days[0].label).toBe("12 Ashwin 2083");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/modules/activity/lib/activity-days.test.ts`
Expected: FAIL — cannot resolve `./activity-days`.

- [ ] **Step 3: Implement day grouping**

`src/modules/activity/lib/activity-days.ts`:

```ts
import { formatDate } from "@/lib/date-format";
import type { DateFormat } from "@/lib/date-format-cookie";

import { kathmanduDateKey } from "./activity-time";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ActivityDay<T> = { dateKey: string; entries: T[]; label: string };

// Entries arrive newest first, so consecutive entries sharing a Kathmandu day
// form one group.
export function groupActivityByDay<T extends { createdAt: Date }>(
  entries: T[],
  dateFormat: DateFormat,
  now: Date,
): ActivityDay<T>[] {
  const todayKey = kathmanduDateKey(now);
  const yesterdayKey = kathmanduDateKey(new Date(now.getTime() - DAY_MS));

  const days: ActivityDay<T>[] = [];
  for (const entry of entries) {
    const dateKey = kathmanduDateKey(entry.createdAt);
    let day = days.at(-1);
    if (day?.dateKey !== dateKey) {
      const label = dateKey === todayKey ? "Today" : dateKey === yesterdayKey ? "Yesterday" : formatDate(dateKey, dateFormat);
      day = { dateKey, entries: [], label };
      days.push(day);
    }
    day.entries.push(entry);
  }
  return days;
}
```

Run: `npx vitest run src/modules/activity/lib/activity-days.test.ts`
Expected: PASS. (If the BS label differs by a day, check `adToBs("2026-09-28")` in a REPL and correct the expected string — the assertion is about using the BS calendar, not this exact date.)

- [ ] **Step 4: Build the row and timeline (server components)**

`src/modules/activity/components/ActivityRow.tsx`:

```tsx
import { HandCoins, List, type LucideIcon, PiggyBank, Receipt, Repeat, Settings, Users, Wallet } from "lucide-react";

import { type Tone, ToneIcon } from "@/components/ToneIcon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { ActivityAction, ActivityLog } from "@/db/schema";

import { describeActivity } from "../lib/activity-format";
import { formatKathmanduTime } from "../lib/activity-time";
import { type ActivitySection, sectionForEntityType } from "../lib/sections";

const SECTION_ICONS: Record<ActivitySection, LucideIcon> = {
  budget: Wallet,
  categories: List,
  dhuku: Users,
  expenses: Receipt,
  loans: HandCoins,
  recurring: Repeat,
  savings: PiggyBank,
  settings: Settings,
};

const ACTION_TONES: Record<ActivityAction, Tone> = {
  archived: "blue",
  completed: "blue",
  created: "green",
  deleted: "pink",
  paid: "green",
  paused: "blue",
  restored: "blue",
  resumed: "blue",
  updated: "amber",
};

type Props = { actorImage: null | string; entry: ActivityLog };

export function ActivityRow({ actorImage, entry }: Props) {
  const changes = entry.changes ?? [];

  return (
    <li className="flex gap-3 px-4 py-3">
      <ToneIcon icon={SECTION_ICONS[sectionForEntityType(entry.entityType)]} tone={ACTION_TONES[entry.action]} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Avatar className="h-5 w-5">
            {actorImage && <AvatarImage alt="" src={actorImage} />}
            <AvatarFallback className="text-[10px]">{entry.actorName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <p className="text-sm">
            <span className="font-medium">{entry.actorName}</span> {describeActivity(entry.action, entry.entityType)}
          </p>
          {entry.source === "mobile" && (
            <Badge className="text-[10px]" variant="outline">
              via mobile
            </Badge>
          )}
          <time className="ml-auto text-xs text-muted-foreground" dateTime={entry.createdAt.toISOString()}>
            {formatKathmanduTime(entry.createdAt)}
          </time>
        </div>
        <p className="text-sm break-words text-muted-foreground">{entry.summary}</p>
        {changes.length > 0 && (
          <details className="group text-sm">
            <summary className="cursor-pointer text-xs font-medium text-primary select-none">
              Show changes ({changes.length})
            </summary>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-muted px-3 py-2">
              {changes.map((change) => (
                <div className="contents" key={change.field}>
                  <dt className="text-muted-foreground">{change.field}</dt>
                  <dd className="break-words">
                    <span className="line-through opacity-60">{change.from ?? "—"}</span> → {change.to ?? "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        )}
      </div>
    </li>
  );
}
```

`src/modules/activity/components/ActivityTimeline.tsx`:

```tsx
import type { ActivityLog } from "@/db/schema";
import type { DateFormat } from "@/lib/date-format-cookie";

import { groupActivityByDay } from "../lib/activity-days";
import { ActivityRow } from "./ActivityRow";

type Props = { dateFormat: DateFormat; entries: ActivityLog[]; memberImages: Map<string, null | string> };

export function ActivityTimeline({ dateFormat, entries, memberImages }: Props) {
  const days = groupActivityByDay(entries, dateFormat, new Date());

  return (
    <div className="space-y-4">
      {days.map((day) => (
        <section aria-label={day.label} key={day.dateKey}>
          <h2 className="px-1 pb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{day.label}</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {day.entries.map((entry) => (
              <ActivityRow
                actorImage={entry.actorMemberId ? (memberImages.get(entry.actorMemberId) ?? null) : null}
                entry={entry}
                key={entry.id}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Build the filter bar (client component)**

`src/modules/activity/components/ActivityFilters.tsx`:

```tsx
"use client";

import { useState } from "react";

import { CalendarDays, Search } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { activityHref, type ActivityFilterParams } from "../lib/activity-query";
import { ACTION_GROUPS, ACTIVITY_SECTIONS } from "../lib/sections";

const ALL = "all";

type Props = { members: { id: string; name: string }[]; realMemberId: string; value: ActivityFilterParams };

// Filters live in the URL (so a filtered view can be shared or reloaded); the
// server page re-queries on every change.
export function ActivityFilters({ members, realMemberId, value }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(value.q ?? "");
  const hasActiveFilters = Boolean(value.action || value.from || value.member || value.q || value.section || value.to);

  // Any filter change starts again from the newest entries, so the cursor is dropped.
  function apply(patch: Partial<ActivityFilterParams>) {
    router.replace(activityHref({ ...value, ...patch, cursor: undefined }));
  }

  function clearFilters() {
    setQuery("");
    router.replace("/activity");
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2 shadow-[0_2px_12px_rgba(102,45,145,0.06)]">
      <form
        className="relative min-w-48 flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q: query.trim() || undefined });
        }}
        role="search"
      >
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search activity"
          className="bg-muted pl-8"
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search activity..."
          value={query}
        />
      </form>

      <label className="flex items-center gap-1.5 rounded-lg border border-input bg-muted px-2.5 py-1.5 text-sm text-foreground">
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          aria-label="From date"
          className="w-28 bg-transparent outline-none"
          onChange={(e) => apply({ from: e.target.value || undefined })}
          type="date"
          value={value.from ?? ""}
        />
        <span className="text-muted-foreground/60">to</span>
        <input
          aria-label="To date"
          className="w-28 bg-transparent outline-none"
          onChange={(e) => apply({ to: e.target.value || undefined })}
          type="date"
          value={value.to ?? ""}
        />
      </label>

      <div className="mx-1 h-5 w-px shrink-0 bg-border" />

      <Select onValueChange={(v) => apply({ member: v === ALL ? undefined : v })} value={value.member ?? ALL}>
        <SelectTrigger aria-label="Member" className="text-muted-foreground" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Anyone</SelectItem>
          {members.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.id === realMemberId ? "Me" : m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select onValueChange={(v) => apply({ section: v === ALL ? undefined : v })} value={value.section ?? ALL}>
        <SelectTrigger aria-label="Section" className="text-muted-foreground" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All sections</SelectItem>
          {ACTIVITY_SECTIONS.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select onValueChange={(v) => apply({ action: v === ALL ? undefined : v })} value={value.action ?? ALL}>
        <SelectTrigger aria-label="Action" className="text-muted-foreground" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Any action</SelectItem>
          {ACTION_GROUPS.map((g) => (
            <SelectItem key={g.value} value={g.value}>
              {g.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button className="ml-auto text-muted-foreground" disabled={!hasActiveFilters} onClick={clearFilters} type="button" variant="ghost">
        Clear filters
      </Button>
    </div>
  );
}
```

- [ ] **Step 6: Build the page, module surface and route**

`src/modules/activity/pages/ActivityPage.tsx`:

```tsx
import Link from "next/link";

import { getDateFormatPref } from "@/lib/date-format-cookie";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";

import { listActivity } from "../api/activity";
import { ActivityFilters } from "../components/ActivityFilters";
import { ActivityTimeline } from "../components/ActivityTimeline";
import { activityHref, type ActivityFilterParams } from "../lib/activity-query";
import { parseActivityFilters } from "../schemas/activity-filter.schema";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function ActivityPage({ searchParams }: Props) {
  const { householdId, memberId } = await getCurrentMember();
  const [members, dateFormat, rawParams] = await Promise.all([
    getHouseholdMembers(householdId),
    getDateFormatPref(householdId),
    searchParams,
  ]);

  const filters = parseActivityFilters(rawParams, new Set(members.map((m) => m.id)));
  const { entries, nextCursor } = await listActivity(householdId, filters);

  const params: ActivityFilterParams = {
    action: filters.action,
    from: filters.from,
    member: filters.member,
    q: filters.q,
    section: filters.section,
    to: filters.to,
  };
  const hasFilters = Object.values(params).some(Boolean);

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">Activity</h1>
        <p className="text-sm text-muted-foreground">Who added, edited or deleted what across the household</p>
      </div>

      <ActivityFilters
        members={members.map((m) => ({ id: m.id, name: m.user.name }))}
        realMemberId={memberId}
        value={params}
      />

      {entries.length === 0 ? (
        <p className="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          {hasFilters || filters.cursor
            ? "No activity matches these filters."
            : "No activity yet. Changes anyone in the household makes will show up here."}
        </p>
      ) : (
        <ActivityTimeline
          dateFormat={dateFormat}
          entries={entries}
          memberImages={new Map(members.map((m) => [m.id, m.user.image]))}
        />
      )}

      {(filters.cursor || nextCursor) && (
        <nav aria-label="Activity pages" className="flex items-center justify-between text-sm font-medium text-primary">
          {filters.cursor ? <Link href={activityHref(params)}>← Back to newest</Link> : <span />}
          {nextCursor && <Link href={activityHref({ ...params, cursor: nextCursor })}>Older activity →</Link>}
        </nav>
      )}
    </>
  );
}
```

`src/modules/activity/index.tsx`:

```tsx
export { ActivityPage } from "./pages/ActivityPage";
```

`src/app/(app)/activity/page.tsx`:

```tsx
import type { Metadata } from "next";

export { ActivityPage as default } from "@/modules/activity";

export const metadata: Metadata = { title: "Activity" };
```

- [ ] **Step 7: Add nav entries, the row-actions label and the navigation e2e route**

`src/components/nav/SidebarNav.tsx`: add `History` to the lucide import list and insert after the Notifications item:

```ts
  { href: "/activity", label: "Activity", icon: History, enabled: true },
```

`src/components/nav/BottomNav.tsx`: add `History` to the lucide import and insert into `MORE_ITEMS` after Notifications:

```ts
  { href: "/activity", label: "Activity", icon: History },
```

`src/components/RowActionsMenu.tsx`: add `aria-label="Row actions"` to the trigger `<button>`.

`e2e/navigation.spec.ts`: insert after the Notifications route:

```ts
  { label: "Activity", path: "/activity", title: "Activity · Piko" },
```

- [ ] **Step 8: Verify in the browser and commit**

Run: `npx tsc --noEmit && npx vitest run && npm run lint`
Expected: clean; PASS.

Run `npm run dev`, sign in, add an expense, edit its amount, then open `/activity`: the entries appear under "Today" with Kathmandu times, the edit row's "Show changes (1)" expands to `Amount RS … → RS …`, each filter updates the URL and the list, and "Clear filters" resets. Check at phone width (bottom nav → More → Activity) — the filter bar wraps without horizontal scroll.

```bash
npm run lint -- --fix
git add src/modules/activity "src/app/(app)/activity" src/components/nav src/components/RowActionsMenu.tsx e2e/navigation.spec.ts
git commit -m "feat(activity): activity page with filters, paging and nav entry"
```

---

### Task 11: End-to-end test and docs

**Files:**
- Create: `e2e/activity.spec.ts`
- Modify: `docs/architecture.md`

**Interfaces:**
- Consumes: the `/activity` page (Task 10), expense logging (Task 3), `gotoRoute` (`e2e/support/nav.ts`), the `Row actions` label (Task 10).

- [ ] **Step 1: Write the e2e spec**

`e2e/activity.spec.ts`:

```ts
import { expect, type Page, test } from "@playwright/test";

import { gotoRoute } from "./support/nav";

async function chooseFilter(page: Page, filter: string, option: string) {
  await page.getByRole("combobox", { name: filter }).click();
  await page.getByRole("option", { exact: true, name: option }).click();
}

test.describe("activity", () => {
  test("shows the activity page with its filters", async ({ page }) => {
    await gotoRoute(page, "/activity");

    await expect(page.getByRole("heading", { exact: true, name: "Activity" })).toBeVisible();
    await expect(page.getByPlaceholder("Search activity...")).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Section" })).toBeVisible();
  });

  // Writes to the seeded e2e database; the unique note keeps this test's
  // entries separate from anything other specs log in parallel.
  test("records an expense being added, edited and deleted", async ({ page }) => {
    const note = `activity-e2e-${Date.now()}`;

    await gotoRoute(page, "/expenses");
    await page.getByRole("complementary").getByRole("button", { exact: true, name: "+ Add Expense" }).click();
    const addDialog = page.getByRole("dialog");
    await addDialog.getByLabel("Amount").fill("1234");
    await addDialog.getByLabel("Note (optional)").fill(note);
    await addDialog.getByRole("button", { name: "Add Expense" }).click();
    await expect(addDialog).toBeHidden();

    await page.getByPlaceholder("Search expenses...").fill(note);
    const expenseRow = page.getByRole("row").filter({ hasText: note });
    await expenseRow.getByRole("button", { name: "Row actions" }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    const editDialog = page.getByRole("dialog");
    await editDialog.getByLabel("Amount").fill("4321");
    await editDialog.getByRole("button", { name: "Save changes" }).click();
    await expect(editDialog).toBeHidden();

    page.once("dialog", (dialog) => dialog.accept());
    await expenseRow.getByRole("button", { name: "Row actions" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await expect(expenseRow).toHaveCount(0);

    await gotoRoute(page, "/activity");
    await page.getByPlaceholder("Search activity...").fill(note);
    await page.getByPlaceholder("Search activity...").press("Enter");
    await expect(page).toHaveURL(/q=activity-e2e/);

    const entries = page.getByRole("listitem").filter({ hasText: note });
    await expect(entries).toHaveCount(3);
    await expect(entries.filter({ hasText: "added an expense" })).toHaveCount(1);
    await expect(entries.filter({ hasText: "deleted an expense" })).toHaveCount(1);

    const edited = entries.filter({ hasText: "edited an expense" });
    await edited.getByText("Show changes (1)").click();
    await expect(edited).toContainText("Amount");
    await expect(edited).toContainText("RS 1,234");
    await expect(edited).toContainText("RS 4,321");

    await chooseFilter(page, "Section", "Expenses");
    await chooseFilter(page, "Action", "Deleted");
    await expect(page).toHaveURL(/action=deleted/);
    await expect(entries).toHaveCount(1);
    await expect(entries).toContainText("deleted an expense");

    await chooseFilter(page, "Section", "Loans");
    await expect(page.getByText("No activity matches these filters.")).toBeVisible();

    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/activity" && url.search === "");
  });
});
```

- [ ] **Step 2: Run the e2e suite**

Run: `npm run test:e2e`
Expected: PASS for `activity.spec.ts`, `navigation.spec.ts` (now including Activity) and every existing spec. (This resets + seeds the `piko_e2e` database, applies the new migration, builds and serves on :3100.) If a selector doesn't match the real markup, fix the selector — not the app — unless the app is genuinely wrong.

- [ ] **Step 3: Update the architecture doc**

In `docs/architecture.md`:

Under **Domain model → System**, change the bullet to:

```markdown
- **System** — `notifications` (deduped via unique `(householdId, dedupeKey)`),
  `activity_logs` (append-only audit trail: actor, entity, action, display-ready
  summary + field diffs, web/mobile source; written by actions via `logActivity`,
  shown on `/activity`), `app_releases` (global, not per-household; published APK builds).
```

Under **Cross-cutting concerns**, add:

```markdown
- **Activity log** (`src/modules/activity/`): every household data mutation calls
  `logActivity(activityActor(member), entry)` after its write succeeds. Each module
  owns a pure `lib/<x>-activity.ts` (summary + `diffFields` specs) so field knowledge
  stays next to the fields. Values are formatted at write time (names, `formatNPR`,
  BS/AD dates) — never raw IDs or image data. An edit with no real change
  (`changes: []`) is skipped. Times/day filters use Asia/Kathmandu.
```

In **Task playbooks → Add a feature module**, add step:

```markdown
5. Log every mutation: add `lib/<x>-activity.ts` (summary + diff specs) and call
   `logActivity` after each write; add the entity type to `activityEntityTypeEnum`
   and to a section in `src/modules/activity/lib/sections.ts`.
```

In **Add a mobile endpoint**, add step:

```markdown
3. Pass `activityActor(auth, "mobile")` into the shared `...ForHousehold` core so the
   activity log records the change as coming from mobile.
```

- [ ] **Step 4: Refresh the graph and commit**

```bash
graphify update .
git add e2e/activity.spec.ts docs/architecture.md
git commit -m "test(e2e): activity log end to end; docs: activity log architecture"
```
