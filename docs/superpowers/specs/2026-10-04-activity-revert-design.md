# Revert from the activity log

## Problem

The activity log (`docs/superpowers/specs/2026-10-04-activity-log-design.md`)
shows who added, edited or deleted what, but nothing can be undone from it.
People want one general undo: fix their own mistakes, recover deleted data,
and roll back a partner's change — from the log entry itself.

## Decisions (from brainstorming)

- **Any revertible entry can be reverted, by either member.** Never blocked
  just because the item changed since; instead the confirmation spells out
  exactly what will happen.
- **Edits offer two modes**, each with its own preview:
  - **Undo only this change** — put back just the fields that edit changed.
  - **Restore to before this change** — put every editable field back to how
    it was immediately before that edit (which also undoes later edits).
- **The confirmation dialog always lists every field that will change as
  `current → new`** (formatted like the log: names, `RS 1,234`, BS/AD dates),
  plus plain-language warnings (see Preview).
- **A revert is itself a normal log entry** ("Nirjal reverted an edit of an
  expense") with its own diff and snapshots, so it can be reverted too (redo).
- **Not revertible:** `account` entries (password/photo), `import` entries
  (no raw data), and any entry logged before this ships (no snapshots).
  Already-sent notifications are history and are not removed or re-sent.

## Data model

Migration adds to `activity_logs`:

```ts
// Raw column values (Drizzle field names) of the entity's row immediately
// before / after the action. null where it didn't exist (before of a create,
// after of a delete) and on entries without revert support.
before: jsonb("before").$type<Record<string, unknown>>(),
after: jsonb("after").$type<Record<string, unknown>>(),
// Rows the action removed or unlinked along with the entity, keyed by kind,
// e.g. { loanPayments: [...] } when a loan delete cascaded its payments.
related: jsonb("related").$type<Record<string, Record<string, unknown>[]>>(),
// Set on the entry a revert writes; points at the entry that was reverted.
revertOfId: uuid("revert_of_id"),
```

No FK on `revertOfId` (log rows are append-only and never deleted by the app).
Snapshots are stored as JSON, so `Date` values become ISO strings; the revert
handlers convert timestamp fields back (`createdAt`, `updatedAt`).

## Capturing snapshots

`ActivityEntry` gains optional `before`, `after`, `related`. Every action that
already logs supplies them — it already holds the `before` row (update/delete
lookups) and gets `after` via `.returning()`:

| Entity | before / after | related (on delete) |
| --- | --- | --- |
| expense | expense row | — |
| income | income row | — |
| budget_item | budget_items row (before = the row for that category/month, any owner) | — |
| category | category row | — |
| savings_goal | goal row | `contributions` (rows cascaded) |
| savings_contribution | contribution row | — |
| loan | loan row | `loanPayments` |
| loan_payment | payment row; also `loanNextInstallmentDate` before/after inside `related.loan` when the payment rolled it forward | — |
| dhuku | dhuku row | `dhukuEntries` |
| dhuku_entry | entry row | — |
| recurring_expense | recurring row | `linkedExpenseIds` (expenses whose `recurringExpenseId` the delete set to null) |
| recurring `paid` | before/after = recurring row (nextDueDate/status); `related.createdExpense` = the expense it inserted | — |
| household_settings | `{ dateFormat }` or `{ plannerEnabled }` | — |
| account | not captured (not revertible) | — |

Snapshots never include `users.image`/password data (account entries carry
none). Goal `image` is captured (it's the goal's own data and needed to
restore it); it is never displayed — the preview shows "Photo: Old photo → New
photo" as the log already does.

## Planning a revert (pure)

`src/modules/activity/lib/revert/plan.ts`:

```ts
type RevertMode = "restore" | "undo"; // undo = only this change; restore = to before this change
type RevertPlan =
  | { kind: "blocked"; reason: string }                      // e.g. "This expense already exists again."
  | { kind: "noop"; reason: string }                         // e.g. "Already back to how it was."
  | {
      kind: "apply";
      changes: ActivityChange[];                             // current → new, formatted
      operation: RevertOperation;                            // what to write (see below)
      warnings: string[];
    };
// What exists *now*, loaded by the entity's handler (household-scoped).
type RevertContext = {
  children: Record<string, Record<string, unknown>[]>; // e.g. { loanPayments: [...] }
  references: { categoryIds: Set<string>; memberIds: Set<string> }; // for re-insert checks
  row: Record<string, unknown> | null;                 // the entity's current row, or null if gone
};
planRevert(entry, context: RevertContext, mode, f: ActivityFormatters): RevertPlan
```

`RevertOperation` is data, not code: `{ type: "update", set }`, `{ type:
"delete" }`, `{ type: "insert", row, related }`, or for `paid`
`{ type: "unpay", deleteExpenseId, set }`. A per-entity registry
(`lib/revert/registry.ts`) gives each entity type its editable fields, field
specs (reusing the `<x>Changes` specs from each module's `*-activity.ts`),
timestamp fields, and child kinds.

Rules by original action:

- **updated** — `undo`: target = current row with each field the entry changed
  (`before[k] !== after[k]`) set to `before[k]`. `restore`: target = current row
  with every editable field set to `before[k]`. Preview = diff(current, target).
  Warning when a field being reverted no longer equals `after[k]` (someone
  changed it since): "This also overrides a later change to Amount (RS 900)."
  Row gone → `blocked` ("This expense has since been deleted — revert that
  deletion first."). Empty diff → `noop`.
- **created** — operation `delete`. Preview lists the item's current values
  `value → —`. If children exist now (payments on a loan, contributions on a
  goal, entries on a dhuku) warning: "This also removes 2 payments." Row gone →
  `noop` ("Already removed.").
- **deleted** — operation `insert` of `before` with its original id, plus
  `related` children with their original ids; for recurring, re-link
  `linkedExpenseIds` that still exist and are unlinked. Row with that id exists
  → `blocked` ("This loan already exists again."). Referenced category/member
  missing → `blocked` with which one.
- **archived/restored, paused/resumed/completed** — an `update` of
  `archived`/`status` back to `before`, same preview/warning rules as updated
  (single mode).
- **paid** (recurring) — operation `unpay`: delete `related.createdExpense` (if it
  still exists) and set the bill's `nextDueDate`/`status` back to `before`.
  Preview lists the bill's fields and "Expense RS 1,500 (Bills) → removed".
- **loan_payment created** — besides deleting the payment, if `related.loan`
  shows the payment rolled `nextInstallmentDate` forward and the loan still
  has that rolled value, set it back to the before value (preview line "Next
  installment: … → …"); if the loan's date has moved since, leave it and warn
  "Next installment date was changed since — left as is."
- **budget_item** — target state for that category/month is the `before` row
  (or none for a create): `apply` deletes the month's rows for that category
  and inserts `before` (original id).
- **household_settings** — `update` of the single setting.
- **A revert entry** is reverted like any entry of its own action (redo).

## Applying a revert

`src/modules/activity/api/revert.actions.ts` (`"use server"`):

- `previewRevertAction(entryId, mode)` → the plan's `{ kind, changes, warnings,
  reason }` for the dialog (no write).
- `revertActivityAction(entryId, mode)`:
  1. `getCurrentMember()`; load the entry `where id = entryId and householdId =
     member.householdId` (another household's id → "not found").
  2. Reject non-revertible entries (account, import, no snapshots).
  3. Load the current row (+ children) scoped by household, `planRevert` again
     against live data (the preview may be stale), and refuse unless `apply`.
  4. Execute `operation` in one transaction via the entity's handler, then log a
     new entry: action = what the revert did (`updated`/`deleted`/`created`;
     for `unpay`, `updated` on the bill), `revertOfId = entry.id`, summary of
     the item's resulting state, `changes` = the plan's changes, `before`/`after`
     = live row before / after the revert, source `web`.
  5. `revalidatePath` for `/activity` and the entity's pages.

Handlers live next to the data they write (`src/modules/<x>/api/<x>.revert.ts`,
no `"use server"`), each exporting `{ load, apply }` registered in
`lib/revert/registry.ts`; household scoping is enforced in every query.

## UI

- `ActivityRow`: a small **Revert** button (lucide `Undo2`) on revertible
  entries (has snapshots, not account/import). Entries written by a revert read
  "Nirjal reverted an edit of an expense" (describeActivity gains a
  `reverted` variant keyed off `revertOfId` + the original's action).
- **Revert dialog** (client component, `Modal`): title "Revert this change?",
  the original entry's sentence and time, then:
  - edits: two radio cards "Undo only this change" / "Restore to before this
    change", each showing its own preview (fetched via `previewRevertAction`);
  - the field list `Field   current → new` (strikethrough current, like the
    log's diff);
  - warnings in an amber box; `blocked`/`noop` show the reason and disable
    **Revert**;
  - **Revert** (destructive styling for deletes) / **Cancel**. Success →
    toast "Reverted" and the page refreshes; failure → toast with the message.

## Testing

- Unit (`lib/revert/plan.test.ts`): for each rule above — undo vs restore on
  the 2pm/3pm example; later-change warning; deleted-since → blocked;
  already-reverted → noop; create with children → warning; delete with
  children → insert carries them; recurring delete re-link; paid → unpay;
  budget owner change; settings; redo of a revert.
- Unit: snapshot capture helpers (JSON round-trip of timestamps).
- E2E (`e2e/activity-revert.spec.ts`): add an expense, edit amount, edit
  note, revert the amount edit with "undo only this change" (note kept), then
  revert the note edit with "restore" (both back); delete the expense, revert
  the delete (expense back with original details); each dialog shows the
  expected `current → new` lines.

## Docs

`docs/architecture.md`: activity-log bullet gains snapshots + revert; the
"Add a feature module" playbook step says to pass `before`/`after` to
`logActivity` and register a revert handler.
