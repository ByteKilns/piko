# Activity log

## Problem

Two people share one household ledger, and there is no way to tell who
added, edited or deleted something — an expense, a savings contribution, a
budget line, a loan payment. When a number looks wrong, nobody can see what
happened to it. We need an append-only record of every household data change
(who, what, when, from where, and for edits what changed), browsable on its
own page with filters.

## Scope decisions (from brainstorming)

- **Visibility:** every member of the household sees the whole log. This
  matches existing visibility — every member already sees every expense,
  goal and loan, shared or personal.
- **No backfill.** Logging starts when this ships. Existing rows record who
  *paid*, not who *entered* them, so any reconstructed history would be wrong.
- **Edits show diffs** (`Amount: Rs 1,200 → Rs 1,500`), with readable values
  resolved at write time (category names, member names, "Shared") rather than
  IDs.
- **App-level logging, not DB triggers.** Only the app knows the actor (the
  session) and the source (web vs mobile), and only the app can render
  readable values.
- **Retention:** keep forever. A two-person household produces a few
  thousand rows a year.

## Data model

`src/db/schema/activityLogs.ts`, re-exported from `src/db/schema/index.ts`:

```ts
export const activityEntityTypeEnum = pgEnum("activity_entity_type", [
  "account", "budget_item", "category", "dhuku", "dhuku_entry", "expense",
  "household_settings", "income", "loan", "loan_payment", "recurring_expense",
  "savings_contribution", "savings_goal",
]);
export const activityActionEnum = pgEnum("activity_action", [
  "archived", "completed", "created", "deleted", "paid", "paused",
  "restored", "resumed", "updated",
]);
export const activitySourceEnum = pgEnum("activity_source", ["mobile", "web"]);

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
    // set null so a removed member's history survives; actorName is the snapshot
    actorMemberId: uuid("actor_member_id").references(() => householdMembers.id, { onDelete: "set null" }),
    actorName: text("actor_name").notNull(),
    entityType: activityEntityTypeEnum("entity_type").notNull(),
    // no FK: the entity may be deleted later and the log must remain
    entityId: uuid("entity_id"),
    action: activityActionEnum("action").notNull(),
    // human sentence fragment written at log time, e.g. "Groceries · Rs 1,200 (Shared)"
    summary: text("summary").notNull(),
    // for "updated": [{ field, from, to }] with display-ready strings; null otherwise
    changes: jsonb("changes").$type<ActivityChange[]>(),
    source: activitySourceEnum("source").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("activity_logs_household_created_idx").on(table.householdId, table.createdAt.desc())],
);
```

`ActivityChange = { field: string; from: string | null; to: string | null }`.

Migration via `npm run db:generate` + `npm run db:migrate`.

## Module: `src/modules/activity/`

```
activity/
  index.tsx                     # export { ActivityPage }
  pages/ActivityPage.tsx        # server component: reads searchParams, queries, renders
  components/
    ActivityFilters.tsx         # client: member / section / action / date range / search → URL
    ActivityTimeline.tsx        # day-grouped list
    ActivityRow.tsx             # one entry; expandable diff for "updated"
  api/
    activity.ts                 # logActivity(), listActivity() — Drizzle, no "use server"
  lib/
    diff.ts (+ .test.ts)        # diffFields(before, after, fieldSpecs) → ActivityChange[]
    sections.ts (+ .test.ts)    # section → entityType[] map, action-group → action[] map
    activity-format.ts          # verb + icon per entity/action for display
  schemas/activity-filter.schema.ts  # Zod parse of searchParams
```

### Writing: `logActivity`

```ts
type ActivityActor = { householdId: string; memberId: string; name: string; source: "mobile" | "web" };

logActivity(actor, { action, changes?, entityId, entityType, summary }): Promise<void>
```

- Lives in `activity/api/activity.ts`, imported by the other modules' actions
  (the same way they import `insertNotification`).
- `householdId` and actor always come from `getCurrentMember()` /
  `requireMobileAuth` — never from client input (golden rule).
- Called **after** the domain write succeeds. If the domain write throws,
  nothing is logged. If the log insert throws, the error propagates (the
  write already happened; the action surfaces the error rather than
  silently dropping the audit row).
- For `updated` / `deleted`, the action reads the current row first
  (already scoped by `householdId`) so the summary and diff describe what
  was really there. If the row isn't found (wrong household / already
  deleted), nothing is written and nothing is logged.
- An update whose diff is empty (nothing actually changed) is **not** logged.

`createExpenseForHousehold(input, ctx)` changes its context from
`{ actorName, householdId }` to `ActivityActor`, so the web action passes
`source: "web"` and `/api/mobile/expenses` passes `source: "mobile"`.

### `diffFields`

Pure helper. Takes `before` and `after` objects plus a field spec list
`[{ key, label, format }]` where `format` turns a raw value into a display
string (money → `formatNPR`, category id → name, owner null → "Shared",
date → household's BS/AD format). Returns only fields whose *formatted*
values differ. Internal fields (`id`, `householdId`, `createdAt`,
`updatedAt`) are never in a spec, so they never appear.

### Coverage

| Module | Action → log |
| --- | --- |
| expenses | create (web, mobile, bulk = one row each) → `expense created`; update → `updated` + diff; delete → `deleted` |
| budget | `setBudgetItemAction` → `budget_item created/updated/deleted` (by prior state; covers planner "apply"); `copyPreviousMonthBudgetAction` → one `budget_item created` per copied row; `setIncomeAction` → `income created/updated` |
| categories | create / update (diff) / archive / restore |
| savings-goals | goal create / update (diff) / delete; `addContributionAction` → `savings_contribution created` |
| loans | loan create / update (diff) / delete; payment add / delete |
| dhuku | dhuku create / update (diff) / delete; entry add / delete |
| recurring | create / update (diff) / delete / pause / resume / complete / mark paid (`paid`) — if marking paid also inserts an expense, that expense is logged too |
| settings | date format, planner opt-in → `household_settings updated` + diff; password → `account updated` "changed their password" (no detail); profile photo → `account updated` "changed their profile photo" |

**Not logged:** notification read state, notification preferences, accent
colour, viewing-as cookie, voice parsing, planner *generation* (a draft,
nothing written), app-release publishing (global, not household data).

Summaries carry only what the household can already see on the source page;
nothing here is sent to a third party, so the AI masking boundary is not
involved.

## Page: `/activity`

- Route `src/app/(app)/activity/page.tsx` re-exports `ActivityPage`, with
  `metadata.title = "Activity"`.
- Nav entry "Activity" (lucide `History` icon) in `SidebarNav` and `BottomNav`
  (bottom nav: in its overflow/"more" group if it has one, matching how
  other secondary pages are placed).
- **Timeline:** entries grouped under day headings (household date format),
  newest first. Each row: actor avatar/initial, `"<Actor> <verb> <entity>"`,
  the summary, time of day, and a small "via mobile" badge when
  `source = mobile`. `updated` rows with changes expand to a
  `Field: from → to` list.
- **Filters** (all in the URL query, so filtered views can be shared and
  survive reloads; parsed with Zod, invalid values ignored):
  - `member` — a household member id (validated against the household).
  - `section` — Expenses · Income & budget · Savings · Loans · Dhuku ·
    Recurring · Categories · Settings (maps to entity types in `sections.ts`).
  - `action` — Created · Edited · Deleted · Other (pause/resume/archive/…).
  - `from` / `to` — date range on `createdAt`, entered in the household's
    BS/AD format, converted to AD day bounds (Asia/Kathmandu) for the query.
  - `q` — case-insensitive substring match on `summary` (`ilike`).
  - "Clear filters" link when any filter is active.
- **Paging:** 50 rows per page, "Load more" using a keyset cursor
  `(createdAt, id)` carried in the URL (`cursor`). Uses the
  `(householdId, createdAt desc)` index.
- **Empty states:** "No activity yet" (no rows at all) vs "No activity
  matches these filters".

## Testing

- Unit (Vitest): `diff.ts` (changed/unchanged/null↔value, formatted-equal
  values not reported), `sections.ts` (every entity type belongs to exactly
  one section), filter schema parsing (bad member id / dates dropped).
- The repo's Vitest suite is pure-function only (no DB); DB-backed behaviour
  is covered by Playwright against the seeded e2e database. So the
  end-to-end check lives in `e2e/activity.spec.ts`: add an expense, edit its
  amount, delete it, then open `/activity` and see three entries (created,
  edited with `Amount: … → …`, deleted) attributed to the logged-in member;
  filter by section and action; a non-matching search shows the
  "No activity matches these filters" state.
- Household isolation is structural: `listActivity` takes `householdId`
  from `getCurrentMember()` and always ANDs it into the WHERE clause; the
  member filter is validated against that household's members.

## Docs

- `docs/architecture.md`: add `activity_logs` under System in the domain
  model, and a "log the change" step to the Add-a-feature-module and
  Add-a-mobile-endpoint playbooks (new mutations must call `logActivity`).
