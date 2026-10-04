# Activity Revert Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Revert button on activity-log entries that undoes an add, edit or delete — with "undo only this change" / "restore to before this change" for edits — after a dialog that lists every field as `current → new` plus warnings.

**Architecture:** Every log entry now stores raw `before`/`after` row snapshots (and cascaded `related` rows on deletes). A pure planner (`lib/revert/plan.ts` + per-entity registry `lib/revert/entities.ts`) compares an entry's snapshots with the live row and produces a preview plus a data-only operation. A server module (`api/revert-store.ts`) loads live rows and applies operations per table, household-scoped; `api/revert.actions.ts` exposes preview/apply and logs the revert as a normal entry with `revertOfId`.

**Tech Stack:** Next.js 16 server actions, Drizzle ORM / Postgres (jsonb), Zod v4, Vitest, Playwright, shadcn `Modal`, `sonner` toasts, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-04-activity-revert-design.md`

## Global Constraints

- **`.env.local` currently points at PRODUCTION (Supabase).** Never run `npm run db:migrate`, `db:generate`-then-migrate, scripts or e2e without an explicit local URL. Use the commented localhost line: `LOCAL_DB=$(node -e "const l=require('fs').readFileSync('.env.local','utf8').split(/\r?\n/).find(x=>/DATABASE_URL=.*localhost/.test(x)); process.stdout.write(l.replace(/^#?\s*DATABASE_URL=/,'').replace(/\"/g,''))")`, then `DATABASE_URL="$LOCAL_DB" npm run db:migrate` and `E2E_DATABASE_URL="${LOCAL_DB%/piko}/piko_e2e" npx playwright test`. Production migrations happen only after the user approves, at the end.
- Golden rule: every query scoped by the session's `householdId`; the revert endpoint takes only `entryId` + `mode` from the client.
- Not revertible: `account` entries, `source = "import"` entries, entries without snapshots.
- A revert re-plans against live data at apply time; the preview is advisory.
- Snapshots are JSON (`toSnapshot`): Dates → ISO strings; `reviveRow` turns `PgTimestamp` columns back into `Date`s.
- Goal `image` is captured in snapshots but never displayed (shown as "Photo").
- Imports/props/keys alphabetical (`npm run lint -- --fix`); never `--no-verify`; pre-commit runs `tsc` + `next build`.
- Work on branch `feature/activity-revert` (from `feature/ai-budget-planner`).

## Review Focus

1. **A crafted `entryId` from another household** (or a non-uuid) must yield "not found"/validation error, never read or write another household's rows — Task 7 `prepare` filters by `householdId` and validates with Zod; reviewer checks every store query carries the household scope.
2. **Reverting twice / double-click** — the second apply must re-plan, find `noop`, and refuse with a clear message rather than writing a duplicate — Task 3 noop tests + Task 7 apply re-plan.
3. **Restoring a delete whose children reference a since-removed member** — the transaction must roll back as a whole (no half-restored loan) and the user sees the error toast — Task 7 uses one `db.transaction` for parent + children.
4. **Fields whose formatted value is identical but raw differs** (goal photo swapped) must still show a preview line, not an empty "nothing to change" — Task 3 photo test.
5. **Settings/date-format revert** must restore only the setting that entry touched (snapshots hold one key) — Task 3 settings test.

---

### Task 1: Snapshot columns and capture plumbing

**Files:**
- Modify: `src/db/schema/activityLogs.ts`
- Create (generated): `drizzle/0015_*.sql`, `drizzle/meta/*`
- Create: `src/modules/activity/lib/snapshot.ts`, `snapshot.test.ts`
- Modify: `src/modules/activity/api/activity.ts` (`ActivityEntry`, `logActivities`)

**Interfaces:**
- Produces: `ActivitySnapshot = Record<string, unknown>` (from `@/db/schema`); columns `before`, `after`, `related`, `revertOfId`; `toSnapshot(row: object): ActivitySnapshot`; `rawEqual(a, b): boolean`; `reviveRow<T extends PgTable>(table: T, row: ActivitySnapshot): T["$inferInsert"]`; `ActivityEntry` gains `after?: null | object`, `before?: null | object`, `related?: Record<string, object[]>`, `revertOfId?: string`.

- [ ] **Step 1: Branch**

```bash
git switch -c feature/activity-revert
```

- [ ] **Step 2: Write the failing snapshot test**

`src/modules/activity/lib/snapshot.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { expenses, households } from "@/db/schema";

import { rawEqual, reviveRow, toSnapshot } from "./snapshot";

describe("toSnapshot", () => {
  it("stores what jsonb gives back: Dates become ISO strings, undefined keys drop", () => {
    expect(toSnapshot({ a: undefined, createdAt: new Date("2026-10-04T09:20:00.123Z"), n: "1200.00" })).toEqual({
      createdAt: "2026-10-04T09:20:00.123Z",
      n: "1200.00",
    });
  });
});

describe("rawEqual", () => {
  it("treats null and undefined as equal and compares by JSON value", () => {
    expect(rawEqual(null, undefined)).toBe(true);
    expect(rawEqual("1200.00", "1200.00")).toBe(true);
    expect(rawEqual("1200.00", "1200")).toBe(false);
    expect(rawEqual(false, null)).toBe(false);
  });
});

describe("reviveRow", () => {
  it("turns timestamp columns back into Dates and drops non-columns", () => {
    const row = reviveRow(expenses, { amount: "5.00", bogus: 1, createdAt: "2026-10-04T09:20:00.123Z", date: "2026-10-04" });
    expect(row).toEqual({ amount: "5.00", createdAt: new Date("2026-10-04T09:20:00.123Z"), date: "2026-10-04" });
  });

  it("leaves non-timestamp columns alone", () => {
    expect(reviveRow(households, { dateFormat: "english", plannerEnabled: true })).toEqual({ dateFormat: "english", plannerEnabled: true });
  });
});
```

- [ ] **Step 3: Run it — expect FAIL** (`npx vitest run src/modules/activity/lib/snapshot.test.ts` → cannot resolve `./snapshot`).

- [ ] **Step 4: Implement `snapshot.ts`**

```ts
import { getTableColumns } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

import type { ActivitySnapshot } from "@/db/schema";

// Exactly what jsonb stores and gives back (Dates → ISO strings, undefined
// keys dropped), so live rows and stored snapshots compare like for like.
export function toSnapshot(row: object): ActivitySnapshot {
  return JSON.parse(JSON.stringify(row)) as ActivitySnapshot;
}

export function rawEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

// Turns a snapshot back into insert/update values for `table`: timestamp
// columns (stored as ISO strings) become Dates again; keys that aren't
// columns of the table are dropped.
export function reviveRow<T extends PgTable>(table: T, row: ActivitySnapshot): T["$inferInsert"] {
  const columns = getTableColumns(table);
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const column = columns[key];
    if (!column) continue;
    values[key] = column.columnType === "PgTimestamp" && typeof value === "string" ? new Date(value) : value;
  }
  return values as T["$inferInsert"];
}
```

- [ ] **Step 5: Add the columns** — in `src/db/schema/activityLogs.ts`, next to `ActivityChange`:

```ts
// Raw column values (Drizzle field names) of a row, as stored in jsonb.
export type ActivitySnapshot = Record<string, unknown>;
```

and in the table, after `changes`:

```ts
    // Raw row just before / after the action, for reverting. null where the
    // row didn't exist, and on entries without revert support (account,
    // import, anything logged before revert shipped).
    before: jsonb("before").$type<ActivitySnapshot>(),
    after: jsonb("after").$type<ActivitySnapshot>(),
    // Rows removed or unlinked along with the entity, by kind
    // (e.g. { loanPayments: [...] } when deleting a loan cascaded them).
    related: jsonb("related").$type<Record<string, ActivitySnapshot[]>>(),
    // Set on the entry a revert writes: the entry that was reverted.
    revertOfId: uuid("revert_of_id"),
```

- [ ] **Step 6: Capture in `logActivities`** — in `src/modules/activity/api/activity.ts` extend `ActivityEntry`:

```ts
  // Raw rows for revert support; omit where the action has none.
  after?: null | object;
  before?: null | object;
  related?: Record<string, object[]>;
  // Set when this entry records a revert of another entry.
  revertOfId?: string;
```

and in the `values(...)` mapping add:

```ts
      after: entry.after ? toSnapshot(entry.after) : null,
      before: entry.before ? toSnapshot(entry.before) : null,
      related: entry.related ? (toSnapshot(entry.related) as Record<string, ActivitySnapshot[]>) : null,
      revertOfId: entry.revertOfId ?? null,
```

(import `toSnapshot` from `../lib/snapshot` and `type ActivitySnapshot` from `@/db/schema`).

- [ ] **Step 7: Generate + apply locally**

```bash
npm run db:generate          # generate reads no DB; produces drizzle/0015_*.sql with 4 ALTER TABLE ADD COLUMN
LOCAL_DB=... (see Global Constraints)
DATABASE_URL="$LOCAL_DB" npm run db:migrate
```

Expected: SQL adds `before jsonb`, `after jsonb`, `related jsonb`, `revert_of_id uuid` — nothing else.

- [ ] **Step 8: Verify + commit** — `npx vitest run src/modules/activity && npx tsc --noEmit` → PASS / clean.

```bash
npm run lint -- --fix
git add src/db/schema drizzle src/modules/activity
git commit -m "feat(activity): store raw before/after snapshots on log entries"
```

---

### Task 2: Export field specs from each module

Pure refactor plus three new spec lists for child entities. Every existing `*-activity` test must stay green.

**Files (all `lib/*-activity.ts` + tests):** expenses, budget, categories, savings-goals, loans, dhuku, recurring, settings.

**Interfaces:**
- Produces: `expenseFields(f)`, `budgetItemFields(f)`, `incomeFields(f)`, `categoryFields()`, `goalFields(f)`, `contributionFields(f)`, `loanFields(f)`, `loanPaymentFields(f)`, `dhukuFields(f)`, `dhukuEntryFields(f)`, `recurringFields(f)`, `settingsFields()` — each returns `FieldSpec<…Snapshot>[]`; new snapshot types `ContributionSnapshot`, `LoanPaymentSnapshot`, `DhukuEntrySnapshot`.

- [ ] **Step 1: Write failing tests for the three new lists** — append to the existing test files:

`savings-activity.test.ts`:

```ts
describe("contributionFields", () => {
  it("lists amount, member and date", () => {
    expect(contributionFields(f).map((s) => [s.label, s.format(({ amount: "5000.00", date: "2026-10-01", memberId: "m-1" } as never)[s.key])])).toEqual([
      ["Amount", "RS 5,000"],
      ["By", "Asha"],
      ["Date", "1 October 2026"],
    ]);
  });
});
```

`loan-activity.test.ts`:

```ts
describe("loanPaymentFields", () => {
  it("lists amount, payer, date and note", () => {
    expect(loanPaymentFields(f).map((s) => s.label)).toEqual(["Amount", "By", "Date", "Note"]);
  });
});
```

`dhuku-activity.test.ts`:

```ts
describe("dhukuEntryFields", () => {
  it("labels the entry type", () => {
    const type = dhukuEntryFields(f).find((s) => s.key === "type")!;
    expect([type.format("payout"), type.format("contribution")]).toEqual(["Payout", "Contribution"]);
  });
});
```

(add the new names to each file's import.)

- [ ] **Step 2: Run — expect FAIL** (missing exports).

- [ ] **Step 3: Refactor each module** so the spec array is an exported function and the existing `xChanges` calls `diffFields(before, after, xFields(f))`. Concretely:

- `expenses/lib/expense-activity.ts`: `function expenseFields` → `export function expenseFields`.
- `budget/lib/budget-activity.ts`: `export function budgetItemFields(f): FieldSpec<BudgetItemSnapshot>[]` (Planned, For) and `export function incomeFields(f): FieldSpec<IncomeSnapshot>[]` (Amount, Note); `budgetItemChanges`/`incomeChanges` use them.
- `categories/lib/category-activity.ts`: `export function categoryFields(): FieldSpec<CategorySnapshot>[]` (Name, Group, Type).
- `savings-goals/lib/savings-activity.ts`: `export function goalFields(f)` (Name, Description, For, Target, Target date — **no image**; `goalChanges` keeps its separate Photo line), plus:

```ts
export type ContributionSnapshot = { amount: number | string; date?: null | string; memberId: string };

export function contributionFields(f: ActivityFormatters): FieldSpec<ContributionSnapshot>[] {
  return [
    { format: f.money, key: "amount", label: "Amount" },
    { format: f.member, key: "memberId", label: "By" },
    { format: f.date, key: "date", label: "Date" },
  ];
}
```

- `loans/lib/loan-activity.ts`: `export function loanFields(f)` (existing list) plus:

```ts
export type LoanPaymentSnapshot = { amount: number | string; date?: null | string; memberId: string; note?: null | string };

export function loanPaymentFields(f: ActivityFormatters): FieldSpec<LoanPaymentSnapshot>[] {
  return [
    { format: f.money, key: "amount", label: "Amount" },
    { format: f.member, key: "memberId", label: "By" },
    { format: f.date, key: "date", label: "Date" },
    { format: f.text, key: "note", label: "Note" },
  ];
}
```

- `dhuku/lib/dhuku-activity.ts`: `export function dhukuFields(f)` plus:

```ts
export type DhukuEntrySnapshot = { amount: number | string; date?: null | string; note?: null | string; type: string };

function entryTypeLabel(value: unknown): null | string {
  if (value === "payout") return "Payout";
  if (value === "contribution") return "Contribution";
  return null;
}

export function dhukuEntryFields(f: ActivityFormatters): FieldSpec<DhukuEntrySnapshot>[] {
  return [
    { format: entryTypeLabel, key: "type", label: "Type" },
    { format: f.money, key: "amount", label: "Amount" },
    { format: f.date, key: "date", label: "Date" },
    { format: f.text, key: "note", label: "Note" },
  ];
}
```

- `recurring/lib/recurring-activity.ts`: `export function recurringFields(f)`.
- `settings/lib/settings-activity.ts`:

```ts
type SettingsSnapshot = { dateFormat?: string; plannerEnabled?: boolean };

export function settingsFields(): FieldSpec<SettingsSnapshot>[] {
  return [
    { format: dateFormatLabel, key: "dateFormat", label: "Date format" },
    { format: (value) => (value === undefined || value === null ? null : onOff(value)), key: "plannerEnabled", label: "AI budget planner" },
  ];
}
```

  and make `dateFormatChanges`/`plannerChanges` reuse the matching specs (`settingsFields().filter((s) => s.key === "dateFormat")`).

- [ ] **Step 4: Run all tests — expect PASS** (`npx vitest run` → everything green, incl. the untouched existing `*-activity` tests).

- [ ] **Step 5: Commit**

```bash
npm run lint -- --fix
git add src/modules
git commit -m "refactor(activity): export field specs from each module"
```

---

### Task 3: Revert planner (pure)

**Files:**
- Create: `src/modules/activity/lib/revert/entities.ts`
- Create: `src/modules/activity/lib/revert/plan.ts`, `plan.test.ts`

**Interfaces:**
- Consumes: Task 1 `rawEqual`, `ActivitySnapshot`; Task 2 field/summary exports.
- Produces:
  - `RevertMode = "restore" | "undo"`; `RevertContext`; `RevertOperation`; `RevertPlan`; `ParentUpdate`
  - `planRevert(entry: RevertableEntry, context: RevertContext, mode: RevertMode, f): RevertPlan`
  - `revertModes(action: ActivityAction): RevertMode[]`
  - `isRevertible(entry: { entityType; hasSnapshot: boolean; source }): boolean`
  - `ENTITY_REVERT: Partial<Record<ActivityEntityType, EntityRevert>>` with `children`, `editable`, `fields`, `noun`, `parentNoun?`, `references`, `summary`.

- [ ] **Step 1: Write the failing planner tests**

`src/modules/activity/lib/revert/plan.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { ActivitySnapshot } from "@/db/schema";

import { testFormatters } from "../test-formatters";
import { ENTITY_REVERT } from "./entities";
import { isRevertible, planRevert, type RevertableEntry, type RevertContext, revertModes } from "./plan";

const f = testFormatters();

function context(row: ActivitySnapshot | null, extra: Partial<RevertContext> = {}): RevertContext {
  return {
    children: {},
    references: { categoryIds: new Set(["cat-1", "cat-2"]), memberIds: new Set(["m-1", "m-2"]), parentIds: new Set(["l-1"]) },
    row,
    ...extra,
  };
}

function entry(partial: Partial<RevertableEntry> & Pick<RevertableEntry, "action" | "entityType">): RevertableEntry {
  return { after: null, before: null, related: null, ...partial };
}

// The spec's example: 2pm edit amount 500 → 800, 3pm edit changed the note.
const original = { amount: "500.00", categoryId: "cat-1", date: "2026-10-01", id: "e-1", note: "veg", ownerMemberId: null, paidByMemberId: "m-1" };
const after2pm = { ...original, amount: "800.00" };
const now = { ...after2pm, note: "fruit" };
const edit2pm = entry({ action: "updated", after: after2pm, before: original, entityType: "expense" });

describe("planRevert — edits", () => {
  it("undo only this change puts back just the fields that edit changed", () => {
    expect(planRevert(edit2pm, context(now), "undo", f)).toEqual({
      changes: [{ field: "Amount", from: "RS 800", to: "RS 500" }],
      kind: "apply",
      operation: { set: { amount: "500.00" }, type: "update" },
      warnings: [],
    });
  });

  it("restore to before this change also undoes later edits, and says so", () => {
    expect(planRevert(edit2pm, context(now), "restore", f)).toEqual({
      changes: [
        { field: "Amount", from: "RS 800", to: "RS 500" },
        { field: "Note", from: "fruit", to: "veg" },
      ],
      kind: "apply",
      operation: { set: { amount: "500.00", note: "veg" }, type: "update" },
      warnings: ["This also overrides a later change to Note (now fruit)."],
    });
  });

  it("warns when the field it reverts was changed again later", () => {
    const plan = planRevert(edit2pm, context({ ...now, amount: "900.00" }), "undo", f);
    expect(plan.kind === "apply" && plan.warnings).toEqual(["This also overrides a later change to Amount (now RS 900)."]);
  });

  it("is a no-op when already back to how it was", () => {
    expect(planRevert(edit2pm, context({ ...now, amount: "500.00" }), "undo", f)).toEqual({
      kind: "noop",
      reason: "Already back to how it was.",
    });
  });

  it("is blocked when the item was deleted since", () => {
    expect(planRevert(edit2pm, context(null), "undo", f)).toEqual({
      kind: "blocked",
      reason: "This expense has since been deleted — revert that deletion first.",
    });
  });

  it("shows a line for a swapped photo even though both format the same", () => {
    const goal = { description: null, id: "g-1", image: "data:a", name: "Trip", ownerMemberId: null, targetAmount: null, targetDate: null };
    const plan = planRevert(entry({ action: "updated", after: { ...goal, image: "data:b" }, before: goal, entityType: "savings_goal" }), context({ ...goal, image: "data:b" }), "undo", f);
    expect(plan.kind === "apply" && plan.changes).toEqual([{ field: "Photo", from: "Current version", to: "Earlier version" }]);
  });

  it("flips status changes back (category archived)", () => {
    const category = { archived: false, budgetType: "flexible", groupName: "Household", id: "c-1", name: "Groceries" };
    const plan = planRevert(entry({ action: "archived", after: { ...category, archived: true }, before: category, entityType: "category" }), context({ ...category, archived: true }), "undo", f);
    expect(plan.kind === "apply" && [plan.changes, plan.operation]).toEqual([
      [{ field: "Status", from: "Archived", to: "Active" }],
      { set: { archived: false }, type: "update" },
    ]);
  });

  it("restores only the setting the entry touched", () => {
    const plan = planRevert(
      entry({ action: "updated", after: { dateFormat: "english" }, before: { dateFormat: "nepali" }, entityType: "household_settings" }),
      context({ dateFormat: "english", plannerEnabled: true }),
      "restore",
      f,
    );
    expect(plan.kind === "apply" && plan.operation).toEqual({ set: { dateFormat: "nepali" }, type: "update" });
  });
});

describe("planRevert — adds", () => {
  const loan = { counterpartyName: "Hari", date: "2026-09-01", direction: "given", id: "l-1", ownerMemberId: null, principalAmount: "50000.00" };

  it("removes the item and warns about children added since", () => {
    const plan = planRevert(entry({ action: "created", after: loan, entityType: "loan" }), context(loan, { children: { loanPayments: [{}, {}] } }), "undo", f);
    expect(plan.kind === "apply" && [plan.operation, plan.warnings, plan.changes[0]]).toEqual([
      { type: "delete" },
      ["This also removes 2 payments."],
      { field: "Person", from: "Hari", to: null },
    ]);
  });

  it("is a no-op when already removed", () => {
    expect(planRevert(entry({ action: "created", after: loan, entityType: "loan" }), context(null), "undo", f)).toEqual({
      kind: "noop",
      reason: "Already removed.",
    });
  });

  it("rolls a loan's next installment back when removing the payment that advanced it", () => {
    const payment = { amount: "5000.00", date: "2026-09-04", id: "lp-1", loanId: "l-1", memberId: "m-1", note: null };
    const link = { id: "l-1", nextInstallmentDateAfter: "2026-11-01", nextInstallmentDateBefore: "2026-10-01" };
    const created = entry({ action: "created", after: payment, entityType: "loan_payment", related: { loan: [link] } });

    const rolled = planRevert(created, context(payment, { children: { loan: [{ id: "l-1", nextInstallmentDate: "2026-11-01" }] } }), "undo", f);
    expect(rolled.kind === "apply" && rolled.operation).toEqual({ parentUpdate: { id: "l-1", set: { nextInstallmentDate: "2026-10-01" } }, type: "delete" });

    const movedSince = planRevert(created, context(payment, { children: { loan: [{ id: "l-1", nextInstallmentDate: "2026-12-01" }] } }), "undo", f);
    expect(movedSince.kind === "apply" && [movedSince.operation, movedSince.warnings]).toEqual([
      { type: "delete" },
      ["Next installment date was changed since — left as is."],
    ]);
  });
});

describe("planRevert — deletes", () => {
  const loan = { counterpartyName: "Hari", date: "2026-09-01", direction: "given", id: "l-1", ownerMemberId: "m-1", principalAmount: "50000.00" };
  const deleted = entry({ action: "deleted", before: loan, entityType: "loan", related: { loanPayments: [{ id: "p-1" }, { id: "p-2" }] } });

  it("re-creates the item with its children", () => {
    const plan = planRevert(deleted, context(null), "undo", f);
    expect(plan.kind === "apply" && [plan.operation, plan.warnings]).toEqual([
      { related: { loanPayments: [{ id: "p-1" }, { id: "p-2" }] }, row: loan, type: "insert" },
      ["Also brings back 2 payments."],
    ]);
  });

  it("is blocked when it exists again, or a member/category/parent is gone", () => {
    expect(planRevert(deleted, context(loan), "undo", f)).toEqual({ kind: "blocked", reason: "This loan already exists again." });
    const noMember = context(null, { references: { categoryIds: new Set(), memberIds: new Set(), parentIds: new Set() } });
    expect(planRevert(deleted, noMember, "undo", f)).toEqual({ kind: "blocked", reason: "A member it belonged to is no longer in the household." });

    const expense = entry({ action: "deleted", before: { ...original, categoryId: "gone" }, entityType: "expense" });
    expect(planRevert(expense, context(null), "undo", f)).toEqual({ kind: "blocked", reason: "Its category no longer exists." });

    const payment = entry({ action: "deleted", before: { amount: "1.00", id: "lp-1", loanId: "gone", memberId: "m-1" }, entityType: "loan_payment" });
    expect(planRevert(payment, context(null), "undo", f)).toEqual({
      kind: "blocked",
      reason: "The loan it belonged to no longer exists — revert that deletion first.",
    });
  });
});

describe("planRevert — marked paid", () => {
  it("removes the created expense and rolls the bill back", () => {
    const bill = { amount: "1500.00", categoryId: "cat-1", endDate: null, frequency: "monthly", icon: "wifi", id: "r-1", name: "Internet", nextDueDate: "2026-10-15", ownerMemberId: null, status: "active", vendor: null };
    const expense = { amount: "1500.00", categoryId: "cat-1", date: "2026-10-15", id: "e-9", note: "Internet", ownerMemberId: null, paidByMemberId: "m-1" };
    const paid = entry({ action: "paid", after: { ...bill, nextDueDate: "2026-11-15" }, before: bill, entityType: "recurring_expense", related: { createdExpense: [expense] } });

    const plan = planRevert(paid, context({ ...bill, nextDueDate: "2026-11-15" }, { children: { createdExpense: [expense] } }), "undo", f);
    expect(plan.kind === "apply" && [plan.operation, plan.changes]).toEqual([
      { deleteExpenseId: "e-9", set: { nextDueDate: "2026-10-15" }, type: "unpay" },
      [
        { field: "Next due", from: "15 November 2026", to: "15 October 2026" },
        { field: "Expense", from: "Groceries · RS 1,500 · Shared — Internet", to: null },
      ],
    ]);
  });
});

describe("revert rules", () => {
  it("offers both modes only for edits", () => {
    expect(revertModes("updated")).toEqual(["undo", "restore"]);
    expect(revertModes("deleted")).toEqual(["undo"]);
  });

  it("excludes account, imported and snapshot-less entries", () => {
    expect(isRevertible({ entityType: "expense", hasSnapshot: true, source: "web" })).toBe(true);
    expect(isRevertible({ entityType: "account", hasSnapshot: true, source: "web" })).toBe(false);
    expect(isRevertible({ entityType: "expense", hasSnapshot: true, source: "import" })).toBe(false);
    expect(isRevertible({ entityType: "expense", hasSnapshot: false, source: "web" })).toBe(false);
  });

  it("has a display field for every editable column of every entity", () => {
    for (const [entityType, config] of Object.entries(ENTITY_REVERT)) {
      const keys = config!.fields(f).map((s) => s.key);
      for (const key of config!.editable) expect(keys, `${entityType}.${key}`).toContain(key);
    }
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (cannot resolve `./entities` / `./plan`).

- [ ] **Step 3: Implement the registry** — `src/modules/activity/lib/revert/entities.ts`:

```ts
import type { ActivityEntityType, ActivitySnapshot } from "@/db/schema";
import { budgetItemFields, incomeFields } from "@/modules/budget/lib/budget-activity";
import { categoryFields, type CategorySnapshot, categorySummary } from "@/modules/categories/lib/category-activity";
import { dhukuEntryFields, dhukuFields, type DhukuSnapshot, dhukuSummary } from "@/modules/dhuku/lib/dhuku-activity";
import { expenseFields, type ExpenseSnapshot, expenseSummary } from "@/modules/expenses/lib/expense-activity";
import { loanFields, loanPaymentFields, type LoanSnapshot, loanSummary } from "@/modules/loans/lib/loan-activity";
import { recurringFields, type RecurringSnapshot, recurringSummary } from "@/modules/recurring/lib/recurring-activity";
import { contributionFields, goalFields, type SavingsGoalSnapshot, goalSummary } from "@/modules/savings-goals/lib/savings-activity";
import { dateFormatLabel, settingsFields } from "@/modules/settings/lib/settings-activity";

import type { ActivityFormatters } from "../activity-values";
import type { FieldSpec } from "../diff";

type Row = ActivitySnapshot;

export type ChildKind = { kind: string; removed?: (n: number) => string; restored?: (n: number) => string };

export type EntityRevert = {
  children: ChildKind[];
  editable: string[];
  fields: (f: ActivityFormatters) => FieldSpec<Row>[];
  noun: string;
  parentNoun?: string;
  references: (row: Row) => { categoryIds: string[]; memberIds: string[]; parentId?: string };
  summary: (f: ActivityFormatters, row: Row) => string;
};

const ids = (...values: unknown[]) => values.filter((v): v is string => typeof v === "string");
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const capitalized = (v: unknown) => (typeof v === "string" && v ? v[0].toUpperCase() + v.slice(1) : null);
const noRefs = () => ({ categoryIds: [], memberIds: [] });

// Per entity type: which columns a revert may write, how to display them, and
// what else a delete takes along. Keys mirror the Drizzle field names.
export const ENTITY_REVERT: Partial<Record<ActivityEntityType, EntityRevert>> = {
  budget_item: {
    children: [],
    editable: ["ownerMemberId", "plannedAmount"],
    fields: (f) => [{ format: f.category, key: "categoryId", label: "Category" }, ...budgetItemFields(f)],
    noun: "budget line",
    references: (r) => ({ categoryIds: ids(r.categoryId), memberIds: ids(r.ownerMemberId) }),
    summary: (f, r) => [f.category(r.categoryId), f.owner(r.ownerMemberId), f.money(r.plannedAmount)].filter(Boolean).join(" · "),
  },
  category: {
    children: [],
    editable: ["archived", "budgetType", "groupName", "name"],
    fields: () => [...categoryFields(), { format: (v) => (v ? "Archived" : "Active"), key: "archived", label: "Status" }],
    noun: "category",
    references: noRefs,
    summary: (_, r) => categorySummary(r as CategorySnapshot),
  },
  dhuku: {
    children: [
      {
        kind: "dhukuEntries",
        removed: (n) => `This also removes ${plural(n, "entry", "entries")}.`,
        restored: (n) => `Also brings back ${plural(n, "entry", "entries")}.`,
      },
    ],
    editable: ["interestPerMonth", "monthlyContribution", "name", "note", "ownerMemberId", "startDate", "totalMembers"],
    fields: dhukuFields,
    noun: "dhuku",
    references: (r) => ({ categoryIds: [], memberIds: ids(r.ownerMemberId) }),
    summary: (f, r) => dhukuSummary(f, r as DhukuSnapshot),
  },
  dhuku_entry: {
    children: [],
    editable: ["amount", "date", "note", "type"],
    fields: dhukuEntryFields,
    noun: "dhuku entry",
    parentNoun: "dhuku",
    references: (r) => ({ categoryIds: [], memberIds: [], parentId: String(r.dhukuId) }),
    summary: (f, r) => `${r.type === "payout" ? "Payout" : "Contribution"} · ${f.money(r.amount)}`,
  },
  expense: {
    children: [],
    editable: ["amount", "categoryId", "date", "note", "ownerMemberId", "paidByMemberId"],
    fields: expenseFields,
    noun: "expense",
    references: (r) => ({ categoryIds: ids(r.categoryId), memberIds: ids(r.ownerMemberId, r.paidByMemberId) }),
    summary: (f, r) => expenseSummary(f, r as ExpenseSnapshot),
  },
  household_settings: {
    children: [],
    editable: ["dateFormat", "plannerEnabled"],
    fields: settingsFields,
    noun: "household setting",
    references: noRefs,
    summary: (_, r) =>
      "dateFormat" in r ? `Date format → ${dateFormatLabel(r.dateFormat)}` : `AI budget planner → ${r.plannerEnabled ? "On" : "Off"}`,
  },
  income: {
    children: [],
    editable: ["amount", "note"],
    fields: incomeFields,
    noun: "income entry",
    references: (r) => ({ categoryIds: [], memberIds: ids(r.memberId) }),
    summary: (f, r) => [f.member(r.memberId), f.money(r.amount)].filter(Boolean).join(" · "),
  },
  loan: {
    children: [
      {
        kind: "loanPayments",
        removed: (n) => `This also removes ${plural(n, "payment")}.`,
        restored: (n) => `Also brings back ${plural(n, "payment")}.`,
      },
    ],
    editable: [
      "counterpartyName",
      "date",
      "direction",
      "dueDate",
      "installmentAmount",
      "installmentFrequency",
      "nextInstallmentDate",
      "note",
      "ownerMemberId",
      "principalAmount",
    ],
    fields: loanFields,
    noun: "loan",
    references: (r) => ({ categoryIds: [], memberIds: ids(r.ownerMemberId) }),
    summary: (f, r) => loanSummary(f, r as LoanSnapshot),
  },
  loan_payment: {
    children: [],
    editable: ["amount", "date", "memberId", "note"],
    fields: loanPaymentFields,
    noun: "loan payment",
    parentNoun: "loan",
    references: (r) => ({ categoryIds: [], memberIds: ids(r.memberId), parentId: String(r.loanId) }),
    summary: (f, r) => `${f.money(r.amount)} · by ${f.member(r.memberId)}`,
  },
  recurring_expense: {
    children: [{ kind: "linkedExpenseIds", restored: (n) => `Also re-links ${plural(n, "expense")} to it.` }],
    editable: ["amount", "categoryId", "endDate", "frequency", "icon", "name", "nextDueDate", "ownerMemberId", "status", "vendor"],
    fields: (f) => [...recurringFields(f), { format: capitalized, key: "status", label: "Status" }],
    noun: "recurring bill",
    references: (r) => ({ categoryIds: ids(r.categoryId), memberIds: ids(r.ownerMemberId) }),
    summary: (f, r) => recurringSummary(f, r as RecurringSnapshot),
  },
  savings_contribution: {
    children: [],
    editable: ["amount", "date", "memberId"],
    fields: contributionFields,
    noun: "contribution",
    parentNoun: "savings goal",
    references: (r) => ({ categoryIds: [], memberIds: ids(r.memberId), parentId: String(r.goalId) }),
    summary: (f, r) => `${f.money(r.amount)} · by ${f.member(r.memberId)}`,
  },
  savings_goal: {
    children: [
      {
        kind: "contributions",
        removed: (n) => `This also removes ${plural(n, "contribution")}.`,
        restored: (n) => `Also brings back ${plural(n, "contribution")}.`,
      },
    ],
    editable: ["description", "image", "name", "ownerMemberId", "targetAmount", "targetDate"],
    fields: (f) => [...goalFields(f), { format: (v) => (v ? "Photo" : null), key: "image", label: "Photo" }],
    noun: "savings goal",
    references: (r) => ({ categoryIds: [], memberIds: ids(r.ownerMemberId) }),
    summary: (f, r) => goalSummary(f, r as SavingsGoalSnapshot),
  },
};
```

- [ ] **Step 4: Implement the planner** — `src/modules/activity/lib/revert/plan.ts`:

```ts
import type { ActivityAction, ActivityChange, ActivityEntityType, ActivityLog, ActivitySnapshot, ActivitySource } from "@/db/schema";
import { expenseSummary, type ExpenseSnapshot } from "@/modules/expenses/lib/expense-activity";

import type { ActivityFormatters } from "../activity-values";
import type { FieldSpec } from "../diff";
import { rawEqual } from "../snapshot";
import { ENTITY_REVERT, type EntityRevert } from "./entities";

type Row = ActivitySnapshot;

export type RevertMode = "restore" | "undo"; // undo = only this change; restore = to before this change

// What exists *now*, loaded by the entity's store (household-scoped).
export type RevertContext = {
  children: Record<string, Row[]>;
  references: { categoryIds: ReadonlySet<string>; memberIds: ReadonlySet<string>; parentIds: ReadonlySet<string> };
  row: null | Row;
};

export type ParentUpdate = { id: string; set: Row };

export type RevertOperation =
  | { deleteExpenseId: null | string; set: Row; type: "unpay" }
  | { parentUpdate?: ParentUpdate; type: "delete" }
  | { related: Record<string, Row[]>; row: Row; type: "insert" }
  | { set: Row; type: "update" };

export type RevertPlan =
  | { changes: ActivityChange[]; kind: "apply"; operation: RevertOperation; warnings: string[] }
  | { kind: "blocked" | "noop"; reason: string };

export type RevertableEntry = Pick<ActivityLog, "action" | "after" | "before" | "entityType" | "related">;

const UNREVERTIBLE: ReadonlySet<ActivityEntityType> = new Set(["account"]);

export function isRevertible(entry: { entityType: ActivityEntityType; hasSnapshot: boolean; source: ActivitySource }): boolean {
  return entry.hasSnapshot && entry.source !== "import" && !UNREVERTIBLE.has(entry.entityType) && entry.entityType in ENTITY_REVERT;
}

export function revertModes(action: ActivityAction): RevertMode[] {
  return action === "updated" ? ["undo", "restore"] : ["undo"];
}

const blocked = (reason: string): RevertPlan => ({ kind: "blocked", reason });
const noop = (reason: string): RevertPlan => ({ kind: "noop", reason });

function labelOf(fields: FieldSpec<Row>[], key: string): string {
  return fields.find((s) => s.key === key)?.label ?? key;
}

// current → target for every displayed field whose raw value differs. Two raw
// values can format the same (e.g. two photos), so those still get a line.
function describeChanges(fields: FieldSpec<Row>[], current: Row, target: Row): ActivityChange[] {
  const changes: ActivityChange[] = [];
  for (const spec of fields) {
    if (rawEqual(current[spec.key], target[spec.key])) continue;
    const from = spec.format(current[spec.key]);
    const to = spec.format(target[spec.key]);
    changes.push(from === to ? { field: spec.label, from: "Current version", to: "Earlier version" } : { field: spec.label, from, to });
  }
  return changes;
}

// Every displayed value of a row, as appearing (restore) or disappearing (remove).
function describeRow(fields: FieldSpec<Row>[], row: Row, direction: "remove" | "restore"): ActivityChange[] {
  return fields.flatMap((spec) => {
    const value = spec.format(row[spec.key]);
    if (value === null) return [];
    return [direction === "remove" ? { field: spec.label, from: value, to: null } : { field: spec.label, from: null, to: value }];
  });
}

function planUpdate(config: EntityRevert, fields: FieldSpec<Row>[], entry: RevertableEntry, context: RevertContext, mode: RevertMode): RevertPlan {
  const before = entry.before ?? {};
  const after = entry.after ?? {};
  const current = context.row;
  if (!current) return blocked(`This ${config.noun} has since been deleted — revert that deletion first.`);

  const keys = config.editable.filter((key) => key in before && (mode === "restore" || !rawEqual(before[key], after[key])));
  const set: Row = {};
  for (const key of keys) if (!rawEqual(current[key], before[key])) set[key] = before[key] ?? null;
  if (Object.keys(set).length === 0) return noop("Already back to how it was.");

  const target = { ...current, ...set };
  const warnings = Object.keys(set)
    .filter((key) => key in after && !rawEqual(current[key], after[key]))
    .map((key) => {
      const spec = fields.find((s) => s.key === key);
      const now = spec?.format(current[key]);
      return `This also overrides a later change to ${labelOf(fields, key)}${now ? ` (now ${now})` : ""}.`;
    });
  return { changes: describeChanges(fields, current, target), kind: "apply", operation: { set, type: "update" }, warnings };
}

function planRemove(config: EntityRevert, fields: FieldSpec<Row>[], entry: RevertableEntry, context: RevertContext, f: ActivityFormatters): RevertPlan {
  if (!context.row) return noop("Already removed.");
  const changes = describeRow(fields, context.row, "remove");
  const warnings = config.children.flatMap((child) => {
    const n = context.children[child.kind]?.length ?? 0;
    return n > 0 && child.removed ? [child.removed(n)] : [];
  });

  let parentUpdate: ParentUpdate | undefined;
  const link = entry.related?.loan?.[0];
  const loan = context.children.loan?.[0];
  if (entry.entityType === "loan_payment" && link && loan) {
    if (rawEqual(loan.nextInstallmentDate, link.nextInstallmentDateAfter)) {
      parentUpdate = { id: String(link.id), set: { nextInstallmentDate: link.nextInstallmentDateBefore ?? null } };
      changes.push({ field: "Next installment", from: f.date(loan.nextInstallmentDate), to: f.date(link.nextInstallmentDateBefore) });
    } else {
      warnings.push("Next installment date was changed since — left as is.");
    }
  }
  return { changes, kind: "apply", operation: parentUpdate ? { parentUpdate, type: "delete" } : { type: "delete" }, warnings };
}

function planRestore(config: EntityRevert, fields: FieldSpec<Row>[], entry: RevertableEntry, context: RevertContext): RevertPlan {
  const before = entry.before;
  if (!before) return blocked("This change can't be reverted.");
  if (context.row) return blocked(`This ${config.noun} already exists again.`);

  const refs = config.references(before);
  if (refs.categoryIds.some((id) => !context.references.categoryIds.has(id))) return blocked("Its category no longer exists.");
  if (refs.memberIds.some((id) => !context.references.memberIds.has(id))) {
    return blocked("A member it belonged to is no longer in the household.");
  }
  if (refs.parentId !== undefined && !context.references.parentIds.has(refs.parentId)) {
    return blocked(`The ${config.parentNoun ?? "item"} it belonged to no longer exists — revert that deletion first.`);
  }

  const related = entry.related ?? {};
  const warnings = config.children.flatMap((child) => {
    const n = related[child.kind]?.length ?? 0;
    return n > 0 && child.restored ? [child.restored(n)] : [];
  });
  return { changes: describeRow(fields, before, "restore"), kind: "apply", operation: { related, row: before, type: "insert" }, warnings };
}

function planUnpay(fields: FieldSpec<Row>[], entry: RevertableEntry, context: RevertContext, f: ActivityFormatters): RevertPlan {
  const before = entry.before ?? {};
  const after = entry.after ?? {};
  const bill = context.row;
  if (!bill) return blocked("This recurring bill has since been deleted — revert that deletion first.");

  const set: Row = {};
  for (const key of ["nextDueDate", "status"]) if (key in before && !rawEqual(bill[key], before[key])) set[key] = before[key] ?? null;
  const expense = context.children.createdExpense?.[0] ?? null;
  if (!expense && Object.keys(set).length === 0) return noop("Already back to how it was.");

  const changes = describeChanges(fields, bill, { ...bill, ...set });
  if (expense) changes.push({ field: "Expense", from: expenseSummary(f, expense as ExpenseSnapshot), to: null });
  const warnings: string[] = [];
  if ("nextDueDate" in set && !rawEqual(bill.nextDueDate, after.nextDueDate)) {
    warnings.push(`This also overrides a later change to Next due (now ${f.date(bill.nextDueDate)}).`);
  }
  if (!expense) warnings.push("The expense it created was already removed.");
  return { changes, kind: "apply", operation: { deleteExpenseId: expense ? String(expense.id) : null, set, type: "unpay" }, warnings };
}

export function planRevert(entry: RevertableEntry, context: RevertContext, mode: RevertMode, f: ActivityFormatters): RevertPlan {
  const config = ENTITY_REVERT[entry.entityType];
  if (!config || (!entry.before && !entry.after)) return blocked("This change can't be reverted.");
  const fields = config.fields(f);

  if (entry.action === "created") return planRemove(config, fields, entry, context, f);
  if (entry.action === "deleted") return planRestore(config, fields, entry, context);
  if (entry.action === "paid") return planUnpay(fields, entry, context, f);
  return planUpdate(config, fields, entry, context, mode);
}
```

- [ ] **Step 5: Run — expect PASS** (`npx vitest run src/modules/activity/lib/revert`). Fix the implementation, not the tests, unless a test contradicts the spec (then ledger a ruling).

- [ ] **Step 6: Commit**

```bash
npm run lint -- --fix
git add src/modules/activity/lib/revert
git commit -m "feat(activity): pure revert planner with per-entity rules"
```

---

### Task 4: Capture snapshots — expenses, budget, income

**Files:** `src/modules/expenses/api/expenses.actions.ts`, `src/modules/budget/api/budget.actions.ts`

**Interfaces:** Consumes Task 1 `ActivityEntry.before/after`.

- [ ] **Step 1: Expenses** — add snapshots to every `logActivity`/`logActivities` call:
  - `createExpenseForHousehold`: `after: created`.
  - bulk: each entry `after: row`.
  - `updateExpenseAction`: change the update to `const [updated] = await db.update(expenses).set({...}).where(...).returning();` and log `after: updated, before`.
  - `deleteExpenseAction`: `before`.
- [ ] **Step 2: Budget**
  - `setBudgetItemAction`: make the transaction return the whole row — `.returning()` (no column selection) on the insert/upsert, and for the shared-update branch `const [updated] = await tx.update(budgetItems).set(...).where(...).returning(); return updated;` — then `const item = await db.transaction(...)`, `itemId = item.id`, and log `after: item, before` (before may be undefined → pass `before ?? null`).
  - `copyPreviousMonthBudgetAction`: each entry `after: item`.
  - `setIncomeAction`: `.returning()` full row as `saved`; log `after: saved, before: before ?? null`.
- [ ] **Step 3: Verify** — `npx tsc --noEmit && npx vitest run` → clean / PASS. Manually: `DATABASE_URL="$LOCAL_DB" npx tsx -e` is not needed; e2e in Task 9 covers expenses end to end.
- [ ] **Step 4: Commit** — `git commit -m "feat(activity): capture snapshots for expenses, budget lines and income"`.

---

### Task 5: Capture snapshots — savings, loans, dhuku

**Files:** `savings-goals.actions.ts`, `loans.actions.ts`, `dhuku.actions.ts`

- [ ] **Step 1: Savings**
  - create: `after: created`; update: `.returning()` → `after: updated, before`; contribution add: `after: created`.
  - delete: before deleting, `const contributions = await db.select().from(savingsContributions).where(eq(savingsContributions.goalId, id));` and log `before, related: { contributions }`.
- [ ] **Step 2: Loans**
  - create `after: created`; update `.returning()` → `after: updated, before`.
  - delete: `const payments = await db.select().from(loanPayments).where(eq(loanPayments.loanId, id));` → `before, related: { loanPayments: payments }`.
  - payment add: make the transaction return `{ advancedTo: string | null, row }` (set `advancedTo = nextInstallmentDate` when it rolls forward), then log `after: created, related: advancedTo ? { loan: [{ id: loan.id, nextInstallmentDateAfter: advancedTo, nextInstallmentDateBefore: loan.nextInstallmentDate }] } : undefined`.
  - payment delete: `before: payment`.
- [ ] **Step 3: Dhuku**
  - create `after: created`; update `.returning()` → `after: updated, before`; entry add `after: created`; entry delete `before: entry`.
  - delete: `const entries = await db.select().from(dhukuEntries).where(eq(dhukuEntries.dhukuId, id));` → `before, related: { dhukuEntries: entries }`.
- [ ] **Step 4: Verify + commit** — `npx tsc --noEmit && npx vitest run`; `git commit -m "feat(activity): capture snapshots for savings, loans and dhuku"`.

---

### Task 6: Capture snapshots — recurring, categories, settings

**Files:** `recurring.actions.ts`, `categories.actions.ts`, `settings.actions.ts`

- [ ] **Step 1: Recurring**
  - create `after: created`; update `.returning()` → `after: updated, before`.
  - delete: `const linked = await db.select({ id: expenses.id }).from(expenses).where(and(eq(expenses.recurringExpenseId, id), eq(expenses.householdId, householdId)));` → `before, related: { linkedExpenseIds: linked }`.
  - status: `.returning()` → `after: updated, before`.
  - mark paid: the transaction returns `{ bill, expense }` where `bill` comes from `.returning()` on the recurring update; the `paid` entry gets `after: bill, before: item, related: { createdExpense: [expense] }`, the expense entry gets `after: expense`.
- [ ] **Step 2: Categories** — create: `.returning()` (full row) as `row`, log `after: row`, and keep returning the same subset object to callers (`{ archived, budgetType, groupName, id, name }` picked from `row`); update `.returning()` → `after: updated, before`; archive/restore `.returning()` → `after: updated, before`.
- [ ] **Step 3: Settings** — date format: `before: { dateFormat: before.dateFormat }, after: { dateFormat: format }`; planner: `before: { plannerEnabled: before.plannerEnabled }, after: { plannerEnabled: enabled }`. Account entries unchanged (no snapshots).
- [ ] **Step 4: Verify + commit** — `npx tsc --noEmit && npx vitest run`; coverage check: `grep -n "logActivit" src/modules/*/api/*.actions.ts` — every call except the two `account` ones passes `before` and/or `after`. `git commit -m "feat(activity): capture snapshots for recurring, categories and settings"`.

---

### Task 7: Revert store and server actions

**Files:**
- Create: `src/modules/activity/api/revert-store.ts`
- Create: `src/modules/activity/api/revert.actions.ts`

**Interfaces:**
- Consumes: Task 1 `reviveRow`, `toSnapshot`; Task 3 planner types/functions.
- Produces: `REVERT_STORES: Partial<Record<ActivityEntityType, RevertStore>>`; `previewRevertAction(entryId, mode): Promise<RevertPreview>`; `revertActivityAction(entryId, mode): Promise<RevertResult>` where `RevertResult = { ok: true } | { ok: false; reason: string }` (expected failures are returned, not thrown — production Next.js redacts thrown server-action messages); `RevertPreview = { changes: ActivityChange[]; kind: "apply" | "blocked" | "noop"; reason: null | string; warnings: string[] }`.

- [ ] **Step 1: Store** — `revert-store.ts` (no `"use server"`; DB access is server-only via `@/db/client`):

```ts
import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import {
  type ActivityEntityType,
  type ActivityLog,
  type ActivitySnapshot,
  budgetItems,
  categories,
  dhukuEntries,
  dhukus,
  expenses,
  householdMembers,
  households,
  incomes,
  loanPayments,
  loans,
  monthlyBudgets,
  recurringExpenses,
  savingsContributions,
  savingsGoals,
} from "@/db/schema";

import type { RevertContext, RevertOperation } from "../lib/revert/plan";
import { reviveRow, toSnapshot } from "../lib/snapshot";

type Row = ActivitySnapshot;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type RevertStore = {
  apply: (tx: Tx, householdId: string, entityId: string, op: RevertOperation) => Promise<void>;
  load: (householdId: string, entityId: string, entry: ActivityLog) => Promise<RevertContext>;
};

type ChildOps = {
  find: (householdId: string, parentId: string) => Promise<object[]>;
  insert: (tx: Tx, householdId: string, parentId: string, rows: Row[]) => Promise<unknown>;
  kind: string;
};

// Table-specific closures keep Drizzle's types concrete; every one of them is
// scoped to the household (directly, or through the parent table).
type TableOps = {
  children?: ChildOps[];
  extra?: (householdId: string, entry: ActivityLog) => Promise<Record<string, object[]>>;
  find: (householdId: string, id: string) => Promise<object | undefined>;
  insert: (tx: Tx, householdId: string, row: Row) => Promise<unknown>;
  parentIds?: (householdId: string) => Promise<string[]>;
  remove: (tx: Tx, householdId: string, id: string, op: Extract<RevertOperation, { type: "delete" }>) => Promise<unknown>;
  unpay?: (tx: Tx, householdId: string, id: string, op: Extract<RevertOperation, { type: "unpay" }>) => Promise<unknown>;
  update: (tx: Tx, householdId: string, id: string, set: Row) => Promise<unknown>;
};

async function householdReferences(householdId: string) {
  const [cats, members] = await Promise.all([
    db.select({ id: categories.id }).from(categories).where(eq(categories.householdId, householdId)),
    db.select({ id: householdMembers.id }).from(householdMembers).where(eq(householdMembers.householdId, householdId)),
  ]);
  return { categoryIds: new Set(cats.map((c) => c.id)), memberIds: new Set(members.map((m) => m.id)) };
}

function tableStore(ops: TableOps): RevertStore {
  return {
    async apply(tx, householdId, entityId, op) {
      if (op.type === "update") await ops.update(tx, householdId, entityId, op.set);
      else if (op.type === "delete") await ops.remove(tx, householdId, entityId, op);
      else if (op.type === "unpay" && ops.unpay) await ops.unpay(tx, householdId, entityId, op);
      else if (op.type === "insert") {
        await ops.insert(tx, householdId, op.row);
        for (const child of ops.children ?? []) {
          const rows = op.related[child.kind] ?? [];
          if (rows.length > 0) await child.insert(tx, householdId, entityId, rows);
        }
      } else throw new Error(`Unsupported revert operation: ${op.type}`);
    },
    async load(householdId, entityId, entry) {
      const [row, refs, parentIds, children, extra] = await Promise.all([
        ops.find(householdId, entityId),
        householdReferences(householdId),
        ops.parentIds ? ops.parentIds(householdId) : Promise.resolve([]),
        Promise.all((ops.children ?? []).map(async (c) => [c.kind, await c.find(householdId, entityId)] as const)),
        ops.extra ? ops.extra(householdId, entry) : Promise.resolve({}),
      ]);
      const loaded = { ...Object.fromEntries(children), ...extra };
      return {
        children: Object.fromEntries(Object.entries(loaded).map(([kind, rows]) => [kind, rows.map((r) => toSnapshot(r))])),
        references: { ...refs, parentIds: new Set(parentIds) },
        row: row ? toSnapshot(row) : null,
      };
    },
  };
}

const goalIdsOf = (householdId: string) => db.select({ id: savingsGoals.id }).from(savingsGoals).where(eq(savingsGoals.householdId, householdId));
const loanIdsOf = (householdId: string) => db.select({ id: loans.id }).from(loans).where(eq(loans.householdId, householdId));
const dhukuIdsOf = (householdId: string) => db.select({ id: dhukus.id }).from(dhukus).where(eq(dhukus.householdId, householdId));
const budgetIdsOf = (householdId: string) =>
  db.select({ id: monthlyBudgets.id }).from(monthlyBudgets).where(eq(monthlyBudgets.householdId, householdId));
const idsOf = async (query: Promise<{ id: string }[]>) => (await query).map((r) => r.id);
```

Then one `tableStore({...})` per entity, following this pattern (shown in full for `expense`; the others differ only in table/scope):

```ts
const expenseStore = tableStore({
  find: async (h, id) => (await db.select().from(expenses).where(and(eq(expenses.id, id), eq(expenses.householdId, h))))[0],
  insert: (tx, h, row) => tx.insert(expenses).values({ ...reviveRow(expenses, row), householdId: h }),
  remove: (tx, h, id) => tx.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.householdId, h))),
  update: (tx, h, id, set) => tx.update(expenses).set(reviveRow(expenses, set)).where(and(eq(expenses.id, id), eq(expenses.householdId, h))),
});
```

- `incomeStore`, `categoryStore`: same shape with `incomes` / `categories` (insert forces `householdId: h`).
- `budgetItemStore`: scope `inArray(budgetItems.monthlyBudgetId, budgetIdsOf(h))`; `parentIds: (h) => idsOf(budgetIdsOf(h))`; insert without householdId.
- `goalStore`: `savingsGoals`, `children: [{ kind: "contributions", find: (h, goalId) => db.select().from(savingsContributions).where(and(eq(savingsContributions.goalId, goalId), inArray(savingsContributions.goalId, goalIdsOf(h)))), insert: (tx, _h, _p, rows) => tx.insert(savingsContributions).values(rows.map((r) => reviveRow(savingsContributions, r))) }]`.
- `contributionStore`: scope `inArray(savingsContributions.goalId, goalIdsOf(h))`, `parentIds: (h) => idsOf(goalIdsOf(h))`.
- `loanStore`: `loans` with child `loanPayments` (same pattern as contributions).
- `loanPaymentStore`: scope via `loanIdsOf`, `parentIds`, plus

```ts
  extra: async (h, entry) => {
    const loanId = (entry.after ?? entry.before)?.loanId;
    if (typeof loanId !== "string") return {};
    return { loan: await db.select().from(loans).where(and(eq(loans.id, loanId), eq(loans.householdId, h))) };
  },
  remove: async (tx, h, id, op) => {
    await tx.delete(loanPayments).where(and(eq(loanPayments.id, id), inArray(loanPayments.loanId, loanIdsOf(h))));
    if (op.parentUpdate) {
      await tx
        .update(loans)
        .set(reviveRow(loans, op.parentUpdate.set))
        .where(and(eq(loans.id, op.parentUpdate.id), eq(loans.householdId, h)));
    }
  },
```

- `dhukuStore` (child `dhukuEntries`) and `dhukuEntryStore` (scope via `dhukuIdsOf`) like loans/payments.
- `recurringStore`: `recurringExpenses` (forces householdId) with

```ts
  children: [
    {
      find: async () => [], // nothing to count on removal: deleting a bill only unlinks its expenses
      insert: (tx, h, billId, rows) =>
        tx
          .update(expenses)
          .set({ recurringExpenseId: billId })
          .where(and(inArray(expenses.id, rows.map((r) => String(r.id))), eq(expenses.householdId, h), isNull(expenses.recurringExpenseId))),
      kind: "linkedExpenseIds",
    },
  ],
  extra: async (h, entry) => {
    const created = entry.related?.createdExpense?.[0]?.id;
    if (entry.action !== "paid" || typeof created !== "string") return {};
    return { createdExpense: await db.select().from(expenses).where(and(eq(expenses.id, created), eq(expenses.householdId, h))) };
  },
  unpay: async (tx, h, id, op) => {
    if (op.deleteExpenseId) await tx.delete(expenses).where(and(eq(expenses.id, op.deleteExpenseId), eq(expenses.householdId, h)));
    if (Object.keys(op.set).length > 0) {
      await tx.update(recurringExpenses).set(reviveRow(recurringExpenses, op.set)).where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.householdId, h)));
    }
  },
```

- `settingsStore` (custom, not `tableStore`):

```ts
const NO_REFERENCES = { categoryIds: new Set<string>(), memberIds: new Set<string>(), parentIds: new Set<string>() };

const settingsStore: RevertStore = {
  async apply(tx, householdId, entityId, op) {
    if (op.type !== "update" || entityId !== householdId) throw new Error("Unsupported settings revert");
    await tx.update(households).set(reviveRow(households, op.set)).where(eq(households.id, householdId));
  },
  async load(householdId, entityId) {
    const rows =
      entityId === householdId
        ? await db.select({ dateFormat: households.dateFormat, plannerEnabled: households.plannerEnabled }).from(households).where(eq(households.id, householdId))
        : [];
    return { children: {}, references: NO_REFERENCES, row: rows[0] ? toSnapshot(rows[0]) : null };
  },
};

export const REVERT_STORES: Partial<Record<ActivityEntityType, RevertStore>> = {
  budget_item: budgetItemStore,
  category: categoryStore,
  dhuku: dhukuStore,
  dhuku_entry: dhukuEntryStore,
  expense: expenseStore,
  household_settings: settingsStore,
  income: incomeStore,
  loan: loanStore,
  loan_payment: loanPaymentStore,
  recurring_expense: recurringStore,
  savings_contribution: contributionStore,
  savings_goal: goalStore,
};
```

- [ ] **Step 2: Actions** — `revert.actions.ts`:

```ts
"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db/client";
import { type ActivityAction, type ActivityChange, type ActivityLog, activityLogs } from "@/db/schema";
import { type CurrentMember, getCurrentMember } from "@/lib/session";

import type { ActivityFormatters } from "../lib/activity-values";
import { ENTITY_REVERT } from "../lib/revert/entities";
import { isRevertible, planRevert, type RevertContext, type RevertMode, type RevertOperation, type RevertPlan, revertModes } from "../lib/revert/plan";
import { activityActor, loadActivityFormatters, logActivity } from "./activity";
import { REVERT_STORES, type RevertStore } from "./revert-store";

const inputSchema = z.object({ entryId: z.string().uuid(), mode: z.enum(["restore", "undo"]) });

export type RevertPreview = { changes: ActivityChange[]; kind: RevertPlan["kind"]; reason: null | string; warnings: string[] };

const LOGGED_ACTION: Record<RevertOperation["type"], ActivityAction> = {
  delete: "deleted",
  insert: "created",
  unpay: "updated",
  update: "updated",
};

type Prepared =
  | { context: RevertContext; entry: ActivityLog; entityId: string; f: ActivityFormatters; ok: true; plan: RevertPlan; store: RevertStore }
  | { ok: false; plan: RevertPlan };

// Always re-reads the entry and the live row for *this* household, so a
// stale preview or a crafted id can never act on anything else.
async function prepare(member: CurrentMember, entryId: string, mode: RevertMode): Promise<Prepared> {
  const input = inputSchema.parse({ entryId, mode });
  const [entry] = await db
    .select()
    .from(activityLogs)
    .where(and(eq(activityLogs.id, input.entryId), eq(activityLogs.householdId, member.householdId)));
  if (!entry) throw new Error("Activity entry not found");

  const store = REVERT_STORES[entry.entityType];
  const hasSnapshot = entry.before !== null || entry.after !== null;
  if (!store || !entry.entityId || !isRevertible({ ...entry, hasSnapshot }) || !revertModes(entry.action).includes(input.mode)) {
    return { ok: false, plan: { kind: "blocked", reason: "This change can't be reverted." } };
  }
  const [context, f] = await Promise.all([store.load(member.householdId, entry.entityId, entry), loadActivityFormatters(member.householdId)]);
  return { context, entityId: entry.entityId, entry, f, ok: true, plan: planRevert(entry, context, input.mode, f), store };
}

export async function previewRevertAction(entryId: string, mode: RevertMode): Promise<RevertPreview> {
  const { plan } = await prepare(await getCurrentMember(), entryId, mode);
  return plan.kind === "apply"
    ? { changes: plan.changes, kind: "apply", reason: null, warnings: plan.warnings }
    : { changes: [], kind: plan.kind, reason: plan.reason, warnings: [] };
}

export type RevertResult = { ok: false; reason: string } | { ok: true };

// Expected failures (blocked / nothing to do) are returned rather than thrown:
// production Next.js replaces thrown server-action messages with a generic one.
export async function revertActivityAction(entryId: string, mode: RevertMode): Promise<RevertResult> {
  const member = await getCurrentMember();
  const prepared = await prepare(member, entryId, mode);
  if (!prepared.ok || prepared.plan.kind !== "apply") {
    return { ok: false, reason: prepared.plan.kind === "apply" ? "This change can't be reverted." : prepared.plan.reason };
  }
  const { context, entityId, entry, f, plan, store } = prepared;
  const op = plan.operation;

  await db.transaction((tx) => store.apply(tx, member.householdId, entityId, op));

  const config = ENTITY_REVERT[entry.entityType]!;
  const resulting =
    op.type === "insert" ? op.row : op.type === "delete" ? (context.row ?? {}) : { ...(context.row ?? {}), ...op.set };
  const cascaded = Object.fromEntries(config.children.filter((c) => c.removed).map((c) => [c.kind, context.children[c.kind] ?? []]));

  await logActivity(activityActor(member), {
    action: LOGGED_ACTION[op.type],
    after: op.type === "delete" ? null : resulting,
    before: op.type === "insert" ? null : context.row,
    changes: plan.changes,
    entityId,
    entityType: entry.entityType,
    related: op.type === "delete" ? cascaded : undefined,
    revertOfId: entry.id,
    summary: config.summary(f, resulting),
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit && npx vitest run && npm run lint` → clean. (End-to-end behaviour is covered in Task 9.)
- [ ] **Step 4: Commit** — `git commit -m "feat(activity): revert store and preview/apply server actions"`.

---

### Task 8: Revert UI

**Files:**
- Modify: `src/modules/activity/api/activity.ts` (`listActivity` returns `ActivityListEntry` without snapshots)
- Modify: `src/modules/activity/lib/activity-format.ts` (+ test) — reverted wording
- Create: `src/modules/activity/components/ChangeList.tsx`
- Create: `src/modules/activity/components/RevertButton.tsx`
- Modify: `ActivityRow.tsx`, `ActivityTimeline.tsx`

**Interfaces:**
- Produces: `ActivityListEntry = Omit<ActivityLog, "after" | "before" | "related"> & { hasSnapshot: boolean }`; `describeActivity(action, entityType, reverted?: boolean)`.

- [ ] **Step 1: Failing test for the reverted wording** — in `activity-format.test.ts`:

```ts
  it("describes an entry written by a revert", () => {
    expect(describeActivity("updated", "expense", true)).toBe("reverted a change to an expense");
  });
```

Run → FAIL. Then in `activity-format.ts`:

```ts
// "added an expense", "marked a recurring bill paid", "reverted a change to an expense".
export function describeActivity(action: ActivityAction, entityType: ActivityEntityType, reverted = false): string {
  const noun = ENTITY_NOUNS[entityType];
  if (reverted) return `reverted a change to ${noun}`;
  return action === "paid" ? `marked ${noun} paid` : `${ACTION_VERBS[action]} ${noun}`;
}
```

Run → PASS.

- [ ] **Step 2: Lighter list query** — in `listActivity`, select every column except the snapshots, plus a flag (snapshots can hold goal photos; the list never needs them):

```ts
export type ActivityListEntry = Omit<ActivityLog, "after" | "before" | "related"> & { hasSnapshot: boolean };

const LIST_COLUMNS = {
  action: activityLogs.action,
  actorMemberId: activityLogs.actorMemberId,
  actorName: activityLogs.actorName,
  changes: activityLogs.changes,
  createdAt: activityLogs.createdAt,
  entityId: activityLogs.entityId,
  entityType: activityLogs.entityType,
  hasSnapshot: sql<boolean>`(${activityLogs.before} is not null or ${activityLogs.after} is not null)`,
  householdId: activityLogs.householdId,
  id: activityLogs.id,
  revertOfId: activityLogs.revertOfId,
  source: activityLogs.source,
  summary: activityLogs.summary,
};
```

`db.select(LIST_COLUMNS)…`; return type `{ entries: ActivityListEntry[]; … }`. Update `ActivityTimeline`/`ActivityRow` prop types from `ActivityLog` to `ActivityListEntry`.

- [ ] **Step 3: Shared change list** — `components/ChangeList.tsx` (no hooks; usable from server and client components), moving the `<dl>` out of `ActivityRow`:

```tsx
import type { ActivityChange } from "@/db/schema";

export function ChangeList({ changes }: { changes: ActivityChange[] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-muted px-3 py-2 text-sm">
      {changes.map((change) => (
        <div className="contents" key={change.field}>
          <dt className="text-muted-foreground">{change.field}</dt>
          <dd className="break-words">
            <span className="line-through opacity-60">{change.from ?? "—"}</span> → {change.to ?? "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
```

`ActivityRow` renders `<ChangeList changes={changes} />` inside its `<details>` (with `className="mt-2"` wrapper).

- [ ] **Step 4: Revert button + dialog** — `components/RevertButton.tsx`:

```tsx
"use client";

import { useRef, useState, useTransition } from "react";

import { TriangleAlert, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { previewRevertAction, type RevertPreview, revertActivityAction } from "../api/revert.actions";
import type { RevertMode } from "../lib/revert/plan";
import { ChangeList } from "./ChangeList";

const MODES: Record<RevertMode, { description: string; label: string }> = {
  restore: {
    description: "Put every field back to how it was before this change — later edits are undone too.",
    label: "Restore to before this change",
  },
  undo: { description: "Put back only what this change altered; later edits stay.", label: "Undo only this change" },
};

const message = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong");

type Props = { description: string; entryId: string; modes: RevertMode[] };

export function RevertButton({ description, entryId, modes }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<RevertMode>(modes[0]);
  const [preview, setPreview] = useState<null | RevertPreview>(null);
  const [error, setError] = useState<null | string>(null);
  const [isReverting, startReverting] = useTransition();
  // Ignores a slow preview that arrives after the user switched modes.
  const latestRequest = useRef(0);

  function loadPreview(nextMode: RevertMode) {
    const request = ++latestRequest.current;
    setMode(nextMode);
    setPreview(null);
    setError(null);
    previewRevertAction(entryId, nextMode)
      .then((result) => request === latestRequest.current && setPreview(result))
      .catch((e: unknown) => request === latestRequest.current && setError(message(e)));
  }

  function openDialog() {
    setOpen(true);
    loadPreview(modes[0]);
  }

  function revert() {
    startReverting(async () => {
      try {
        const result = await revertActivityAction(entryId, mode);
        if (!result.ok) {
          toast.error(result.reason);
          loadPreview(mode);
          return;
        }
        toast.success("Reverted");
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(message(e));
        loadPreview(mode);
      }
    });
  }

  return (
    <>
      <Button className="h-7 gap-1 px-2 text-xs" onClick={openDialog} size="sm" type="button" variant="ghost">
        <Undo2 className="h-3.5 w-3.5" />
        Revert
      </Button>
      <Modal
        footer={
          <>
            <Button onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={preview?.kind !== "apply" || isReverting} onClick={revert} type="button">
              {isReverting ? "Reverting..." : "Revert"}
            </Button>
          </>
        }
        icon={Undo2}
        onOpenChange={setOpen}
        open={open}
        title="Revert this change?"
        tone="amber"
      >
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">{description}</p>

          {modes.length > 1 && (
            <div aria-label="How to revert" className="grid gap-2" role="radiogroup">
              {modes.map((m) => (
                <label
                  className={cn("flex cursor-pointer gap-3 rounded-lg border p-3", mode === m && "border-primary bg-primary/5")}
                  key={m}
                >
                  <input checked={mode === m} className="mt-1" name="revert-mode" onChange={() => loadPreview(m)} type="radio" />
                  <span>
                    <span className="font-medium">{MODES[m].label}</span>
                    <span className="block text-xs text-muted-foreground">{MODES[m].description}</span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {error && <p className="text-destructive">{error}</p>}
          {!preview && !error && <p className="text-muted-foreground">Checking what will change…</p>}
          {preview && preview.kind !== "apply" && <p className="rounded-lg bg-muted px-3 py-2">{preview.reason}</p>}
          {preview?.kind === "apply" && (
            <>
              <div className="space-y-1">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">This will change</p>
                <ChangeList changes={preview.changes} />
              </div>
              {preview.warnings.length > 0 && (
                <ul className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  {preview.warnings.map((warning) => (
                    <li className="flex gap-2" key={warning}>
                      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {warning}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
```

- [ ] **Step 5: Wire into `ActivityRow`** — after the summary line:

```tsx
        {isRevertible(entry) && (
          <RevertButton
            description={`${entry.actorName} ${sentence} · ${entry.summary} · ${formatKathmanduTime(entry.createdAt)}`}
            entryId={entry.id}
            modes={revertModes(entry.action)}
          />
        )}
```

where `sentence = describeActivity(entry.action, entry.entityType, entry.revertOfId !== null)` (also used in the heading line). Import `isRevertible`, `revertModes` from `../lib/revert/plan`.

- [ ] **Step 6: Verify** — `npx tsc --noEmit && npx vitest run && npm run lint`. Confirm a `<Toaster />` is mounted (`grep -rn "Toaster" src/app`); if not, the `toast` calls still work only where one is mounted — add `<Toaster />` from `@/components/ui/sonner` to `src/app/layout.tsx` only if missing.
- [ ] **Step 7: Commit** — `git commit -m "feat(activity): revert button with preview dialog"`.

---

### Task 9: End-to-end test and docs

**Files:** Create `e2e/activity-revert.spec.ts`; modify `docs/architecture.md`.

- [ ] **Step 1: E2E spec**

```ts
import { expect, type Page, test } from "@playwright/test";

import { gotoRoute } from "./support/nav";

async function openActivity(page: Page, query: string) {
  await gotoRoute(page, "/activity");
  await page.getByPlaceholder("Search activity...").fill(query);
  await page.getByPlaceholder("Search activity...").press("Enter");
  await expect(page).toHaveURL(/q=/);
}

async function editExpense(page: Page, query: string, fill: (dialog: ReturnType<Page["getByRole"]>) => Promise<void>) {
  await gotoRoute(page, "/expenses");
  await page.getByPlaceholder("Search expenses...").fill(query);
  await page.getByRole("row").filter({ hasText: query }).getByRole("button", { name: "Row actions" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog");
  await fill(dialog);
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toBeHidden();
}

test("reverts edits both ways and brings back a deleted expense", async ({ page }) => {
  test.setTimeout(90_000);
  const token = `revert-e2e-${Date.now()}`;

  // Add, then edit the amount (the "2pm" edit), then the note (the "3pm" edit).
  await gotoRoute(page, "/expenses");
  await page.getByRole("complementary").getByRole("button", { exact: true, name: "+ Add Expense" }).click();
  const add = page.getByRole("dialog");
  await add.getByLabel("Amount").fill("1234");
  await add.getByLabel("Note (optional)").fill(`${token}-a`);
  await add.getByRole("button", { name: "Add Expense" }).click();
  await expect(add).toBeHidden();
  await editExpense(page, token, (d) => d.getByLabel("Amount").fill("4321"));
  await editExpense(page, token, (d) => d.getByLabel("Note (optional)").fill(`${token}-b`));

  // Undo only the amount edit: amount back to 1,234, note stays -b.
  await openActivity(page, token);
  const entries = page.getByRole("listitem").filter({ hasText: token });
  const amountEdit = entries.filter({ hasText: "edited an expense" }).filter({ hasText: `${token}-a` });
  await amountEdit.getByRole("button", { name: "Revert" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("radio", { name: /Undo only this change/ })).toBeChecked();
  await expect(dialog).toContainText("Amount");
  await expect(dialog).toContainText("RS 4,321");
  await expect(dialog).toContainText("RS 1,234");
  await dialog.getByRole("button", { exact: true, name: "Revert" }).click();
  await expect(dialog).toBeHidden();
  const reverts = entries.filter({ hasText: "reverted a change to an expense" });
  await expect(reverts.first()).toContainText(`RS 1,234`);
  await expect(reverts.first()).toContainText(`${token}-b`);

  // Restore to before the note edit: both fields go back, with an override warning.
  const noteEdit = entries.filter({ hasText: "edited an expense" }).filter({ hasText: `${token}-b` });
  await noteEdit.getByRole("button", { name: "Revert" }).click();
  await dialog.getByRole("radio", { name: /Restore to before this change/ }).check();
  await expect(dialog).toContainText("This also overrides a later change to Amount");
  await expect(dialog).toContainText(`${token}-a`);
  await dialog.getByRole("button", { exact: true, name: "Revert" }).click();
  await expect(dialog).toBeHidden();
  await expect(reverts).toHaveCount(2);
  await expect(reverts.first()).toContainText("RS 4,321");
  await expect(reverts.first()).toContainText(`${token}-a`);

  // Delete it, then revert the delete.
  await gotoRoute(page, "/expenses");
  await page.getByPlaceholder("Search expenses...").fill(token);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("row").filter({ hasText: token }).getByRole("button", { name: "Row actions" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.getByRole("row").filter({ hasText: token })).toHaveCount(0);

  await openActivity(page, token);
  await entries.filter({ hasText: "deleted an expense" }).getByRole("button", { name: "Revert" }).click();
  await expect(dialog).toContainText(`${token}-a`);
  await dialog.getByRole("button", { exact: true, name: "Revert" }).click();
  await expect(dialog).toBeHidden();

  await gotoRoute(page, "/expenses");
  await page.getByPlaceholder("Search expenses...").fill(token);
  await expect(page.getByRole("row").filter({ hasText: token })).toHaveCount(1);
});
```

- [ ] **Step 2: Run e2e against the LOCAL e2e database** — `E2E_DATABASE_URL="${LOCAL_DB%/piko}/piko_e2e" npx playwright test` → all specs PASS (incl. the existing activity spec).
- [ ] **Step 3: Docs** — in `docs/architecture.md` extend the Activity log bullet: "Entries also store raw `before`/`after` snapshots (and cascaded `related` rows on deletes); `src/modules/activity/lib/revert/` plans a revert (pure, per-entity registry in `entities.ts`) and `api/revert.actions.ts` applies it — household-scoped, re-planned at apply time, and logged with `revertOfId`." Extend playbook step 5: "pass `before`/`after` (and `related` for cascading deletes) to `logActivity`, and add the entity to `ENTITY_REVERT` + `REVERT_STORES`."
- [ ] **Step 4: Commit + graph** — `graphify update .`; `git commit -m "test(e2e): activity revert end to end; docs: revert architecture"`.
- [ ] **Step 5: Production (only with user approval)** — report that migration 0015 must be applied to production before deploying (`npm run db:migrate` with `.env.local` on Supabase) and ask.
