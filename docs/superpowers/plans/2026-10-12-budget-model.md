# Piko Budget Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. If you don't have those skills, do the tasks in order, one step at a time. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Budget into each person's own monthly plan that fits their pay. It carries forward by itself, sets savings, dhuku, loans and funds aside first, splits lines into fixed / essential / can-cut, and drives Home's "safe to spend" from the can-cut money. Big occasional costs get funds, and each month's leftover gets decided on and kept as a cushion.

**Architecture:** Five phases, each shippable on its own and each ending in a STOP for the owner to review, apply the database migration and test. The maths lives in small pure functions under `src/modules/<feature>/lib/` with Vitest tests written first. Server actions follow the existing `getCurrentMember()` + household-scoped query + `logActivity` pattern. Database changes are Drizzle schema edits plus generated migrations. The executor generates migrations but never applies them.

**Tech Stack:** Next.js 16 (App Router, server components, server actions), React 19, TypeScript, Drizzle ORM + PostgreSQL, Zod v4, Vitest (node, no DOM), Playwright e2e, ESLint with `eslint-plugin-perfectionist`, Husky pre-commit hook.

**Spec:** There is no separate spec file. The agreed design is the "Design (agreed)" section below, which the owner approved point by point on 2026-10-11 and 2026-10-12. Read it fully before starting.

**Verified:** on 2026-10-13 this whole plan was dry-run end to end in a throwaway copy of the repo (starting from commit `2d12c94`):
- Every edit applied cleanly, in order, exactly as written here.
- `npm run db:generate` produced the four expected migrations without asking anything.
- Every task's commit passed the pre-commit hook (`tsc` and `next build`), lint showed 0 errors throughout, and at the end all 420 unit tests passed.
- The same code passed the full browser suite (48 tests) before the two newest browser tests were added. Those two (in `budget.spec.ts` and `dashboard.spec.ts`) passed their own runs.

If a step doesn't match what you see, something has changed since then. Stop and report rather than improvise.

## How to use this plan

- Do the phases **in order**: 1 → 2 → 3 → 4 → 5. Inside a phase, do the tasks in order.
- Every phase ends with a **STOP checkpoint**. When you reach it, stop working and send the owner the report it describes. **Do not start the next phase until the owner says to go on.** Between phases the owner applies the migration to their database and tests the app.
- Code blocks are complete. Every code step is one of three kinds:
  - **"Create `path` with:"** — a new file; paste the whole block.
  - **"Replace the whole of `path` with:"** — overwrite the file with the whole block.
  - **"In `path`, find:" … "Replace it with:"** — find the exact old text (match by text, not line number) and replace it with the new text. Each old block occurs exactly once in the file at that point.
  - **"Delete `path`."** — remove the file (`git rm path`).
- Before Phase 1, create the branch once: `git switch -c feat/budget-model`. Every task commits to that branch.

## Design (agreed)

The owner approved every point below in conversation on 2026-10-11 and 2026-10-12. Read it all before Phase 1.

### Why

The two members keep fully separate money. Each lives on their own pay, gives a set amount to family, pays off debt and saves a little, and was running short because big occasional costs (a yearly internet bill, gifts, check-ups, festivals) landed in single months with nothing set aside. The old Budget page was household-wide, counted by who an expense was *for*, and had to be re-entered every month, so it went unused. This plan makes each person's month a plan that fits their own pay, carries forward by itself, and keeps a running "safe to spend" from the money they can actually cut.

### 1. Each person has their own plan (Phase 1)

1. **Per person, counted by who paid.** Budget shows one person's plan at a time (a tab per member). Spending counts against whoever paid (`paidByMemberId`), with the "pay back later" part moved onto the other person — the same wallet rule Home already uses (`walletShares` in `src/modules/dashboard/lib/wallet.ts`). This replaces the money-model rule that Budget counts by who an expense was for.
2. **One person's plan never changes the other's.** Saving or removing a line only touches that person's own line for that category and month.
3. **No new shared lines.** A new line always has an owner. Old months keep their shared lines; Budget shows them read-only on a "Shared" tab (only when the month has any) with spending shown as "—", because spending now belongs to a person.
4. **Kinds.** Every line has a kind: **Fixed** (same every month: family support, EMI, bills), **Essential** (varies but can't really be cut: petrol, groceries, medicine) or **Can cut** (lunch, shopping, dates). The kind lives **on each person's line**, not on the shared category, so the two people can disagree. `budget_items.kind` is nullable: null means "not chosen yet" and follows the category (`fixed` → Fixed, `flexible` → Essential). A new line starts with the kind that person last gave the category, else the category's default.
5. **A can-cut line's amount is its cap.** There is no separate cap field.
6. **Months carry forward by themselves.** A month where a person has no lines of their own shows their lines from their latest earlier month that has any, minus archived categories ("Carried over from Asoj"). Nothing is written until someone changes that month; the first change copies the carried plan in for real and then applies the change. Removing a person's last line in a month sets it to 0 instead of deleting it, so the month doesn't fall back to the previous plan. "Copy last month" goes away.
7. **Fill from recurring** fills the selected person's plan from *their own* recurring bills, as Fixed lines.
8. **Left to plan** = income − set aside − budgeted, per person, shown in red with "The plan is bigger than income" when below zero.
9. **Budget alerts** (80% / 100% notifications) work per person and per household month: the check finds the household's month for the expense date (Bikram Sambat or Gregorian) and compares the payer's own spending in that category with the payer's own line.

### 2. Set aside first, and pay vs extra (Phase 2)

10. **Income has two kinds.** **Pay** is the base pay a person can count on; it carries forward like lines do (a month without its own pay entry uses the latest earlier one), and is changed for a single month by entering that month's pay. **Extra** is anything else that month (bonus, leave encashment, refunds): any number of entries, each with a note. Existing income rows become that month's pay. Past months are not rewritten.
11. **The plan runs on pay only.** Extra income never makes "Left to plan" bigger.
12. **"Set aside first"** is filled in automatically from what Piko already knows, never typed twice, and never counted as Spent:
    - each savings pot plan for that person (planned vs put in by them this month);
    - each of their active dhukus: the monthly contribution, plus the monthly interest once they have taken their payout (done = contributions logged this month);
    - each loan they took that has an installment and is not paid off: the installment (weekly installments × 52 ÷ 12), capped at what's still owed (done = repayments this month);
    - from Phase 4, each of their funds' monthly set-aside.
13. Budget's figures become: **Left to plan** (the lead), **Pay** (opens the Pay & extra dialog; notes the extra and any carry-over), **Set aside first**, **Budgeted**.

### 3. Home follows the person viewing it (Phase 3)

14. Home shows the plan of the member being viewed ("viewing as" switches it). Its top figures become that person's: **Spent**, **Pay** (with "+ Rs X extra"), **Moved this month** (their savings deposits, their dhukus' payments, their repayments on loans they took) and **Unallocated** = pay + extra − spent − moved. "By person" stays as it is.
15. **Safe to spend today covers only the can-cut money.** The weekly pacing (weekly allowances with a last-week buffer and carry-over, `src/modules/dashboard/lib/pacing.ts`) runs over that person's can-cut lines. Only can-cut spending moves it.
16. **Overruns come out of the can-cut money.** When any other line goes over (an essential like petrol, or a fixed line like a family top-up), and for any spending in a category with no line, the excess is taken from the can-cut money that's left, spread over the remaining weeks of the month (earlier weeks are untouched). Home says so: "Petrol went Rs 1,000 over, taken from your spending money." Under-spending is not released mid-month; it becomes extra money at month end.
17. **Essentials list** under the figures: each essential line as "Petrol 4,200 of 6,500", red once it's over.

### 4. Funds for occasional costs (Phase 4)

18. A **fund** is a named pile inside a person's everyday account, owned by one person: a name, a monthly set-aside, and optionally a target and a due month. Piko suggests the monthly amount for a dated fund: (target − balance) ÷ months left including the due month.
19. **Balance** = every monthly set-aside from the fund's first month up to this month (at the amount in force each month) + money added by hand − what expenses took from it. Changing the monthly amount applies from the current month on; past months keep their amounts.
20. Each fund's set-aside appears under "Set aside first" and in Home's "Moved this month".
21. **Paying from a fund**: the expense form's "Paid from" (now a dropdown) lists the payer's funds next to the savings pots. The fund pays up to its balance; **anything above the balance counts as that month's normal spending** (stored as `expenses.fund_amount`, the part the fund paid). The fund part is left out of Spent, Budget, the weekly allowance and Reports, and shown as "paid from funds". An expense can't be both paid from a fund and paid back later, or from a fund and from savings.
22. Funds live in a "Funds" section on the Budget page (add, edit, add money) and in Home's Balances.

### 5. Extra money and the cushion (Phase 5)

23. **To decide** for a person's month = pay + extra − spent − moved (Home's Unallocated at month end). From the first day of the next month, Home shows a card for the previous month until it is settled.
24. If it's positive, the person splits it however they like between: their savings pots (a deposit dated the last day of that month), their funds (money added for that month), loans they took (a repayment dated the last day of that month), and **keep as cushion**. The parts must add up to the amount.
25. If it's negative, the card says the month went over and that it comes from the cushion; confirming records it.
26. **The cushion** is each person's money in their everyday account beyond the month's plan. It starts at 0, grows only by "keep", shrinks when a month went over, can go below zero, and can be corrected by hand. It shows in Home's Balances with a target the person sets.
27. Settling only works for the logged-in member's own months (viewing as someone else shows the card without its buttons).

### Out of scope (do NOT build)

- Voice entry privacy and masking.
- Bank sync or importing statements.
- Waiting rules for impulse buys.
- Caps carrying over to the next month.
- Alerts beyond Home's warnings and the existing 80%/100% budget notifications.
- Undo (revert) for the new entity types (funds, fund top-ups, month settlements, cushion entries). They are logged in Activity but not revertible, which happens automatically because they are not registered in `ENTITY_REVERT`.
- Choosing a fund from the mobile app (mobile expenses stay "paid from pay").
- Moving money between funds or pots.
- Changing Reports beyond leaving fund-paid amounts out of Spent and reading the carried-over plan and pay.

## Global Constraints

- **Staging:** stage files only by exact path, as each task's commit step lists them. Never use `git add -A`, `git add .`, `git commit -a`, `git stash`, `git checkout -- <file>` or `git reset --hard`.
- **Shell:** this is a Windows machine. The commands below work in both PowerShell and Git Bash. Run them from the repo root `C:\Users\nirja\OneDrive\Documents\piko`.
- **Line endings:** files are checked out with Windows line endings (CRLF), while the code blocks in this plan use LF. If your edit tool matches text byte for byte, compare line by line and ignore `\r`. Don't convert whole files' line endings.
- **Migrations:**
  - Generate them with `npm run db:generate`. It only writes files into `drizzle/` and needs no database. Its file name ends in random words (for example `drizzle/0022_ambitious_venom.sql`); yours will differ, and that's fine. Commit the new `.sql` file and everything it changed under `drizzle/meta/`.
  - **Never run `npm run db:migrate`, `npm run db:seed`, or anything that writes to the owner's database.**
  - Never hand-edit `drizzle/meta/*` or the generated SQL.
  - If `npm run db:generate` asks an interactive question (for example "Is X created or renamed from Y?"), **stop and report it**. Don't answer it. This plan only adds things, so it shouldn't ask.
- **Pre-commit hook:** it runs `npx tsc --noEmit` then `npm run build` and takes 1–2 minutes. That's expected. **Never use `--no-verify`.** If the hook fails, read the error, fix the code, `git add` the same files again, and commit again. If `tsc` complains that `LayoutProps` or `PageProps` can't be found, run `npx next typegen` once and commit again.
- **Lint ordering is enforced:**
  - Imports are grouped react → third-party → `@/…` → relative, with a blank line between groups and alphabetical order inside each group.
  - Named import lists, type and interface properties, and JSX props are alphabetical.
  - After editing, run `npm run lint -- --fix`, then `npm run lint`, which must show **0 errors**. The 2 existing warnings (`NepaliDateField.tsx`, `ExpenseDialog.tsx`) are fine.
  - `npm run lint -- --fix` may re-sort imports or props in code you pasted. That's expected; keep its result.
- **Money from the database is a string** (Drizzle `numeric`). Convert with `Number(x)` when reading, and `String(x)` when writing.
- **Household scoping:** every query must be scoped to the household: `householdId` from `getCurrentMember()` for writes, or through a parent table that has `householdId`. Never trust an id from the client without checking it belongs to the household.
- **Comments:** short `//` comments that say *why*, matching the surrounding code.
- **Next.js 16:** use only APIs already used in this repo. If you think you need a new Next API, stop and read `node_modules/next/dist/docs/` first.
- **Edits:** change only what each step says. Don't rename, reformat or "tidy" other code.
- **When an old block doesn't match:**
  - Line numbers are never used; find code by its text.
  - If a "find" block doesn't match exactly, it's usually because `npm run lint -- --fix` re-sorted imports or props in an earlier task. Find the same code by meaning and make the same change.
- **End-to-end tests** run against a separate test database on the same Supabase server (`piko_e2e`), which `npm run test:e2e` resets and seeds itself; it never touches the owner's data. Against that remote database a few older tests (Activity "records an expense being added, edited and deleted", Activity revert, Expenses "repeats an expense") sometimes time out when the whole suite runs in parallel, and a seed or page can fail with `ECONNRESET` when the connection drops. Before treating a failure as yours, re-run just that spec with `npx playwright test <spec> --reporter=line --workers=1`. Report anything that still fails.

## Review Focus

The five things most likely to go wrong for the two people using this, each pinned by a test in the task that owns it:

1. **Two people, one category.** Saving or removing one person's line must never change the other person's line for the same category (the bug fixed in `2d12c94`, now by design). Pinned in Task 1.7 by the e2e test "one person's line doesn't replace the other person's line for the same category".
2. **Removing the last line of a carried-over month.** It must not make the month fall back to the previous plan: the line stays at zero, so the month stays its own. Pinned in Task 1.7 by the e2e test "removing a line from a carried-over month makes the month its own".
3. **Dhuku interest timing.** Interest is planned from the month *after* the pot is taken, never in the same month. Pinned in Task 2.2 by "doesn't add interest in the month the pot is taken".
4. **Deciding a month twice.** A decided month must not be asked about again, even after a reload. The server refuses a second settlement, and `month_settlements` is unique per person and month. Pinned in Task 5.4 by the e2e test "asks about last month's leftover until it's decided", which reloads after deciding.
5. **Fund mixed with pay back later or savings.** An expense paid from a fund can't also be paid back later or paid from savings. Otherwise Spent and the pay-back balance would both count it. Pinned in Task 4.4 by `expense.schema.test.ts`.

Also worth a reviewer's eye, with no automated test because they need a real database:

- Editing an expense already paid from a fund leaves out its own earlier share when working out the fund's balance (`fundPayment` in `expenses.actions.ts`).
- Viewing Home as the other person shows their month and cushion, but the server actions only ever settle or change the signed-in person's own (`getCurrentMember()`).

---

## Phase 1: Each person's own plan

Budget becomes one person's plan at a time, counted by who paid, with each line's kind (fixed / essential / can cut) on the line itself. A month with no lines of its own shows the person's last plan until they change something. Home and Reports read the same carried-over plan, and the 80% / 100% budget alerts work per person and per household month (they never fired for Bikram Sambat households before).

### Task 1.1: A kind for each budget line

Each budget line gets an optional kind. Null means "not chosen yet" and follows the category (`fixed` → fixed, `flexible` → essential), so no existing row needs changing.

**Files:**
- Modify: `src/db/schema/budgets.ts`
- Generate: a new migration under `drizzle/` (with `npm run db:generate`)

- [ ] **Step 1: Change the schema**

In `src/db/schema/budgets.ts` (change 1 of 2), find:

```ts
import { integer, numeric, pgTable, unique, uuid } from "drizzle-orm/pg-core";

import { categories } from "./categories";
import { householdMembers } from "./householdMembers";
import { households } from "./households";

export const monthlyBudgets = pgTable(
  "monthly_budgets",
  {
```

Replace it with:

```ts
import { integer, numeric, pgEnum, pgTable, unique, uuid } from "drizzle-orm/pg-core";

import { categories } from "./categories";
import { householdMembers } from "./householdMembers";
import { households } from "./households";

// How a person treats one of their budget lines. "can_cut" lines make up the
// money Home's "safe to spend" is worked out from.
export const budgetLineKindEnum = pgEnum("budget_line_kind", ["fixed", "essential", "can_cut"]);

export const monthlyBudgets = pgTable(
  "monthly_budgets",
  {
```

In `src/db/schema/budgets.ts` (change 2 of 2), find:

```ts
      onDelete: "cascade",
    }),
    plannedAmount: numeric("planned_amount", { precision: 12, scale: 2 }).notNull(),
  },
  (table) => [
    unique().on(table.monthlyBudgetId, table.categoryId, table.ownerMemberId),
```

Replace it with:

```ts
      onDelete: "cascade",
    }),
    plannedAmount: numeric("planned_amount", { precision: 12, scale: 2 }).notNull(),
    // null = not chosen yet: it follows the category (fixed → fixed,
    // flexible → essential).
    kind: budgetLineKindEnum("kind"),
  },
  (table) => [
    unique().on(table.monthlyBudgetId, table.categoryId, table.ownerMemberId),
```

- [ ] **Step 2: Generate the migration**

Run:

```bash
npm run db:generate
```

Expected: it prints `Your SQL migration file ➜ drizzle\0022_<random_words>.sql` and asks nothing. The new file must contain exactly these statements (the file name's words will differ):

```sql
CREATE TYPE "public"."budget_line_kind" AS ENUM('fixed', 'essential', 'can_cut');--> statement-breakpoint
ALTER TABLE "budget_items" ADD COLUMN "kind" "budget_line_kind";
```

If it asks a question or the SQL differs, stop and report.

- [ ] **Step 3: Check types and lint**

Run:

```bash
npx tsc --noEmit
npm run lint -- --fix
npm run lint
```

Expected: `tsc` prints nothing; lint shows 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/db/schema/budgets.ts drizzle
git commit -m "feat(db): a kind for each person's budget line"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.


### Task 1.2: Which lines make up a month's plan

The rule that makes plans carry forward: a person's plan for a month is their own lines in that month, or, if they have none there, their lines from their latest earlier month that has some (leaving out archived categories). Shared lines never carry over. Nothing is written to the database to carry a plan; it's worked out when read.

**Files:**
- Create: `src/modules/budget/lib/plan-lines.test.ts`
- Create: `src/modules/budget/lib/plan-lines.ts`
- Create: `src/modules/budget/api/budget.ts`

**Interfaces:**
- Produces: `type BudgetLineKind = "can_cut" | "essential" | "fixed"`, `LINE_KINDS`, `kindOf(kind, categoryBudgetType)`, `type DatedLine`, `type PlanLine` (a `DatedLine` plus `inherited`), `planLinesForMonth(lines, target, archivedCategoryIds)`, `lastKindByCategory(lines, ownerMemberId)` in `src/modules/budget/lib/plan-lines.ts`.
- Produces: `listDatedLines(householdId, through)` and `listPlanLines(householdId, year, month)` in `src/modules/budget/api/budget.ts` (queries, no `"use server"`).

- [ ] **Step 1: Write the failing test**

Create `src/modules/budget/lib/plan-lines.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

import { type DatedLine, kindOf, lastKindByCategory, planLinesForMonth } from "./plan-lines";

const ME = "me";
const HER = "her";

function line(overrides: Partial<DatedLine>): DatedLine {
  return { categoryId: "petrol", id: "l1", kind: null, month: 6, ownerMemberId: ME, plannedAmount: 6500, year: 2083, ...overrides };
}

describe("kindOf", () => {
  it("keeps a kind the person chose", () => {
    expect(kindOf("can_cut", "fixed")).toBe("can_cut");
  });

  it("follows the category when none was chosen", () => {
    expect(kindOf(null, "fixed")).toBe("fixed");
    expect(kindOf(null, "flexible")).toBe("essential");
    expect(kindOf(null, undefined)).toBe("essential");
  });
});

describe("planLinesForMonth", () => {
  it("uses a person's own lines in that month", () => {
    const lines = [line({ id: "asoj", month: 6 }), line({ id: "kartik", month: 7, plannedAmount: 7000 })];

    expect(planLinesForMonth(lines, { month: 7, year: 2083 }, new Set())).toEqual([
      { ...lines[1], inherited: false },
    ]);
  });

  it("carries a person's latest earlier month into a month where they have none", () => {
    const lines = [
      line({ categoryId: "lunch", id: "bhadra", month: 5 }),
      line({ categoryId: "petrol", id: "asoj-petrol", month: 6 }),
      line({ categoryId: "groceries", id: "asoj-groceries", month: 6 }),
    ];

    const plan = planLinesForMonth(lines, { month: 8, year: 2083 }, new Set());

    expect(plan.map((l) => l.id)).toEqual(["asoj-petrol", "asoj-groceries"]);
    expect(plan.every((l) => l.inherited)).toBe(true);
  });

  it("carries over across a year end", () => {
    const lines = [line({ id: "chaitra", month: 12, year: 2083 })];

    expect(planLinesForMonth(lines, { month: 1, year: 2084 }, new Set()).map((l) => l.id)).toEqual(["chaitra"]);
  });

  it("works each person out on their own", () => {
    const lines = [line({ id: "mine-asoj", month: 6 }), line({ id: "hers-kartik", month: 7, ownerMemberId: HER })];

    const plan = planLinesForMonth(lines, { month: 7, year: 2083 }, new Set());

    expect(plan.map((l) => [l.id, l.inherited])).toEqual([
      ["mine-asoj", true],
      ["hers-kartik", false],
    ]);
  });

  it("never looks ahead to later months", () => {
    expect(planLinesForMonth([line({ month: 8 })], { month: 7, year: 2083 }, new Set())).toEqual([]);
  });

  it("leaves archived categories out of a carried-over plan, but not out of the month they were set in", () => {
    const lines = [line({ categoryId: "savings", id: "asoj-savings", month: 6 }), line({ id: "asoj-petrol", month: 6 })];
    const archived = new Set(["savings"]);

    expect(planLinesForMonth(lines, { month: 7, year: 2083 }, archived).map((l) => l.id)).toEqual(["asoj-petrol"]);
    expect(planLinesForMonth(lines, { month: 6, year: 2083 }, archived).map((l) => l.id)).toEqual(["asoj-savings", "asoj-petrol"]);
  });

  it("keeps shared lines in their own month only", () => {
    const shared = line({ id: "shared-bhadra", month: 5, ownerMemberId: null });

    expect(planLinesForMonth([shared], { month: 5, year: 2083 }, new Set())).toEqual([{ ...shared, inherited: false }]);
    expect(planLinesForMonth([shared], { month: 6, year: 2083 }, new Set())).toEqual([]);
  });
});

describe("lastKindByCategory", () => {
  it("remembers the latest kind a person chose for each category", () => {
    const lines = [
      line({ categoryId: "lunch", kind: "essential", month: 5 }),
      line({ categoryId: "lunch", kind: "can_cut", month: 6 }),
      line({ categoryId: "petrol", kind: null, month: 6 }),
      line({ categoryId: "dates", kind: "can_cut", month: 6, ownerMemberId: HER }),
    ];

    expect(lastKindByCategory(lines, ME)).toEqual({ lunch: "can_cut" });
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run:

```bash
npx vitest run src/modules/budget/lib/plan-lines.test.ts
```

Expected: FAIL. The run reports it can't resolve `./plan-lines`, because the file doesn't exist yet.

- [ ] **Step 3: Write the code**

Create `src/modules/budget/lib/plan-lines.ts` with:

```ts
export type BudgetLineKind = "can_cut" | "essential" | "fixed";

export const LINE_KINDS: { label: string; value: BudgetLineKind }[] = [
  { label: "Fixed", value: "fixed" },
  { label: "Essential", value: "essential" },
  { label: "Can cut", value: "can_cut" },
];

// A line's own kind, or the one its category suggests when none was chosen.
export function kindOf(kind: BudgetLineKind | null, categoryBudgetType: "fixed" | "flexible" | undefined): BudgetLineKind {
  if (kind !== null) return kind;
  return categoryBudgetType === "fixed" ? "fixed" : "essential";
}

// A budget line with the month it was set in.
export type DatedLine = {
  categoryId: string;
  id: string;
  kind: BudgetLineKind | null;
  month: number;
  ownerMemberId: null | string;
  plannedAmount: number;
  year: number;
};

// inherited = carried over from an earlier month, not set in this one.
export type PlanLine = DatedLine & { inherited: boolean };

const monthOrder = (year: number, month: number) => year * 12 + month;

// The lines that make up a month's plan. Each person's plan is their own lines
// in that month. A month where they have none carries over their lines from
// the latest earlier month that has some (leaving out archived categories),
// so a plan only needs entering once. Shared lines (no owner) are from before
// per-person plans and never carry over.
export function planLinesForMonth(
  lines: DatedLine[],
  target: { month: number; year: number },
  archivedCategoryIds: ReadonlySet<string>,
): PlanLine[] {
  const targetOrder = monthOrder(target.year, target.month);
  const plan: PlanLine[] = lines
    .filter((l) => l.ownerMemberId === null && monthOrder(l.year, l.month) === targetOrder)
    .map((l) => ({ ...l, inherited: false }));

  const owners = new Set(lines.flatMap((l) => (l.ownerMemberId === null ? [] : [l.ownerMemberId])));
  for (const owner of owners) {
    const own = lines.filter((l) => l.ownerMemberId === owner && monthOrder(l.year, l.month) <= targetOrder);
    if (own.length === 0) continue;
    const latest = Math.max(...own.map((l) => monthOrder(l.year, l.month)));
    const inherited = latest !== targetOrder;
    for (const l of own) {
      if (monthOrder(l.year, l.month) !== latest) continue;
      if (inherited && archivedCategoryIds.has(l.categoryId)) continue;
      plan.push({ ...l, inherited });
    }
  }
  return plan;
}

// The kind a person last chose for each category, so a new line for that
// category starts the same way.
export function lastKindByCategory(lines: DatedLine[], ownerMemberId: string): Record<string, BudgetLineKind> {
  const chosen = lines
    .flatMap((l) => (l.ownerMemberId === ownerMemberId && l.kind !== null ? [{ ...l, kind: l.kind }] : []))
    .sort((a, b) => monthOrder(a.year, a.month) - monthOrder(b.year, b.month));
  const result: Record<string, BudgetLineKind> = {};
  for (const l of chosen) result[l.categoryId] = l.kind;
  return result;
}
```

Create `src/modules/budget/api/budget.ts` with:

```ts
import { and, eq, lte, or } from "drizzle-orm";

import { db } from "@/db/client";
import { budgetItems, categories, monthlyBudgets } from "@/db/schema";

import { type DatedLine, type PlanLine, planLinesForMonth } from "../lib/plan-lines";

// Every budget line up to and including the given month, with the month it
// was set in.
export async function listDatedLines(householdId: string, through: { month: number; year: number }): Promise<DatedLine[]> {
  const rows = await db
    .select({
      categoryId: budgetItems.categoryId,
      id: budgetItems.id,
      kind: budgetItems.kind,
      month: monthlyBudgets.month,
      ownerMemberId: budgetItems.ownerMemberId,
      plannedAmount: budgetItems.plannedAmount,
      year: monthlyBudgets.year,
    })
    .from(budgetItems)
    .innerJoin(monthlyBudgets, eq(monthlyBudgets.id, budgetItems.monthlyBudgetId))
    .where(
      and(
        eq(monthlyBudgets.householdId, householdId),
        or(
          lte(monthlyBudgets.year, through.year - 1),
          and(eq(monthlyBudgets.year, through.year), lte(monthlyBudgets.month, through.month)),
        ),
      ),
    );
  return rows.map((r) => ({ ...r, plannedAmount: Number(r.plannedAmount) }));
}

// The lines that make up a month's plan, each person's own lines carried over
// from their latest earlier month when they have none in this one.
export async function listPlanLines(householdId: string, year: number, month: number): Promise<PlanLine[]> {
  const [lines, archived] = await Promise.all([
    listDatedLines(householdId, { month, year }),
    db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.householdId, householdId), eq(categories.archived, true))),
  ]);
  return planLinesForMonth(lines, { month, year }, new Set(archived.map((c) => c.id)));
}
```

- [ ] **Step 4: Run the tests again**

Run:

```bash
npx vitest run src/modules/budget/lib/plan-lines.test.ts
```

Expected: PASS, 10 tests.

- [ ] **Step 5: Check types, all unit tests and lint**

Run:

```bash
npx tsc --noEmit
npm test
npm run lint -- --fix
npm run lint
```

Expected: `tsc` prints nothing; every unit test passes; lint shows 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/modules/budget/lib/plan-lines.test.ts src/modules/budget/lib/plan-lines.ts src/modules/budget/api/budget.ts
git commit -m "feat(budget): work out which lines make up a month's plan"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.


### Task 1.3: Split one expense between wallets

Budget will count spending by who paid, the same way Home does. This pulls Home's rule (the payer's part, and the other person's part when some of it is to be paid back) out into a per-expense helper both can use.

**Files:**
- Modify: `src/modules/dashboard/lib/wallet.test.ts`
- Modify: `src/modules/dashboard/lib/wallet.ts`

**Interfaces:**
- Produces: `walletShares(expense, memberIds): { amount: number; memberId: string }[]` and `type WalletShare` in `src/modules/dashboard/lib/wallet.ts`. `walletSpentByMember` keeps its signature and now uses it.

- [ ] **Step 1: Write the failing test**

In `src/modules/dashboard/lib/wallet.test.ts` (change 1 of 2), find:

```ts
import { describe, expect, it } from "vitest";

import { walletSpentByMember } from "./wallet";

const ME = "me";
const HER = "her";
```

Replace it with:

```ts
import { describe, expect, it } from "vitest";

import { walletShares, walletSpentByMember } from "./wallet";

const ME = "me";
const HER = "her";
```

In `src/modules/dashboard/lib/wallet.test.ts` (change 2 of 2), find:

```ts
    expect(totals.get(ME)).toBe(1000);
  });
});
```

Replace it with:

```ts
    expect(totals.get(ME)).toBe(1000);
  });
});

describe("walletShares", () => {
  it("gives the whole expense to the payer when nothing is paid back", () => {
    expect(walletShares({ amount: 2000, paidByMemberId: ME, payBackAmount: null }, [ME, HER])).toEqual([{ amount: 2000, memberId: ME }]);
  });

  it("splits off the part the other person will pay back", () => {
    expect(walletShares({ amount: 3000, paidByMemberId: HER, payBackAmount: 1000 }, [ME, HER])).toEqual([
      { amount: 2000, memberId: HER },
      { amount: 1000, memberId: ME },
    ]);
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run:

```bash
npx vitest run src/modules/dashboard/lib/wallet.test.ts
```

Expected: FAIL. The new `walletShares` tests fail because `walletShares` isn't exported yet.

- [ ] **Step 3: Write the code**

Replace the whole of `src/modules/dashboard/lib/wallet.ts` with:

```ts
// Money that left each person's own wallet. Spending counts against whoever
// paid it, not who it was for: the two members keep separate money, and
// paying for each other is generosity, not debt. The exception is an expense
// ticked "to be paid back": that part counts against the other person, since
// they're the one who'll end up paying for it.
export type WalletExpense = { amount: number; paidByMemberId: string; payBackAmount: null | number };

export type WalletShare = { amount: number; memberId: string };

// How one expense splits between wallets: the payer's part, and the other
// person's part when some of it is to be paid back.
export function walletShares(expense: WalletExpense, memberIds: string[]): WalletShare[] {
  const payer = expense.paidByMemberId;
  const other = memberIds.length === 2 ? memberIds.find((id) => id !== payer) : undefined;
  const repay = other && expense.payBackAmount ? Math.min(expense.payBackAmount, expense.amount) : 0;
  const shares = [{ amount: expense.amount - repay, memberId: payer }];
  if (other && repay > 0) shares.push({ amount: repay, memberId: other });
  return shares;
}

export function walletSpentByMember(expenses: WalletExpense[], memberIds: string[]): Map<string, number> {
  const totals = new Map(memberIds.map((id) => [id, 0]));
  for (const expense of expenses) {
    for (const share of walletShares(expense, memberIds)) {
      totals.set(share.memberId, (totals.get(share.memberId) ?? 0) + share.amount);
    }
  }
  return totals;
}
```

- [ ] **Step 4: Run the tests again**

Run:

```bash
npx vitest run src/modules/dashboard/lib/wallet.test.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Check types, all unit tests and lint**

Run:

```bash
npx tsc --noEmit
npm test
npm run lint -- --fix
npm run lint
```

Expected: `tsc` prints nothing; every unit test passes; lint shows 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/modules/dashboard/lib/wallet.test.ts src/modules/dashboard/lib/wallet.ts
git commit -m "feat(dashboard): split one expense between wallets"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.


### Task 1.4: Budget alerts per person and household month

The 80% / 100% budget alert looked up the budget by the expense date's Gregorian year and month, so it never found a Bikram Sambat household's budget. It now finds the household's own month, uses the carried-over plan, and compares the payer's own spending in the category with the payer's own line.

**Files:**
- Modify: `src/modules/notifications/api/notifications.actions.ts`
- Modify: `src/modules/expenses/api/expenses.actions.ts`

**Interfaces:**
- Consumes: `listPlanLines` (Task 1.2), `walletShares` (Task 1.3), `periodOfDate` (existing, `src/modules/savings/lib/savings-forecast.ts`).
- Changes: `checkBudgetThreshold(householdId, categoryId, paidByMemberId, dateStr)` — the third argument is now the payer, not the owner.

- [ ] **Step 1: Rewrite the budget alert**

In `src/modules/notifications/api/notifications.actions.ts` (change 1 of 4), find:

```ts

import { db } from "@/db/client";
import {
  budgetItems,
  categories,
  dhukuEntries,
  dhukus,
  expenses,
  loanPayments,
  loans,
  monthlyBudgets,
  notifications,
  recurringExpenses,
} from "@/db/schema";
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { formatPeriodLabel } from "@/lib/month-period";
import { NOTIFICATION_PREFS_COOKIE_NAME, type NotificationPreferences } from "@/lib/notification-preferences-cookie";
import { getCurrentMember } from "@/lib/session";
import { formatNPR } from "@/modules/dashboard/lib/format";
import { cycleStatus, expectedNextAmount, nextEntryDueDate } from "@/modules/dhuku/lib/dhuku-stats";
import { formatDueDate } from "@/modules/recurring/lib/recurring-stats";

type NotificationInput = {
  body: string;
```

Replace it with:

```ts

import { db } from "@/db/client";
import {
  categories,
  dhukuEntries,
  dhukus,
  expenses,
  householdMembers,
  loanPayments,
  loans,
  notifications,
  recurringExpenses,
} from "@/db/schema";
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { formatPeriodLabel, resolvePeriod } from "@/lib/month-period";
import { NOTIFICATION_PREFS_COOKIE_NAME, type NotificationPreferences } from "@/lib/notification-preferences-cookie";
import { getCurrentMember } from "@/lib/session";
import { listPlanLines } from "@/modules/budget/api/budget";
import { formatNPR } from "@/modules/dashboard/lib/format";
import { walletShares } from "@/modules/dashboard/lib/wallet";
import { cycleStatus, expectedNextAmount, nextEntryDueDate } from "@/modules/dhuku/lib/dhuku-stats";
import { formatDueDate } from "@/modules/recurring/lib/recurring-stats";
import { periodOfDate } from "@/modules/savings/lib/savings-forecast";

type NotificationInput = {
  body: string;
```

In `src/modules/notifications/api/notifications.actions.ts` (change 2 of 4), find:

```ts
    .onConflictDoNothing({ target: [notifications.householdId, notifications.dedupeKey] });
}

// Called after an expense is created/updated. Compares spend-so-far for the
// affected category+owner+month against its planned budget and fires a
// one-time "80% reached" and/or "budget exceeded" notification — dedupeKey
// ensures each threshold only ever fires once per category/owner/month, no
// matter how many further expenses land in the same bucket afterward.
export async function checkBudgetThreshold(
  householdId: string,
  categoryId: string,
  ownerMemberId: null | string,
  dateStr: string,
) {
  const [year, month] = dateStr.split("-").map(Number);

  const [budget] = await db
    .select()
    .from(monthlyBudgets)
    .where(and(eq(monthlyBudgets.householdId, householdId), eq(monthlyBudgets.year, year), eq(monthlyBudgets.month, month)));
  if (!budget) return;

  const ownerCondition = ownerMemberId === null ? isNull(budgetItems.ownerMemberId) : eq(budgetItems.ownerMemberId, ownerMemberId);
  const [item] = await db
    .select()
    .from(budgetItems)
    .where(and(eq(budgetItems.monthlyBudgetId, budget.id), eq(budgetItems.categoryId, categoryId), ownerCondition));
  const planned = Number(item?.plannedAmount ?? 0);
  if (planned <= 0) return;

  const [category] = await db.select().from(categories).where(eq(categories.id, categoryId));
  if (!category) return;

  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
  const monthExpenseOwnerCondition = ownerMemberId === null ? isNull(expenses.ownerMemberId) : eq(expenses.ownerMemberId, ownerMemberId);
  const monthExpenses = await db
    .select()
    .from(expenses)
```

Replace it with:

```ts
    .onConflictDoNothing({ target: [notifications.householdId, notifications.dedupeKey] });
}

// Called after an expense is saved. Compares what the payer has spent so far
// in that category this month against their own plan line and fires a
// one-time "80% reached" and/or "budget exceeded" notification — dedupeKey
// ensures each threshold only ever fires once per category/person/month, no
// matter how many further expenses land in the same bucket afterward.
export async function checkBudgetThreshold(householdId: string, categoryId: string, paidByMemberId: string, dateStr: string) {
  // Budgets are kept in the household's own calendar months.
  const dateFormat = await getDateFormatPref(householdId);
  const { month, year } = periodOfDate(dateStr, dateFormat);
  const lines = await listPlanLines(householdId, year, month);
  const planned = lines.find((l) => l.categoryId === categoryId && l.ownerMemberId === paidByMemberId)?.plannedAmount ?? 0;
  if (planned <= 0) return;

  const [category] = await db.select().from(categories).where(eq(categories.id, categoryId));
  if (!category) return;

  const period = resolvePeriod(year, month, dateFormat);
  const members = await db.select({ id: householdMembers.id }).from(householdMembers).where(eq(householdMembers.householdId, householdId));
  const monthExpenses = await db
    .select()
    .from(expenses)
```

In `src/modules/notifications/api/notifications.actions.ts` (change 3 of 4), find:

```ts
      and(
        eq(expenses.householdId, householdId),
        eq(expenses.categoryId, categoryId),
        monthExpenseOwnerCondition,
        // Paid from savings: saved for in earlier months, so not against this budget.
        isNull(expenses.savingsPotId),
        gte(expenses.date, monthStart),
        lte(expenses.date, monthEnd),
      ),
    );
  const spent = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);

  const pct = spent / planned;
  const ownerKey = ownerMemberId ?? "shared";

  if (pct >= 1) {
    await insertNotification({
      body: `You've spent ${formatNPR(spent)} of your ${formatNPR(planned)} ${category.name.toLowerCase()} budget.`,
      category: "budget",
      dedupeKey: `budget:${categoryId}:${ownerKey}:${year}:${month}:100`,
      householdId,
      severity: "danger",
      title: `${category.name} budget exceeded`,
```

Replace it with:

```ts
      and(
        eq(expenses.householdId, householdId),
        eq(expenses.categoryId, categoryId),
        // Paid from savings: saved for in earlier months, so not against this budget.
        isNull(expenses.savingsPotId),
        gte(expenses.date, period.startDate),
        lte(expenses.date, period.endDate),
      ),
    );
  // What came out of this person's own wallet, the same as the Budget page.
  const memberIds = members.map((m) => m.id);
  const spent = monthExpenses
    .flatMap((e) =>
      walletShares(
        { amount: Number(e.amount), paidByMemberId: e.paidByMemberId, payBackAmount: e.payBackAmount === null ? null : Number(e.payBackAmount) },
        memberIds,
      ),
    )
    .filter((share) => share.memberId === paidByMemberId)
    .reduce((s, share) => s + share.amount, 0);

  const pct = spent / planned;

  if (pct >= 1) {
    await insertNotification({
      body: `You've spent ${formatNPR(spent)} of your ${formatNPR(planned)} ${category.name.toLowerCase()} budget.`,
      category: "budget",
      dedupeKey: `budget:${categoryId}:${paidByMemberId}:${year}:${month}:100`,
      householdId,
      severity: "danger",
      title: `${category.name} budget exceeded`,
```

In `src/modules/notifications/api/notifications.actions.ts` (change 4 of 4), find:

```ts
    await insertNotification({
      body: `You've spent ${formatNPR(spent)} of your ${formatNPR(planned)} ${category.name.toLowerCase()} budget.`,
      category: "budget",
      dedupeKey: `budget:${categoryId}:${ownerKey}:${year}:${month}:80`,
      householdId,
      severity: "warning",
      title: `${category.name} is at 80%`,
```

Replace it with:

```ts
    await insertNotification({
      body: `You've spent ${formatNPR(spent)} of your ${formatNPR(planned)} ${category.name.toLowerCase()} budget.`,
      category: "budget",
      dedupeKey: `budget:${categoryId}:${paidByMemberId}:${year}:${month}:80`,
      householdId,
      severity: "warning",
      title: `${category.name} is at 80%`,
```

- [ ] **Step 2: Check the payer's budget when an expense is saved**

In `src/modules/expenses/api/expenses.actions.ts` (change 1 of 2), find:

```ts
      title: "New shared expense added",
    });
  }
  await checkBudgetThreshold(householdId, parsed.categoryId, parsed.ownerMemberId, parsed.date);

  const f = await loadActivityFormatters(householdId);
  await logActivity(actor, {
```

Replace it with:

```ts
      title: "New shared expense added",
    });
  }
  await checkBudgetThreshold(householdId, parsed.categoryId, parsed.paidByMemberId, parsed.date);

  const f = await loadActivityFormatters(householdId);
  await logActivity(actor, {
```

In `src/modules/expenses/api/expenses.actions.ts` (change 2 of 2), find:

```ts
    });
  }

  // One threshold check per distinct category+owner+month combo touched by
  // this batch, rather than one per row — checkBudgetThreshold recomputes
  // the whole month's spend anyway, so repeating it per row would just be
  // redundant work for the same dedupeKey.
  const seenBudgetKeys = new Set<string>();
  for (const parsed of parsedList) {
    const key = `${parsed.categoryId}:${parsed.ownerMemberId ?? "shared"}:${parsed.date.slice(0, 7)}`;
    if (seenBudgetKeys.has(key)) continue;
    seenBudgetKeys.add(key);
    await checkBudgetThreshold(householdId, parsed.categoryId, parsed.ownerMemberId, parsed.date);
  }

  const f = await loadActivityFormatters(householdId);
```

Replace it with:

```ts
    });
  }

  // One threshold check per distinct category+payer+month combo touched by
  // this batch, rather than one per row — checkBudgetThreshold recomputes
  // the whole month's spend anyway, so repeating it per row would just be
  // redundant work for the same dedupeKey.
  const seenBudgetKeys = new Set<string>();
  for (const parsed of parsedList) {
    const key = `${parsed.categoryId}:${parsed.paidByMemberId}:${parsed.date.slice(0, 7)}`;
    if (seenBudgetKeys.has(key)) continue;
    seenBudgetKeys.add(key);
    await checkBudgetThreshold(householdId, parsed.categoryId, parsed.paidByMemberId, parsed.date);
  }

  const f = await loadActivityFormatters(householdId);
```

- [ ] **Step 3: Check types, unit tests and lint**

Run:

```bash
npx tsc --noEmit
npm test
npm run lint -- --fix
npm run lint
```

Expected: `tsc` prints nothing; every unit test passes; lint shows 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/modules/notifications/api/notifications.actions.ts src/modules/expenses/api/expenses.actions.ts
git commit -m "fix(notifications): budget alerts per person and household month"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.


### Task 1.5: Line kinds in Activity and undo

Activity shows when a line's kind changes, undo can put a kind back, and undo finds a budget line by its person as well as its category (each person now has their own line for a category).

**Files:**
- Modify: `src/modules/budget/lib/budget-activity.test.ts`
- Modify: `src/modules/budget/lib/budget-activity.ts`
- Modify: `src/modules/activity/lib/revert/entities.ts`
- Modify: `src/modules/activity/api/revert-store.ts`

**Interfaces:**
- Consumes: `LINE_KINDS` (Task 1.2).
- Changes: `BudgetItemSnapshot` gains `kind?: null | string`; `budgetItemFields` gains a "Kind" field.

- [ ] **Step 1: Write the failing test**

In `src/modules/budget/lib/budget-activity.test.ts`, find:

```ts
    ]);
  });

  it("summarises and diffs income", () => {
    const before = { amount: "90000.00", memberId: "m-2", month: 10, note: null, year: 2026 };
    expect(incomeSummary(f, before)).toBe("Ravi · October 2026 · RS 90,000");
```

Replace it with:

```ts
    ]);
  });

  it("diffs the kind of a line", () => {
    const before = { categoryId: "cat-1", kind: "essential", ownerMemberId: "m-1", plannedAmount: "3000.00" };
    expect(budgetItemChanges(f, before, { ...before, kind: "can_cut", plannedAmount: 3000 })).toEqual([
      { field: "Kind", from: "Essential", to: "Can cut" },
    ]);
  });

  it("summarises and diffs income", () => {
    const before = { amount: "90000.00", memberId: "m-2", month: 10, note: null, year: 2026 };
    expect(incomeSummary(f, before)).toBe("Ravi · October 2026 · RS 90,000");
```

- [ ] **Step 2: Run the tests and watch them fail**

Run:

```bash
npx vitest run src/modules/budget/lib/budget-activity.test.ts
```

Expected: FAIL. The new "diffs the kind of a line" test fails: there's no Kind field yet.

- [ ] **Step 3: Write the code**

In `src/modules/budget/lib/budget-activity.ts` (change 1 of 2), find:

```ts
import type { ActivityFormatters } from "@/modules/activity/lib/activity-values";
import { diffFields, type FieldSpec } from "@/modules/activity/lib/diff";

export type BudgetItemSnapshot = { categoryId: string; ownerMemberId: null | string; plannedAmount: number | string };
export type IncomeSnapshot = { amount: number | string; memberId: string; month: number; note?: null | string; year: number };

// "Groceries · Shared · Ashwin 2083 · RS 8,000"
```

Replace it with:

```ts
import type { ActivityFormatters } from "@/modules/activity/lib/activity-values";
import { diffFields, type FieldSpec } from "@/modules/activity/lib/diff";

import { LINE_KINDS } from "./plan-lines";

export type BudgetItemSnapshot = { categoryId: string; kind?: null | string; ownerMemberId: null | string; plannedAmount: number | string };
export type IncomeSnapshot = { amount: number | string; memberId: string; month: number; note?: null | string; year: number };

// "Groceries · Shared · Ashwin 2083 · RS 8,000"
```

In `src/modules/budget/lib/budget-activity.ts` (change 2 of 2), find:

```ts
    .join(" · ");
}

export function budgetItemFields(f: ActivityFormatters): FieldSpec<BudgetItemSnapshot>[] {
  return [
    { format: f.money, key: "plannedAmount", label: "Planned" },
    { format: f.owner, key: "ownerMemberId", label: "For" },
  ];
}

```

Replace it with:

```ts
    .join(" · ");
}

function kindLabel(value: unknown): null | string {
  return LINE_KINDS.find((k) => k.value === value)?.label ?? null;
}

export function budgetItemFields(f: ActivityFormatters): FieldSpec<BudgetItemSnapshot>[] {
  return [
    { format: f.money, key: "plannedAmount", label: "Planned" },
    { format: f.owner, key: "ownerMemberId", label: "For" },
    { format: kindLabel, key: "kind", label: "Kind" },
  ];
}

```

In `src/modules/activity/lib/revert/entities.ts`, find:

```ts
export const ENTITY_REVERT: Partial<Record<ActivityEntityType, EntityRevert>> = {
  budget_item: {
    children: [],
    editable: ["ownerMemberId", "plannedAmount"],
    fields: (f) => [{ format: f.category, key: "categoryId", label: "Category" }, ...rowFields(budgetItemFields(f))],
    noun: "budget line",
    parentNoun: "month's budget",
    references: (r) => ({ categoryIds: ids(r.categoryId), memberIds: ids(r.ownerMemberId), parentId: String(r.monthlyBudgetId) }),
    // A budget line is its category/month: an owner change deletes the row and inserts another.
    restoreReplacesExisting: true,
    summary: (f, r) => [f.category(r.categoryId), f.owner(r.ownerMemberId), f.money(r.plannedAmount)].filter(Boolean).join(" · "),
  },
```

Replace it with:

```ts
export const ENTITY_REVERT: Partial<Record<ActivityEntityType, EntityRevert>> = {
  budget_item: {
    children: [],
    editable: ["kind", "ownerMemberId", "plannedAmount"],
    fields: (f) => [{ format: f.category, key: "categoryId", label: "Category" }, ...rowFields(budgetItemFields(f))],
    noun: "budget line",
    parentNoun: "month's budget",
    references: (r) => ({ categoryIds: ids(r.categoryId), memberIds: ids(r.ownerMemberId), parentId: String(r.monthlyBudgetId) }),
    // A budget line is its category, person and month: the row there now may be a different one.
    restoreReplacesExisting: true,
    summary: (f, r) => [f.category(r.categoryId), f.owner(r.ownerMemberId), f.money(r.plannedAmount)].filter(Boolean).join(" · "),
  },
```

In `src/modules/activity/api/revert-store.ts` (change 1 of 2), find:

```ts
});

const budgetItemStore = tableStore({
  // A budget line is its category/month: changing the owner deletes the row
  // and inserts another, so the line there now may carry a different id.
  // Prefer the entry's own row if several owners share the category.
  find: async (h, id, entry) => {
    const { categoryId, monthlyBudgetId } = entry.after ?? entry.before ?? {};
    if (typeof categoryId === "string" && typeof monthlyBudgetId === "string") {
      const lines = await db
        .select()
```

Replace it with:

```ts
});

const budgetItemStore = tableStore({
  // A budget line is its category, person and month, so the line there now
  // may carry a different id (an older owner change deleted the row and
  // inserted another). Prefer the entry's own row, then the same person's:
  // each person has their own line for a category.
  find: async (h, id, entry) => {
    const { categoryId, monthlyBudgetId, ownerMemberId } = entry.after ?? entry.before ?? {};
    if (typeof categoryId === "string" && typeof monthlyBudgetId === "string") {
      const lines = await db
        .select()
```

In `src/modules/activity/api/revert-store.ts` (change 2 of 2), find:

```ts
            inArray(budgetItems.monthlyBudgetId, budgetIdsOf(h)),
          ),
        );
      const line = lines.find((l) => l.id === id) ?? lines[0];
      if (line) return line;
    }
    return (await db.select().from(budgetItems).where(and(eq(budgetItems.id, id), inArray(budgetItems.monthlyBudgetId, budgetIdsOf(h)))))[0];
```

Replace it with:

```ts
            inArray(budgetItems.monthlyBudgetId, budgetIdsOf(h)),
          ),
        );
      const line = lines.find((l) => l.id === id) ?? lines.find((l) => l.ownerMemberId === (ownerMemberId ?? null));
      if (line) return line;
    }
    return (await db.select().from(budgetItems).where(and(eq(budgetItems.id, id), inArray(budgetItems.monthlyBudgetId, budgetIdsOf(h)))))[0];
```

- [ ] **Step 4: Run the tests again**

Run:

```bash
npx vitest run src/modules/budget/lib/budget-activity.test.ts src/modules/activity/lib/revert/plan.test.ts
```

Expected: PASS, 28 tests.

- [ ] **Step 5: Check types, all unit tests and lint**

Run:

```bash
npx tsc --noEmit
npm test
npm run lint -- --fix
npm run lint
```

Expected: `tsc` prints nothing; every unit test passes; lint shows 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/modules/budget/lib/budget-activity.test.ts src/modules/budget/lib/budget-activity.ts src/modules/activity/lib/revert/entities.ts src/modules/activity/api/revert-store.ts
git commit -m "feat(activity): budget line kinds in activity and undo"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.


### Task 1.6: Home and Reports read the month's plan

Home and Reports switch from the stored lines of a month to the month's plan (carried over when a person has none of their own). Home keeps its household-wide pacing for now (Phase 3 changes it), counting every line whose kind isn't fixed.

**Files:**
- Modify: `src/modules/dashboard/pages/DashboardPage.tsx`
- Modify: `src/modules/reports/pages/ReportsPage.tsx`

**Interfaces:**
- Consumes: `listPlanLines`, `kindOf` (Task 1.2).

- [ ] **Step 1: Home reads the month's plan**

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 1 of 5), find:

```tsx
} from "@/lib/month-period";
import { getEffectiveMember, getHouseholdMembers } from "@/lib/session";
import { todayISO } from "@/lib/today";
import { getBudgetItemsForMonth, getIncomesForMonth } from "@/modules/budget/api/budget.actions";
import { dashboardSummary } from "@/modules/budget/lib/calculations";
import { listCategories } from "@/modules/categories/api/categories";
import {
  type HomeBalanceRow,
```

Replace it with:

```tsx
} from "@/lib/month-period";
import { getEffectiveMember, getHouseholdMembers } from "@/lib/session";
import { todayISO } from "@/lib/today";
import { listPlanLines } from "@/modules/budget/api/budget";
import { getIncomesForMonth } from "@/modules/budget/api/budget.actions";
import { dashboardSummary } from "@/modules/budget/lib/calculations";
import { kindOf } from "@/modules/budget/lib/plan-lines";
import { listCategories } from "@/modules/categories/api/categories";
import {
  type HomeBalanceRow,
```

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 2 of 5), find:

```tsx
    members,
    categories,
    incomeRows,
    budgetItemRows,
    expenseRows,
    prevIncomeRows,
    prevExpenseRows,
```

Replace it with:

```tsx
    members,
    categories,
    incomeRows,
    planLines,
    expenseRows,
    prevIncomeRows,
    prevExpenseRows,
```

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 3 of 5), find:

```tsx
    getHouseholdMembers(householdId),
    listCategories(householdId),
    getIncomesForMonth(year, month),
    getBudgetItemsForMonth(year, month),
    listExpensesForMonth(year, month, dateFormat),
    getIncomesForMonth(prev.year, prev.month),
    listExpensesForMonth(prev.year, prev.month, dateFormat),
```

Replace it with:

```tsx
    getHouseholdMembers(householdId),
    listCategories(householdId),
    getIncomesForMonth(year, month),
    listPlanLines(householdId, year, month),
    listExpensesForMonth(year, month, dateFormat),
    getIncomesForMonth(prev.year, prev.month),
    listExpensesForMonth(prev.year, prev.month, dateFormat),
```

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 4 of 5), find:

```tsx
  ]);

  if (isCurrentMonth) {
    await checkBudgetReminder(householdId, year, month, budgetItemRows.length);
  }

  // Expenses paid from a savings pot came out of money set aside over many
```

Replace it with:

```tsx
  ]);

  if (isCurrentMonth) {
    await checkBudgetReminder(householdId, year, month, planLines.length);
  }

  // Expenses paid from a savings pot came out of money set aside over many
```

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 5 of 5), find:

```tsx
  // already spoken for): the hero's safe-to-spend figure and its carry-over.
  // Fixed-category expenses don't count against it, for the same reason.
  const period = resolvePeriod(year, month, dateFormat);
  const flexiblePlanned = budgetItemRows
    .filter((b) => category(b.categoryId)?.budgetType === "flexible")
    .reduce((s, b) => s + Number(b.plannedAmount), 0);
  const pacingSchedule =
    flexiblePlanned > 0 ? buildPacingSchedule({ daysInPeriod: period.daysInPeriod, flexibleTotal: flexiblePlanned }) : null;
  const dayOfPeriod = isCurrentMonth ? daysElapsedInPeriod(period) : period.daysInPeriod;
```

Replace it with:

```tsx
  // already spoken for): the hero's safe-to-spend figure and its carry-over.
  // Fixed-category expenses don't count against it, for the same reason.
  const period = resolvePeriod(year, month, dateFormat);
  const flexiblePlanned = planLines
    .filter((l) => kindOf(l.kind, category(l.categoryId)?.budgetType) !== "fixed")
    .reduce((s, l) => s + l.plannedAmount, 0);
  const pacingSchedule =
    flexiblePlanned > 0 ? buildPacingSchedule({ daysInPeriod: period.daysInPeriod, flexibleTotal: flexiblePlanned }) : null;
  const dayOfPeriod = isCurrentMonth ? daysElapsedInPeriod(period) : period.daysInPeriod;
```

- [ ] **Step 2: Reports reads the month's plan**

In `src/modules/reports/pages/ReportsPage.tsx` (change 1 of 2), find:

```tsx
  resolvePeriod,
} from "@/lib/month-period";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { getBudgetItemsForMonth, getIncomesForMonth, listAllIncomes } from "@/modules/budget/api/budget.actions";
import { listCategories } from "@/modules/categories/api/categories";
import { pctOfIncome } from "@/modules/dashboard/lib/format";
import { listExpensesForMonth, listExpensesForRange } from "@/modules/expenses/api/expenses.actions";
```

Replace it with:

```tsx
  resolvePeriod,
} from "@/lib/month-period";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { listPlanLines } from "@/modules/budget/api/budget";
import { getIncomesForMonth, listAllIncomes } from "@/modules/budget/api/budget.actions";
import { listCategories } from "@/modules/categories/api/categories";
import { pctOfIncome } from "@/modules/dashboard/lib/format";
import { listExpensesForMonth, listExpensesForRange } from "@/modules/expenses/api/expenses.actions";
```

In `src/modules/reports/pages/ReportsPage.tsx` (change 2 of 2), find:

```tsx
    getIncomesForMonth(year, month),
    getIncomesForMonth(prev.year, prev.month),
    listAllIncomes(),
    getBudgetItemsForMonth(year, month),
    listExpensesForMonth(year, month, dateFormat),
    listExpensesForMonth(prev.year, prev.month, dateFormat),
    listExpensesForRange(rangeStart, period.endDate),
```

Replace it with:

```tsx
    getIncomesForMonth(year, month),
    getIncomesForMonth(prev.year, prev.month),
    listAllIncomes(),
    listPlanLines(householdId, year, month),
    listExpensesForMonth(year, month, dateFormat),
    listExpensesForMonth(prev.year, prev.month, dateFormat),
    listExpensesForRange(rangeStart, period.endDate),
```

- [ ] **Step 3: Check types, unit tests and lint**

Run:

```bash
npx tsc --noEmit
npm test
npm run lint -- --fix
npm run lint
```

Expected: `tsc` prints nothing; every unit test passes; lint shows 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/modules/dashboard/pages/DashboardPage.tsx src/modules/reports/pages/ReportsPage.tsx
git commit -m "feat(home): Home and Reports read the month's plan"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.


### Task 1.7: Each person's own plan, carried forward

The Budget page shows one person's plan at a time (a tab each, plus a read-only Shared tab for old months that have shared lines). Lines are grouped Fixed / Essential / Can cut, spending is counted by who paid, and Left to plan turns red when the plan is bigger than income. The dialog loses "For" and gains "Kind". Saving or removing a line first copies a carried-over plan into the month; removing a person's last line keeps it at zero so the month doesn't fall back to the previous plan. "Copy last month" goes away. The e2e seed gives each person their own lines with kinds.

**Files:**
- Modify: `src/modules/budget/lib/budget-view.test.ts`
- Modify: `src/modules/budget/lib/budget-view.ts`
- Modify: `src/modules/budget/schemas/budget-item.schema.ts`
- Modify: `src/modules/budget/api/budget.actions.ts`
- Modify: `src/modules/budget/components/BudgetDialog.tsx`
- Modify: `src/modules/budget/components/BudgetView.tsx`
- Modify: `src/modules/budget/pages/BudgetPage.tsx`
- Modify: `scripts/seed-e2e.ts`
- Modify: `e2e/budget.spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 1.2–1.6.
- Produces: `buildPersonPlan`, `sharedRows`, `type PersonPlan`, `type PlanRow`, `type KindGroup`, `type SharedRow` in `budget-view.ts` (replacing `buildBudgetGroups`); `setBudgetItemAction({ categoryId, kind, month, ownerMemberId, plannedAmount, year })`; `removeBudgetItemAction({ categoryId, month, ownerMemberId, year })`; `fillBudgetFromRecurringAction(year, month, ownerMemberId)`; `type PersonView` in `BudgetView.tsx`. Removes `getBudgetItemsForMonth` and `copyPreviousMonthBudgetAction`.

- [ ] **Step 1: Replace the Budget view tests**

Replace the whole of `src/modules/budget/lib/budget-view.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

import { buildBudgetLead, buildPersonPlan, overBudgetRows, sharedRows } from "./budget-view";

const CATEGORIES = [
  { budgetType: "flexible" as const, id: "food", name: "Groceries" },
  { budgetType: "fixed" as const, id: "rent", name: "Rent" },
  { budgetType: "flexible" as const, id: "lunch", name: "Lunch" },
  { budgetType: "flexible" as const, id: "fun", name: "Fun" },
];

describe("buildPersonPlan", () => {
  it("groups lines by kind in the order fixed, essential, can cut", () => {
    const plan = buildPersonPlan({
      categories: CATEGORIES,
      lines: [
        { categoryId: "lunch", inherited: false, kind: "can_cut", plannedAmount: 3000 },
        { categoryId: "food", inherited: false, kind: null, plannedAmount: 5000 },
        { categoryId: "rent", inherited: false, kind: null, plannedAmount: 20000 },
      ],
      spending: [],
    });

    expect(plan.groups.map((g) => [g.label, g.planned])).toEqual([
      ["Fixed", 20000],
      ["Essential", 5000],
      ["Can cut", 3000],
    ]);
    expect(plan.budgeted).toBe(28000);
  });

  it("counts spending against the line for its category", () => {
    const plan = buildPersonPlan({
      categories: CATEGORIES,
      lines: [{ categoryId: "food", inherited: false, kind: "essential", plannedAmount: 5000 }],
      spending: [
        { amount: 1200, categoryId: "food" },
        { amount: 800, categoryId: "food" },
      ],
    });

    expect(plan.groups[0].rows[0]).toMatchObject({ categoryName: "Groceries", planned: 5000, spent: 2000 });
    expect(plan.spentInLines).toBe(2000);
  });

  it("lists spending in categories without a line, biggest first", () => {
    const plan = buildPersonPlan({
      categories: CATEGORIES,
      lines: [{ categoryId: "food", inherited: false, kind: "essential", plannedAmount: 5000 }],
      spending: [
        { amount: 300, categoryId: "lunch" },
        { amount: 900, categoryId: "fun" },
        { amount: 1000, categoryId: "food" },
      ],
    });

    expect(plan.unbudgeted).toEqual([
      { categoryId: "fun", categoryName: "Fun", spent: 900 },
      { categoryId: "lunch", categoryName: "Lunch", spent: 300 },
    ]);
    expect(plan.unbudgetedTotal).toBe(1200);
    expect(plan.totalSpent).toBe(2200);
  });

  it("treats a zero line as no line", () => {
    const plan = buildPersonPlan({
      categories: CATEGORIES,
      lines: [{ categoryId: "lunch", inherited: false, kind: "can_cut", plannedAmount: 0 }],
      spending: [{ amount: 400, categoryId: "lunch" }],
    });

    expect(plan.groups).toEqual([]);
    expect(plan.unbudgeted).toEqual([{ categoryId: "lunch", categoryName: "Lunch", spent: 400 }]);
  });

  it("sorts rows in a group by how much of the line is used", () => {
    const plan = buildPersonPlan({
      categories: CATEGORIES,
      lines: [
        { categoryId: "food", inherited: false, kind: "essential", plannedAmount: 1000 },
        { categoryId: "fun", inherited: false, kind: "essential", plannedAmount: 1000 },
      ],
      spending: [
        { amount: 500, categoryId: "food" },
        { amount: 900, categoryId: "fun" },
      ],
    });

    expect(plan.groups[0].rows.map((r) => r.categoryName)).toEqual(["Fun", "Groceries"]);
  });

  it("keeps whether a line was carried over", () => {
    const plan = buildPersonPlan({
      categories: CATEGORIES,
      lines: [{ categoryId: "food", inherited: true, kind: null, plannedAmount: 5000 }],
      spending: [],
    });

    expect(plan.groups[0].rows[0].inherited).toBe(true);
  });
});

describe("sharedRows", () => {
  it("keeps only shared lines with an amount", () => {
    expect(
      sharedRows(
        [
          { categoryId: "food", ownerMemberId: null, plannedAmount: 1500 },
          { categoryId: "fun", ownerMemberId: null, plannedAmount: 0 },
          { categoryId: "lunch", ownerMemberId: "me", plannedAmount: 3000 },
        ],
        CATEGORIES,
      ),
    ).toEqual([{ categoryId: "food", categoryName: "Groceries", planned: 1500 }]);
  });
});

describe("buildBudgetLead", () => {
  it("names a single over-budget category", () => {
    expect(
      buildBudgetLead({
        allSpent: 10000,
        budgeted: 8000,
        income: 10000,
        outside: 1000,
        overBudget: [{ categoryName: "Rent", over: 500 }],
      }),
    ).toEqual({ outside: "10%", planned: "80%", rest: " is Rs 500.00 over.", strong: "Rent" });
  });

  it("counts multiple over-budget categories", () => {
    const lead = buildBudgetLead({
      allSpent: 10000,
      budgeted: 8000,
      income: 10000,
      outside: 0,
      overBudget: [
        { categoryName: "Rent", over: 500 },
        { categoryName: "Fun", over: 200 },
      ],
    });
    expect(lead.strong).toBe("2 categories");
    expect(lead.rest).toBe(" are over budget.");
  });

  it("celebrates an in-plan budget", () => {
    const lead = buildBudgetLead({ allSpent: 0, budgeted: 0, income: 0, outside: 0, overBudget: [] });
    expect(lead).toMatchObject({ outside: "0%", planned: "0%", strong: "" });
    expect(lead.rest).toBe("Every budget is within plan.");
  });
});

describe("overBudgetRows", () => {
  it("collects only rows that spent more than planned", () => {
    const plan = buildPersonPlan({
      categories: CATEGORIES,
      lines: [
        { categoryId: "food", inherited: false, kind: "essential", plannedAmount: 1000 },
        { categoryId: "fun", inherited: false, kind: "can_cut", plannedAmount: 1000 },
      ],
      spending: [
        { amount: 1500, categoryId: "food" },
        { amount: 400, categoryId: "fun" },
      ],
    });
    expect(overBudgetRows(plan)).toEqual([{ categoryName: "Groceries", over: 500 }]);
  });
});
```

- [ ] **Step 2: Replace the Budget view logic**

Replace the whole of `src/modules/budget/lib/budget-view.ts` with:

```ts
import { formatMoney } from "@/lib/money";

import { type BudgetLineKind, kindOf, LINE_KINDS } from "./plan-lines";

// Pure view logic for the Budget page: one person's plan (their lines grouped
// by kind, plus spending outside any line), the headline figures and the
// lead sentence.

export type PlanRow = {
  categoryId: string;
  categoryName: string;
  inherited: boolean;
  kind: BudgetLineKind;
  planned: number;
  spent: number;
};

export type KindGroup = { kind: BudgetLineKind; label: string; planned: number; rows: PlanRow[]; spent: number };

export type UnbudgetedRow = { categoryId: string; categoryName: string; spent: number };

export type PersonPlan = {
  budgeted: number;
  groups: KindGroup[];
  spentInLines: number;
  totalSpent: number;
  unbudgeted: UnbudgetedRow[];
  unbudgetedTotal: number;
};

type CategoryInput = { budgetType: "fixed" | "flexible"; id: string; name: string };
type LineInput = { categoryId: string; inherited: boolean; kind: BudgetLineKind | null; plannedAmount: number };
type SpendInput = { amount: number; categoryId: string };

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

// `lines` and `spending` are one person's: their plan lines, and the part of
// each expense that came out of their own wallet.
export function buildPersonPlan(input: { categories: CategoryInput[]; lines: LineInput[]; spending: SpendInput[] }): PersonPlan {
  const categoryById = new Map(input.categories.map((c) => [c.id, c]));
  const spentByCategory = new Map<string, number>();
  for (const s of input.spending) spentByCategory.set(s.categoryId, (spentByCategory.get(s.categoryId) ?? 0) + s.amount);

  const rows: PlanRow[] = input.lines.flatMap((line) => {
    const category = categoryById.get(line.categoryId);
    if (!category || line.plannedAmount <= 0) return [];
    return [
      {
        categoryId: line.categoryId,
        categoryName: category.name,
        inherited: line.inherited,
        kind: kindOf(line.kind, category.budgetType),
        planned: line.plannedAmount,
        spent: spentByCategory.get(line.categoryId) ?? 0,
      },
    ];
  });

  const groups = LINE_KINDS.flatMap(({ label, value }) => {
    const kindRows = rows.filter((r) => r.kind === value).sort((a, b) => b.spent / b.planned - a.spent / a.planned);
    if (kindRows.length === 0) return [];
    return [{ kind: value, label, planned: sum(kindRows.map((r) => r.planned)), rows: kindRows, spent: sum(kindRows.map((r) => r.spent)) }];
  });

  const planned = new Set(rows.map((r) => r.categoryId));
  const unbudgeted = [...spentByCategory]
    .filter(([categoryId, spent]) => !planned.has(categoryId) && spent > 0)
    .map(([categoryId, spent]) => ({ categoryId, categoryName: categoryById.get(categoryId)?.name ?? "Unknown", spent }))
    .sort((a, b) => b.spent - a.spent);

  const spentInLines = sum(rows.map((r) => r.spent));
  const unbudgetedTotal = sum(unbudgeted.map((r) => r.spent));
  return {
    budgeted: sum(rows.map((r) => r.planned)),
    groups,
    spentInLines,
    totalSpent: spentInLines + unbudgetedTotal,
    unbudgeted,
    unbudgetedTotal,
  };
}

// Lines set for both people before plans were per person. Spending now counts
// against whoever paid, so these only show what was planned.
export type SharedRow = { categoryId: string; categoryName: string; planned: number };

export function sharedRows(lines: { categoryId: string; ownerMemberId: null | string; plannedAmount: number }[], categories: CategoryInput[]): SharedRow[] {
  return lines.flatMap((line) => {
    const category = categories.find((c) => c.id === line.categoryId);
    if (line.ownerMemberId !== null || !category || line.plannedAmount <= 0) return [];
    return [{ categoryId: line.categoryId, categoryName: category.name, planned: line.plannedAmount }];
  });
}

export type BudgetLead = { outside: string; planned: string; rest: string; strong: string };

function share(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export function buildBudgetLead(input: {
  allSpent: number;
  budgeted: number;
  income: number;
  outside: number;
  overBudget: { categoryName: string; over: number }[];
}): BudgetLead {
  const { allSpent, budgeted, income, outside, overBudget } = input;

  let strong = "";
  let rest = "";
  if (overBudget.length === 1) {
    strong = overBudget[0].categoryName;
    rest = ` is Rs ${formatMoney(overBudget[0].over, { currency: false })} over.`;
  } else if (overBudget.length > 1) {
    strong = `${overBudget.length} categories`;
    rest = " are over budget.";
  } else {
    rest = "Every budget is within plan.";
  }

  return { outside: `${share(outside, allSpent)}%`, planned: `${share(budgeted, income)}%`, rest, strong };
}

export function overBudgetRows(plan: PersonPlan): { categoryName: string; over: number }[] {
  return plan.groups
    .flatMap((group) => group.rows)
    .filter((row) => row.spent > row.planned)
    .map((row) => ({ categoryName: row.categoryName, over: row.spent - row.planned }));
}
```

- [ ] **Step 3: Lines always have an owner and a kind**

In `src/modules/budget/schemas/budget-item.schema.ts` (change 1 of 2), find:

```ts
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  categoryId: z.string().uuid(),
  ownerMemberId: z.string().uuid().nullable(),
  plannedAmount: z.number().nonnegative(),
  // When editing an existing line: whose line it was. If it differs from
  // ownerMemberId, the line moves to the new owner.
  replacesOwnerMemberId: z.string().uuid().nullable().optional(),
});

export type SetBudgetItemInput = z.infer<typeof setBudgetItemSchema>;
```

Replace it with:

```ts
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  categoryId: z.string().uuid(),
  // Each person plans their own money, so a new line always has an owner.
  ownerMemberId: z.string().uuid(),
  plannedAmount: z.number().nonnegative(),
  kind: z.enum(["fixed", "essential", "can_cut"]),
});

export type SetBudgetItemInput = z.infer<typeof setBudgetItemSchema>;
```

In `src/modules/budget/schemas/budget-item.schema.ts` (change 2 of 2), find:

```ts
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  categoryId: z.string().uuid(),
  ownerMemberId: z.string().uuid().nullable(),
});

```

Replace it with:

```ts
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  categoryId: z.string().uuid(),
  // null removes an old shared line.
  ownerMemberId: z.string().uuid().nullable(),
});

```

- [ ] **Step 4: Save, remove and fill a person's own lines**

Replace the whole of `src/modules/budget/api/budget.actions.ts` with:

```ts
"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { budgetItems, incomes, monthlyBudgets, recurringExpenses } from "@/db/schema";
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { resolvePeriod } from "@/lib/month-period";
import { type CurrentMember, getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { activityActor, loadActivityFormatters, logActivities, logActivity } from "@/modules/activity/api/activity";
import type { ActivityFormatters } from "@/modules/activity/lib/activity-values";
import { listCategories } from "@/modules/categories/api/categories";

import { budgetItemChanges, budgetItemSummary, incomeChanges, incomeSummary } from "../lib/budget-activity";
import { recurringBudgetLines } from "../lib/recurring-budget";
import { type RemoveBudgetItemInput, removeBudgetItemSchema, type SetBudgetItemInput, setBudgetItemSchema } from "../schemas/budget-item.schema";
import { type SetIncomeInput, setIncomeSchema } from "../schemas/income.schema";
import { listPlanLines } from "./budget";

// Insert-or-get in one statement. A select-then-insert would race when two
// requests hit a not-yet-created month at the same time (both see nothing,
// both insert, one hits the unique constraint and 500s). The no-op update on
// conflict makes the concurrent case return the existing row instead.
async function getOrCreateMonthlyBudget(householdId: string, year: number, month: number) {
  const [budget] = await db
    .insert(monthlyBudgets)
    .values({ householdId, year, month })
    .onConflictDoUpdate({
      set: { householdId },
      target: [monthlyBudgets.householdId, monthlyBudgets.year, monthlyBudgets.month],
    })
    .returning();
  return budget;
}

// null = shared. A plain eq() never matches NULL in SQL.
function ownerIs(ownerMemberId: null | string) {
  return ownerMemberId === null ? isNull(budgetItems.ownerMemberId) : eq(budgetItems.ownerMemberId, ownerMemberId);
}

async function assertMemberInHousehold(householdId: string, memberId: string) {
  const members = await getHouseholdMembers(householdId);
  if (!members.some((m) => m.id === memberId)) {
    throw new Error("Member does not belong to this household");
  }
}

// A month where a person has no lines of their own shows their last month's
// plan. The first change to such a month copies that plan in for real, so the
// change lands on the copy and the rest of the plan stays as it was.
async function materializeMonth(member: CurrentMember, f: ActivityFormatters, ownerMemberId: string, year: number, month: number) {
  const { householdId } = member;
  const [budget, plan] = await Promise.all([getOrCreateMonthlyBudget(householdId, year, month), listPlanLines(householdId, year, month)]);
  const carried = plan.filter((l) => l.ownerMemberId === ownerMemberId && l.inherited);
  if (carried.length === 0) return budget;

  const inserted = await db
    .insert(budgetItems)
    .values(
      carried.map((l) => ({
        categoryId: l.categoryId,
        kind: l.kind,
        monthlyBudgetId: budget.id,
        ownerMemberId,
        plannedAmount: String(l.plannedAmount),
      })),
    )
    .onConflictDoNothing()
    .returning();
  await logActivities(
    activityActor(member),
    inserted.map((item) => ({
      action: "created" as const,
      after: item,
      entityId: item.id,
      entityType: "budget_item" as const,
      summary: budgetItemSummary(f, item, { month, year }),
    })),
  );
  return budget;
}

export async function setBudgetItemAction(input: SetBudgetItemInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = setBudgetItemSchema.parse(input);

  const [categories, f] = await Promise.all([listCategories(householdId), loadActivityFormatters(householdId)]);
  if (!categories.some((c) => c.id === parsed.categoryId)) {
    throw new Error("Category does not belong to this household");
  }
  await assertMemberInHousehold(householdId, parsed.ownerMemberId);

  const budget = await materializeMonth(member, f, parsed.ownerMemberId, parsed.year, parsed.month);

  // Only ever this person's own line: the other person's plan is theirs.
  const [before] = await db
    .select()
    .from(budgetItems)
    .where(
      and(
        eq(budgetItems.monthlyBudgetId, budget.id),
        eq(budgetItems.categoryId, parsed.categoryId),
        eq(budgetItems.ownerMemberId, parsed.ownerMemberId),
      ),
    );
  const [item] = await db
    .insert(budgetItems)
    .values({
      categoryId: parsed.categoryId,
      kind: parsed.kind,
      monthlyBudgetId: budget.id,
      ownerMemberId: parsed.ownerMemberId,
      plannedAmount: String(parsed.plannedAmount),
    })
    .onConflictDoUpdate({
      set: { kind: parsed.kind, plannedAmount: String(parsed.plannedAmount) },
      target: [budgetItems.monthlyBudgetId, budgetItems.categoryId, budgetItems.ownerMemberId],
    })
    .returning();

  const after = { categoryId: parsed.categoryId, kind: parsed.kind, ownerMemberId: parsed.ownerMemberId, plannedAmount: parsed.plannedAmount };
  const summary = budgetItemSummary(f, after, { month: parsed.month, year: parsed.year });
  await logActivity(
    activityActor(member),
    before
      ? { action: "updated", after: item, before, changes: budgetItemChanges(f, before, after), entityId: item.id, entityType: "budget_item", summary }
      : { action: "created", after: item, before: null, entityId: item.id, entityType: "budget_item", summary },
  );

  revalidatePath("/budget");
  revalidatePath("/dashboard");
}

export async function removeBudgetItemAction(input: RemoveBudgetItemInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = removeBudgetItemSchema.parse(input);
  const f = await loadActivityFormatters(householdId);

  let budget;
  if (parsed.ownerMemberId === null) {
    budget = await getOrCreateMonthlyBudget(householdId, parsed.year, parsed.month);
  } else {
    await assertMemberInHousehold(householdId, parsed.ownerMemberId);
    budget = await materializeMonth(member, f, parsed.ownerMemberId, parsed.year, parsed.month);
  }

  const own = await db
    .select()
    .from(budgetItems)
    .where(and(eq(budgetItems.monthlyBudgetId, budget.id), ownerIs(parsed.ownerMemberId)));
  const before = own.find((l) => l.categoryId === parsed.categoryId);
  if (!before) return;

  const summary = budgetItemSummary(f, before, { month: parsed.month, year: parsed.year });
  if (parsed.ownerMemberId !== null && own.length === 1) {
    // Removing a person's last line would leave the month empty, and an empty
    // month shows the previous month's plan again. Keep it at zero instead.
    const [after] = await db.update(budgetItems).set({ plannedAmount: "0" }).where(eq(budgetItems.id, before.id)).returning();
    await logActivity(activityActor(member), {
      action: "updated",
      after,
      before,
      changes: budgetItemChanges(f, before, after),
      entityId: before.id,
      entityType: "budget_item",
      summary,
    });
  } else {
    await db.delete(budgetItems).where(eq(budgetItems.id, before.id));
    await logActivity(activityActor(member), { action: "deleted", before, entityId: before.id, entityType: "budget_item", summary });
  }

  revalidatePath("/budget");
  revalidatePath("/dashboard");
}

// Adds a line to one person's plan for each category with their recurring
// bills due this month. Lines they already have are left alone. Returns how
// many lines it added.
export async function fillBudgetFromRecurringAction(year: number, month: number, ownerMemberId: string): Promise<number> {
  const member = await getCurrentMember();
  const { householdId } = member;
  await assertMemberInHousehold(householdId, ownerMemberId);
  const dateFormat = await getDateFormatPref(householdId);
  const period = resolvePeriod(year, month, dateFormat);

  // A person's plan only takes their own bills.
  const bills = await db
    .select()
    .from(recurringExpenses)
    .where(and(eq(recurringExpenses.householdId, householdId), eq(recurringExpenses.ownerMemberId, ownerMemberId)));
  const lines = recurringBudgetLines(
    bills.map((b) => ({
      amount: Number(b.amount),
      categoryId: b.categoryId,
      frequency: b.frequency,
      nextDueDate: b.nextDueDate,
      ownerMemberId: b.ownerMemberId,
      status: b.status,
    })),
    period,
  );
  if (lines.length === 0) return 0;

  const f = await loadActivityFormatters(householdId);
  const budget = await materializeMonth(member, f, ownerMemberId, year, month);
  const existing = await db
    .select()
    .from(budgetItems)
    .where(and(eq(budgetItems.monthlyBudgetId, budget.id), eq(budgetItems.ownerMemberId, ownerMemberId)));
  const existingCategoryIds = new Set(existing.map((i) => i.categoryId));
  const toInsert = lines
    .filter((line) => !existingCategoryIds.has(line.categoryId))
    .map((line) => ({
      categoryId: line.categoryId,
      kind: "fixed" as const,
      monthlyBudgetId: budget.id,
      ownerMemberId,
      plannedAmount: String(line.plannedAmount),
    }));

  if (toInsert.length > 0) {
    const inserted = await db.insert(budgetItems).values(toInsert).returning();
    await logActivities(
      activityActor(member),
      inserted.map((item) => ({
        action: "created" as const,
        after: item,
        entityId: item.id,
        entityType: "budget_item" as const,
        summary: budgetItemSummary(f, item, { month, year }),
      })),
    );
  }

  revalidatePath("/budget");
  revalidatePath("/dashboard");
  return toInsert.length;
}

export async function getIncomesForMonth(year: number, month: number) {
  const { householdId } = await getCurrentMember();
  return db
    .select()
    .from(incomes)
    .where(and(eq(incomes.householdId, householdId), eq(incomes.year, year), eq(incomes.month, month)));
}

export async function listAllIncomes() {
  const { householdId } = await getCurrentMember();
  return db.select().from(incomes).where(eq(incomes.householdId, householdId));
}

export async function setIncomeAction(input: SetIncomeInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = setIncomeSchema.parse(input);

  const members = await getHouseholdMembers(householdId);
  if (!members.some((m) => m.id === parsed.memberId)) {
    throw new Error("Member does not belong to this household");
  }

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

  const [saved] = await db
    .insert(incomes)
    .values({
      householdId,
      memberId: parsed.memberId,
      year: parsed.year,
      month: parsed.month,
      amount: String(parsed.amount),
      note: parsed.note,
    })
    .onConflictDoUpdate({
      target: [incomes.memberId, incomes.year, incomes.month],
      set: { amount: String(parsed.amount), note: parsed.note ?? null },
    })
    .returning();

  const f = await loadActivityFormatters(householdId);
  const after = { amount: parsed.amount, memberId: parsed.memberId, month: parsed.month, note: parsed.note, year: parsed.year };
  await logActivity(
    activityActor(member),
    before
      ? { action: "updated", after: saved, before, changes: incomeChanges(f, before, after), entityId: saved.id, entityType: "income", summary: incomeSummary(f, after) }
      : { action: "created", after: saved, before: null, entityId: saved.id, entityType: "income", summary: incomeSummary(f, after) },
  );

  revalidatePath("/budget");
  revalidatePath("/dashboard");
}
```

- [ ] **Step 5: The line dialog: Kind instead of For**

In `src/modules/budget/components/BudgetDialog.tsx` (change 1 of 9), find:

```tsx
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { removeBudgetItemAction, setBudgetItemAction } from "@/modules/budget/api/budget.actions";
import { updateCategoryAction } from "@/modules/categories/api/categories.actions";

type Category = { budgetType: "fixed" | "flexible"; groupName: string; id: string; name: string };
type Member = { id: string; name: string };

export type BudgetOwnerKey = "me" | "partner" | "shared";

export type BudgetDraft = {
  budgetType: "fixed" | "flexible";
  categoryId: string;
  ownerKey: BudgetOwnerKey;
  planned: number;
};

type Props = {
  categories: Category[];
  currentMemberId: string;
  defaultCategoryId?: string;
  initial?: BudgetDraft;
  members: Member[];
  month: number;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  ownerKey: BudgetOwnerKey;
  spentByKey: Record<string, number>;
  year: number;
};

const FORM_ID = "budget-form";
const AMOUNT_ERROR = "Enter a monthly amount";

// Set / change a category's budget for one owner. The category's Type also
// updates the shared category (spec §3.3), so every owner's budget for it
// reads the same.
export function BudgetDialog({ categories, currentMemberId, defaultCategoryId, initial, members, month, onOpenChange, open, ownerKey, spentByKey, year }: Props) {
  const [pending, setPending] = useState(false);

  return (
```

Replace it with:

```tsx
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { removeBudgetItemAction, setBudgetItemAction } from "@/modules/budget/api/budget.actions";
import { type BudgetLineKind, kindOf, LINE_KINDS } from "@/modules/budget/lib/plan-lines";

type Category = { budgetType: "fixed" | "flexible"; groupName: string; id: string; name: string };

export type BudgetDraft = { categoryId: string; kind: BudgetLineKind; planned: number };

type Props = {
  categories: Category[];
  defaultCategoryId?: string;
  initial?: BudgetDraft;
  // The kind this person last gave each category, so a new line starts the same way.
  lastKinds: Record<string, BudgetLineKind>;
  month: number;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  ownerMemberId: string;
  // "Your plan" or "Karuna's plan".
  planLabel: string;
  spentByCategory: Record<string, number>;
  year: number;
};

const FORM_ID = "budget-form";
const AMOUNT_ERROR = "Enter a monthly amount";

const KIND_HELP: Record<BudgetLineKind, string> = {
  can_cut: "Money you can choose not to spend, like lunches out or shopping. Home's safe to spend is worked out from these.",
  essential: "Changes month to month but can't really be cut, like petrol or groceries.",
  fixed: "The same every month, like rent, a loan payment or a bill.",
};

// Set or change one line of one person's plan.
export function BudgetDialog({ onOpenChange, open, ...rest }: Props) {
  const [pending, setPending] = useState(false);

  return (
```

In `src/modules/budget/components/BudgetDialog.tsx` (change 2 of 9), find:

```tsx
          <Button className="min-w-35 justify-start" disabled={pending} form={FORM_ID} type="submit">
            {pending ? "Saving..." : "Save budget"}
          </Button>
          {initial && (
            <Button disabled={pending} form={FORM_ID} type="submit" value="remove" variant="destructive">
              Remove budget
            </Button>
```

Replace it with:

```tsx
          <Button className="min-w-35 justify-start" disabled={pending} form={FORM_ID} type="submit">
            {pending ? "Saving..." : "Save budget"}
          </Button>
          {rest.initial && (
            <Button disabled={pending} form={FORM_ID} type="submit" value="remove" variant="destructive">
              Remove budget
            </Button>
```

In `src/modules/budget/components/BudgetDialog.tsx` (change 3 of 9), find:

```tsx
      hint="Enter to save · Esc to close"
      onOpenChange={onOpenChange}
      open={open}
      title={initial ? "Change budget" : "Set a budget"}
    >
      <BudgetFields
        categories={categories}
        currentMemberId={currentMemberId}
        defaultCategoryId={defaultCategoryId}
        initial={initial}
        members={members}
        month={month}
        onDone={() => onOpenChange(false)}
        onPendingChange={setPending}
        ownerKey={ownerKey}
        spentByKey={spentByKey}
        year={year}
      />
    </Modal>
  );
}

type FieldsProps = Omit<Props, "onOpenChange" | "open"> & { onDone: () => void; onPendingChange: (pending: boolean) => void };

function BudgetFields({ categories, currentMemberId, defaultCategoryId, initial, members, month, onDone, onPendingChange, ownerKey, spentByKey, year }: FieldsProps) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? defaultCategoryId ?? "");
  const [owner, setOwner] = useState<BudgetOwnerKey>(initial?.ownerKey ?? ownerKey);
  const [amount, setAmount] = useState(initial ? String(initial.planned) : "");
  const [budgetType, setBudgetType] = useState<"fixed" | "flexible">(
    () => initial?.budgetType ?? categories.find((c) => c.id === defaultCategoryId)?.budgetType ?? "flexible",
  );
  const [error, setError] = useState<string | undefined>();

  const partner = members.find((m) => m.id !== currentMemberId) ?? null;
  const memberIdFor = (key: BudgetOwnerKey) => (key === "shared" ? null : key === "me" ? currentMemberId : (partner?.id ?? currentMemberId));

  const selectedCategory = categories.find((c) => c.id === categoryId) ?? null;
  const spent = categoryId ? (spentByKey[`${categoryId}::${owner}`] ?? 0) : 0;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
```

Replace it with:

```tsx
      hint="Enter to save · Esc to close"
      onOpenChange={onOpenChange}
      open={open}
      subtitle={rest.planLabel}
      title={rest.initial ? "Change budget" : "Set a budget"}
    >
      <BudgetFields {...rest} onDone={() => onOpenChange(false)} onPendingChange={setPending} />
    </Modal>
  );
}

type FieldsProps = Omit<Props, "onOpenChange" | "open"> & { onDone: () => void; onPendingChange: (pending: boolean) => void };

function BudgetFields({
  categories,
  defaultCategoryId,
  initial,
  lastKinds,
  month,
  onDone,
  onPendingChange,
  ownerMemberId,
  spentByCategory,
  year,
}: FieldsProps) {
  const router = useRouter();
  const defaultKind = (categoryId: string) => lastKinds[categoryId] ?? kindOf(null, categories.find((c) => c.id === categoryId)?.budgetType);
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? defaultCategoryId ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.planned) : "");
  const [kind, setKind] = useState<BudgetLineKind>(() => initial?.kind ?? defaultKind(initial?.categoryId ?? defaultCategoryId ?? ""));
  const [error, setError] = useState<string | undefined>();

  const selectedCategory = categories.find((c) => c.id === categoryId) ?? null;
  const spent = categoryId ? (spentByCategory[categoryId] ?? 0) : 0;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
```

In `src/modules/budget/components/BudgetDialog.tsx` (change 4 of 9), find:

```tsx
    onPendingChange(true);
    try {
      if (intent === "remove") {
        await removeBudgetItemAction({ categoryId, month, ownerMemberId: memberIdFor(owner), year });
        toast.success("Budget removed");
        onDone();
        router.refresh();
```

Replace it with:

```tsx
    onPendingChange(true);
    try {
      if (intent === "remove") {
        await removeBudgetItemAction({ categoryId, month, ownerMemberId, year });
        toast.success("Budget removed");
        onDone();
        router.refresh();
```

In `src/modules/budget/components/BudgetDialog.tsx` (change 5 of 9), find:

```tsx
        return;
      }

      if (selectedCategory.budgetType !== budgetType) {
        await updateCategoryAction(selectedCategory.id, {
          budgetType,
          groupName: selectedCategory.groupName,
          name: selectedCategory.name,
        });
      }
      await setBudgetItemAction({
        categoryId: selectedCategory.id,
        month,
        ownerMemberId: memberIdFor(owner),
        plannedAmount: value,
        // Only a line kept in the same category can move to another owner.
        replacesOwnerMemberId: initial?.categoryId === selectedCategory.id ? memberIdFor(initial.ownerKey) : undefined,
        year,
      });
      toast.success("Budget saved");
      onDone();
      router.refresh();
```

Replace it with:

```tsx
        return;
      }

      await setBudgetItemAction({ categoryId: selectedCategory.id, kind, month, ownerMemberId, plannedAmount: value, year });
      toast.success("Budget saved");
      onDone();
      router.refresh();
```

In `src/modules/budget/components/BudgetDialog.tsx` (change 6 of 9), find:

```tsx
    }
  }

  const ownerOptions = [
    { label: "Me", value: "me" as const },
    ...(partner ? [{ label: partner.name, value: "partner" as const }] : []),
    { label: "Shared", value: "shared" as const },
  ];

  return (
    <form className="flex flex-col gap-5.5" id={FORM_ID} noValidate onSubmit={onSubmit}>
      <div>
```

Replace it with:

```tsx
    }
  }

  return (
    <form className="flex flex-col gap-5.5" id={FORM_ID} noValidate onSubmit={onSubmit}>
      <div>
```

In `src/modules/budget/components/BudgetDialog.tsx` (change 7 of 9), find:

```tsx
          label="Category"
          onValueChange={(value) => {
            setCategoryId(value);
            setError(undefined);
          }}
          placeholder="Search categories..."
```

Replace it with:

```tsx
          label="Category"
          onValueChange={(value) => {
            setCategoryId(value);
            // A new line starts as this person last had it for the category.
            if (!initial) setKind(defaultKind(value));
            setError(undefined);
          }}
          placeholder="Search categories..."
```

In `src/modules/budget/components/BudgetDialog.tsx` (change 8 of 9), find:

```tsx
        )}
      </div>

      <Segmented label="For" onChange={setOwner} options={ownerOptions} value={owner} />

      <AmountInput
        data-autofocus
        error={error === AMOUNT_ERROR ? error : undefined}
```

Replace it with:

```tsx
        )}
      </div>

      <AmountInput
        data-autofocus
        error={error === AMOUNT_ERROR ? error : undefined}
```

In `src/modules/budget/components/BudgetDialog.tsx` (change 9 of 9), find:

```tsx
      />

      <div>
        <Segmented
          label="Type"
          onChange={setBudgetType}
          options={[
            { label: "Fixed", value: "fixed" },
            { label: "Flexible", value: "flexible" },
          ]}
          value={budgetType}
        />
        <p className="mt-1.5 text-xs leading-normal text-n-600">
          Fixed is the same every month, like a loan payment. Flexible changes, like groceries.
        </p>
      </div>
    </form>
  );
```

Replace it with:

```tsx
      />

      <div>
        <Segmented label="Kind" onChange={setKind} options={LINE_KINDS} value={kind} />
        <p className="mt-1.5 text-xs leading-normal text-n-600">{KIND_HELP[kind]}</p>
      </div>
    </form>
  );
```

- [ ] **Step 6: The Budget page view**

Replace the whole of `src/modules/budget/components/BudgetView.tsx` with:

```tsx
"use client";

import { Fragment, useState } from "react";

import { ChevronRight, Plus, Repeat } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Ledger, LedgerCell } from "@/components/Ledger";
import { LineTabs } from "@/components/LineTabs";
import { Meter } from "@/components/Meter";
import { Money } from "@/components/Money";
import { Monogram, type MonogramPerson } from "@/components/Monogram";
import { PageHeader } from "@/components/PageHeader";
import { Row, type RowColumns, RowGroupHead, RowsHeader } from "@/components/Rows";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import type { MonthNavModel } from "@/lib/month-nav";
import { cn } from "@/lib/utils";
import { fillBudgetFromRecurringAction } from "@/modules/budget/api/budget.actions";
import { BudgetDialog, type BudgetDraft } from "@/modules/budget/components/BudgetDialog";
import { SetIncomeDialog } from "@/modules/budget/components/SetIncomeDialog";
import type { BudgetLead, PersonPlan, PlanRow, SharedRow } from "@/modules/budget/lib/budget-view";
import type { BudgetLineKind } from "@/modules/budget/lib/plan-lines";

type Category = { budgetType: "fixed" | "flexible"; groupName: string; id: string; name: string };
type Member = { id: string; name: string };

type LedgerFigures = {
  budgeted: number;
  budgetedRatio: number;
  budgetedSub: string;
  outside: number;
  outsideSub: string;
  spentIn: number;
  spentInSub: string;
  unplanned: number;
  unplannedSub: string;
};

export type PersonView = {
  // Set when this month shows a plan carried over from an earlier month.
  carriedFrom: null | string;
  key: "me" | "partner";
  lastKinds: Record<string, BudgetLineKind>;
  lead: BudgetLead;
  ledger: LedgerFigures;
  memberId: string;
  name: string;
  plan: PersonPlan;
  savings: { planned: number; pots: { id: string; name: string; planned: number; putIn: number }[]; putIn: number };
  spentByCategory: Record<string, number>;
};

type Props = {
  categories: Category[];
  currentMemberId: string;
  incomes: Record<string, number>;
  members: Member[];
  month: number;
  monthLabel: string;
  monthNav: MonthNavModel;
  people: PersonView[];
  shared: SharedRow[];
  year: number;
};

type Tab = "me" | "partner" | "shared";

const COLUMNS: RowColumns = {
  lg: "minmax(170px,1.6fr) repeat(3,minmax(0,0.85fr)) minmax(140px,1.2fr)",
  md: "minmax(130px,1.4fr) repeat(3,minmax(0,0.9fr)) minmax(110px,1fr)",
  sm: "minmax(120px,1.4fr) repeat(3,minmax(0,0.9fr)) minmax(90px,1fr)",
};
const SHOWN_UNBUDGETED = 4;

function pct(ratio: number) {
  return `${Math.round(ratio * 100)}%`;
}

export function BudgetView(props: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("me");
  const [openUnbudgeted, setOpenUnbudgeted] = useState(false);
  const [dialog, setDialog] = useState<{ defaultCategoryId?: string; initial?: BudgetDraft; open: boolean }>({ open: false });
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [fillPending, setFillPending] = useState(false);

  const person = tab === "shared" ? null : (props.people.find((p) => p.key === tab) ?? props.people[0]);
  const monogram = (p: PersonView): MonogramPerson[] => [{ name: p.name, role: p.key }];

  function openNew() {
    setDialog({ open: true });
  }

  function openRow(row: PlanRow) {
    setDialog({ initial: { categoryId: row.categoryId, kind: row.kind, planned: row.planned }, open: true });
  }

  function openCategory(categoryId: string) {
    setDialog({ defaultCategoryId: categoryId, open: true });
  }

  async function fillFromRecurring() {
    if (!person) return;
    setFillPending(true);
    try {
      const added = await fillBudgetFromRecurringAction(props.year, props.month, person.memberId);
      toast.success(added > 0 ? `Added ${added} ${added === 1 ? "line" : "lines"} from recurring bills` : "Nothing new to add from recurring bills");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fill");
    } finally {
      setFillPending(false);
    }
  }

  const tabs = [
    ...props.people.map((p) => ({ label: p.key === "me" ? "Me" : p.name, value: p.key })),
    ...(props.shared.length > 0 ? [{ label: "Shared", value: "shared" as const }] : []),
  ];

  return (
    <div>
      <PageHeader
        actions={
          <>
            {person && (
              <>
                <Button disabled={fillPending} onClick={() => void fillFromRecurring()} variant="ghost">
                  <Repeat />
                  Fill from recurring
                </Button>
                <Button className="h-9.5" onClick={openNew} variant="outline">
                  <Plus />
                  Add budget
                </Button>
              </>
            )}
            <Button onClick={() => setIncomeOpen(true)} variant="ghost">
              Set income
            </Button>
          </>
        }
        monthNav={props.monthNav}
        title="Budget"
      />

      {person && (
        <>
          <p className="mb-6.5 max-w-[60ch] text-xl leading-[1.45] tracking-[-0.005em] text-n-800 text-pretty">
            {person.key === "me" ? "You've" : `${person.name} has`} planned{" "}
            <strong className="text-ink">{person.lead.planned} of this month&apos;s income</strong>, yet{" "}
            <strong className="text-ink">{person.lead.outside} of spending</strong> happened outside a budget.{" "}
            <strong className="text-ink">{person.lead.strong}</strong>
            {person.lead.rest}
          </p>

          <Ledger>
            <LedgerCell bar={<Meter ratio={person.ledger.budgetedRatio} />} label="Budgeted" lead note={person.ledger.budgetedSub}>
              <Money size="lead" value={person.ledger.budgeted} />
            </LedgerCell>
            <LedgerCell label="Spent in budgets" note={person.ledger.spentInSub}>
              <Money size="cell" value={person.ledger.spentIn} />
            </LedgerCell>
            <LedgerCell label="Spent outside" note={person.ledger.outsideSub}>
              <Money size="cell" value={person.ledger.outside} />
            </LedgerCell>
            <LedgerCell
              label="Left to plan"
              note={<span className={cn(person.ledger.unplanned < 0 && "text-signal-ink")}>{person.ledger.unplannedSub}</span>}
            >
              <Money size="cell" tone={person.ledger.unplanned < 0 ? "negative" : "default"} value={person.ledger.unplanned} />
            </LedgerCell>
          </Ledger>
        </>
      )}

      <LineTabs
        aside={person ? "Click a row to change its budget" : undefined}
        className="mt-5.5 mb-6.5"
        label="Whose plan"
        onChange={(value) => setTab(value)}
        tabs={tabs}
        value={tab}
      />

      {person?.carriedFrom && (
        <p className="mb-4 text-[13px] text-n-700">
          Carried over from {person.carriedFrom}. Changing a line makes this month&apos;s plan its own.
        </p>
      )}

      <RowsHeader columns={COLUMNS}>
        <span>Category</span>
        <span className="text-right">Budget</span>
        <span className="text-right">Spent</span>
        <span className="text-right">Left</span>
        <span>Used</span>
      </RowsHeader>

      {person && <PersonRows monogram={monogram(person)} onCategory={openCategory} onNew={openNew} onRow={openRow} openUnbudgeted={openUnbudgeted} person={person} setOpenUnbudgeted={setOpenUnbudgeted} />}

      {tab === "shared" && (
        <>
          <RowGroupHead columns={COLUMNS} first>
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="text-[15px] font-semibold whitespace-nowrap">Shared</span>
              <span className="truncate text-[13px] text-n-600">From before plans were per person. Spending now counts against whoever paid.</span>
            </div>
            <div className="text-right text-[15px] font-semibold">
              <Money value={props.shared.reduce((sum, row) => sum + row.planned, 0)} />
            </div>
            <div />
            <div />
            <div />
          </RowGroupHead>
          {props.shared.map((row) => (
            <Row columns={COLUMNS} key={row.categoryId}>
              <span className="truncate text-[15px] whitespace-nowrap">{row.categoryName}</span>
              <div className="text-right text-[15px]">
                <Money value={row.planned} />
              </div>
              <div className="text-right text-[15px] text-n-500">—</div>
              <div className="text-right text-[15px] text-n-500">—</div>
              <div />
            </Row>
          ))}
        </>
      )}

      {person && person.savings.pots.length > 0 && (
        <>
          <RowGroupHead columns={COLUMNS}>
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="text-[15px] font-semibold whitespace-nowrap">Savings</span>
              <span className="truncate text-[13px] text-n-600">Planned against put in this month</span>
            </div>
            <div className="text-right text-[15px] font-semibold">
              <Money value={person.savings.planned} />
            </div>
            <div className="text-right text-[15px] font-semibold">
              <Money value={person.savings.putIn} />
            </div>
            <div className="text-right text-[15px] font-semibold">
              <Money value={Math.max(0, person.savings.planned - person.savings.putIn)} />
            </div>
            <div className="flex min-w-0 items-center gap-2.5">
              <Meter className="flex-1" ratio={person.savings.planned > 0 ? Math.min(1, person.savings.putIn / person.savings.planned) : 0} />
              <span className="w-10.5 text-right text-[13px] font-semibold text-ink">
                {pct(person.savings.planned > 0 ? person.savings.putIn / person.savings.planned : 0)}
              </span>
            </div>
          </RowGroupHead>
          {person.savings.pots.map((pot) => (
            <Row columns={COLUMNS} key={pot.id}>
              <span className="truncate text-[15px] whitespace-nowrap">{pot.name}</span>
              <div className="text-right text-[15px]">
                <Money value={pot.planned} />
              </div>
              <div className="text-right text-[15px]">
                <Money value={pot.putIn} />
              </div>
              <div className="text-right text-[15px]">
                <Money value={Math.max(0, pot.planned - pot.putIn)} />
              </div>
              <div className="flex min-w-0 items-center gap-2.5">
                <Meter className="flex-1" ratio={pot.planned > 0 ? Math.min(1, pot.putIn / pot.planned) : 0} />
                <span className="w-10.5 text-right text-[13px] text-n-700">{pct(pot.planned > 0 ? pot.putIn / pot.planned : 0)}</span>
              </div>
            </Row>
          ))}
        </>
      )}

      {person && (
        <BudgetDialog
          categories={props.categories}
          defaultCategoryId={dialog.defaultCategoryId}
          initial={dialog.initial}
          lastKinds={person.lastKinds}
          month={props.month}
          onOpenChange={(value) => !value && setDialog({ open: false })}
          open={dialog.open}
          ownerMemberId={person.memberId}
          planLabel={person.key === "me" ? "Your plan" : `${person.name}'s plan`}
          spentByCategory={person.spentByCategory}
          year={props.year}
        />
      )}

      <SetIncomeDialog
        currentMemberId={props.currentMemberId}
        incomes={props.incomes}
        members={props.members}
        month={props.month}
        monthLabel={props.monthLabel}
        onOpenChange={setIncomeOpen}
        open={incomeOpen}
        year={props.year}
      />
    </div>
  );
}

type PersonRowsProps = {
  monogram: MonogramPerson[];
  onCategory: (categoryId: string) => void;
  onNew: () => void;
  onRow: (row: PlanRow) => void;
  openUnbudgeted: boolean;
  person: PersonView;
  setOpenUnbudgeted: (open: boolean) => void;
};

// One person's plan: a group per kind (fixed, essential, can cut), then their
// spending in categories without a line.
function PersonRows({ monogram, onCategory, onNew, onRow, openUnbudgeted, person, setOpenUnbudgeted }: PersonRowsProps) {
  const { plan } = person;
  const shown = plan.unbudgeted.slice(0, SHOWN_UNBUDGETED);
  const moreCount = plan.unbudgeted.length - shown.length;
  const moreTotal = plan.unbudgeted.slice(SHOWN_UNBUDGETED).reduce((sum, row) => sum + row.spent, 0);
  const preview = `${shown.map((row) => row.categoryName).join(", ")}${moreCount > 0 ? ` and ${moreCount} more` : ""}`;

  return (
    <>
      {plan.groups.length === 0 && (
        <RowGroupHead columns={COLUMNS} first>
          <div className="flex min-w-0 items-center gap-2.5">
            <Monogram people={monogram} />
            <span className="text-[15px] font-semibold whitespace-nowrap">{person.key === "me" ? "Me" : person.name}</span>
            <span className="truncate text-[13px] text-n-600">
              No budgets yet · Rs {formatMoney(plan.totalSpent, { currency: false })} spent
            </span>
          </div>
          <div className="col-span-4 flex justify-end">
            <Button className="h-auto px-1.5 py-0.75 text-[13px]" onClick={onNew} type="button" variant="ghost">
              <Plus />
              Set a budget
            </Button>
          </div>
        </RowGroupHead>
      )}

      {plan.groups.map((group, index) => {
        const usedRatio = group.planned > 0 ? group.spent / group.planned : 0;
        const left = group.planned - group.spent;
        return (
          <Fragment key={group.kind}>
            <RowGroupHead columns={COLUMNS} first={index === 0}>
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="text-[15px] font-semibold whitespace-nowrap">{group.label}</span>
                <span className="truncate text-[13px] text-n-600">
                  {group.rows.length} {group.rows.length === 1 ? "line" : "lines"}
                </span>
              </div>
              <div className="text-right text-[15px] font-semibold">
                <Money value={group.planned} />
              </div>
              <div className="text-right text-[15px] font-semibold">
                <Money value={group.spent} />
              </div>
              <div className={cn("text-right text-[15px] font-semibold", left < 0 && "text-signal-ink")}>
                <Money tone={left < 0 ? "negative" : "default"} value={left} />
              </div>
              <div className="flex min-w-0 items-center gap-2.5">
                <Meter className="flex-1" ratio={usedRatio} />
                <span className={cn("w-10.5 text-right text-[13px] font-semibold", usedRatio > 1 ? "text-signal-ink" : "text-ink")}>
                  {pct(usedRatio)}
                </span>
              </div>
            </RowGroupHead>

            {group.rows.map((row) => {
              const rowRatio = row.planned > 0 ? row.spent / row.planned : 0;
              const rowLeft = row.planned - row.spent;
              return (
                <Row columns={COLUMNS} key={row.categoryId} onClick={() => onRow(row)}>
                  <span className="truncate text-[15px] whitespace-nowrap">{row.categoryName}</span>
                  <div className="text-right text-[15px]">
                    <Money value={row.planned} />
                  </div>
                  <div className="text-right text-[15px]">
                    <Money value={row.spent} />
                  </div>
                  <div className={cn("text-right text-[15px] font-semibold", rowLeft < 0 && "text-signal-ink")}>
                    <Money tone={rowLeft < 0 ? "negative" : "default"} value={rowLeft} />
                  </div>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Meter className="flex-1" ratio={rowRatio} />
                    <span className={cn("w-10.5 text-right text-[13px]", rowRatio > 1 ? "text-signal-ink" : "text-n-700")}>{pct(rowRatio)}</span>
                  </div>
                </Row>
              );
            })}
          </Fragment>
        );
      })}

      {plan.unbudgeted.length > 0 && (
        <>
          <Row columns={COLUMNS} onClick={() => setOpenUnbudgeted(!openUnbudgeted)}>
            <div className="col-span-2 flex min-w-0 items-center gap-2">
              <ChevronRight aria-hidden className={cn("size-3.5 shrink-0 text-n-600 transition-transform", openUnbudgeted && "rotate-90")} />
              <span className="shrink-0 text-sm text-n-800">Without a budget</span>
              <span className="truncate text-[13px] text-n-600">{preview}</span>
            </div>
            <div className="text-right text-[15px]">
              <Money value={plan.unbudgetedTotal} />
            </div>
            <div />
            <div className="text-[13px] text-n-600">
              {plan.unbudgeted.length} {plan.unbudgeted.length === 1 ? "category" : "categories"}
            </div>
          </Row>

          {openUnbudgeted &&
            shown.map((row) => (
              <Row className="bg-ink/3" columns={COLUMNS} key={row.categoryId}>
                <div className="col-span-2 truncate pl-5.5 text-sm text-n-800">{row.categoryName}</div>
                <div className="text-right text-sm">
                  <Money value={row.spent} />
                </div>
                <div />
                <div className="flex">
                  <Button className="h-auto px-1.5 py-0.5 text-[13px]" onClick={() => onCategory(row.categoryId)} type="button" variant="ghost">
                    Set budget
                  </Button>
                </div>
              </Row>
            ))}

          {openUnbudgeted && moreCount > 0 && (
            <Row className="bg-ink/3" columns={COLUMNS}>
              <div className="col-span-2 truncate pl-5.5 text-sm text-n-800">
                {moreCount} more {moreCount === 1 ? "category" : "categories"}
              </div>
              <div className="text-right text-sm">
                <Money value={moreTotal} />
              </div>
              <div />
              <div />
            </Row>
          )}
        </>
      )}
    </>
  );
}
```

- [ ] **Step 7: The Budget page data**

Replace the whole of `src/modules/budget/pages/BudgetPage.tsx` with:

```tsx
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { formatMoney } from "@/lib/money";
import { buildMonthNav, parseMonthParam } from "@/lib/month-nav";
import { currentPeriodYearMonth, formatPeriodLabel, MAX_NAVIGABLE_YEAR, MIN_NAVIGABLE_YEAR, resolvePeriod } from "@/lib/month-period";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { listDatedLines, listPlanLines } from "@/modules/budget/api/budget";
import { getIncomesForMonth } from "@/modules/budget/api/budget.actions";
import { BudgetView, type PersonView } from "@/modules/budget/components/BudgetView";
import { buildBudgetLead, buildPersonPlan, overBudgetRows, sharedRows } from "@/modules/budget/lib/budget-view";
import { lastKindByCategory } from "@/modules/budget/lib/plan-lines";
import { listCategories } from "@/modules/categories/api/categories";
import { walletShares } from "@/modules/dashboard/lib/wallet";
import { listExpensesForMonth } from "@/modules/expenses/api/expenses.actions";
import { checkBudgetReminder } from "@/modules/notifications/api/notifications.actions";
import { listSavingsDeposits, listSavingsPotPlans, listSavingsPots } from "@/modules/savings/api/savings.actions";

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

type Props = { searchParams: Promise<{ month?: string; year?: string }> };

export async function BudgetPage({ searchParams }: Props) {
  const { householdId, memberId } = await getCurrentMember();
  const dateFormat = await getDateFormatPref(householdId);
  const params = await searchParams;
  const { year: currentYear, month: currentMonth } = currentPeriodYearMonth(dateFormat);
  const year = parseMonthParam(params.year, currentYear, MAX_NAVIGABLE_YEAR[dateFormat], MIN_NAVIGABLE_YEAR[dateFormat]);
  const month = parseMonthParam(params.month, currentMonth, 12);
  const isCurrentMonth = year === currentYear && month === currentMonth;
  const period = resolvePeriod(year, month, dateFormat);

  const [members, categories, incomes, planLines, datedLines, expenseRows, potRows, planRows, depositRows] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    getIncomesForMonth(year, month),
    listPlanLines(householdId, year, month),
    listDatedLines(householdId, { month, year }),
    listExpensesForMonth(year, month, dateFormat),
    listSavingsPots(householdId),
    listSavingsPotPlans(householdId),
    listSavingsDeposits(householdId),
  ]);

  if (isCurrentMonth) {
    await checkBudgetReminder(householdId, year, month, planLines.length);
  }

  const memberIds = members.map((m) => m.id);
  const categoryList = categories.map((c) => ({ budgetType: c.budgetType, groupName: c.groupName, id: c.id, name: c.name }));

  // Each person's spending is what left their own wallet, the same as Home.
  // Expenses paid from savings were saved for in earlier months, so they don't
  // count against this month's budget.
  const shares = expenseRows
    .filter((e) => e.savingsPotId === null)
    .flatMap((e) =>
      walletShares(
        { amount: Number(e.amount), paidByMemberId: e.paidByMemberId, payBackAmount: e.payBackAmount === null ? null : Number(e.payBackAmount) },
        memberIds,
      ).map((share) => ({ ...share, categoryId: e.categoryId })),
    );

  const ordered = [...members.filter((m) => m.id === memberId), ...members.filter((m) => m.id !== memberId)];
  const people: PersonView[] = ordered.map((member) => {
    const lines = planLines.filter((l) => l.ownerMemberId === member.id);
    const spending = shares.filter((s) => s.memberId === member.id);
    const plan = buildPersonPlan({ categories: categoryList, lines, spending });
    const income = incomes.filter((i) => i.memberId === member.id).reduce((sum, i) => sum + Number(i.amount), 0);

    // Savings comes from the pots' monthly plans: this person's share of each.
    const pots = potRows.flatMap((pot) => {
      const planned = planRows.filter((p) => p.potId === pot.id && p.memberId === member.id).reduce((sum, p) => sum + Number(p.monthlyAmount), 0);
      const putIn = depositRows
        .filter((d) => d.potId === pot.id && d.kind === "deposit" && d.memberId === member.id && d.date >= period.startDate && d.date <= period.endDate)
        .reduce((sum, d) => sum + Number(d.amount), 0);
      return planned > 0 || putIn > 0 ? [{ id: pot.id, name: pot.name, planned, putIn }] : [];
    });
    const plannedSavings = pots.reduce((sum, pot) => sum + pot.planned, 0);
    const unplanned = income - plan.budgeted - plannedSavings;
    const carried = lines.find((l) => l.inherited);

    return {
      carriedFrom: carried ? formatPeriodLabel(carried.year, carried.month, dateFormat) : null,
      key: member.id === memberId ? ("me" as const) : ("partner" as const),
      lastKinds: lastKindByCategory(datedLines, member.id),
      lead: buildBudgetLead({
        allSpent: plan.totalSpent,
        budgeted: plan.budgeted,
        income,
        outside: plan.unbudgetedTotal,
        overBudget: overBudgetRows(plan),
      }),
      ledger: {
        budgeted: plan.budgeted,
        budgetedRatio: income > 0 ? plan.budgeted / income : 0,
        budgetedSub: `${percent(plan.budgeted, income)}% of Rs ${formatMoney(income, { currency: false })} income`,
        outside: plan.unbudgetedTotal,
        outsideSub: `${percent(plan.unbudgetedTotal, plan.totalSpent)}% of all spending`,
        spentIn: plan.spentInLines,
        spentInSub: plan.budgeted > 0 ? `${percent(plan.spentInLines, plan.budgeted)}% of what's budgeted` : "Nothing budgeted yet",
        unplanned,
        unplannedSub:
          unplanned < 0
            ? "The plan is bigger than income"
            : plannedSavings > 0
              ? `${percent(unplanned, income)}% of income, after ${formatMoney(plannedSavings)} planned savings`
              : `${percent(unplanned, income)}% of income`,
      },
      memberId: member.id,
      name: member.user.name,
      plan,
      savings: { planned: plannedSavings, pots, putIn: pots.reduce((sum, pot) => sum + pot.putIn, 0) },
      spentByCategory: Object.fromEntries(
        [...new Set(spending.map((s) => s.categoryId))].map((id) => [id, spending.filter((s) => s.categoryId === id).reduce((sum, s) => sum + s.amount, 0)]),
      ),
    };
  });

  return (
    <BudgetView
      categories={categoryList}
      currentMemberId={memberId}
      incomes={Object.fromEntries(memberIds.map((id) => [id, incomes.filter((i) => i.memberId === id).reduce((sum, i) => sum + Number(i.amount), 0)]))}
      members={members.map((m) => ({ id: m.id, name: m.user.name }))}
      month={month}
      monthLabel={formatPeriodLabel(year, month, dateFormat)}
      monthNav={buildMonthNav({
        allowFuture: true,
        basePath: "/budget",
        current: { month: currentMonth, year: currentYear },
        dateFormat,
        selected: { month, year },
      })}
      people={people}
      shared={sharedRows(planLines, categoryList)}
      year={year}
    />
  );
}
```

- [ ] **Step 8: Seed per-person lines and test the new behaviour**

In `scripts/seed-e2e.ts`, find:

```ts
  const oldest = months[0];

  // A small plan for the current month so the dashboard hero (weekly pacing)
  // and the budget page have something to render. Groceries is shared and
  // flexible; the rest sit with one member.
  const [currentBudget] = await db
    .insert(monthlyBudgets)
    .values({ householdId: household.id, month: current.month, year: current.year })
    .returning();
  await db.insert(budgetItems).values([
    { categoryId: idOf("Groceries"), monthlyBudgetId: currentBudget.id, ownerMemberId: null, plannedAmount: "15000" },
    { categoryId: idOf("Dining Out"), monthlyBudgetId: currentBudget.id, ownerMemberId: m1.id, plannedAmount: "6000" },
    { categoryId: idOf("Entertainment"), monthlyBudgetId: currentBudget.id, ownerMemberId: m2.id, plannedAmount: "4000" },
    { categoryId: idOf("EMI"), monthlyBudgetId: currentBudget.id, ownerMemberId: m1.id, plannedAmount: "8000" },
  ]);

  // Current-month income and spending so the dashboard, budget and reports
```

Replace it with:

```ts
  const oldest = months[0];

  // A small plan for the current month so the dashboard hero (weekly pacing)
  // and the budget page have something to render. Each person plans their
  // own money: one line of each kind for member 1, a can-cut line for member 2.
  const [currentBudget] = await db
    .insert(monthlyBudgets)
    .values({ householdId: household.id, month: current.month, year: current.year })
    .returning();
  await db.insert(budgetItems).values([
    { categoryId: idOf("Groceries"), kind: "essential", monthlyBudgetId: currentBudget.id, ownerMemberId: m1.id, plannedAmount: "15000" },
    { categoryId: idOf("Dining Out"), kind: "can_cut", monthlyBudgetId: currentBudget.id, ownerMemberId: m1.id, plannedAmount: "6000" },
    { categoryId: idOf("Entertainment"), kind: "can_cut", monthlyBudgetId: currentBudget.id, ownerMemberId: m2.id, plannedAmount: "4000" },
    { categoryId: idOf("EMI"), kind: "fixed", monthlyBudgetId: currentBudget.id, ownerMemberId: m1.id, plannedAmount: "8000" },
  ]);

  // Current-month income and spending so the dashboard, budget and reports
```

Replace the whole of `e2e/budget.spec.ts` with:

```ts
import { expect, type Page, test } from "@playwright/test";

import { expectNoErrorBoundary, gotoRoute } from "./support/nav";

const PARTNER = process.env.SEED_USER2_NAME ?? "Partner";

// A month ahead, so these writes never change the current month's figures
// that other specs read.
async function gotoMonthAhead(page: Page, ahead: number): Promise<void> {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + ahead, 1);
  await page.goto(`/budget?year=${target.getFullYear()}&month=${target.getMonth() + 1}`);
  await expectNoErrorBoundary(page);
}

async function addBudget(page: Page, { amount, category }: { amount: string; category: string }) {
  await page.getByRole("button", { name: "Add budget" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Category" }).fill(category);
  await page.keyboard.press("Enter");
  await dialog.getByLabel("Monthly budget").fill(amount);
  await dialog.getByRole("button", { name: "Save budget" }).click();
  // The first change to a carried-over month copies the plan in first.
  await expect(dialog).toBeHidden({ timeout: 20_000 });
}

function budgetRow(page: Page, category: string) {
  return page.locator('[data-slot="row"]').filter({ hasText: category });
}

test.describe("budget plans per person", () => {
  // Several saves, each a server round trip and a refresh.
  test.beforeEach(() => test.slow());

  test("one person's line doesn't replace the other person's line for the same category", async ({ page }) => {
    await gotoMonthAhead(page, 1);

    await addBudget(page, { amount: "1111", category: "Petrol" });
    await page.getByRole("tab", { exact: true, name: PARTNER }).click();
    await addBudget(page, { amount: "2222", category: "Petrol" });
    // Read what was saved, not a page that may still be refreshing.
    await page.reload();

    await expect(budgetRow(page, "Petrol")).toContainText("1,111");
    await page.getByRole("tab", { exact: true, name: PARTNER }).click();
    await expect(budgetRow(page, "Petrol")).toContainText("2,222");
  });

  test("a month with no lines of its own carries over the last plan", async ({ page }) => {
    await gotoMonthAhead(page, 2);

    await expect(page.getByText(/^Carried over from/)).toBeVisible();
    await expect(page.getByText("Can cut", { exact: true })).toBeVisible();
    await expect(budgetRow(page, "Dining Out")).toHaveCount(1);
  });

  test("removing a line from a carried-over month makes the month its own", async ({ page }) => {
    await gotoMonthAhead(page, 4);
    await page.getByRole("tab", { exact: true, name: PARTNER }).click();

    await budgetRow(page, "Entertainment").click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Remove budget" }).click();
    await expect(dialog).toBeHidden({ timeout: 20_000 });
    await page.reload();
    await page.getByRole("tab", { exact: true, name: PARTNER }).click();

    // Even when it was the only line, the month doesn't fall back to the last plan.
    await expect(budgetRow(page, "Entertainment")).toHaveCount(0);
    await expect(page.getByText(/Changing a line makes this month's plan its own/)).toHaveCount(0);
  });
});

test.describe("budget", () => {
  test.beforeEach(async ({ page }) => {
    await gotoRoute(page, "/budget");
  });

  test("shows the month's plan", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Budget", exact: true })).toBeVisible();
    await expect(page.getByText("Budgeted", { exact: true })).toBeVisible();
    await expect(page.getByText("Spent in budgets", { exact: true })).toBeVisible();
    await expect(page.getByText("Click a row to change its budget")).toBeVisible();
  });

  test("opens the budget editor", async ({ page }) => {
    await page.getByRole("button", { name: "Add budget" }).click();

    await expect(page.getByRole("dialog").getByRole("heading", { name: "Set a budget" })).toBeVisible();
  });

  test("opens the set-income dialog", async ({ page }) => {
    await page.getByRole("button", { name: "Set income" }).click();

    await expect(page.getByRole("dialog").getByRole("heading", { name: "Set income" })).toBeVisible();
  });
});
```

- [ ] **Step 9: Check types, unit tests and lint**

Run:

```bash
npx tsc --noEmit
npx vitest run src/modules/budget/lib/budget-view.test.ts
npm test
npm run lint -- --fix
npm run lint
```

Expected: `tsc` prints nothing; every unit test passes (the named ones: 11 tests); lint shows 0 errors.

- [ ] **Step 10: Run the browser tests for this task**

Run:

```bash
npx playwright test e2e/budget.spec.ts e2e/dashboard.spec.ts --reporter=line
```

Expected: all pass. This builds the app and resets its own test database first (1–3 minutes). If one fails with `ECONNRESET` or a timeout, re-run it alone (see Global Constraints) before treating it as a real failure. The new budget tests write to months one to four ahead of today, so they never change the current month that other tests read.

- [ ] **Step 11: Commit**

```bash
git add src/modules/budget/lib/budget-view.test.ts src/modules/budget/lib/budget-view.ts src/modules/budget/schemas/budget-item.schema.ts src/modules/budget/api/budget.actions.ts src/modules/budget/components/BudgetDialog.tsx src/modules/budget/components/BudgetView.tsx src/modules/budget/pages/BudgetPage.tsx scripts/seed-e2e.ts e2e/budget.spec.ts
git commit -m "feat(budget): each person's own plan, carried forward"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.


### Phase 1 checkpoint: STOP

Stop here. Do not start Phase 2.

Send the owner a short report:

- The task commits made in this phase (`git log --oneline` since the phase began).
- The new migration file's name, and that it adds the `budget_line_kind` type and the nullable `budget_items.kind` column. The owner should check, after migrating: Budget shows a tab per person; lines are grouped Fixed / Essential / Can cut; a line's Kind can be changed; both people can have a line for the same category; next month shows "Carried over from …" until a line is changed; old months with shared lines show a Shared tab; Fill from recurring adds only the selected person's own bills.
- The results of `npx tsc --noEmit`, `npm test`, `npm run lint` and `npm run test:e2e` (say which e2e tests failed, if any, and whether they passed when re-run alone).
- Anything that didn't match the plan and what you did about it.

Then wait. The owner applies the migration (`npm run db:migrate`) on their database themselves, tries the app, and tells you whether to go on.

## Phase 2: Set aside first, and pay vs extra

Income splits into pay (carried forward month to month) and extra (bonuses, refunds), and each plan starts with "Set aside first": savings plans, dhuku and loan installments filled in from what Piko already knows. Left to plan = pay − set aside − budgeted.

### Task 2.1: Pay and extra income

Income rows get a kind. Pay stays one per person per month (now a partial unique index on `kind = 'pay'`); extra can have any number of rows. Existing rows become pay.

**Files:**
- Modify: `src/db/schema/incomes.ts`
- Generate: a new migration under `drizzle/` (with `npm run db:generate`)

- [ ] **Step 1: Change the schema**

In `src/db/schema/incomes.ts` (change 1 of 2), find:

```ts
import { integer, numeric, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";

import { householdMembers } from "./householdMembers";
import { households } from "./households";

export const incomes = pgTable(
  "incomes",
  {
```

Replace it with:

```ts
import { sql } from "drizzle-orm";
import { integer, numeric, pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { householdMembers } from "./householdMembers";
import { households } from "./households";

// "pay" is the base pay a person can count on: one per person per month, and
// it carries forward to later months. "extra" is anything else that month (a
// bonus, a refund), any number of entries.
export const incomeKindEnum = pgEnum("income_kind", ["pay", "extra"]);

export const incomes = pgTable(
  "incomes",
  {
```

In `src/db/schema/incomes.ts` (change 2 of 2), find:

```ts
    month: integer("month").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    note: text("note"),
  },
  (table) => [unique().on(table.memberId, table.year, table.month)],
);
```

Replace it with:

```ts
    month: integer("month").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    note: text("note"),
    kind: incomeKindEnum("kind").notNull().default("pay"),
  },
  (table) => [uniqueIndex("incomes_one_pay").on(table.memberId, table.year, table.month).where(sql`${table.kind} = 'pay'`)],
);
```

- [ ] **Step 2: Generate the migration**

Run:

```bash
npm run db:generate
```

Expected: it prints `Your SQL migration file ➜ drizzle\0023_<random_words>.sql` and asks nothing. The new file must contain exactly these statements (the file name's words will differ):

```sql
CREATE TYPE "public"."income_kind" AS ENUM('pay', 'extra');--> statement-breakpoint
ALTER TABLE "incomes" DROP CONSTRAINT "incomes_member_id_year_month_unique";--> statement-breakpoint
ALTER TABLE "incomes" ADD COLUMN "kind" "income_kind" DEFAULT 'pay' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "incomes_one_pay" ON "incomes" USING btree ("member_id","year","month") WHERE "incomes"."kind" = 'pay';
```

If it asks a question or the SQL differs, stop and report.

- [ ] **Step 3: Check types and lint**

Run:

```bash
npx tsc --noEmit
npm run lint -- --fix
npm run lint
```

Expected: `tsc` prints nothing; lint shows 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/db/schema/incomes.ts drizzle
git commit -m "feat(db): pay and extra income"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.


### Task 2.2: Pay carried forward, and what's set aside first

Two pieces of pure maths. Pay carries forward: a month with no pay entry of its own uses the latest earlier one, while extra income only counts in its own month. "Set aside first" rows come from what Piko already knows: a person's savings pot plans, their active dhukus (contribution, plus interest from the month after they took their payout) and loans they took with an installment (capped at what's still owed).

**Files:**
- Create: `src/modules/budget/lib/income.test.ts`
- Create: `src/modules/budget/lib/income.ts`
- Create: `src/modules/budget/lib/set-aside.test.ts`
- Create: `src/modules/budget/lib/set-aside.ts`

**Interfaces:**
- Produces: `type IncomeRow`, `type ExtraIncome`, `type MonthIncome`, `monthIncome(rows, memberId, target)`, `incomeByMonth(rows, memberIds, months)` in `src/modules/budget/lib/income.ts`.
- Produces: `type SetAsideRow`, `savingsSetAsides`, `dhukuSetAsides`, `loanSetAsides` in `src/modules/budget/lib/set-aside.ts`.

- [ ] **Step 1: Write the failing tests**

Create `src/modules/budget/lib/income.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

import { incomeByMonth, type IncomeRow, monthIncome } from "./income";

const ME = "me";
const HER = "her";

function row(overrides: Partial<IncomeRow>): IncomeRow {
  return { amount: 62000, id: "i1", kind: "pay", memberId: ME, month: 6, note: null, year: 2083, ...overrides };
}

describe("monthIncome", () => {
  it("uses the month's own pay entry", () => {
    const rows = [row({ amount: 60000, id: "bhadra", month: 5 }), row({ id: "asoj", month: 6 })];

    expect(monthIncome(rows, ME, { month: 6, year: 2083 })).toEqual({ extra: 0, extras: [], pay: 62000, payCarriedFrom: null, total: 62000 });
  });

  it("carries the latest earlier pay into a month without one", () => {
    const rows = [row({ amount: 60000, id: "bhadra", month: 5 }), row({ id: "asoj", month: 6 })];

    const income = monthIncome(rows, ME, { month: 8, year: 2083 });

    expect(income.pay).toBe(62000);
    expect(income.payCarriedFrom).toEqual({ month: 6, year: 2083 });
  });

  it("carries pay across a year end", () => {
    expect(monthIncome([row({ month: 12, year: 2083 })], ME, { month: 2, year: 2084 }).pay).toBe(62000);
  });

  it("never uses a later month's pay", () => {
    expect(monthIncome([row({ month: 9 })], ME, { month: 8, year: 2083 })).toMatchObject({ pay: 0, payCarriedFrom: null, total: 0 });
  });

  it("adds extra income only in its own month", () => {
    const rows = [
      row({ id: "pay", month: 6 }),
      row({ amount: 38000, id: "bonus", kind: "extra", month: 7, note: "Dashain bonus" }),
      row({ amount: 2000, id: "refund", kind: "extra", month: 7, note: null }),
    ];

    expect(monthIncome(rows, ME, { month: 7, year: 2083 })).toEqual({
      extra: 40000,
      extras: [
        { amount: 38000, id: "bonus", note: "Dashain bonus" },
        { amount: 2000, id: "refund", note: null },
      ],
      pay: 62000,
      payCarriedFrom: { month: 6, year: 2083 },
      total: 102000,
    });
    expect(monthIncome(rows, ME, { month: 8, year: 2083 }).extra).toBe(0);
  });

  it("keeps each person's income apart", () => {
    const rows = [row({ id: "mine" }), row({ amount: 93600, id: "hers", memberId: HER })];

    expect(monthIncome(rows, HER, { month: 6, year: 2083 }).pay).toBe(93600);
  });
});

describe("incomeByMonth", () => {
  it("totals everyone's income per month with pay carried forward", () => {
    const rows = [
      row({ id: "mine", month: 5 }),
      row({ amount: 90000, id: "hers", memberId: HER, month: 5 }),
      row({ amount: 5000, id: "bonus", kind: "extra", month: 6 }),
    ];

    expect(
      incomeByMonth(rows, [ME, HER], [
        { month: 5, year: 2083 },
        { month: 6, year: 2083 },
      ]),
    ).toEqual([
      { amount: 152000, month: 5, year: 2083 },
      { amount: 157000, month: 6, year: 2083 },
    ]);
  });
});
```

Create `src/modules/budget/lib/set-aside.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

import { dhukuSetAsides, loanSetAsides, savingsSetAsides } from "./set-aside";

const ME = "me";
const HER = "her";
const KARTIK = { endDate: "2026-11-16", startDate: "2026-10-18" };

describe("savingsSetAsides", () => {
  const pots = [{ id: "shared", name: "Shared savings" }];

  it("shows this person's plan for each pot against what they put in this month", () => {
    const rows = savingsSetAsides({
      deposits: [
        { amount: 3000, date: "2026-10-20", kind: "deposit", memberId: ME, potId: "shared" },
        { amount: 9000, date: "2026-10-21", kind: "deposit", memberId: HER, potId: "shared" },
        { amount: 2000, date: "2026-09-30", kind: "deposit", memberId: ME, potId: "shared" },
        { amount: 500, date: "2026-10-25", kind: "interest", memberId: null, potId: "shared" },
      ],
      memberId: ME,
      period: KARTIK,
      plans: [
        { memberId: ME, monthlyAmount: 5000, potId: "shared" },
        { memberId: HER, monthlyAmount: 10000, potId: "shared" },
      ],
      pots,
    });

    expect(rows).toEqual([{ done: 3000, id: "savings:shared", kind: "savings", label: "Shared savings", planned: 5000, sub: "Savings" }]);
  });

  it("leaves out pots this person has no plan for", () => {
    expect(savingsSetAsides({ deposits: [], memberId: ME, period: KARTIK, plans: [{ memberId: HER, monthlyAmount: 10000, potId: "shared" }], pots })).toEqual([]);
  });
});

describe("dhukuSetAsides", () => {
  const dhuku = {
    completedAt: null,
    id: "pottery",
    interestPerMonth: 300,
    monthlyContribution: 3000,
    name: "Pottery Dhuku",
    ownerMemberId: ME,
    totalMembers: 12,
  };

  it("plans the contribution until the payout is taken", () => {
    const rows = dhukuSetAsides({
      dhukus: [dhuku],
      entries: [{ amount: 3000, date: "2026-09-20", dhukuId: "pottery", type: "contribution" }],
      memberId: ME,
      period: KARTIK,
    });

    expect(rows).toEqual([{ done: 0, id: "dhuku:pottery", kind: "dhuku", label: "Pottery Dhuku", planned: 3000, sub: "Dhuku" }]);
  });

  it("adds the monthly interest from the month after the payout, and counts this month's contribution as done", () => {
    const rows = dhukuSetAsides({
      dhukus: [dhuku],
      entries: [
        { amount: 33000, date: "2026-08-25", dhukuId: "pottery", type: "payout" },
        { amount: 3300, date: "2026-10-19", dhukuId: "pottery", type: "contribution" },
      ],
      memberId: ME,
      period: KARTIK,
    });

    expect(rows[0]).toMatchObject({ done: 3300, planned: 3300, sub: "Dhuku, with interest" });
  });

  it("leaves out other people's, completed and fully paid dhukus", () => {
    const paidUp = Array.from({ length: 12 }, (_, i) => ({ amount: 3000, date: `2025-${String(i + 1).padStart(2, "0")}-01`, dhukuId: "pottery", type: "contribution" }));

    expect(dhukuSetAsides({ dhukus: [{ ...dhuku, ownerMemberId: HER }], entries: [], memberId: ME, period: KARTIK })).toEqual([]);
    expect(dhukuSetAsides({ dhukus: [{ ...dhuku, completedAt: "2026-09-01" }], entries: [], memberId: ME, period: KARTIK })).toEqual([]);
    expect(dhukuSetAsides({ dhukus: [dhuku], entries: paidUp, memberId: ME, period: KARTIK })).toEqual([]);
  });
});

describe("dhuku interest timing", () => {
  it("doesn't add interest in the month the pot is taken", () => {
    const rows = dhukuSetAsides({
      dhukus: [
        {
          completedAt: null,
          id: "pottery",
          interestPerMonth: 300,
          monthlyContribution: 3000,
          name: "Pottery Dhuku",
          ownerMemberId: ME,
          totalMembers: 12,
        },
      ],
      entries: [{ amount: 33000, date: "2026-10-19", dhukuId: "pottery", type: "payout" }],
      memberId: ME,
      period: KARTIK,
    });

    expect(rows[0]).toMatchObject({ planned: 3000, sub: "Dhuku" });
  });
});

describe("loanSetAsides", () => {
  const loan = {
    counterpartyName: "Raju",
    direction: "taken" as const,
    id: "raju",
    installmentAmount: 5000,
    installmentFrequency: "monthly" as const,
    ownerMemberId: ME,
    principalAmount: 100000,
  };

  it("plans the installment and counts this month's repayments as done", () => {
    const rows = loanSetAsides({
      loans: [loan],
      memberId: ME,
      payments: [{ amount: 5000, date: "2026-10-30", loanId: "raju" }],
      period: KARTIK,
    });

    expect(rows).toEqual([{ done: 5000, id: "loan:raju", kind: "loan", label: "Raju", planned: 5000, sub: "Loan repayment" }]);
  });

  it("caps the installment at what's still owed", () => {
    const rows = loanSetAsides({
      loans: [loan],
      memberId: ME,
      payments: [{ amount: 97000, date: "2026-09-01", loanId: "raju" }],
      period: KARTIK,
    });

    expect(rows[0].planned).toBe(3000);
  });

  it("turns a weekly installment into a monthly amount", () => {
    const rows = loanSetAsides({ loans: [{ ...loan, installmentAmount: 1200, installmentFrequency: "weekly" }], memberId: ME, payments: [], period: KARTIK });

    expect(rows[0].planned).toBe(5200);
  });

  it("leaves out loans without an installment, given loans, other people's and paid-off loans", () => {
    expect(loanSetAsides({ loans: [{ ...loan, installmentAmount: null, installmentFrequency: null }], memberId: ME, payments: [], period: KARTIK })).toEqual([]);
    expect(loanSetAsides({ loans: [{ ...loan, direction: "given" }], memberId: ME, payments: [], period: KARTIK })).toEqual([]);
    expect(loanSetAsides({ loans: [{ ...loan, ownerMemberId: HER }], memberId: ME, payments: [], period: KARTIK })).toEqual([]);
    expect(loanSetAsides({ loans: [loan], memberId: ME, payments: [{ amount: 100000, date: "2026-09-01", loanId: "raju" }], period: KARTIK })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run:

```bash
npx vitest run src/modules/budget/lib/income.test.ts src/modules/budget/lib/set-aside.test.ts
```

Expected: FAIL. The run reports it can't resolve `./income` and `./set-aside`.

- [ ] **Step 3: Write the code**

Create `src/modules/budget/lib/income.ts` with:

```ts
export type IncomeKind = "extra" | "pay";

export type IncomeRow = { amount: number; id: string; kind: IncomeKind; memberId: string; month: number; note: null | string; year: number };

export type ExtraIncome = { amount: number; id: string; note: null | string };

export type MonthIncome = {
  extra: number;
  extras: ExtraIncome[];
  pay: number;
  // The month the pay was carried over from, when this month has no pay entry of its own.
  payCarriedFrom: null | { month: number; year: number };
  total: number;
};

const monthOrder = (year: number, month: number) => year * 12 + month;

// One person's income for a month. Pay carries forward: a month without its
// own pay entry uses the latest earlier one, so base pay is entered once.
// Extra income (a bonus, a refund) only ever counts in its own month.
export function monthIncome(rows: IncomeRow[], memberId: string, target: { month: number; year: number }): MonthIncome {
  const targetOrder = monthOrder(target.year, target.month);
  const own = rows.filter((r) => r.memberId === memberId);

  const pays = own.filter((r) => r.kind === "pay" && monthOrder(r.year, r.month) <= targetOrder);
  const latestPay = pays.reduce<IncomeRow | null>(
    (latest, r) => (latest === null || monthOrder(r.year, r.month) > monthOrder(latest.year, latest.month) ? r : latest),
    null,
  );
  const pay = latestPay?.amount ?? 0;
  const payCarriedFrom =
    latestPay && monthOrder(latestPay.year, latestPay.month) !== targetOrder ? { month: latestPay.month, year: latestPay.year } : null;

  const extras = own
    .filter((r) => r.kind === "extra" && monthOrder(r.year, r.month) === targetOrder)
    .map((r) => ({ amount: r.amount, id: r.id, note: r.note }));
  const extra = extras.reduce((sum, e) => sum + e.amount, 0);

  return { extra, extras, pay, payCarriedFrom, total: pay + extra };
}

// The household's total income for each of the given months, with pay
// carried forward the same way.
export function incomeByMonth(rows: IncomeRow[], memberIds: string[], months: { month: number; year: number }[]) {
  return months.map((m) => ({
    amount: memberIds.reduce((sum, id) => sum + monthIncome(rows, id, m).total, 0),
    month: m.month,
    year: m.year,
  }));
}
```

Create `src/modules/budget/lib/set-aside.ts` with:

```ts
// "Set aside first": money a person's plan takes off the top before any
// budget line, filled in from what Piko already knows (savings pot plans,
// dhukus, loan installments) so it's never typed twice. None of it is
// spending: it's money moved to the person's own piles or paid back.

export type SetAsideKind = "dhuku" | "fund" | "loan" | "savings";

export type SetAsideRow = { done: number; id: string; kind: SetAsideKind; label: string; planned: number; sub: string };

type Period = { endDate: string; startDate: string };

const inPeriod = (date: string, period: Period) => date >= period.startDate && date <= period.endDate;
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

// This person's monthly plan for each savings pot, against what they put in
// this month.
export function savingsSetAsides(input: {
  deposits: { amount: number; date: string; kind: string; memberId: null | string; potId: string }[];
  memberId: string;
  period: Period;
  plans: { memberId: string; monthlyAmount: number; potId: string }[];
  pots: { id: string; name: string }[];
}): SetAsideRow[] {
  return input.pots.flatMap((pot) => {
    const planned = sum(input.plans.filter((p) => p.potId === pot.id && p.memberId === input.memberId).map((p) => p.monthlyAmount));
    if (planned <= 0) return [];
    const done = sum(
      input.deposits
        .filter((d) => d.potId === pot.id && d.kind === "deposit" && d.memberId === input.memberId && inPeriod(d.date, input.period))
        .map((d) => d.amount),
    );
    return [{ done, id: `savings:${pot.id}`, kind: "savings" as const, label: pot.name, planned, sub: "Savings" }];
  });
}

// Each active dhuku of this person: the monthly contribution, plus the
// monthly interest from the month after they took their payout.
export function dhukuSetAsides(input: {
  dhukus: {
    completedAt: unknown;
    id: string;
    interestPerMonth: null | number;
    monthlyContribution: number;
    name: string;
    ownerMemberId: null | string;
    totalMembers: number;
  }[];
  entries: { amount: number; date: string; dhukuId: string; type: string }[];
  memberId: string;
  period: Period;
}): SetAsideRow[] {
  return input.dhukus.flatMap((dhuku) => {
    if (dhuku.ownerMemberId !== input.memberId || dhuku.completedAt !== null) return [];
    const entries = input.entries.filter((e) => e.dhukuId === dhuku.id);
    const paidBefore = entries.filter((e) => e.type === "contribution" && e.date < input.period.startDate).length;
    if (paidBefore >= dhuku.totalMembers) return [];
    const tookPot = entries.some((e) => e.type === "payout" && e.date < input.period.startDate);
    const planned = dhuku.monthlyContribution + (tookPot ? (dhuku.interestPerMonth ?? 0) : 0);
    const done = sum(entries.filter((e) => e.type === "contribution" && inPeriod(e.date, input.period)).map((e) => e.amount));
    return [{ done, id: `dhuku:${dhuku.id}`, kind: "dhuku" as const, label: dhuku.name, planned, sub: tookPot ? "Dhuku, with interest" : "Dhuku" }];
  });
}

// Each loan this person took that has an installment and isn't paid off: the
// installment as a monthly amount, capped at what's still owed.
export function loanSetAsides(input: {
  loans: {
    counterpartyName: string;
    direction: "given" | "taken";
    id: string;
    installmentAmount: null | number;
    installmentFrequency: "monthly" | "weekly" | null;
    ownerMemberId: null | string;
    principalAmount: number;
  }[];
  memberId: string;
  payments: { amount: number; date: string; loanId: string }[];
  period: Period;
}): SetAsideRow[] {
  return input.loans.flatMap((loan) => {
    if (loan.ownerMemberId !== input.memberId || loan.direction !== "taken" || loan.installmentAmount === null) return [];
    const payments = input.payments.filter((p) => p.loanId === loan.id);
    const owedAtStart = loan.principalAmount - sum(payments.filter((p) => p.date < input.period.startDate).map((p) => p.amount));
    if (owedAtStart <= 0) return [];
    const monthly = loan.installmentFrequency === "weekly" ? Math.round((loan.installmentAmount * 52) / 12) : loan.installmentAmount;
    const done = sum(payments.filter((p) => inPeriod(p.date, input.period)).map((p) => p.amount));
    return [
      {
        done,
        id: `loan:${loan.id}`,
        kind: "loan" as const,
        label: loan.counterpartyName,
        planned: Math.min(monthly, owedAtStart),
        sub: "Loan repayment",
      },
    ];
  });
}
```

- [ ] **Step 4: Run the tests again**

Run:

```bash
npx vitest run src/modules/budget/lib/income.test.ts src/modules/budget/lib/set-aside.test.ts
```

Expected: PASS, 17 tests.

- [ ] **Step 5: Check types, all unit tests and lint**

Run:

```bash
npx tsc --noEmit
npm test
npm run lint -- --fix
npm run lint
```

Expected: `tsc` prints nothing; every unit test passes; lint shows 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/modules/budget/lib/income.test.ts src/modules/budget/lib/income.ts src/modules/budget/lib/set-aside.test.ts src/modules/budget/lib/set-aside.ts
git commit -m "feat(budget): pay carried forward and what's set aside first"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.


### Task 2.3: Pay and extra income: actions and dialog

The actions and dialog for pay and extra income. Setting pay writes that month's pay row (later months follow it); extra income adds a row with a note; an income row can be deleted. The old single-figure income code stays until the Budget page stops using it in Task 2.5.

**Files:**
- Modify: `src/modules/budget/lib/budget-activity.test.ts`
- Modify: `src/modules/budget/lib/budget-activity.ts`
- Modify: `src/modules/budget/api/budget.ts`
- Create: `src/modules/budget/components/PayDialog.tsx`
- Modify: `src/modules/budget/schemas/income.schema.ts`
- Modify: `src/modules/budget/api/budget.actions.ts`

**Interfaces:**
- Consumes: `IncomeRow`, `monthIncome`, `ExtraIncome` (Task 2.2).
- Produces: `setPaySchema`, `extraIncomeSchema` (and their types); `setPayAction`, `addExtraIncomeAction`, `deleteIncomeAction` in `budget.actions.ts`; `listIncomeRows(householdId)`, `householdIncome(householdId, year, month)` in `budget/api/budget.ts`; `PayDialog`. The old `setIncomeSchema`, `getIncomesForMonth`, `listAllIncomes` and `setIncomeAction` stay until Task 2.5.

- [ ] **Step 1: Write the failing test**

In `src/modules/budget/lib/budget-activity.test.ts`, find:

```ts
    ]);
  });

  it("summarises and diffs income", () => {
    const before = { amount: "90000.00", memberId: "m-2", month: 10, note: null, year: 2026 };
    expect(incomeSummary(f, before)).toBe("Ravi · October 2026 · RS 90,000");
```

Replace it with:

```ts
    ]);
  });

  it("marks extra income in its summary", () => {
    const extra = { amount: "38000.00", kind: "extra", memberId: "m-2", month: 10, note: "Dashain bonus", year: 2026 };
    expect(incomeSummary(f, extra)).toBe("Ravi · October 2026 · RS 38,000 · Extra · Dashain bonus");
  });

  it("summarises and diffs income", () => {
    const before = { amount: "90000.00", memberId: "m-2", month: 10, note: null, year: 2026 };
    expect(incomeSummary(f, before)).toBe("Ravi · October 2026 · RS 90,000");
```

- [ ] **Step 2: Run the tests and watch them fail**

Run:

```bash
npx vitest run src/modules/budget/lib/budget-activity.test.ts
```

Expected: FAIL. The new "marks extra income" test fails: the summary has no "Extra" yet.

- [ ] **Step 3: Write the code**

In `src/modules/budget/lib/budget-activity.ts` (change 1 of 2), find:

```ts
import { LINE_KINDS } from "./plan-lines";

export type BudgetItemSnapshot = { categoryId: string; kind?: null | string; ownerMemberId: null | string; plannedAmount: number | string };
export type IncomeSnapshot = { amount: number | string; memberId: string; month: number; note?: null | string; year: number };

// "Groceries · Shared · Ashwin 2083 · RS 8,000"
export function budgetItemSummary(
```

Replace it with:

```ts
import { LINE_KINDS } from "./plan-lines";

export type BudgetItemSnapshot = { categoryId: string; kind?: null | string; ownerMemberId: null | string; plannedAmount: number | string };
export type IncomeSnapshot = { amount: number | string; kind?: string; memberId: string; month: number; note?: null | string; year: number };

// "Groceries · Shared · Ashwin 2083 · RS 8,000"
export function budgetItemSummary(
```

In `src/modules/budget/lib/budget-activity.ts` (change 2 of 2), find:

```ts
  return diffFields(before, after, budgetItemFields(f));
}

// "Ravi · Ashwin 2083 · RS 90,000"
export function incomeSummary(f: ActivityFormatters, income: IncomeSnapshot): string {
  return [f.member(income.memberId), f.period(income.year, income.month), f.money(income.amount)].filter(Boolean).join(" · ");
}

export function incomeFields(f: ActivityFormatters): FieldSpec<IncomeSnapshot>[] {
```

Replace it with:

```ts
  return diffFields(before, after, budgetItemFields(f));
}

// "Ravi · Ashwin 2083 · RS 90,000", or "… · Extra · Dashain bonus" for extra income.
export function incomeSummary(f: ActivityFormatters, income: IncomeSnapshot): string {
  const extra = income.kind === "extra" ? ["Extra", f.text(income.note)] : [];
  return [f.member(income.memberId), f.period(income.year, income.month), f.money(income.amount), ...extra].filter(Boolean).join(" · ");
}

export function incomeFields(f: ActivityFormatters): FieldSpec<IncomeSnapshot>[] {
```

In `src/modules/budget/api/budget.ts`, find:

```ts
import { and, eq, lte, or } from "drizzle-orm";

import { db } from "@/db/client";
import { budgetItems, categories, monthlyBudgets } from "@/db/schema";

import { type DatedLine, type PlanLine, planLinesForMonth } from "../lib/plan-lines";

// Every budget line up to and including the given month, with the month it
// was set in.
export async function listDatedLines(householdId: string, through: { month: number; year: number }): Promise<DatedLine[]> {
```

Replace it with:

```ts
import { and, eq, lte, or } from "drizzle-orm";

import { db } from "@/db/client";
import { budgetItems, categories, householdMembers, incomes, monthlyBudgets } from "@/db/schema";

import { type IncomeRow, monthIncome } from "../lib/income";
import { type DatedLine, type PlanLine, planLinesForMonth } from "../lib/plan-lines";

// Every income entry in the household (a handful a month), for working out
// any month's pay and extra with monthIncome().
export async function listIncomeRows(householdId: string): Promise<IncomeRow[]> {
  const rows = await db.select().from(incomes).where(eq(incomes.householdId, householdId));
  return rows.map((r) => ({ amount: Number(r.amount), id: r.id, kind: r.kind, memberId: r.memberId, month: r.month, note: r.note, year: r.year }));
}

// Everyone's income for the month: pay carried forward, plus extra.
export async function householdIncome(householdId: string, year: number, month: number): Promise<number> {
  const [rows, members] = await Promise.all([
    listIncomeRows(householdId),
    db.select({ id: householdMembers.id }).from(householdMembers).where(eq(householdMembers.householdId, householdId)),
  ]);
  return members.reduce((sum, m) => sum + monthIncome(rows, m.id, { month, year }).total, 0);
}

// Every budget line up to and including the given month, with the month it
// was set in.
export async function listDatedLines(householdId: string, through: { month: number; year: number }): Promise<DatedLine[]> {
```

Create `src/modules/budget/components/PayDialog.tsx` with:

```tsx
"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AmountInput } from "@/components/AmountInput";
import { Modal } from "@/components/Modal";
import { Money } from "@/components/Money";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { addExtraIncomeAction, deleteIncomeAction, setPayAction } from "@/modules/budget/api/budget.actions";
import type { ExtraIncome } from "@/modules/budget/lib/income";

type Props = {
  extras: ExtraIncome[];
  memberId: string;
  month: number;
  monthLabel: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pay: number;
  // The month the pay was carried over from, e.g. "Asoj 2083", if any.
  payCarriedFrom: null | string;
  // "Your pay" or "Karuna's pay".
  title: string;
  year: number;
};

const FORM_ID = "pay-form";

// One person's pay for the month (it carries forward to later months) and
// any extra income on top. Fields unmount with the dialog, so every open
// starts from the saved figures again.
export function PayDialog({ onOpenChange, open, ...rest }: Props) {
  const [pending, setPending] = useState(false);

  return (
    <Modal
      className="sm:max-w-110"
      footer={
        <Button className="min-w-35 justify-start" disabled={pending} form={FORM_ID} type="submit">
          {pending ? "Saving..." : "Save pay"}
        </Button>
      }
      hint="Enter to save · Esc to close"
      onOpenChange={onOpenChange}
      open={open}
      subtitle={rest.monthLabel}
      title={rest.title}
    >
      <PayFields {...rest} onDone={() => onOpenChange(false)} onPendingChange={setPending} />
    </Modal>
  );
}

type FieldsProps = Omit<Props, "monthLabel" | "onOpenChange" | "open" | "title"> & {
  onDone: () => void;
  onPendingChange: (pending: boolean) => void;
};

function PayFields({ extras, memberId, month, onDone, onPendingChange, pay, payCarriedFrom, year }: FieldsProps) {
  const router = useRouter();
  const [payText, setPayText] = useState(pay > 0 ? String(pay) : "");
  const [extraText, setExtraText] = useState("");
  const [extraNote, setExtraNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(payText) || 0;
    if (amount === pay && payCarriedFrom === null) {
      onDone();
      return;
    }
    onPendingChange(true);
    try {
      await setPayAction({ amount, memberId, month, year });
      toast.success("Pay saved");
      onDone();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      onPendingChange(false);
    }
  }

  async function addExtra() {
    const amount = Number(extraText);
    if (!(amount > 0)) {
      toast.error("Enter the extra amount");
      return;
    }
    setBusy(true);
    try {
      await addExtraIncomeAction({ amount, memberId, month, note: extraNote.trim() || undefined, year });
      setExtraText("");
      setExtraNote("");
      toast.success("Extra income added");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setBusy(false);
    }
  }

  async function removeExtra(id: string) {
    setBusy(true);
    try {
      await deleteIncomeAction(id);
      toast.success("Extra income deleted");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form className="flex flex-col gap-1.5" id={FORM_ID} noValidate onSubmit={onSubmit}>
        <AmountInput data-autofocus label="Pay" onChange={(event) => setPayText(event.target.value)} placeholder="0.00" size="xl" value={payText} />
        <p className="text-xs leading-normal text-n-600">
          {payCarriedFrom
            ? `Carried over from ${payCarriedFrom}. Saving sets this month's pay, and later months follow it.`
            : "The pay you can count on. Later months use it until you change it."}
        </p>
      </form>

      <section className="flex flex-col gap-3 border-t border-n-300 pt-4">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold">Extra this month</h3>
          <p className="text-xs text-n-600">A bonus, leave encashment or a refund. It counts for this month only and never grows the plan.</p>
        </div>
        {extras.map((extra) => (
          <div className="flex items-baseline justify-between gap-3 border-b border-n-200 py-1.5" key={extra.id}>
            <span className="truncate text-sm">{extra.note ?? "Extra income"}</span>
            <span className="flex items-baseline gap-3">
              <span className="text-sm font-semibold">
                <Money value={extra.amount} />
              </span>
              <Button className="h-auto px-1.5 py-0.5 text-[13px]" disabled={busy} onClick={() => void removeExtra(extra.id)} type="button" variant="ghost">
                Delete
              </Button>
            </span>
          </div>
        ))}
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto]">
          <AmountInput label="Extra amount" onChange={(event) => setExtraText(event.target.value)} placeholder="0.00" value={extraText} />
          <TextField label="What was it?" onChange={(event) => setExtraNote(event.target.value)} placeholder="e.g. Dashain bonus" value={extraNote} />
          <Button disabled={busy} onClick={() => void addExtra()} type="button" variant="outline">
            Add extra
          </Button>
        </div>
      </section>
    </div>
  );
}
```

Replace the whole of `src/modules/budget/schemas/income.schema.ts` with:

```ts
import { z } from "zod";

// A person's pay for one month. Later months use it until it's changed.
export const setPaySchema = z.object({
  memberId: z.string().uuid(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  amount: z.number().nonnegative(),
});

export type SetPayInput = z.infer<typeof setPaySchema>;

// Income beyond pay in one month: a bonus, leave encashment, a refund.
export const extraIncomeSchema = z.object({
  memberId: z.string().uuid(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  amount: z.number().positive(),
  note: z.string().trim().max(120).optional(),
});

export type ExtraIncomeInput = z.infer<typeof extraIncomeSchema>;

// The old single income figure. The Budget page still uses it until Task 2.5.
export const setIncomeSchema = z.object({
  memberId: z.string().uuid(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  amount: z.number().nonnegative(),
  note: z.string().optional(),
});

export type SetIncomeInput = z.infer<typeof setIncomeSchema>;
```

In `src/modules/budget/api/budget.actions.ts` (change 1 of 2), find:

```ts
import type { ActivityFormatters } from "@/modules/activity/lib/activity-values";
import { listCategories } from "@/modules/categories/api/categories";

import { budgetItemChanges, budgetItemSummary, incomeChanges, incomeSummary } from "../lib/budget-activity";
import { recurringBudgetLines } from "../lib/recurring-budget";
import { type RemoveBudgetItemInput, removeBudgetItemSchema, type SetBudgetItemInput, setBudgetItemSchema } from "../schemas/budget-item.schema";
import { type SetIncomeInput, setIncomeSchema } from "../schemas/income.schema";
import { listPlanLines } from "./budget";

// Insert-or-get in one statement. A select-then-insert would race when two
// requests hit a not-yet-created month at the same time (both see nothing,
// both insert, one hits the unique constraint and 500s). The no-op update on
// conflict makes the concurrent case return the existing row instead.
```

Replace it with:

```ts
import type { ActivityFormatters } from "@/modules/activity/lib/activity-values";
import { listCategories } from "@/modules/categories/api/categories";

import { budgetItemChanges, budgetItemSummary, incomeChanges, incomeSummary } from "../lib/budget-activity";
import { recurringBudgetLines } from "../lib/recurring-budget";
import { type RemoveBudgetItemInput, removeBudgetItemSchema, type SetBudgetItemInput, setBudgetItemSchema } from "../schemas/budget-item.schema";
import { type ExtraIncomeInput, extraIncomeSchema, type SetIncomeInput, setIncomeSchema, type SetPayInput, setPaySchema } from "../schemas/income.schema";
import { listPlanLines } from "./budget";

// Insert-or-get in one statement. A select-then-insert would race when two
// requests hit a not-yet-created month at the same time (both see nothing,
// both insert, one hits the unique constraint and 500s). The no-op update on
// conflict makes the concurrent case return the existing row instead.
```

In `src/modules/budget/api/budget.actions.ts` (change 2 of 2), find:

```ts
      : { action: "created", after: saved, before: null, entityId: saved.id, entityType: "income", summary: incomeSummary(f, after) },
  );

  revalidatePath("/budget");
  revalidatePath("/dashboard");
}
```

Replace it with:

```ts
      : { action: "created", after: saved, before: null, entityId: saved.id, entityType: "income", summary: incomeSummary(f, after) },
  );

  revalidatePath("/budget");
  revalidatePath("/dashboard");
}

function revalidateIncomePaths() {
  revalidatePath("/budget");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}

// Sets one person's pay for one month. Months after it use this pay until
// it's changed again (see monthIncome).
export async function setPayAction(input: SetPayInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = setPaySchema.parse(input);
  await assertMemberInHousehold(householdId, parsed.memberId);

  const [before] = await db
    .select()
    .from(incomes)
    .where(
      and(
        eq(incomes.householdId, householdId),
        eq(incomes.memberId, parsed.memberId),
        eq(incomes.year, parsed.year),
        eq(incomes.month, parsed.month),
        eq(incomes.kind, "pay"),
      ),
    );
  const [saved] = before
    ? await db.update(incomes).set({ amount: String(parsed.amount) }).where(eq(incomes.id, before.id)).returning()
    : await db
        .insert(incomes)
        .values({ amount: String(parsed.amount), householdId, kind: "pay", memberId: parsed.memberId, month: parsed.month, year: parsed.year })
        .returning();

  const f = await loadActivityFormatters(householdId);
  const summary = incomeSummary(f, saved);
  await logActivity(
    activityActor(member),
    before
      ? { action: "updated", after: saved, before, changes: incomeChanges(f, before, saved), entityId: saved.id, entityType: "income", summary }
      : { action: "created", after: saved, before: null, entityId: saved.id, entityType: "income", summary },
  );

  revalidateIncomePaths();
}

export async function addExtraIncomeAction(input: ExtraIncomeInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = extraIncomeSchema.parse(input);
  await assertMemberInHousehold(householdId, parsed.memberId);

  const [created] = await db
    .insert(incomes)
    .values({
      amount: String(parsed.amount),
      householdId,
      kind: "extra",
      memberId: parsed.memberId,
      month: parsed.month,
      note: parsed.note || null,
      year: parsed.year,
    })
    .returning();

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "created",
    after: created,
    before: null,
    entityId: created.id,
    entityType: "income",
    summary: incomeSummary(f, created),
  });

  revalidateIncomePaths();
}

export async function deleteIncomeAction(id: string) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const [before] = await db
    .select()
    .from(incomes)
    .where(and(eq(incomes.id, id), eq(incomes.householdId, householdId)));
  if (!before) return;

  await db.delete(incomes).where(and(eq(incomes.id, id), eq(incomes.householdId, householdId)));

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "deleted",
    before,
    entityId: id,
    entityType: "income",
    summary: incomeSummary(f, before),
  });

  revalidateIncomePaths();
}
```

- [ ] **Step 4: Run the tests again**

Run:

```bash
npx vitest run src/modules/budget/lib/budget-activity.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Check types, all unit tests and lint**

Run:

```bash
npx tsc --noEmit
npm test
npm run lint -- --fix
npm run lint
```

Expected: `tsc` prints nothing; every unit test passes; lint shows 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/modules/budget/lib/budget-activity.test.ts src/modules/budget/lib/budget-activity.ts src/modules/budget/api/budget.ts src/modules/budget/components/PayDialog.tsx src/modules/budget/schemas/income.schema.ts src/modules/budget/api/budget.actions.ts
git commit -m "feat(budget): pay and extra income actions and dialog"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.


### Task 2.4: Every page reads pay carried forward

Home, Reports, Expenses and Recurring read income as pay carried forward plus that month's extra. Home's Income cell opens the Pay & extra dialog for the person viewing it, and Reports' six-month trend fills in carried-over pay.

**Files:**
- Modify: `src/modules/dashboard/pages/DashboardPage.tsx`
- Modify: `src/modules/dashboard/components/HomeView.tsx`
- Modify: `src/modules/expenses/pages/ExpensesPage.tsx`
- Modify: `src/modules/recurring/pages/RecurringPage.tsx`
- Modify: `src/modules/reports/pages/ReportsPage.tsx`

**Interfaces:**
- Consumes: `listIncomeRows`, `householdIncome`, `PayDialog` (Task 2.3), `monthIncome`, `incomeByMonth` (Task 2.2).

- [ ] **Step 1: Home**

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 1 of 7), find:

```tsx
} from "@/lib/month-period";
import { getEffectiveMember, getHouseholdMembers } from "@/lib/session";
import { todayISO } from "@/lib/today";
import { listPlanLines } from "@/modules/budget/api/budget";
import { getIncomesForMonth } from "@/modules/budget/api/budget.actions";
import { dashboardSummary } from "@/modules/budget/lib/calculations";
import { kindOf } from "@/modules/budget/lib/plan-lines";
import { listCategories } from "@/modules/categories/api/categories";
import {
```

Replace it with:

```tsx
} from "@/lib/month-period";
import { getEffectiveMember, getHouseholdMembers } from "@/lib/session";
import { todayISO } from "@/lib/today";
import { listIncomeRows, listPlanLines } from "@/modules/budget/api/budget";
import { dashboardSummary } from "@/modules/budget/lib/calculations";
import { monthIncome } from "@/modules/budget/lib/income";
import { kindOf } from "@/modules/budget/lib/plan-lines";
import { listCategories } from "@/modules/categories/api/categories";
import {
```

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 2 of 7), find:

```tsx
  HomeView,
} from "@/modules/dashboard/components/HomeView";
import { allowanceSpentByDay, daysLeftInMonth } from "@/modules/dashboard/lib/cash-flow";
import { toExpenseInputs, toIncomeInputs } from "@/modules/dashboard/lib/map-rows";
import { movedThisMonth } from "@/modules/dashboard/lib/moved";
import { buildPacingSchedule, currentWeekPacing } from "@/modules/dashboard/lib/pacing";
import { walletSpentByMember } from "@/modules/dashboard/lib/wallet";
```

Replace it with:

```tsx
  HomeView,
} from "@/modules/dashboard/components/HomeView";
import { allowanceSpentByDay, daysLeftInMonth } from "@/modules/dashboard/lib/cash-flow";
import { toExpenseInputs } from "@/modules/dashboard/lib/map-rows";
import { movedThisMonth } from "@/modules/dashboard/lib/moved";
import { buildPacingSchedule, currentWeekPacing } from "@/modules/dashboard/lib/pacing";
import { walletSpentByMember } from "@/modules/dashboard/lib/wallet";
```

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 3 of 7), find:

```tsx
    incomeRows,
    planLines,
    expenseRows,
    prevIncomeRows,
    prevExpenseRows,
    recentExpenseRows,
    paybackRows,
```

Replace it with:

```tsx
    incomeRows,
    planLines,
    expenseRows,
    prevExpenseRows,
    recentExpenseRows,
    paybackRows,
```

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 4 of 7), find:

```tsx
  ] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    getIncomesForMonth(year, month),
    listPlanLines(householdId, year, month),
    listExpensesForMonth(year, month, dateFormat),
    getIncomesForMonth(prev.year, prev.month),
    listExpensesForMonth(prev.year, prev.month, dateFormat),
    listRecentExpenses(5),
    listPaybacks(householdId),
```

Replace it with:

```tsx
  ] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    listIncomeRows(householdId),
    listPlanLines(householdId, year, month),
    listExpensesForMonth(year, month, dateFormat),
    listExpensesForMonth(prev.year, prev.month, dateFormat),
    listRecentExpenses(5),
    listPaybacks(householdId),
```

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 5 of 7), find:

```tsx
  const payExpenseRows = expenseRows.filter((e) => e.savingsPotId === null);
  const paidFromSavings = expenseRows.filter((e) => e.savingsPotId !== null).reduce((s, e) => s + Number(e.amount), 0);

  const incomes = toIncomeInputs(incomeRows);
  const expenses = toExpenseInputs(payExpenseRows);
  const summary = dashboardSummary(incomes, expenses);

  const prevIncomes = toIncomeInputs(prevIncomeRows);
  const prevExpensesList = toExpenseInputs(prevExpenseRows.filter((e) => e.savingsPotId === null));
  const prevSummary = dashboardSummary(prevIncomes, prevExpensesList);

```

Replace it with:

```tsx
  const payExpenseRows = expenseRows.filter((e) => e.savingsPotId === null);
  const paidFromSavings = expenseRows.filter((e) => e.savingsPotId !== null).reduce((s, e) => s + Number(e.amount), 0);

  // Pay carries forward from earlier months; extra income counts in its own month.
  const incomes = members.map((m) => ({ amount: monthIncome(incomeRows, m.id, { month, year }).total, memberId: m.id }));
  const expenses = toExpenseInputs(payExpenseRows);
  const summary = dashboardSummary(incomes, expenses);

  const prevIncomes = members.map((m) => ({ amount: monthIncome(incomeRows, m.id, prev).total, memberId: m.id }));
  const prevExpensesList = toExpenseInputs(prevExpenseRows.filter((e) => e.savingsPotId === null));
  const prevSummary = dashboardSummary(prevIncomes, prevExpensesList);

```

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 6 of 7), find:

```tsx
  }));

  const monthLabel = formatPeriodLabel(year, month, dateFormat);

  return (
    <HomeView
      balances={balances}
      currentMemberId={memberId}
      daysLeft={daysLeftInMonth(year, month, dateFormat)}
      incomes={Object.fromEntries(incomes.map((i) => [i.memberId, i.amount]))}
      ledger={{
        income: summary.combinedIncome,
        incomeTrendPct: trendPct(summary.combinedIncome, prevSummary.combinedIncome),
```

Replace it with:

```tsx
  }));

  const monthLabel = formatPeriodLabel(year, month, dateFormat);
  const viewerIncome = monthIncome(incomeRows, memberId, { month, year });

  return (
    <HomeView
      balances={balances}
      currentMemberId={memberId}
      daysLeft={daysLeftInMonth(year, month, dateFormat)}

      ledger={{
        income: summary.combinedIncome,
        incomeTrendPct: trendPct(summary.combinedIncome, prevSummary.combinedIncome),
```

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 7 of 7), find:

```tsx
      monthNav={buildMonthNav({ basePath: "/dashboard", current: { month: currentMonth, year: currentYear }, dateFormat, selected: { month, year } })}
      owners={owners}
      pacing={pacing}
      payback={payback}
      prevMonthName={formatPeriodLabel(prev.year, prev.month, dateFormat).split(" ")[0]}
      recent={recent}
```

Replace it with:

```tsx
      monthNav={buildMonthNav({ basePath: "/dashboard", current: { month: currentMonth, year: currentYear }, dateFormat, selected: { month, year } })}
      owners={owners}
      pacing={pacing}
      pay={{
        amount: viewerIncome.pay,
        carriedFrom: viewerIncome.payCarriedFrom ? formatPeriodLabel(viewerIncome.payCarriedFrom.year, viewerIncome.payCarriedFrom.month, dateFormat) : null,
        extras: viewerIncome.extras,
      }}
      payback={payback}
      prevMonthName={formatPeriodLabel(prev.year, prev.month, dateFormat).split(" ")[0]}
      recent={recent}
```

In `src/modules/dashboard/components/HomeView.tsx` (change 1 of 4), find:

```tsx
import { formatMoney } from "@/lib/money";
import type { MonthNavModel } from "@/lib/month-nav";
import { cn } from "@/lib/utils";
import { SetIncomeDialog } from "@/modules/budget/components/SetIncomeDialog";
import { CategoryIcon } from "@/modules/categories/components/CategoryIcon";
import { deletePaybackAction } from "@/modules/paybacks/api/paybacks.actions";
import { PaybackDialog } from "@/modules/paybacks/components/PaybackDialog";
```

Replace it with:

```tsx
import { formatMoney } from "@/lib/money";
import type { MonthNavModel } from "@/lib/month-nav";
import { cn } from "@/lib/utils";
import { PayDialog } from "@/modules/budget/components/PayDialog";
import type { ExtraIncome } from "@/modules/budget/lib/income";
import { CategoryIcon } from "@/modules/categories/components/CategoryIcon";
import { deletePaybackAction } from "@/modules/paybacks/api/paybacks.actions";
import { PaybackDialog } from "@/modules/paybacks/components/PaybackDialog";
```

In `src/modules/dashboard/components/HomeView.tsx` (change 2 of 4), find:

```tsx
  balances: HomeBalanceRow[];
  currentMemberId: string;
  daysLeft: number;
  incomes: Record<string, number>;
  ledger: {
    income: number;
    incomeTrendPct: null | number;
```

Replace it with:

```tsx
  balances: HomeBalanceRow[];
  currentMemberId: string;
  daysLeft: number;
  ledger: {
    income: number;
    incomeTrendPct: null | number;
```

In `src/modules/dashboard/components/HomeView.tsx` (change 3 of 4), find:

```tsx
  monthNav: MonthNavModel;
  owners: HomeOwnerRow[];
  pacing: HomePacing | null;
  payback: null | PaybackBalance;
  prevMonthName: string;
  recent: HomeRecentGroup[];
```

Replace it with:

```tsx
  monthNav: MonthNavModel;
  owners: HomeOwnerRow[];
  pacing: HomePacing | null;
  // The pay of the person viewing Home, for the Pay & extra dialog.
  pay: { amount: number; carriedFrom: null | string; extras: ExtraIncome[] };
  payback: null | PaybackBalance;
  prevMonthName: string;
  recent: HomeRecentGroup[];
```

In `src/modules/dashboard/components/HomeView.tsx` (change 4 of 4), find:

```tsx
        </section>
      </div>

      <SetIncomeDialog
        currentMemberId={props.currentMemberId}
        incomes={props.incomes}
        members={props.members}
        month={props.month}
        monthLabel={props.monthNav.label}
        onOpenChange={setIncomeOpen}
        open={incomeOpen}
        year={props.year}
      />

```

Replace it with:

```tsx
        </section>
      </div>

      <PayDialog
        extras={props.pay.extras}
        memberId={props.currentMemberId}
        month={props.month}
        monthLabel={props.monthNav.label}
        onOpenChange={setIncomeOpen}
        open={incomeOpen}
        pay={props.pay.amount}
        payCarriedFrom={props.pay.carriedFrom}
        title="Pay & extra"
        year={props.year}
      />

```

- [ ] **Step 2: Reports**

In `src/modules/reports/pages/ReportsPage.tsx` (change 1 of 6), find:

```tsx
  resolvePeriod,
} from "@/lib/month-period";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { listPlanLines } from "@/modules/budget/api/budget";
import { getIncomesForMonth, listAllIncomes } from "@/modules/budget/api/budget.actions";
import { listCategories } from "@/modules/categories/api/categories";
import { pctOfIncome } from "@/modules/dashboard/lib/format";
import { listExpensesForMonth, listExpensesForRange } from "@/modules/expenses/api/expenses.actions";
```

Replace it with:

```tsx
  resolvePeriod,
} from "@/lib/month-period";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { listIncomeRows, listPlanLines } from "@/modules/budget/api/budget";
import { incomeByMonth, monthIncome } from "@/modules/budget/lib/income";
import { listCategories } from "@/modules/categories/api/categories";
import { pctOfIncome } from "@/modules/dashboard/lib/format";
import { listExpensesForMonth, listExpensesForRange } from "@/modules/expenses/api/expenses.actions";
```

In `src/modules/reports/pages/ReportsPage.tsx` (change 2 of 6), find:

```tsx
  const period = resolvePeriod(year, month, dateFormat);
  const isCurrent = year === currentYear && month === currentMonth;

  let rangeStartYm = { month, year };
  for (let i = 0; i < 5; i++) rangeStartYm = previousMonth(rangeStartYm.year, rangeStartYm.month);
  const rangeStart = resolvePeriod(rangeStartYm.year, rangeStartYm.month, dateFormat).startDate;

  const [
    members,
    categories,
    incomeRows,
    prevIncomeRows,
    allIncomeRows,
    budgetItemRows,
    expenseRows,
    prevExpenseRows,
```

Replace it with:

```tsx
  const period = resolvePeriod(year, month, dateFormat);
  const isCurrent = year === currentYear && month === currentMonth;

  // The six months the trend chart covers, oldest first.
  const trendMonths = [{ month, year }];
  for (let i = 0; i < 5; i++) trendMonths.unshift(previousMonth(trendMonths[0].year, trendMonths[0].month));
  const rangeStart = resolvePeriod(trendMonths[0].year, trendMonths[0].month, dateFormat).startDate;

  const [
    members,
    categories,
    incomeRows,
    budgetItemRows,
    expenseRows,
    prevExpenseRows,
```

In `src/modules/reports/pages/ReportsPage.tsx` (change 3 of 6), find:

```tsx
  ] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    getIncomesForMonth(year, month),
    getIncomesForMonth(prev.year, prev.month),
    listAllIncomes(),
    listPlanLines(householdId, year, month),
    listExpensesForMonth(year, month, dateFormat),
    listExpensesForMonth(prev.year, prev.month, dateFormat),
```

Replace it with:

```tsx
  ] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    listIncomeRows(householdId),
    listPlanLines(householdId, year, month),
    listExpensesForMonth(year, month, dateFormat),
    listExpensesForMonth(prev.year, prev.month, dateFormat),
```

In `src/modules/reports/pages/ReportsPage.tsx` (change 4 of 6), find:

```tsx
  const categoryName = (id: string) => category(id)?.name ?? "Unknown";

  const expenses = payExpenseRows.map((e) => ({ amount: Number(e.amount), categoryId: e.categoryId, ownerMemberId: e.ownerMemberId }));
  const combinedIncome = incomeRows.reduce((s, i) => s + Number(i.amount), 0);
  const prevIncome = prevIncomeRows.reduce((s, i) => s + Number(i.amount), 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const prevTotalExpenses = payPrevExpenseRows.reduce((s, e) => s + Number(e.amount), 0);

```

Replace it with:

```tsx
  const categoryName = (id: string) => category(id)?.name ?? "Unknown";

  const expenses = payExpenseRows.map((e) => ({ amount: Number(e.amount), categoryId: e.categoryId, ownerMemberId: e.ownerMemberId }));
  // Pay carries forward from earlier months; extra income counts in its own month.
  const memberIncome = (id: string, ym: { month: number; year: number }) => monthIncome(incomeRows, id, ym).total;
  const combinedIncome = members.reduce((s, m) => s + memberIncome(m.id, { month, year }), 0);
  const prevIncome = members.reduce((s, m) => s + memberIncome(m.id, prev), 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const prevTotalExpenses = payPrevExpenseRows.reduce((s, e) => s + Number(e.amount), 0);

```

In `src/modules/reports/pages/ReportsPage.tsx` (change 5 of 6), find:

```tsx
  const lead = expenseLead({ budgetLines, changes, current: totalExpenses, prevMonthName, previous: prevTotalExpenses });

  const trendPoints = monthlyIncomeExpenseTrend(
    allIncomeRows.map((i) => ({ amount: Number(i.amount), month: i.month, year: i.year })),
    payRangeExpenseRows.map((e) => ({ amount: Number(e.amount), date: e.date })),
    { month, year },
    6,
```

Replace it with:

```tsx
  const lead = expenseLead({ budgetLines, changes, current: totalExpenses, prevMonthName, previous: prevTotalExpenses });

  const trendPoints = monthlyIncomeExpenseTrend(
    incomeByMonth(
      incomeRows,
      members.map((m) => m.id),
      trendMonths,
    ),
    payRangeExpenseRows.map((e) => ({ amount: Number(e.amount), date: e.date })),
    { month, year },
    6,
```

In `src/modules/reports/pages/ReportsPage.tsx` (change 6 of 6), find:

```tsx
  );

  const incomeMembers = [
    { amount: incomeRows.filter((i) => i.memberId === memberId).reduce((s, i) => s + Number(i.amount), 0), key: "me" as const, label: "Me" },
    ...(partner
      ? [{ amount: incomeRows.filter((i) => i.memberId === partner.id).reduce((s, i) => s + Number(i.amount), 0), key: "partner" as const, label: partner.user.name }]
      : []),
  ].map((member) => ({
    ...member,
    trendPct: trendPct(member.amount, prevIncomeRows.filter((i) => i.memberId === (member.key === "me" ? memberId : partner?.id)).reduce((s, i) => s + Number(i.amount), 0)),
  }));

  // Savings tab: money put into each pot this month, and what was paid from savings.
  const deposits = depositRows.map((d) => ({ amount: Number(d.amount), date: d.date, id: d.id, kind: d.kind, memberId: d.memberId, potId: d.potId }));
```

Replace it with:

```tsx
  );

  const incomeMembers = [
    { amount: memberIncome(memberId, { month, year }), id: memberId, key: "me" as const, label: "Me" },
    ...(partner ? [{ amount: memberIncome(partner.id, { month, year }), id: partner.id, key: "partner" as const, label: partner.user.name }] : []),
  ].map(({ id, ...member }) => ({ ...member, trendPct: trendPct(member.amount, memberIncome(id, prev)) }));

  // Savings tab: money put into each pot this month, and what was paid from savings.
  const deposits = depositRows.map((d) => ({ amount: Number(d.amount), date: d.date, id: d.id, kind: d.kind, memberId: d.memberId, potId: d.potId }));
```

- [ ] **Step 3: Expenses and Recurring**

In `src/modules/expenses/pages/ExpensesPage.tsx` (change 1 of 3), find:

```tsx
import { currentPeriodYearMonth, formatPeriodLabel, MAX_NAVIGABLE_YEAR, MIN_NAVIGABLE_YEAR, resolvePeriod } from "@/lib/month-period";
import { getEffectiveMember, getHouseholdMembers } from "@/lib/session";
import { todayISO } from "@/lib/today";
import { getIncomesForMonth } from "@/modules/budget/api/budget.actions";
import { listCategories } from "@/modules/categories/api/categories";
import { daysLeftInMonth } from "@/modules/dashboard/lib/cash-flow";
import { listExpensesForMonth } from "@/modules/expenses/api/expenses.actions";
```

Replace it with:

```tsx
import { currentPeriodYearMonth, formatPeriodLabel, MAX_NAVIGABLE_YEAR, MIN_NAVIGABLE_YEAR, resolvePeriod } from "@/lib/month-period";
import { getEffectiveMember, getHouseholdMembers } from "@/lib/session";
import { todayISO } from "@/lib/today";
import { householdIncome } from "@/modules/budget/api/budget";
import { listCategories } from "@/modules/categories/api/categories";
import { daysLeftInMonth } from "@/modules/dashboard/lib/cash-flow";
import { listExpensesForMonth } from "@/modules/expenses/api/expenses.actions";
```

In `src/modules/expenses/pages/ExpensesPage.tsx` (change 2 of 3), find:

```tsx
  const isCurrentMonth = year === current.year && month === current.month;
  const period = resolvePeriod(year, month, dateFormat);

  const [members, categories, expenseRows, incomeRows, recurringItems, savingsPots] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    listExpensesForMonth(year, month, dateFormat),
    getIncomesForMonth(year, month),
    listRecurringExpenses(householdId),
    listSavingsPots(householdId),
  ]);
```

Replace it with:

```tsx
  const isCurrentMonth = year === current.year && month === current.month;
  const period = resolvePeriod(year, month, dateFormat);

  const [members, categories, expenseRows, income, recurringItems, savingsPots] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    listExpensesForMonth(year, month, dateFormat),
    householdIncome(householdId, year, month),
    listRecurringExpenses(householdId),
    listSavingsPots(householdId),
  ]);
```

In `src/modules/expenses/pages/ExpensesPage.tsx` (change 3 of 3), find:

```tsx
      daysLeft={isCurrentMonth ? daysLeftInMonth(year, month, dateFormat) : null}
      expenses={expenses}
      exportRows={exportRows}
      income={incomeRows.reduce((sum, i) => sum + Number(i.amount), 0)}
      members={members.map((m) => ({ id: m.id, name: m.user.name }))}
      monthLabel={monthLabel}
      monthNav={buildMonthNav({ basePath: "/expenses", current, dateFormat, selected: { month, year } })}
```

Replace it with:

```tsx
      daysLeft={isCurrentMonth ? daysLeftInMonth(year, month, dateFormat) : null}
      expenses={expenses}
      exportRows={exportRows}
      income={income}
      members={members.map((m) => ({ id: m.id, name: m.user.name }))}
      monthLabel={monthLabel}
      monthNav={buildMonthNav({ basePath: "/expenses", current, dateFormat, selected: { month, year } })}
```

In `src/modules/recurring/pages/RecurringPage.tsx` (change 1 of 3), find:

```tsx
  resolvePeriod,
} from "@/lib/month-period";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { getIncomesForMonth } from "@/modules/budget/api/budget.actions";
import { listCategories } from "@/modules/categories/api/categories";
import { listExpensesForMonth } from "@/modules/expenses/api/expenses.actions";
import { listRecurringExpenses } from "@/modules/recurring/api/recurring.actions";
```

Replace it with:

```tsx
  resolvePeriod,
} from "@/lib/month-period";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { householdIncome } from "@/modules/budget/api/budget";
import { listCategories } from "@/modules/categories/api/categories";
import { listExpensesForMonth } from "@/modules/expenses/api/expenses.actions";
import { listRecurringExpenses } from "@/modules/recurring/api/recurring.actions";
```

In `src/modules/recurring/pages/RecurringPage.tsx` (change 2 of 3), find:

```tsx
  const month = parseMonthParam(params.month, currentMonth, 12);
  const isCurrentMonth = year === currentYear && month === currentMonth;

  const [members, categories, recurringItems, monthExpenses, incomes] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    listRecurringExpenses(householdId),
    listExpensesForMonth(year, month, dateFormat),
    getIncomesForMonth(year, month),
  ]);

  const period = resolvePeriod(year, month, dateFormat);
```

Replace it with:

```tsx
  const month = parseMonthParam(params.month, currentMonth, 12);
  const isCurrentMonth = year === currentYear && month === currentMonth;

  const [members, categories, recurringItems, monthExpenses, income] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    listRecurringExpenses(householdId),
    listExpensesForMonth(year, month, dateFormat),
    householdIncome(householdId, year, month),
  ]);

  const period = resolvePeriod(year, month, dateFormat);
```

In `src/modules/recurring/pages/RecurringPage.tsx` (change 3 of 3), find:

```tsx

  const activeItems = recurringItems.filter((i) => i.status === "active");
  const monthly = activeItems.reduce((sum, i) => sum + Number(i.amount) * monthlyEquivalent(i.frequency), 0);
  const income = incomes.reduce((sum, i) => sum + Number(i.amount), 0);
  const paidTotal = paidExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const dueItems = activeItems.filter((i) => !paidIds.has(i.id) && dayNumberInPeriod(i.nextDueDate, year, month, dateFormat) !== null);
  const dueTotal = dueItems.reduce((sum, i) => sum + Number(i.amount), 0);
```

Replace it with:

```tsx

  const activeItems = recurringItems.filter((i) => i.status === "active");
  const monthly = activeItems.reduce((sum, i) => sum + Number(i.amount) * monthlyEquivalent(i.frequency), 0);

  const paidTotal = paidExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const dueItems = activeItems.filter((i) => !paidIds.has(i.id) && dayNumberInPeriod(i.nextDueDate, year, month, dateFormat) !== null);
  const dueTotal = dueItems.reduce((sum, i) => sum + Number(i.amount), 0);
```

- [ ] **Step 4: Check types, unit tests and lint**

Run:

```bash
npx tsc --noEmit
npm test
npm run lint -- --fix
npm run lint
```

Expected: `tsc` prints nothing; every unit test passes; lint shows 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/modules/dashboard/pages/DashboardPage.tsx src/modules/dashboard/components/HomeView.tsx src/modules/expenses/pages/ExpensesPage.tsx src/modules/recurring/pages/RecurringPage.tsx src/modules/reports/pages/ReportsPage.tsx
git commit -m "feat(income): every page reads pay carried forward"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.


### Task 2.5: Pay and Set aside first on the Budget page

The Budget page's figures become Left to plan (the lead), Pay (opens Pay & extra), Set aside first and Budgeted. A "Set aside first" group lists savings plans, dhuku and loan installments with what's been done this month, and replaces the old Savings group. The plan runs on pay only. The old income dialog and actions are removed.

**Files:**
- Modify: `src/modules/budget/pages/BudgetPage.tsx`
- Modify: `src/modules/budget/components/BudgetView.tsx`
- Delete: `src/modules/budget/components/SetIncomeDialog.tsx`
- Modify: `src/modules/budget/api/budget.actions.ts`
- Modify: `src/modules/budget/schemas/income.schema.ts`
- Modify: `e2e/budget.spec.ts`

**Interfaces:**
- Consumes: Tasks 2.2–2.3.
- Changes: `PersonView` gains `pay` and `setAside` and loses `savings`; `BudgetView` no longer takes `currentMemberId`, `incomes` or `members`.

- [ ] **Step 1: Remove the old single-figure income code**

In `src/modules/budget/api/budget.actions.ts` (change 1 of 2), find:

```ts
import { budgetItemChanges, budgetItemSummary, incomeChanges, incomeSummary } from "../lib/budget-activity";
import { recurringBudgetLines } from "../lib/recurring-budget";
import { type RemoveBudgetItemInput, removeBudgetItemSchema, type SetBudgetItemInput, setBudgetItemSchema } from "../schemas/budget-item.schema";
import { type ExtraIncomeInput, extraIncomeSchema, type SetIncomeInput, setIncomeSchema, type SetPayInput, setPaySchema } from "../schemas/income.schema";
import { listPlanLines } from "./budget";

// Insert-or-get in one statement. A select-then-insert would race when two
```

Replace it with:

```ts
import { budgetItemChanges, budgetItemSummary, incomeChanges, incomeSummary } from "../lib/budget-activity";
import { recurringBudgetLines } from "../lib/recurring-budget";
import { type RemoveBudgetItemInput, removeBudgetItemSchema, type SetBudgetItemInput, setBudgetItemSchema } from "../schemas/budget-item.schema";
import { type ExtraIncomeInput, extraIncomeSchema, type SetPayInput, setPaySchema } from "../schemas/income.schema";
import { listPlanLines } from "./budget";

// Insert-or-get in one statement. A select-then-insert would race when two
```

In `src/modules/budget/api/budget.actions.ts` (change 2 of 2), find:

```ts
  return toInsert.length;
}

export async function getIncomesForMonth(year: number, month: number) {
  const { householdId } = await getCurrentMember();
  return db
    .select()
    .from(incomes)
    .where(and(eq(incomes.householdId, householdId), eq(incomes.year, year), eq(incomes.month, month)));
}

export async function listAllIncomes() {
  const { householdId } = await getCurrentMember();
  return db.select().from(incomes).where(eq(incomes.householdId, householdId));
}

export async function setIncomeAction(input: SetIncomeInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = setIncomeSchema.parse(input);

  const members = await getHouseholdMembers(householdId);
  if (!members.some((m) => m.id === parsed.memberId)) {
    throw new Error("Member does not belong to this household");
  }

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

  const [saved] = await db
    .insert(incomes)
    .values({
      householdId,
      memberId: parsed.memberId,
      year: parsed.year,
      month: parsed.month,
      amount: String(parsed.amount),
      note: parsed.note,
    })
    .onConflictDoUpdate({
      target: [incomes.memberId, incomes.year, incomes.month],
      set: { amount: String(parsed.amount), note: parsed.note ?? null },
    })
    .returning();

  const f = await loadActivityFormatters(householdId);
  const after = { amount: parsed.amount, memberId: parsed.memberId, month: parsed.month, note: parsed.note, year: parsed.year };
  await logActivity(
    activityActor(member),
    before
      ? { action: "updated", after: saved, before, changes: incomeChanges(f, before, after), entityId: saved.id, entityType: "income", summary: incomeSummary(f, after) }
      : { action: "created", after: saved, before: null, entityId: saved.id, entityType: "income", summary: incomeSummary(f, after) },
  );

  revalidatePath("/budget");
  revalidatePath("/dashboard");
}

function revalidateIncomePaths() {
  revalidatePath("/budget");
  revalidatePath("/dashboard");
```

Replace it with:

```ts
  return toInsert.length;
}

function revalidateIncomePaths() {
  revalidatePath("/budget");
  revalidatePath("/dashboard");
```

In `src/modules/budget/schemas/income.schema.ts`, find:

```ts
});

export type ExtraIncomeInput = z.infer<typeof extraIncomeSchema>;

// The old single income figure. The Budget page still uses it until Task 2.5.
export const setIncomeSchema = z.object({
  memberId: z.string().uuid(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  amount: z.number().nonnegative(),
  note: z.string().optional(),
});

export type SetIncomeInput = z.infer<typeof setIncomeSchema>;
```

Replace it with:

```ts
});

export type ExtraIncomeInput = z.infer<typeof extraIncomeSchema>;
```

- [ ] **Step 2: Remove the old income dialog**

Delete `src/modules/budget/components/SetIncomeDialog.tsx`:

```bash
git rm src/modules/budget/components/SetIncomeDialog.tsx
```

- [ ] **Step 3: The Budget view: pay, set aside first and the new figures**

In `src/modules/budget/components/BudgetView.tsx` (change 1 of 11), find:

```tsx
import { cn } from "@/lib/utils";
import { fillBudgetFromRecurringAction } from "@/modules/budget/api/budget.actions";
import { BudgetDialog, type BudgetDraft } from "@/modules/budget/components/BudgetDialog";
import { SetIncomeDialog } from "@/modules/budget/components/SetIncomeDialog";
import type { BudgetLead, PersonPlan, PlanRow, SharedRow } from "@/modules/budget/lib/budget-view";
import type { BudgetLineKind } from "@/modules/budget/lib/plan-lines";

type Category = { budgetType: "fixed" | "flexible"; groupName: string; id: string; name: string };
type Member = { id: string; name: string };

type LedgerFigures = {
  budgeted: number;
  budgetedRatio: number;
  budgetedSub: string;
  outside: number;
  outsideSub: string;
  spentIn: number;
  spentInSub: string;
  unplanned: number;
  unplannedSub: string;
};
```

Replace it with:

```tsx
import { cn } from "@/lib/utils";
import { fillBudgetFromRecurringAction } from "@/modules/budget/api/budget.actions";
import { BudgetDialog, type BudgetDraft } from "@/modules/budget/components/BudgetDialog";
import { PayDialog } from "@/modules/budget/components/PayDialog";
import type { BudgetLead, PersonPlan, PlanRow, SharedRow } from "@/modules/budget/lib/budget-view";
import type { ExtraIncome } from "@/modules/budget/lib/income";
import type { BudgetLineKind } from "@/modules/budget/lib/plan-lines";
import type { SetAsideRow } from "@/modules/budget/lib/set-aside";

type Category = { budgetType: "fixed" | "flexible"; groupName: string; id: string; name: string };

type LedgerFigures = {
  budgeted: number;
  budgetedSub: string;
  pay: number;
  paySub: null | string;
  // How much of pay the plan uses: set aside plus budgeted, over pay.
  plannedRatio: number;
  setAside: number;
  setAsideSub: string;
  unplanned: number;
  unplannedSub: string;
};
```

In `src/modules/budget/components/BudgetView.tsx` (change 2 of 11), find:

```tsx
  ledger: LedgerFigures;
  memberId: string;
  name: string;
  plan: PersonPlan;
  savings: { planned: number; pots: { id: string; name: string; planned: number; putIn: number }[]; putIn: number };
  spentByCategory: Record<string, number>;
};

type Props = {
  categories: Category[];
  currentMemberId: string;
  incomes: Record<string, number>;
  members: Member[];
  month: number;
  monthLabel: string;
  monthNav: MonthNavModel;
```

Replace it with:

```tsx
  ledger: LedgerFigures;
  memberId: string;
  name: string;
  pay: { amount: number; carriedFrom: null | string; extras: ExtraIncome[] };
  plan: PersonPlan;
  setAside: { done: number; planned: number; rows: SetAsideRow[] };
  spentByCategory: Record<string, number>;
};

type Props = {
  categories: Category[];
  month: number;
  monthLabel: string;
  monthNav: MonthNavModel;
```

In `src/modules/budget/components/BudgetView.tsx` (change 3 of 11), find:

```tsx
  const [tab, setTab] = useState<Tab>("me");
  const [openUnbudgeted, setOpenUnbudgeted] = useState(false);
  const [dialog, setDialog] = useState<{ defaultCategoryId?: string; initial?: BudgetDraft; open: boolean }>({ open: false });
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [fillPending, setFillPending] = useState(false);

  const person = tab === "shared" ? null : (props.people.find((p) => p.key === tab) ?? props.people[0]);
```

Replace it with:

```tsx
  const [tab, setTab] = useState<Tab>("me");
  const [openUnbudgeted, setOpenUnbudgeted] = useState(false);
  const [dialog, setDialog] = useState<{ defaultCategoryId?: string; initial?: BudgetDraft; open: boolean }>({ open: false });
  const [payOpen, setPayOpen] = useState(false);
  const [fillPending, setFillPending] = useState(false);

  const person = tab === "shared" ? null : (props.people.find((p) => p.key === tab) ?? props.people[0]);
```

In `src/modules/budget/components/BudgetView.tsx` (change 4 of 11), find:

```tsx
                  <Plus />
                  Add budget
                </Button>
              </>
            )}
            <Button onClick={() => setIncomeOpen(true)} variant="ghost">
              Set income
            </Button>
          </>
        }
        monthNav={props.monthNav}
```

Replace it with:

```tsx
                  <Plus />
                  Add budget
                </Button>
                <Button onClick={() => setPayOpen(true)} variant="ghost">
                  Pay &amp; extra
                </Button>
              </>
            )}
          </>
        }
        monthNav={props.monthNav}
```

In `src/modules/budget/components/BudgetView.tsx` (change 5 of 11), find:

```tsx
          </p>

          <Ledger>
            <LedgerCell bar={<Meter ratio={person.ledger.budgetedRatio} />} label="Budgeted" lead note={person.ledger.budgetedSub}>
              <Money size="lead" value={person.ledger.budgeted} />
            </LedgerCell>
            <LedgerCell label="Spent in budgets" note={person.ledger.spentInSub}>
              <Money size="cell" value={person.ledger.spentIn} />
            </LedgerCell>
            <LedgerCell label="Spent outside" note={person.ledger.outsideSub}>
              <Money size="cell" value={person.ledger.outside} />
            </LedgerCell>
            <LedgerCell
              label="Left to plan"
              note={<span className={cn(person.ledger.unplanned < 0 && "text-signal-ink")}>{person.ledger.unplannedSub}</span>}
            >
              <Money size="cell" tone={person.ledger.unplanned < 0 ? "negative" : "default"} value={person.ledger.unplanned} />
            </LedgerCell>
          </Ledger>
        </>
```

Replace it with:

```tsx
          </p>

          <Ledger>
            <LedgerCell
              bar={<Meter ratio={person.ledger.plannedRatio} />}
              label="Left to plan"
              lead
              note={<span className={cn(person.ledger.unplanned < 0 && "text-signal-ink")}>{person.ledger.unplannedSub}</span>}
            >
              <Money size="lead" tone={person.ledger.unplanned < 0 ? "negative" : "default"} value={person.ledger.unplanned} />
            </LedgerCell>
            <LedgerCell label="Pay" note={person.ledger.paySub} onSelect={() => setPayOpen(true)}>
              <Money size="cell" value={person.ledger.pay} />
            </LedgerCell>
            <LedgerCell label="Set aside first" note={person.ledger.setAsideSub}>
              <Money size="cell" value={person.ledger.setAside} />
            </LedgerCell>
            <LedgerCell label="Budgeted" note={person.ledger.budgetedSub}>
              <Money size="cell" value={person.ledger.budgeted} />
            </LedgerCell>
          </Ledger>
        </>
```

In `src/modules/budget/components/BudgetView.tsx` (change 6 of 11), find:

```tsx
        <span>Used</span>
      </RowsHeader>

      {person && <PersonRows monogram={monogram(person)} onCategory={openCategory} onNew={openNew} onRow={openRow} openUnbudgeted={openUnbudgeted} person={person} setOpenUnbudgeted={setOpenUnbudgeted} />}

      {tab === "shared" && (
        <>
```

Replace it with:

```tsx
        <span>Used</span>
      </RowsHeader>

      {person && person.setAside.rows.length > 0 && <SetAsideRows setAside={person.setAside} />}

      {person && (
        <PersonRows
          afterSetAside={person.setAside.rows.length > 0}
          monogram={monogram(person)}
          onCategory={openCategory}
          onNew={openNew}
          onRow={openRow}
          openUnbudgeted={openUnbudgeted}
          person={person}
          setOpenUnbudgeted={setOpenUnbudgeted}
        />
      )}

      {tab === "shared" && (
        <>
```

In `src/modules/budget/components/BudgetView.tsx` (change 7 of 11), find:

```tsx
        </>
      )}

      {person && person.savings.pots.length > 0 && (
        <>
          <RowGroupHead columns={COLUMNS}>
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="text-[15px] font-semibold whitespace-nowrap">Savings</span>
              <span className="truncate text-[13px] text-n-600">Planned against put in this month</span>
            </div>
            <div className="text-right text-[15px] font-semibold">
              <Money value={person.savings.planned} />
            </div>
            <div className="text-right text-[15px] font-semibold">
              <Money value={person.savings.putIn} />
            </div>
            <div className="text-right text-[15px] font-semibold">
              <Money value={Math.max(0, person.savings.planned - person.savings.putIn)} />
            </div>
            <div className="flex min-w-0 items-center gap-2.5">
              <Meter className="flex-1" ratio={person.savings.planned > 0 ? Math.min(1, person.savings.putIn / person.savings.planned) : 0} />
              <span className="w-10.5 text-right text-[13px] font-semibold text-ink">
                {pct(person.savings.planned > 0 ? person.savings.putIn / person.savings.planned : 0)}
              </span>
            </div>
          </RowGroupHead>
          {person.savings.pots.map((pot) => (
            <Row columns={COLUMNS} key={pot.id}>
              <span className="truncate text-[15px] whitespace-nowrap">{pot.name}</span>
              <div className="text-right text-[15px]">
                <Money value={pot.planned} />
              </div>
              <div className="text-right text-[15px]">
                <Money value={pot.putIn} />
              </div>
              <div className="text-right text-[15px]">
                <Money value={Math.max(0, pot.planned - pot.putIn)} />
              </div>
              <div className="flex min-w-0 items-center gap-2.5">
                <Meter className="flex-1" ratio={pot.planned > 0 ? Math.min(1, pot.putIn / pot.planned) : 0} />
                <span className="w-10.5 text-right text-[13px] text-n-700">{pct(pot.planned > 0 ? pot.putIn / pot.planned : 0)}</span>
              </div>
            </Row>
          ))}
        </>
      )}

      {person && (
        <BudgetDialog
```

Replace it with:

```tsx
        </>
      )}


      {person && (
        <BudgetDialog
```

In `src/modules/budget/components/BudgetView.tsx` (change 8 of 11), find:

```tsx
        />
      )}

      <SetIncomeDialog
        currentMemberId={props.currentMemberId}
        incomes={props.incomes}
        members={props.members}
        month={props.month}
        monthLabel={props.monthLabel}
        onOpenChange={setIncomeOpen}
        open={incomeOpen}
        year={props.year}
      />
    </div>
  );
}

type PersonRowsProps = {
  monogram: MonogramPerson[];
  onCategory: (categoryId: string) => void;
  onNew: () => void;
```

Replace it with:

```tsx
        />
      )}

      {person && (
        <PayDialog
          extras={person.pay.extras}
          memberId={person.memberId}
          month={props.month}
          monthLabel={props.monthLabel}
          onOpenChange={setPayOpen}
          open={payOpen}
          pay={person.pay.amount}
          payCarriedFrom={person.pay.carriedFrom}
          title={person.key === "me" ? "Your pay" : `${person.name}'s pay`}
          year={props.year}
        />
      )}
    </div>
  );
}

// "Set aside first": savings plans, dhukus, loan installments (and later
// funds), filled in from what Piko already knows. Done is what has actually
// gone in this month.
function SetAsideRows({ setAside }: { setAside: PersonView["setAside"] }) {
  const ratio = setAside.planned > 0 ? setAside.done / setAside.planned : 0;
  return (
    <>
      <RowGroupHead columns={COLUMNS} first>
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="text-[15px] font-semibold whitespace-nowrap">Set aside first</span>
          <span className="truncate text-[13px] text-n-600">Filled in from savings, dhuku and loans</span>
        </div>
        <div className="text-right text-[15px] font-semibold">
          <Money value={setAside.planned} />
        </div>
        <div className="text-right text-[15px] font-semibold">
          <Money value={setAside.done} />
        </div>
        <div className="text-right text-[15px] font-semibold">
          <Money value={Math.max(0, setAside.planned - setAside.done)} />
        </div>
        <div className="flex min-w-0 items-center gap-2.5">
          <Meter className="flex-1" ratio={Math.min(1, ratio)} />
          <span className="w-10.5 text-right text-[13px] font-semibold text-ink">{pct(ratio)}</span>
        </div>
      </RowGroupHead>
      {setAside.rows.map((row) => {
        const rowRatio = row.planned > 0 ? row.done / row.planned : 0;
        return (
          <Row columns={COLUMNS} key={row.id}>
            <div className="flex min-w-0 items-baseline gap-2.5">
              <span className="truncate text-[15px] whitespace-nowrap">{row.label}</span>
              <span className="shrink-0 text-xs text-n-600">{row.sub}</span>
            </div>
            <div className="text-right text-[15px]">
              <Money value={row.planned} />
            </div>
            <div className="text-right text-[15px]">
              <Money value={row.done} />
            </div>
            <div className="text-right text-[15px]">
              <Money value={Math.max(0, row.planned - row.done)} />
            </div>
            <div className="flex min-w-0 items-center gap-2.5">
              <Meter className="flex-1" ratio={Math.min(1, rowRatio)} />
              <span className="w-10.5 text-right text-[13px] text-n-700">{pct(rowRatio)}</span>
            </div>
          </Row>
        );
      })}
    </>
  );
}

type PersonRowsProps = {
  // The "Set aside first" group sits above, so the first kind group isn't first on the page.
  afterSetAside: boolean;
  monogram: MonogramPerson[];
  onCategory: (categoryId: string) => void;
  onNew: () => void;
```

In `src/modules/budget/components/BudgetView.tsx` (change 9 of 11), find:

```tsx

// One person's plan: a group per kind (fixed, essential, can cut), then their
// spending in categories without a line.
function PersonRows({ monogram, onCategory, onNew, onRow, openUnbudgeted, person, setOpenUnbudgeted }: PersonRowsProps) {
  const { plan } = person;
  const shown = plan.unbudgeted.slice(0, SHOWN_UNBUDGETED);
  const moreCount = plan.unbudgeted.length - shown.length;
```

Replace it with:

```tsx

// One person's plan: a group per kind (fixed, essential, can cut), then their
// spending in categories without a line.
function PersonRows({ afterSetAside, monogram, onCategory, onNew, onRow, openUnbudgeted, person, setOpenUnbudgeted }: PersonRowsProps) {
  const { plan } = person;
  const shown = plan.unbudgeted.slice(0, SHOWN_UNBUDGETED);
  const moreCount = plan.unbudgeted.length - shown.length;
```

In `src/modules/budget/components/BudgetView.tsx` (change 10 of 11), find:

```tsx
  return (
    <>
      {plan.groups.length === 0 && (
        <RowGroupHead columns={COLUMNS} first>
          <div className="flex min-w-0 items-center gap-2.5">
            <Monogram people={monogram} />
            <span className="text-[15px] font-semibold whitespace-nowrap">{person.key === "me" ? "Me" : person.name}</span>
```

Replace it with:

```tsx
  return (
    <>
      {plan.groups.length === 0 && (
        <RowGroupHead columns={COLUMNS} first={!afterSetAside}>
          <div className="flex min-w-0 items-center gap-2.5">
            <Monogram people={monogram} />
            <span className="text-[15px] font-semibold whitespace-nowrap">{person.key === "me" ? "Me" : person.name}</span>
```

In `src/modules/budget/components/BudgetView.tsx` (change 11 of 11), find:

```tsx
        const left = group.planned - group.spent;
        return (
          <Fragment key={group.kind}>
            <RowGroupHead columns={COLUMNS} first={index === 0}>
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="text-[15px] font-semibold whitespace-nowrap">{group.label}</span>
                <span className="truncate text-[13px] text-n-600">
```

Replace it with:

```tsx
        const left = group.planned - group.spent;
        return (
          <Fragment key={group.kind}>
            <RowGroupHead columns={COLUMNS} first={index === 0 && !afterSetAside}>
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="text-[15px] font-semibold whitespace-nowrap">{group.label}</span>
                <span className="truncate text-[13px] text-n-600">
```

- [ ] **Step 4: The Budget page data**

Replace the whole of `src/modules/budget/pages/BudgetPage.tsx` with:

```tsx
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { formatMoney } from "@/lib/money";
import { buildMonthNav, parseMonthParam } from "@/lib/month-nav";
import { currentPeriodYearMonth, formatPeriodLabel, MAX_NAVIGABLE_YEAR, MIN_NAVIGABLE_YEAR, resolvePeriod } from "@/lib/month-period";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { listDatedLines, listIncomeRows, listPlanLines } from "@/modules/budget/api/budget";
import { BudgetView, type PersonView } from "@/modules/budget/components/BudgetView";
import { buildBudgetLead, buildPersonPlan, overBudgetRows, sharedRows } from "@/modules/budget/lib/budget-view";
import { monthIncome } from "@/modules/budget/lib/income";
import { lastKindByCategory } from "@/modules/budget/lib/plan-lines";
import { dhukuSetAsides, loanSetAsides, savingsSetAsides } from "@/modules/budget/lib/set-aside";
import { listCategories } from "@/modules/categories/api/categories";
import { walletShares } from "@/modules/dashboard/lib/wallet";
import { listDhukuEntries, listDhukus } from "@/modules/dhuku/api/dhuku.actions";
import { listExpensesForMonth } from "@/modules/expenses/api/expenses.actions";
import { listLoanPayments, listLoans } from "@/modules/loans/api/loans.actions";
import { checkBudgetReminder } from "@/modules/notifications/api/notifications.actions";
import { listSavingsDeposits, listSavingsPotPlans, listSavingsPots } from "@/modules/savings/api/savings.actions";

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

type Props = { searchParams: Promise<{ month?: string; year?: string }> };

export async function BudgetPage({ searchParams }: Props) {
  const { householdId, memberId } = await getCurrentMember();
  const dateFormat = await getDateFormatPref(householdId);
  const params = await searchParams;
  const { year: currentYear, month: currentMonth } = currentPeriodYearMonth(dateFormat);
  const year = parseMonthParam(params.year, currentYear, MAX_NAVIGABLE_YEAR[dateFormat], MIN_NAVIGABLE_YEAR[dateFormat]);
  const month = parseMonthParam(params.month, currentMonth, 12);
  const isCurrentMonth = year === currentYear && month === currentMonth;
  const period = resolvePeriod(year, month, dateFormat);

  const [
    members,
    categories,
    incomeRows,
    planLines,
    datedLines,
    expenseRows,
    potRows,
    planRows,
    depositRows,
    dhukuRows,
    dhukuEntryRows,
    loanRows,
    loanPaymentRows,
  ] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    listIncomeRows(householdId),
    listPlanLines(householdId, year, month),
    listDatedLines(householdId, { month, year }),
    listExpensesForMonth(year, month, dateFormat),
    listSavingsPots(householdId),
    listSavingsPotPlans(householdId),
    listSavingsDeposits(householdId),
    listDhukus(householdId),
    listDhukuEntries(householdId),
    listLoans(householdId),
    listLoanPayments(householdId),
  ]);

  if (isCurrentMonth) {
    await checkBudgetReminder(householdId, year, month, planLines.length);
  }

  const memberIds = members.map((m) => m.id);
  const categoryList = categories.map((c) => ({ budgetType: c.budgetType, groupName: c.groupName, id: c.id, name: c.name }));

  // Each person's spending is what left their own wallet, the same as Home.
  // Expenses paid from savings were saved for in earlier months, so they don't
  // count against this month's budget.
  const shares = expenseRows
    .filter((e) => e.savingsPotId === null)
    .flatMap((e) =>
      walletShares(
        { amount: Number(e.amount), paidByMemberId: e.paidByMemberId, payBackAmount: e.payBackAmount === null ? null : Number(e.payBackAmount) },
        memberIds,
      ).map((share) => ({ ...share, categoryId: e.categoryId })),
    );

  const deposits = depositRows.map((d) => ({ amount: Number(d.amount), date: d.date, kind: d.kind, memberId: d.memberId, potId: d.potId }));
  const plans = planRows.map((p) => ({ memberId: p.memberId, monthlyAmount: Number(p.monthlyAmount), potId: p.potId }));
  const dhukus = dhukuRows.map((d) => ({
    completedAt: d.completedAt,
    id: d.id,
    interestPerMonth: d.interestPerMonth === null ? null : Number(d.interestPerMonth),
    monthlyContribution: Number(d.monthlyContribution),
    name: d.name,
    ownerMemberId: d.ownerMemberId,
    totalMembers: d.totalMembers,
  }));
  const dhukuEntries = dhukuEntryRows.map((e) => ({ amount: Number(e.amount), date: e.date, dhukuId: e.dhukuId, type: e.type }));
  const loans = loanRows.map((l) => ({
    counterpartyName: l.counterpartyName,
    direction: l.direction,
    id: l.id,
    installmentAmount: l.installmentAmount === null ? null : Number(l.installmentAmount),
    installmentFrequency: l.installmentFrequency,
    ownerMemberId: l.ownerMemberId,
    principalAmount: Number(l.principalAmount),
  }));
  const payments = loanPaymentRows.map((p) => ({ amount: Number(p.amount), date: p.date, loanId: p.loanId }));

  const ordered = [...members.filter((m) => m.id === memberId), ...members.filter((m) => m.id !== memberId)];
  const people: PersonView[] = ordered.map((member) => {
    const lines = planLines.filter((l) => l.ownerMemberId === member.id);
    const spending = shares.filter((s) => s.memberId === member.id);
    const plan = buildPersonPlan({ categories: categoryList, lines, spending });
    const income = monthIncome(incomeRows, member.id, { month, year });

    const setAsideRows = [
      ...savingsSetAsides({ deposits, memberId: member.id, period, plans, pots: potRows }),
      ...dhukuSetAsides({ dhukus, entries: dhukuEntries, memberId: member.id, period }),
      ...loanSetAsides({ loans, memberId: member.id, payments, period }),
    ];
    const setAside = setAsideRows.reduce((sum, row) => sum + row.planned, 0);
    // The plan runs on pay only: extra income never makes room in it.
    const unplanned = income.pay - setAside - plan.budgeted;
    const carried = lines.find((l) => l.inherited);
    const payCarriedFrom = income.payCarriedFrom ? formatPeriodLabel(income.payCarriedFrom.year, income.payCarriedFrom.month, dateFormat) : null;

    return {
      carriedFrom: carried ? formatPeriodLabel(carried.year, carried.month, dateFormat) : null,
      key: member.id === memberId ? ("me" as const) : ("partner" as const),
      lastKinds: lastKindByCategory(datedLines, member.id),
      lead: buildBudgetLead({
        allSpent: plan.totalSpent,
        budgeted: plan.budgeted,
        income: income.pay,
        outside: plan.unbudgetedTotal,
        overBudget: overBudgetRows(plan),
      }),
      ledger: {
        budgeted: plan.budgeted,
        budgetedSub: `${percent(plan.budgeted, income.pay)}% of pay`,
        pay: income.pay,
        paySub: income.extra > 0 ? `+ ${formatMoney(income.extra)} extra` : payCarriedFrom ? `Carried over from ${payCarriedFrom}` : null,
        plannedRatio: income.pay > 0 ? (setAside + plan.budgeted) / income.pay : 0,
        setAside,
        setAsideSub: setAsideRows.length > 0 ? `${setAsideRows.length} ${setAsideRows.length === 1 ? "item" : "items"}` : "Nothing set aside",
        unplanned,
        unplannedSub: unplanned < 0 ? "The plan is bigger than pay" : `${percent(unplanned, income.pay)}% of pay not planned yet`,
      },
      memberId: member.id,
      name: member.user.name,
      pay: { amount: income.pay, carriedFrom: payCarriedFrom, extras: income.extras },
      plan,
      setAside: {
        done: setAsideRows.reduce((sum, row) => sum + row.done, 0),
        planned: setAside,
        rows: setAsideRows,
      },
      spentByCategory: Object.fromEntries(
        [...new Set(spending.map((s) => s.categoryId))].map((id) => [id, spending.filter((s) => s.categoryId === id).reduce((sum, s) => sum + s.amount, 0)]),
      ),
    };
  });

  return (
    <BudgetView
      categories={categoryList}
      month={month}
      monthLabel={formatPeriodLabel(year, month, dateFormat)}
      monthNav={buildMonthNav({
        allowFuture: true,
        basePath: "/budget",
        current: { month: currentMonth, year: currentYear },
        dateFormat,
        selected: { month, year },
      })}
      people={people}
      shared={sharedRows(planLines, categoryList)}
      year={year}
    />
  );
}
```

- [ ] **Step 5: Update the browser tests**

In `e2e/budget.spec.ts` (change 1 of 3), find:

```ts
    await expect(budgetRow(page, "Petrol")).toContainText("2,222");
  });

  test("a month with no lines of its own carries over the last plan", async ({ page }) => {
    await gotoMonthAhead(page, 2);

    await expect(page.getByText(/^Carried over from/)).toBeVisible();
    await expect(page.getByText("Can cut", { exact: true })).toBeVisible();
    await expect(budgetRow(page, "Dining Out")).toHaveCount(1);
  });
```

Replace it with:

```ts
    await expect(budgetRow(page, "Petrol")).toContainText("2,222");
  });

  test("extra income shows on top of pay without growing the plan", async ({ page }) => {
    await gotoMonthAhead(page, 3);

    await page.getByRole("button", { name: "Pay & extra" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Extra amount").fill("1234");
    await dialog.getByLabel("What was it?").fill("e2e bonus");
    await dialog.getByRole("button", { name: "Add extra" }).click();
    await expect(dialog.getByText("e2e bonus")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.reload();

    await expect(page.getByText("+ Rs 1,234.00 extra")).toBeVisible();
  });

  test("a month with no lines of its own carries over the last plan", async ({ page }) => {
    await gotoMonthAhead(page, 2);

    await expect(page.getByText(/Changing a line makes this month's plan its own/)).toBeVisible();
    await expect(page.getByText("Can cut", { exact: true })).toBeVisible();
    await expect(budgetRow(page, "Dining Out")).toHaveCount(1);
  });
```

In `e2e/budget.spec.ts` (change 2 of 3), find:

```ts

  test("shows the month's plan", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Budget", exact: true })).toBeVisible();
    await expect(page.getByText("Budgeted", { exact: true })).toBeVisible();
    await expect(page.getByText("Spent in budgets", { exact: true })).toBeVisible();
    await expect(page.getByText("Click a row to change its budget")).toBeVisible();
  });

```

Replace it with:

```ts

  test("shows the month's plan", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Budget", exact: true })).toBeVisible();
    await expect(page.getByText("Left to plan", { exact: true })).toBeVisible();
    await expect(page.getByText("Set aside first", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Click a row to change its budget")).toBeVisible();
  });

```

In `e2e/budget.spec.ts` (change 3 of 3), find:

```ts
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Set a budget" })).toBeVisible();
  });

  test("opens the set-income dialog", async ({ page }) => {
    await page.getByRole("button", { name: "Set income" }).click();

    await expect(page.getByRole("dialog").getByRole("heading", { name: "Set income" })).toBeVisible();
  });
});
```

Replace it with:

```ts
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Set a budget" })).toBeVisible();
  });

  test("opens the pay dialog", async ({ page }) => {
    await page.getByRole("button", { name: "Pay & extra" }).click();

    await expect(page.getByRole("dialog").getByRole("heading", { name: "Your pay" })).toBeVisible();
  });
});
```

- [ ] **Step 6: Check types, unit tests and lint**

Run:

```bash
npx tsc --noEmit
npm test
npm run lint -- --fix
npm run lint
```

Expected: `tsc` prints nothing; every unit test passes; lint shows 0 errors.

- [ ] **Step 7: Run the browser tests for this task**

Run:

```bash
npx playwright test e2e/budget.spec.ts --reporter=line
```

Expected: all pass. This builds the app and resets its own test database first (1–3 minutes). If one fails with `ECONNRESET` or a timeout, re-run it alone (see Global Constraints) before treating it as a real failure.

- [ ] **Step 8: Commit**

```bash
git add src/modules/budget/pages/BudgetPage.tsx src/modules/budget/components/BudgetView.tsx src/modules/budget/components/SetIncomeDialog.tsx src/modules/budget/api/budget.actions.ts src/modules/budget/schemas/income.schema.ts e2e/budget.spec.ts
git commit -m "feat(budget): pay and set aside first on the Budget page"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again. (The deleted file is already staged by `git rm`; `git add` on it is harmless.)


### Phase 2 checkpoint: STOP

Stop here. Do not start Phase 3.

Send the owner a short report:

- The task commits made in this phase (`git log --oneline` since the phase began).
- The new migration file's name, and that it adds the `income_kind` type, the `incomes.kind` column (default `pay`) and the `incomes_one_pay` partial unique index in place of the old unique constraint. The owner should check: Budget's Pay & extra dialog sets pay and adds extras; the next month shows the pay carried over; Left to plan is pay − set aside − budgeted and turns red when negative; Set aside first lists their savings plan, their dhuku (with interest from the month after taking the pot) and loans with an installment; Home's Income cell opens the same dialog; Reports' income trend includes carried-over pay.
- The results of `npx tsc --noEmit`, `npm test`, `npm run lint` and `npm run test:e2e` (say which e2e tests failed, if any, and whether they passed when re-run alone).
- Anything that didn't match the plan and what you did about it.

Then wait. The owner applies the migration (`npm run db:migrate`) on their database themselves, tries the app, and tells you whether to go on.

## Phase 3: Home follows the person viewing it

Home's figures and hero follow the person viewing it. Safe to spend runs over their can-cut lines only, and anything that went over elsewhere (an essential, a fixed line, spending with no line) comes out of what's left, spread over the remaining weeks. Essentials get their own list.

### Task 3.1: Overruns, and spreading them over the weeks left

What went over plan outside the can-cut lines (any other line past its amount, plus spending with no line at all), the sentence Home shows about it, and how it comes out of the weekly allowances: the current and later weeks shrink in proportion, never below zero, and earlier weeks stay as they were.

**Files:**
- Modify: `src/modules/budget/lib/budget-view.test.ts`
- Modify: `src/modules/budget/lib/budget-view.ts`
- Modify: `src/modules/dashboard/lib/pacing.test.ts`
- Modify: `src/modules/dashboard/lib/pacing.ts`

**Interfaces:**
- Produces: `type Overrun`, `overrunFromPlan(plan)`, `overrunNote(overrun)` in `budget-view.ts`; `weekIndexOf(schedule, day)`, `withOverrun(schedule, fromIndex, overrun)` in `pacing.ts`.

- [ ] **Step 1: Write the failing tests**

In `src/modules/budget/lib/budget-view.test.ts` (change 1 of 2), find:

```ts
import { describe, expect, it } from "vitest";

import { buildBudgetLead, buildPersonPlan, overBudgetRows, sharedRows } from "./budget-view";

const CATEGORIES = [
  { budgetType: "flexible" as const, id: "food", name: "Groceries" },
```

Replace it with:

```ts
import { describe, expect, it } from "vitest";

import { buildBudgetLead, buildPersonPlan, overBudgetRows, overrunFromPlan, overrunNote, sharedRows } from "./budget-view";

const CATEGORIES = [
  { budgetType: "flexible" as const, id: "food", name: "Groceries" },
```

In `src/modules/budget/lib/budget-view.test.ts` (change 2 of 2), find:

```ts
    expect(overBudgetRows(plan)).toEqual([{ categoryName: "Groceries", over: 500 }]);
  });
});
```

Replace it with:

```ts
    expect(overBudgetRows(plan)).toEqual([{ categoryName: "Groceries", over: 500 }]);
  });
});

describe("overrunFromPlan", () => {
  it("collects lines past their amount, except can-cut ones, and spending without a line", () => {
    const plan = buildPersonPlan({
      categories: CATEGORIES,
      lines: [
        { categoryId: "food", inherited: false, kind: "essential", plannedAmount: 5000 },
        { categoryId: "rent", inherited: false, kind: "fixed", plannedAmount: 20000 },
        { categoryId: "lunch", inherited: false, kind: "can_cut", plannedAmount: 3000 },
      ],
      spending: [
        { amount: 6000, categoryId: "food" },
        { amount: 20000, categoryId: "rent" },
        { amount: 4000, categoryId: "lunch" },
        { amount: 500, categoryId: "fun" },
      ],
    });

    expect(overrunFromPlan(plan)).toEqual({
      sources: [
        { categoryName: "Groceries", over: 1000 },
        { categoryName: null, over: 500 },
      ],
      total: 1500,
    });
  });

  it("is zero when everything outside can-cut is within plan", () => {
    const plan = buildPersonPlan({
      categories: CATEGORIES,
      lines: [{ categoryId: "food", inherited: false, kind: "essential", plannedAmount: 5000 }],
      spending: [{ amount: 4000, categoryId: "food" }],
    });

    expect(overrunFromPlan(plan)).toEqual({ sources: [], total: 0 });
  });
});

describe("overrunNote", () => {
  it("says what went over and where it came from", () => {
    expect(overrunNote({ sources: [{ categoryName: "Petrol", over: 1000 }], total: 1000 })).toBe(
      "Petrol went Rs 1,000.00 over, taken from your spending money.",
    );
  });

  it("lists several sources", () => {
    expect(
      overrunNote({
        sources: [
          { categoryName: "Petrol", over: 1000 },
          { categoryName: "Family Support", over: 5000 },
          { categoryName: null, over: 500 },
        ],
        total: 6500,
      }),
    ).toBe("Petrol went Rs 1,000.00 over, Family Support went Rs 5,000.00 over and Rs 500.00 went outside a budget, taken from your spending money.");
  });

  it("says nothing without an overrun", () => {
    expect(overrunNote({ sources: [], total: 0 })).toBeNull();
  });
});
```

In `src/modules/dashboard/lib/pacing.test.ts` (change 1 of 2), find:

```ts
import { describe, expect, it } from "vitest";

import { buildPacingSchedule, currentWeekPacing } from "./pacing";

describe("buildPacingSchedule", () => {
  it("creates one week per 7 days", () => {
```

Replace it with:

```ts
import { describe, expect, it } from "vitest";

import { buildPacingSchedule, currentWeekPacing, weekIndexOf, withOverrun } from "./pacing";

describe("buildPacingSchedule", () => {
  it("creates one week per 7 days", () => {
```

In `src/modules/dashboard/lib/pacing.test.ts` (change 2 of 2), find:

```ts
    expect(currentWeekPacing(schedule, 3, spentByDay).remaining).toBe(0);
  });
});
```

Replace it with:

```ts
    expect(currentWeekPacing(schedule, 3, spentByDay).remaining).toBe(0);
  });
});

describe("weekIndexOf", () => {
  const schedule = buildPacingSchedule({ daysInPeriod: 30, flexibleTotal: 4000 });

  it("finds the week a day falls in", () => {
    expect(weekIndexOf(schedule, 1)).toBe(0);
    expect(weekIndexOf(schedule, 15)).toBe(2);
    expect(weekIndexOf(schedule, 30)).toBe(4);
  });

  it("uses the last week for a day past the end", () => {
    expect(weekIndexOf(schedule, 31)).toBe(4);
  });
});

describe("withOverrun", () => {
  const schedule = buildPacingSchedule({ daysInPeriod: 30, flexibleTotal: 7500 });
  const sum = (from: number, s = schedule) => s.weeks.filter((w) => w.index >= from).reduce((t, w) => t + w.allowance, 0);

  it("takes the overrun out of this week and the weeks after it", () => {
    const cut = withOverrun(schedule, 2, 1000);

    expect(Math.abs(sum(2, cut) - (sum(2) - 1000))).toBeLessThanOrEqual(2);
  });

  it("leaves earlier weeks as they were", () => {
    const cut = withOverrun(schedule, 2, 1000);

    expect(cut.weeks.slice(0, 2)).toEqual(schedule.weeks.slice(0, 2));
  });

  it("spreads the cut so no single week is wiped out", () => {
    const cut = withOverrun(schedule, 2, 1000);

    for (const week of cut.weeks.slice(2)) expect(week.allowance).toBeGreaterThan(0);
  });

  it("never goes below zero", () => {
    const cut = withOverrun(schedule, 3, 99999);

    expect(cut.weeks.slice(3).every((w) => w.allowance === 0)).toBe(true);
  });

  it("changes nothing without an overrun", () => {
    expect(withOverrun(schedule, 1, 0)).toBe(schedule);
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run:

```bash
npx vitest run src/modules/budget/lib/budget-view.test.ts src/modules/dashboard/lib/pacing.test.ts
```

Expected: FAIL. The run fails to import `overrunFromPlan`, `overrunNote`, `weekIndexOf` and `withOverrun`.

- [ ] **Step 3: Write the code**

In `src/modules/budget/lib/budget-view.ts`, find:

```ts
    .filter((row) => row.spent > row.planned)
    .map((row) => ({ categoryName: row.categoryName, over: row.spent - row.planned }));
}
```

Replace it with:

```ts
    .filter((row) => row.spent > row.planned)
    .map((row) => ({ categoryName: row.categoryName, over: row.spent - row.planned }));
}

// What went over plan outside the can-cut lines: another line spent past its
// amount (categoryName set), or spending in categories with no line at all
// (categoryName null). It comes out of the can-cut money that's left.
export type Overrun = { sources: { categoryName: null | string; over: number }[]; total: number };

export function overrunFromPlan(plan: PersonPlan): Overrun {
  const sources: Overrun["sources"] = plan.groups
    .filter((group) => group.kind !== "can_cut")
    .flatMap((group) => group.rows)
    .filter((row) => row.spent > row.planned)
    .map((row) => ({ categoryName: row.categoryName, over: row.spent - row.planned }));
  if (plan.unbudgetedTotal > 0) sources.push({ categoryName: null, over: plan.unbudgetedTotal });
  return { sources, total: sum(sources.map((s) => s.over)) };
}

// "Petrol went Rs 1,000.00 over and Rs 500.00 went outside a budget, taken
// from your spending money."
export function overrunNote(overrun: Overrun): null | string {
  if (overrun.total <= 0) return null;
  const parts = overrun.sources.map((s) =>
    s.categoryName === null ? `${formatMoney(s.over)} went outside a budget` : `${s.categoryName} went ${formatMoney(s.over)} over`,
  );
  const joined = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `${joined}, taken from your spending money.`;
}
```

In `src/modules/dashboard/lib/pacing.ts`, find:

```ts
  }
  return total;
}
```

Replace it with:

```ts
  }
  return total;
}

// The index of the week a day falls in (the last week for a day past the end).
export function weekIndexOf(schedule: PacingSchedule, dayOfPeriod: number): number {
  const week = schedule.weeks.find((w) => dayOfPeriod >= w.startDay && dayOfPeriod <= w.endDay) ?? schedule.weeks[schedule.weeks.length - 1];
  return week.index;
}

// Money gone over elsewhere in the plan comes out of what's left of the
// allowance: the weeks from `fromIndex` on shrink in proportion (never below
// zero), so one week isn't wiped out, and earlier weeks stay as they were.
export function withOverrun(schedule: PacingSchedule, fromIndex: number, overrun: number): PacingSchedule {
  if (overrun <= 0) return schedule;
  const remaining = schedule.weeks.filter((w) => w.index >= fromIndex).reduce((s, w) => s + w.allowance, 0);
  const factor = remaining > 0 ? Math.max(0, remaining - overrun) / remaining : 0;
  return {
    ...schedule,
    weeks: schedule.weeks.map((w) => (w.index >= fromIndex ? { ...w, allowance: Math.round(w.allowance * factor) } : w)),
  };
}
```

- [ ] **Step 4: Run the tests again**

Run:

```bash
npx vitest run src/modules/budget/lib/budget-view.test.ts src/modules/dashboard/lib/pacing.test.ts
```

Expected: PASS, 34 tests.

- [ ] **Step 5: Check types, all unit tests and lint**

Run:

```bash
npx tsc --noEmit
npm test
npm run lint -- --fix
npm run lint
```

Expected: `tsc` prints nothing; every unit test passes; lint shows 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/modules/budget/lib/budget-view.test.ts src/modules/budget/lib/budget-view.ts src/modules/dashboard/lib/pacing.test.ts src/modules/dashboard/lib/pacing.ts
git commit -m "feat(home): overruns and spreading them over the weeks left"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.


### Task 3.2: Home follows the person viewing it

Home's top figures, hero and essentials become the viewer's own. Safe to spend runs over their can-cut lines, only can-cut spending moves it day by day, and any overrun is taken off the weeks left. "By person" stays as it is.

**Files:**
- Modify: `src/modules/dashboard/lib/cash-flow.test.ts`
- Modify: `src/modules/dashboard/lib/cash-flow.ts`
- Modify: `src/modules/dashboard/pages/DashboardPage.tsx`
- Modify: `src/modules/dashboard/components/HomeView.tsx`
- Modify: `src/modules/dashboard/lib/map-rows.ts`
- Delete: `src/modules/budget/lib/calculations.ts`
- Delete: `src/modules/budget/lib/calculations.test.ts`
- Modify: `e2e/dashboard.spec.ts`

**Interfaces:**
- Consumes: `buildPersonPlan` (Task 1.7), `overrunFromPlan`, `overrunNote`, `weekIndexOf`, `withOverrun` (Task 3.1), `walletShares` (Task 1.3), `monthIncome` (Task 2.2).
- Changes: `allowanceSpentByDay` becomes `spentByDayIn(rows, categoryIds, year, month, dateFormat)` (counts only the given categories). `HomeView`'s `ledger` swaps `income`/`incomeTrendPct`/`spentPctOfIncome` for `pay`/`payNote`/`spentPctOfPay`; `HomePacing` gains `overrunNote`; `HomeView` gains `essentials`. Removes `src/modules/budget/lib/calculations.ts` (and its test), now unused.

- [ ] **Step 1: Count spending by day in given categories only**

In `src/modules/dashboard/lib/cash-flow.test.ts` (change 1 of 3), find:

```ts

import { resolvePeriod } from "@/lib/month-period";

import { allowanceSpentByDay, daysLeftInMonth } from "./cash-flow";

describe("daysLeftInMonth", () => {
  it("returns the full day count for a month that isn't the current one", () => {
```

Replace it with:

```ts

import { resolvePeriod } from "@/lib/month-period";

import { daysLeftInMonth, spentByDayIn } from "./cash-flow";

describe("daysLeftInMonth", () => {
  it("returns the full day count for a month that isn't the current one", () => {
```

In `src/modules/dashboard/lib/cash-flow.test.ts` (change 2 of 3), find:

```ts
  });
});

describe("allowanceSpentByDay", () => {
  const fixedCategoryIds = new Set(["rent"]);

  it("adds up non-fixed expenses by day and leaves fixed ones out", () => {
    const spent = allowanceSpentByDay(
      [
        { amount: "200", categoryId: "groceries", date: "2026-02-03" },
        { amount: "150.50", categoryId: "petrol", date: "2026-02-03" },
        { amount: "25000", categoryId: "rent", date: "2026-02-02" },
      ],
      fixedCategoryIds,
      2026,
      2,
      "english",
    );

    expect(spent).toHaveLength(28); // Feb 2026 is not a leap year
    expect(spent[1]).toBe(0); // rent on day 2 is a fixed bill, so it doesn't count
    expect(spent[2]).toBe(350.5);
    expect(spent.reduce((sum, value) => sum + value, 0)).toBe(350.5);
  });

  it("still counts an expense whose category isn't known to be fixed", () => {
    const spent = allowanceSpentByDay(
      [{ amount: "500", categoryId: "archived-category", date: "2026-02-10" }],
      fixedCategoryIds,
      2026,
      2,
      "english",
    );

    expect(spent[9]).toBe(500);
  });

  it("ignores expenses outside the month", () => {
    const spent = allowanceSpentByDay(
      [
        { amount: "1000", categoryId: "groceries", date: "2026-01-31" },
        { amount: "1000", categoryId: "groceries", date: "2026-03-01" },
      ],
      fixedCategoryIds,
      2026,
      2,
      "english",
```

Replace it with:

```ts
  });
});

describe("spentByDayIn", () => {
  const canCut = new Set(["lunch", "shopping"]);

  it("adds up spending in the given categories by day and leaves the rest out", () => {
    const spent = spentByDayIn(
      [
        { amount: "200", categoryId: "lunch", date: "2026-02-03" },
        { amount: 150.5, categoryId: "shopping", date: "2026-02-03" },
        { amount: "25000", categoryId: "rent", date: "2026-02-02" },
        { amount: "3000", categoryId: "petrol", date: "2026-02-03" },
      ],
      canCut,
      2026,
      2,
      "english",
    );

    expect(spent).toHaveLength(28); // Feb 2026 is not a leap year
    expect(spent[1]).toBe(0); // rent isn't a can-cut category
    expect(spent[2]).toBe(350.5);
    expect(spent.reduce((sum, value) => sum + value, 0)).toBe(350.5);
  });

  it("ignores expenses outside the month", () => {
    const spent = spentByDayIn(
      [
        { amount: "1000", categoryId: "lunch", date: "2026-01-31" },
        { amount: "1000", categoryId: "lunch", date: "2026-03-01" },
      ],
      canCut,
      2026,
      2,
      "english",
```

In `src/modules/dashboard/lib/cash-flow.test.ts` (change 3 of 3), find:

```ts

  it("uses the Nepali month's own days when the household uses BS dates", () => {
    const period = resolvePeriod(2083, 6, "nepali");
    const spent = allowanceSpentByDay(
      [
        { amount: "100", categoryId: "groceries", date: period.startDate },
        { amount: "300", categoryId: "groceries", date: period.endDate },
      ],
      fixedCategoryIds,
      2083,
      6,
      "nepali",
```

Replace it with:

```ts

  it("uses the Nepali month's own days when the household uses BS dates", () => {
    const period = resolvePeriod(2083, 6, "nepali");
    const spent = spentByDayIn(
      [
        { amount: "100", categoryId: "lunch", date: period.startDate },
        { amount: "300", categoryId: "lunch", date: period.endDate },
      ],
      canCut,
      2083,
      6,
      "nepali",
```

In `src/modules/dashboard/lib/cash-flow.ts` (change 1 of 2), find:

```ts
  return Math.max(0, period.daysInPeriod - daysElapsedInPeriod(period) + 1);
}

export type AllowanceExpenseRow = { amount: string; categoryId: string; date: string };

// Spending that counts against the weekly allowance, per day of the period
// (index 0 = day 1). Fixed-category expenses (rent, EMI, bills) are left out:
// the allowance is built from the flexible budget only, and fixed bills have
// their own budget lines. An expense whose category isn't in
// `fixedCategoryIds` (including an archived or unknown one) still counts.
export function allowanceSpentByDay(
  expenseRows: AllowanceExpenseRow[],
  fixedCategoryIds: ReadonlySet<string>,
  year: number,
  month: number,
  dateFormat: DateFormat,
```

Replace it with:

```ts
  return Math.max(0, period.daysInPeriod - daysElapsedInPeriod(period) + 1);
}

export type AllowanceExpenseRow = { amount: number | string; categoryId: string; date: string };

// Spending in the given categories, per day of the period (index 0 = day 1).
// The weekly allowance is built from a person's can-cut lines, so only
// spending in those categories counts against it day by day; everything else
// that goes over plan is taken off the allowance as a whole instead.
export function spentByDayIn(
  expenseRows: AllowanceExpenseRow[],
  categoryIds: ReadonlySet<string>,
  year: number,
  month: number,
  dateFormat: DateFormat,
```

In `src/modules/dashboard/lib/cash-flow.ts` (change 2 of 2), find:

```ts
  const period = resolvePeriod(year, month, dateFormat);
  const spent = new Array<number>(period.daysInPeriod).fill(0);
  for (const expense of expenseRows) {
    if (fixedCategoryIds.has(expense.categoryId)) continue;
    const day = dayNumberInPeriod(expense.date, year, month, dateFormat);
    if (day !== null) spent[day - 1] += Number(expense.amount);
  }
```

Replace it with:

```ts
  const period = resolvePeriod(year, month, dateFormat);
  const spent = new Array<number>(period.daysInPeriod).fill(0);
  for (const expense of expenseRows) {
    if (!categoryIds.has(expense.categoryId)) continue;
    const day = dayNumberInPeriod(expense.date, year, month, dateFormat);
    if (day !== null) spent[day - 1] += Number(expense.amount);
  }
```

- [ ] **Step 2: Home's data follows the viewer**

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 1 of 8), find:

```tsx
import { formatShortDate } from "@/lib/date-format";
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { buildMonthNav, parseMonthParam, previousMonth } from "@/lib/month-nav";
import {
  currentPeriodYearMonth,
```

Replace it with:

```tsx
import { formatShortDate } from "@/lib/date-format";
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { formatMoney } from "@/lib/money";
import { buildMonthNav, parseMonthParam, previousMonth } from "@/lib/month-nav";
import {
  currentPeriodYearMonth,
```

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 2 of 8), find:

```tsx
import { getEffectiveMember, getHouseholdMembers } from "@/lib/session";
import { todayISO } from "@/lib/today";
import { listIncomeRows, listPlanLines } from "@/modules/budget/api/budget";
import { dashboardSummary } from "@/modules/budget/lib/calculations";
import { monthIncome } from "@/modules/budget/lib/income";
import { kindOf } from "@/modules/budget/lib/plan-lines";
import { listCategories } from "@/modules/categories/api/categories";
import {
  type HomeBalanceRow,
  type HomeOwnerRow,
  type HomePacing,
  type HomeRecentGroup,
  type HomeSavingsPot,
  HomeView,
} from "@/modules/dashboard/components/HomeView";
import { allowanceSpentByDay, daysLeftInMonth } from "@/modules/dashboard/lib/cash-flow";
import { toExpenseInputs } from "@/modules/dashboard/lib/map-rows";
import { movedThisMonth } from "@/modules/dashboard/lib/moved";
import { buildPacingSchedule, currentWeekPacing } from "@/modules/dashboard/lib/pacing";
import { walletSpentByMember } from "@/modules/dashboard/lib/wallet";
import { listDhukuEntries, listDhukus } from "@/modules/dhuku/api/dhuku.actions";
import { dhukuPosition } from "@/modules/dhuku/lib/dhuku-money";
import { listExpensesForMonth, listRecentExpenses } from "@/modules/expenses/api/expenses.actions";
```

Replace it with:

```tsx
import { getEffectiveMember, getHouseholdMembers } from "@/lib/session";
import { todayISO } from "@/lib/today";
import { listIncomeRows, listPlanLines } from "@/modules/budget/api/budget";
import { buildPersonPlan, overrunFromPlan, overrunNote } from "@/modules/budget/lib/budget-view";
import { monthIncome } from "@/modules/budget/lib/income";
import { listCategories } from "@/modules/categories/api/categories";
import {
  type HomeBalanceRow,
  type HomeEssential,
  type HomeOwnerRow,
  type HomePacing,
  type HomeRecentGroup,
  type HomeSavingsPot,
  HomeView,
} from "@/modules/dashboard/components/HomeView";
import { daysLeftInMonth, spentByDayIn } from "@/modules/dashboard/lib/cash-flow";
import { toExpenseInputs } from "@/modules/dashboard/lib/map-rows";
import { movedThisMonth } from "@/modules/dashboard/lib/moved";
import { buildPacingSchedule, currentWeekPacing, weekIndexOf, withOverrun } from "@/modules/dashboard/lib/pacing";
import { walletShares, walletSpentByMember } from "@/modules/dashboard/lib/wallet";
import { listDhukuEntries, listDhukus } from "@/modules/dhuku/api/dhuku.actions";
import { dhukuPosition } from "@/modules/dhuku/lib/dhuku-money";
import { listExpensesForMonth, listRecentExpenses } from "@/modules/expenses/api/expenses.actions";
```

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 3 of 8), find:

```tsx

  // Expenses paid from a savings pot came out of money set aside over many
  // months, not this month's pay. Spent, Left and the weekly allowance leave
  // them out; Home shows them on their own.
  const payExpenseRows = expenseRows.filter((e) => e.savingsPotId === null);
  const paidFromSavings = expenseRows.filter((e) => e.savingsPotId !== null).reduce((s, e) => s + Number(e.amount), 0);

  // Pay carries forward from earlier months; extra income counts in its own month.
  const incomes = members.map((m) => ({ amount: monthIncome(incomeRows, m.id, { month, year }).total, memberId: m.id }));
  const expenses = toExpenseInputs(payExpenseRows);
  const summary = dashboardSummary(incomes, expenses);

  const prevIncomes = members.map((m) => ({ amount: monthIncome(incomeRows, m.id, prev).total, memberId: m.id }));
  const prevExpensesList = toExpenseInputs(prevExpenseRows.filter((e) => e.savingsPotId === null));
  const prevSummary = dashboardSummary(prevIncomes, prevExpensesList);

  const category = (id: string) => categories.find((c) => c.id === id);
  const memberName = (id: string) => members.find((m) => m.id === id)?.user.name ?? "Member";
```

Replace it with:

```tsx

  // Expenses paid from a savings pot came out of money set aside over many
  // months, not this month's pay. Spent, Left and the weekly allowance leave
  // them out; Home shows the viewer's on their own.
  const payExpenseRows = expenseRows.filter((e) => e.savingsPotId === null);
  const paidFromSavings = expenseRows
    .filter((e) => e.savingsPotId !== null && e.paidByMemberId === memberId)
    .reduce((s, e) => s + Number(e.amount), 0);

  // Pay carries forward from earlier months; extra income counts in its own month.
  const incomes = members.map((m) => ({ amount: monthIncome(incomeRows, m.id, { month, year }).total, memberId: m.id }));
  const expenses = toExpenseInputs(payExpenseRows);
  const prevIncomes = members.map((m) => ({ amount: monthIncome(incomeRows, m.id, prev).total, memberId: m.id }));

  const category = (id: string) => categories.find((c) => c.id === id);
  const memberName = (id: string) => members.find((m) => m.id === id)?.user.name ?? "Member";
```

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 4 of 8), find:

```tsx
    },
  ];

  // Weekly pacing over the flexible part of the budget (fixed commitments are
  // already spoken for): the hero's safe-to-spend figure and its carry-over.
  // Fixed-category expenses don't count against it, for the same reason.
  const period = resolvePeriod(year, month, dateFormat);
  const flexiblePlanned = planLines
    .filter((l) => kindOf(l.kind, category(l.categoryId)?.budgetType) !== "fixed")
    .reduce((s, l) => s + l.plannedAmount, 0);
  const pacingSchedule =
    flexiblePlanned > 0 ? buildPacingSchedule({ daysInPeriod: period.daysInPeriod, flexibleTotal: flexiblePlanned }) : null;
  const dayOfPeriod = isCurrentMonth ? daysElapsedInPeriod(period) : period.daysInPeriod;
  const fixedCategoryIds = new Set(categories.filter((c) => c.budgetType === "fixed").map((c) => c.id));
  const spentByDay = allowanceSpentByDay(payExpenseRows, fixedCategoryIds, year, month, dateFormat);
  const weekPacing = pacingSchedule ? currentWeekPacing(pacingSchedule, dayOfPeriod, spentByDay) : null;
  const pacing: HomePacing | null = weekPacing
    ? {
        carryIn: weekPacing.carryIn,
        nextWeekAllowance: pacingSchedule!.weeks[weekPacing.index + 1]?.allowance ?? weekPacing.allowance,
        nextWeekday: weekdayOf(period.startDate, weekPacing.nextWeekStartDay),
        over: weekPacing.remaining <= 0,
        safeToday: weekPacing.safeToday,
        weekLeft: weekPacing.remaining,
        weeklyAllowance: weekPacing.allowance,
      }
    : null;

  // The "pay back later" balance between the two members, across all months.
  const payback = partner
```

Replace it with:

```tsx
    },
  ];

  // Home's figures and hero follow the person viewing it: their Spent is what
  // left their own wallet, and their plan is their own lines.
  const period = resolvePeriod(year, month, dateFormat);
  const memberIds = members.map((m) => m.id);
  const viewerShares = (rows: typeof expenseRows) =>
    rows
      .filter((e) => e.savingsPotId === null)
      .flatMap((e) =>
        walletShares(
          { amount: Number(e.amount), paidByMemberId: e.paidByMemberId, payBackAmount: e.payBackAmount === null ? null : Number(e.payBackAmount) },
          memberIds,
        ).flatMap((share) => (share.memberId === memberId ? [{ amount: share.amount, categoryId: e.categoryId, date: e.date }] : [])),
      );
  const viewerSpending = viewerShares(expenseRows);
  const viewerSpent = viewerSpending.reduce((s, e) => s + e.amount, 0);
  const viewerPrevSpent = viewerShares(prevExpenseRows).reduce((s, e) => s + e.amount, 0);
  const viewerIncome = monthIncome(incomeRows, memberId, { month, year });
  const payCarriedFrom = viewerIncome.payCarriedFrom
    ? formatPeriodLabel(viewerIncome.payCarriedFrom.year, viewerIncome.payCarriedFrom.month, dateFormat)
    : null;
  const viewerPlan = buildPersonPlan({
    categories: categories.map((c) => ({ budgetType: c.budgetType, id: c.id, name: c.name })),
    lines: planLines.filter((l) => l.ownerMemberId === memberId),
    spending: viewerSpending,
  });

  // Weekly pacing over the can-cut lines: the hero's safe-to-spend figure and
  // its carry-over. Only can-cut spending counts against it, and whatever went
  // over elsewhere comes out of what's left, from this week on.
  const canCut = viewerPlan.groups.find((g) => g.kind === "can_cut");
  const canCutIds = new Set(canCut?.rows.map((r) => r.categoryId) ?? []);
  const overrun = overrunFromPlan(viewerPlan);
  const dayOfPeriod = isCurrentMonth ? daysElapsedInPeriod(period) : period.daysInPeriod;
  const baseSchedule = canCut ? buildPacingSchedule({ daysInPeriod: period.daysInPeriod, flexibleTotal: canCut.planned }) : null;
  const pacingSchedule = baseSchedule ? withOverrun(baseSchedule, weekIndexOf(baseSchedule, dayOfPeriod), overrun.total) : null;
  const spentByDay = spentByDayIn(viewerSpending, canCutIds, year, month, dateFormat);
  const weekPacing = pacingSchedule ? currentWeekPacing(pacingSchedule, dayOfPeriod, spentByDay) : null;
  const pacing: HomePacing | null =
    pacingSchedule && weekPacing
      ? {
          carryIn: weekPacing.carryIn,
          nextWeekAllowance: pacingSchedule.weeks[weekPacing.index + 1]?.allowance ?? weekPacing.allowance,
          nextWeekday: weekdayOf(period.startDate, weekPacing.nextWeekStartDay),
          over: weekPacing.remaining <= 0,
          overrunNote: overrunNote(overrun),
          safeToday: weekPacing.safeToday,
          weekLeft: weekPacing.remaining,
          weeklyAllowance: weekPacing.allowance,
        }
      : null;
  const essentials: HomeEssential[] =
    viewerPlan.groups
      .find((g) => g.kind === "essential")
      ?.rows.map((r) => ({ categoryName: r.categoryName, planned: r.planned, spent: r.spent })) ?? [];

  // The "pay back later" balance between the two members, across all months.
  const payback = partner
```

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 5 of 8), find:

```tsx
      reserveFull: balance >= reserveMinimum,
    };
  });
  // Money moved into your own piles this month. Unallocated takes it off too,
  // since it's no longer free to spend.
  const moved = movedThisMonth({
    deposits,
    dhukuEntries: dhukuEntryRows.map((e) => ({ amount: Number(e.amount), date: e.date, type: e.type })),
    endDate: period.endDate,
    loanPayments: loanPaymentRows.flatMap((p) => {
      const loan = loanRows.find((l) => l.id === p.loanId);
      return loan ? [{ amount: Number(p.amount), date: p.date, direction: loan.direction }] : [];
    }),
    startDate: period.startDate,
  });
  const unallocated = summary.combinedIncome - summary.totalExpenses - moved.total;

  // Balances: where each pile stands, apart from this month's spending.
  // Positive = yours, or owed to you; negative = you owe it.
```

Replace it with:

```tsx
      reserveFull: balance >= reserveMinimum,
    };
  });
  // Money the viewer moved into their own piles this month: their savings
  // deposits, their dhukus' payments and their repayments on loans they took.
  // Unallocated takes it off too, since it's no longer free to spend.
  const viewerDhukuIds = new Set(dhukuRows.filter((d) => d.ownerMemberId === memberId).map((d) => d.id));
  const moved = movedThisMonth({
    deposits: deposits.filter((d) => d.memberId === memberId),
    dhukuEntries: dhukuEntryRows
      .filter((e) => viewerDhukuIds.has(e.dhukuId))
      .map((e) => ({ amount: Number(e.amount), date: e.date, type: e.type })),
    endDate: period.endDate,
    loanPayments: loanPaymentRows.flatMap((p) => {
      const loan = loanRows.find((l) => l.id === p.loanId);
      return loan && p.memberId === memberId ? [{ amount: Number(p.amount), date: p.date, direction: loan.direction }] : [];
    }),
    startDate: period.startDate,
  });
  const unallocated = viewerIncome.pay + viewerIncome.extra - viewerSpent - moved.total;

  // Balances: where each pile stands, apart from this month's spending.
  // Positive = yours, or owed to you; negative = you owe it.
```

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 6 of 8), find:

```tsx
  }));

  const monthLabel = formatPeriodLabel(year, month, dateFormat);
  const viewerIncome = monthIncome(incomeRows, memberId, { month, year });

  return (
    <HomeView
```

Replace it with:

```tsx
  }));

  const monthLabel = formatPeriodLabel(year, month, dateFormat);

  return (
    <HomeView
```

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 7 of 8), find:

```tsx
      currentMemberId={memberId}
      daysLeft={daysLeftInMonth(year, month, dateFormat)}

      ledger={{
        income: summary.combinedIncome,
        incomeTrendPct: trendPct(summary.combinedIncome, prevSummary.combinedIncome),
        moved,
        paidFromSavings,
        spent: summary.totalExpenses,
        spentMeterRatio: summary.combinedIncome > 0 ? summary.totalExpenses / summary.combinedIncome : 0,
        spentPctOfIncome: percent(summary.totalExpenses, summary.combinedIncome),
        spentTrendPct: trendPct(summary.totalExpenses, prevSummary.totalExpenses),
        unallocated,
      }}
      members={members.map((m) => ({ id: m.id, name: m.user.name }))}
```

Replace it with:

```tsx
      currentMemberId={memberId}
      daysLeft={daysLeftInMonth(year, month, dateFormat)}

      essentials={essentials}
      ledger={{
        moved,
        paidFromSavings,
        pay: viewerIncome.pay,
        payNote: viewerIncome.extra > 0 ? `+ ${formatMoney(viewerIncome.extra)} extra` : payCarriedFrom ? `Carried over from ${payCarriedFrom}` : null,
        spent: viewerSpent,
        spentMeterRatio: viewerIncome.pay > 0 ? viewerSpent / viewerIncome.pay : 0,
        spentPctOfPay: percent(viewerSpent, viewerIncome.pay),
        spentTrendPct: trendPct(viewerSpent, viewerPrevSpent),
        unallocated,
      }}
      members={members.map((m) => ({ id: m.id, name: m.user.name }))}
```

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 8 of 8), find:

```tsx
      pacing={pacing}
      pay={{
        amount: viewerIncome.pay,
        carriedFrom: viewerIncome.payCarriedFrom ? formatPeriodLabel(viewerIncome.payCarriedFrom.year, viewerIncome.payCarriedFrom.month, dateFormat) : null,
        extras: viewerIncome.extras,
      }}
      payback={payback}
```

Replace it with:

```tsx
      pacing={pacing}
      pay={{
        amount: viewerIncome.pay,
        carriedFrom: payCarriedFrom,
        extras: viewerIncome.extras,
      }}
      payback={payback}
```

- [ ] **Step 3: Home's view: Pay, the overrun note and Essentials**

In `src/modules/dashboard/components/HomeView.tsx` (change 1 of 9), find:

```tsx

export type HomeBalanceRow = { amount: number; id: string; label: string; sub: string };

export type HomePacing = {
  carryIn: number;
  nextWeekAllowance: number;
  nextWeekday: null | string;
  over: boolean;
  safeToday: number;
  weekLeft: number;
  weeklyAllowance: number;
```

Replace it with:

```tsx

export type HomeBalanceRow = { amount: number; id: string; label: string; sub: string };

export type HomeEssential = { categoryName: string; planned: number; spent: number };

export type HomePacing = {
  carryIn: number;
  nextWeekAllowance: number;
  nextWeekday: null | string;
  over: boolean;
  // Set when another line went over (or money went outside a budget) and was
  // taken from the can-cut money.
  overrunNote: null | string;
  safeToday: number;
  weekLeft: number;
  weeklyAllowance: number;
```

In `src/modules/dashboard/components/HomeView.tsx` (change 2 of 9), find:

```tsx
  balances: HomeBalanceRow[];
  currentMemberId: string;
  daysLeft: number;
  ledger: {
    income: number;
    incomeTrendPct: null | number;
    moved: { dhuku: number; loans: number; savings: number; total: number };
    paidFromSavings: number;
    spent: number;
    spentMeterRatio: number;
    spentPctOfIncome: null | number;
    spentTrendPct: null | number;
    unallocated: number;
  };
```

Replace it with:

```tsx
  balances: HomeBalanceRow[];
  currentMemberId: string;
  daysLeft: number;
  // The essential lines of the person viewing Home.
  essentials: HomeEssential[];
  // The figures of the person viewing Home.
  ledger: {
    moved: { dhuku: number; loans: number; savings: number; total: number };
    paidFromSavings: number;
    pay: number;
    payNote: null | string;
    spent: number;
    spentMeterRatio: number;
    spentPctOfPay: null | number;
    spentTrendPct: null | number;
    unallocated: number;
  };
```

In `src/modules/dashboard/components/HomeView.tsx` (change 3 of 9), find:

```tsx
  }

  const spentTrend = trendText(ledger.spentTrendPct, props.prevMonthName);
  const incomeTrend = trendText(ledger.incomeTrendPct, props.prevMonthName);

  return (
    <div>
```

Replace it with:

```tsx
  }

  const spentTrend = trendText(ledger.spentTrendPct, props.prevMonthName);

  return (
    <div>
```

In `src/modules/dashboard/components/HomeView.tsx` (change 4 of 9), find:

```tsx
              <p className="max-w-[46ch] text-[15px] leading-normal text-n-800 text-pretty">
                {pacing.over
                  ? `This week's allowance is fully spent. A new weekly allowance of ${formatMoney(pacing.nextWeekAllowance)} starts on ${pacing.nextWeekday ?? "the next week"}.`
                  : "Spend up to this today and the week stays on plan. Anything you don't use carries into tomorrow."}
              </p>
              <button
                className="-ml-1.5 inline-flex items-center gap-1.5 self-start px-1.5 py-1 text-[13px] text-n-700 hover:bg-ink/6 hover:text-ink"
                onClick={() => setExplain((value) => !value)}
```

Replace it with:

```tsx
              <p className="max-w-[46ch] text-[15px] leading-normal text-n-800 text-pretty">
                {pacing.over
                  ? `This week's allowance is fully spent. A new weekly allowance of ${formatMoney(pacing.nextWeekAllowance)} starts on ${pacing.nextWeekday ?? "the next week"}.`
                  : "Spend up to this today on things you can cut and the week stays on plan. Anything you don't use carries into tomorrow."}
              </p>
              {pacing.overrunNote && <p className="max-w-[52ch] text-[13px] leading-normal text-signal-ink text-pretty">{pacing.overrunNote}</p>}
              <button
                className="-ml-1.5 inline-flex items-center gap-1.5 self-start px-1.5 py-1 text-[13px] text-n-700 hover:bg-ink/6 hover:text-ink"
                onClick={() => setExplain((value) => !value)}
```

In `src/modules/dashboard/components/HomeView.tsx` (change 5 of 9), find:

```tsx
              {explain && (
                <p className="max-w-[52ch] text-[13px] leading-[1.55] text-n-700 text-pretty">
                  {
                    "Your monthly plan is split into weekly allowances. Safe to spend is what's left of this week's allowance, divided by the days remaining in the week. Money you don't spend becomes next week's buffer."
                  }
                </p>
              )}
```

Replace it with:

```tsx
              {explain && (
                <p className="max-w-[52ch] text-[13px] leading-[1.55] text-n-700 text-pretty">
                  {
                    "Your can-cut lines (things like lunches out, shopping and dates) are split into weekly allowances. Safe to spend is what's left of this week's allowance, divided by the days remaining in the week. Money you don't spend becomes next week's buffer. When another line goes over, or money goes outside a budget, the difference comes out of what's left for the rest of the month."
                  }
                </p>
              )}
```

In `src/modules/dashboard/components/HomeView.tsx` (change 6 of 9), find:

```tsx
                  <Link href="/budget">Go to Budget</Link>
                </Button>
              }
              body="Once you set a flexible budget, this page works out how much you can safely spend each day of the week."
              title="No flexible budget yet"
            />
          )}
        </div>
```

Replace it with:

```tsx
                  <Link href="/budget">Go to Budget</Link>
                </Button>
              }
              body="Mark lines like lunch, shopping or dates as Can cut on Budget, and this works out how much you can safely spend on them each day."
              title="No can-cut budget yet"
            />
          )}
        </div>
```

In `src/modules/dashboard/components/HomeView.tsx` (change 7 of 9), find:

```tsx

      <Ledger className="mt-9">
        <LedgerCell
          bar={<Meter label={`Spent ${ledger.spentPctOfIncome ?? 0}% of income`} ratio={ledger.spentMeterRatio} />}
          label={`Spent in ${props.spentMonthName}`}
          lead
          note={
            <>
              {ledger.spentPctOfIncome !== null && (
                <span className={ledger.spentPctOfIncome > 100 ? "text-signal-ink" : undefined}>
                  {ledger.spentPctOfIncome}% of income
                </span>
              )}
              {spentTrend && <span>{spentTrend}</span>}
              {ledger.paidFromSavings > 0 && <span>{formatMoney(ledger.paidFromSavings)} paid from savings</span>}
```

Replace it with:

```tsx

      <Ledger className="mt-9">
        <LedgerCell
          bar={<Meter label={`Spent ${ledger.spentPctOfPay ?? 0}% of pay`} ratio={ledger.spentMeterRatio} />}
          label={`Spent in ${props.spentMonthName}`}
          lead
          note={
            <>
              {ledger.spentPctOfPay !== null && (
                <span className={ledger.spentPctOfPay > 100 ? "text-signal-ink" : undefined}>{ledger.spentPctOfPay}% of pay</span>
              )}
              {spentTrend && <span>{spentTrend}</span>}
              {ledger.paidFromSavings > 0 && <span>{formatMoney(ledger.paidFromSavings)} paid from savings</span>}
```

In `src/modules/dashboard/components/HomeView.tsx` (change 8 of 9), find:

```tsx
        >
          <Money size="lead" value={ledger.spent} />
        </LedgerCell>
        <LedgerCell label="Income" note={incomeTrend} onSelect={() => setIncomeOpen(true)}>
          <Money size="cell" value={ledger.income} />
        </LedgerCell>
        <LedgerCell
          label="Moved this month"
```

Replace it with:

```tsx
        >
          <Money size="lead" value={ledger.spent} />
        </LedgerCell>
        <LedgerCell label="Pay" note={ledger.payNote} onSelect={() => setIncomeOpen(true)}>
          <Money size="cell" value={ledger.pay} />
        </LedgerCell>
        <LedgerCell
          label="Moved this month"
```

In `src/modules/dashboard/components/HomeView.tsx` (change 9 of 9), find:

```tsx
        >
          <Money size="cell" value={ledger.moved.total} />
        </LedgerCell>
        <LedgerCell label="Unallocated" note={ledger.unallocated < 0 ? "Spent and moved more than income" : "Ready to assign"}>
          <Money size="cell" tone={ledger.unallocated < 0 ? "negative" : "default"} value={ledger.unallocated} />
        </LedgerCell>
      </Ledger>

      {props.members.length === 2 && (props.payback !== null || props.recentPaybacks.length > 0) && (
        <section className="mt-9 border-t border-n-300 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
```

Replace it with:

```tsx
        >
          <Money size="cell" value={ledger.moved.total} />
        </LedgerCell>
        <LedgerCell label="Unallocated" note={ledger.unallocated < 0 ? "Spent and moved more than pay and extra" : "Ready to assign"}>
          <Money size="cell" tone={ledger.unallocated < 0 ? "negative" : "default"} value={ledger.unallocated} />
        </LedgerCell>
      </Ledger>

      {props.essentials.length > 0 && (
        <section className="mt-9 max-w-160">
          <SectionHeading sub="Can't really be cut, so watch they stay within plan">Essentials</SectionHeading>
          {props.essentials.map((row) => {
            const over = row.spent - row.planned;
            return (
              <div className="flex items-baseline justify-between gap-4 border-b border-n-300 py-3" key={row.categoryName}>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[15px]">{row.categoryName}</span>
                  <span className="text-[13px] text-n-600">
                    {formatMoney(row.spent)} of {formatMoney(row.planned)}
                  </span>
                </span>
                <span className={cn("text-[13px] font-semibold", over > 0 ? "text-signal-ink" : "text-n-700")}>
                  {over > 0 ? `${formatMoney(over)} over` : `${formatMoney(-over)} left`}
                </span>
              </div>
            );
          })}
        </section>
      )}

      {props.members.length === 2 && (props.payback !== null || props.recentPaybacks.length > 0) && (
        <section className="mt-9 border-t border-n-300 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
```

- [ ] **Step 4: Remove helpers nothing uses any more**

Replace the whole of `src/modules/dashboard/lib/map-rows.ts` with:

```ts
// Pure row-shaping helper: reshapes raw expense rows (with numeric-as-string
// amounts) into plain numbers for the dashboard page.

export function toExpenseInputs(
  rows: { amount: string; categoryId: string; ownerMemberId: string | null; }[],
) {
  return rows.map((e) => ({
    categoryId: e.categoryId,
    ownerMemberId: e.ownerMemberId,
    amount: Number(e.amount),
  }));
}
```

Delete `src/modules/budget/lib/calculations.ts`:

```bash
git rm src/modules/budget/lib/calculations.ts
```

Delete `src/modules/budget/lib/calculations.test.ts`:

```bash
git rm src/modules/budget/lib/calculations.test.ts
```

- [ ] **Step 5: Test it in the browser**

In `e2e/dashboard.spec.ts`, find:

```ts
    await expect(page.getByText("Unallocated").first()).toBeVisible();
  });

  test("exposes previous/next month navigation", async ({ page }) => {
    await expect(page.getByLabel("Previous month")).toBeVisible();
    await expect(page.getByLabel("Next month")).toBeVisible();
```

Replace it with:

```ts
    await expect(page.getByText("Unallocated").first()).toBeVisible();
  });

  test("follows the viewer's own plan: essentials and what went over", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Essentials" })).toBeVisible();
    await expect(page.getByText("Pay", { exact: true })).toBeVisible();
    // The seed has spending outside any line, which comes out of the can-cut money.
    await expect(page.getByText(/taken from your spending money\.$/)).toBeVisible();
  });

  test("exposes previous/next month navigation", async ({ page }) => {
    await expect(page.getByLabel("Previous month")).toBeVisible();
    await expect(page.getByLabel("Next month")).toBeVisible();
```

- [ ] **Step 6: Check types, unit tests and lint**

Run:

```bash
npx tsc --noEmit
npx vitest run src/modules/dashboard/lib/cash-flow.test.ts
npm test
npm run lint -- --fix
npm run lint
```

Expected: `tsc` prints nothing; every unit test passes (the named ones: 5 tests); lint shows 0 errors.

- [ ] **Step 7: Run the browser tests for this task**

Run:

```bash
npx playwright test e2e/dashboard.spec.ts --reporter=line
```

Expected: all pass. This builds the app and resets its own test database first (1–3 minutes). If one fails with `ECONNRESET` or a timeout, re-run it alone (see Global Constraints) before treating it as a real failure.

- [ ] **Step 8: Commit**

```bash
git add src/modules/dashboard/lib/cash-flow.test.ts src/modules/dashboard/lib/cash-flow.ts src/modules/dashboard/pages/DashboardPage.tsx src/modules/dashboard/components/HomeView.tsx src/modules/dashboard/lib/map-rows.ts src/modules/budget/lib/calculations.ts src/modules/budget/lib/calculations.test.ts e2e/dashboard.spec.ts
git commit -m "feat(home): Home follows the person viewing it"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again. (The deleted file is already staged by `git rm`; `git add` on it is harmless.)


### Phase 3 checkpoint: STOP

Stop here. Do not start Phase 4.

Send the owner a short report:

- The task commits made in this phase (`git log --oneline` since the phase began).
- That this phase has no migration. The owner should check: Home shows their own Pay, Spent, Moved and Unallocated, and switching "viewing as" switches them; Safe to spend appears only once they have Can cut lines and only can-cut spending moves it; spending past an essential line or outside any line shows the "… taken from your spending money" note and lowers safe to spend; the Essentials list shows "x of y" and turns red when over.
- The results of `npx tsc --noEmit`, `npm test`, `npm run lint` and `npm run test:e2e` (say which e2e tests failed, if any, and whether they passed when re-run alone).
- Anything that didn't match the plan and what you did about it.

Then wait. The owner applies the migration (`npm run db:migrate`) on their database themselves, tries the app, and tells you whether to go on.

## Phase 4: Funds for occasional costs

Funds are named piles inside a person's everyday account for occasional costs. Each sets money aside every month (under "Set aside first"), can take money added by hand, and can pay for an expense up to its balance; the rest of that expense counts as normal spending.

### Task 4.1: Funds

Three new tables (funds, their monthly plans, money added by hand), two new expense columns (which fund paid and how much of it), and two new activity types, with their Activity wording.

**Files:**
- Create: `src/db/schema/funds.ts`
- Modify: `src/db/schema/index.ts`
- Modify: `src/db/schema/expenses.ts`
- Modify: `src/db/schema/activityLogs.ts`
- Modify: `src/modules/activity/lib/activity-format.ts`
- Modify: `src/modules/activity/lib/sections.ts`
- Generate: a new migration under `drizzle/` (with `npm run db:generate`)

- [ ] **Step 1: Change the schema**

Create `src/db/schema/funds.ts` with:

```ts
import { boolean, integer, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { householdMembers } from "./householdMembers";
import { households } from "./households";

// A named pile inside one person's everyday account for an occasional cost
// (a yearly bill, festivals, gifts, health). It only exists in Piko: the
// money stays in the account. Months are the household's own calendar months.
export const funds = pgTable("funds", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  ownerMemberId: uuid("owner_member_id")
    .notNull()
    .references(() => householdMembers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // Optional: how much is needed, and by which month.
  target: numeric("target", { precision: 12, scale: 2 }),
  dueYear: integer("due_year"),
  dueMonth: integer("due_month"),
  // The first month money is set aside.
  startYear: integer("start_year").notNull(),
  startMonth: integer("start_month").notNull(),
  // Archived funds stop setting money aside and drop out of the plan.
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// The monthly set-aside from a month on. Changing it adds a row from the month
// the change is made, so earlier months keep the amount they had.
export const fundPlans = pgTable(
  "fund_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fundId: uuid("fund_id")
      .notNull()
      .references(() => funds.id, { onDelete: "cascade" }),
    fromYear: integer("from_year").notNull(),
    fromMonth: integer("from_month").notNull(),
    monthlyAmount: numeric("monthly_amount", { precision: 12, scale: 2 }).notNull(),
  },
  (table) => [unique().on(table.fundId, table.fromYear, table.fromMonth)],
);

// Money added to a fund on top of the monthly set-aside, counted in the month
// it was added for.
export const fundTopUps = pgTable("fund_top_ups", {
  id: uuid("id").defaultRandom().primaryKey(),
  fundId: uuid("fund_id")
    .notNull()
    .references(() => funds.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

In `src/db/schema/index.ts`, find:

```ts
export * from "./expenses";
export * from "./paybacks";
export * from "./savings";
export * from "./notifications";
export * from "./loans";
export * from "./dhukus";
```

Replace it with:

```ts
export * from "./expenses";
export * from "./paybacks";
export * from "./savings";
export * from "./funds";
export * from "./notifications";
export * from "./loans";
export * from "./dhukus";
```

In `src/db/schema/expenses.ts` (change 1 of 2), find:

```ts
import { date, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { categories } from "./categories";
import { householdMembers } from "./householdMembers";
import { households } from "./households";
import { recurringExpenses } from "./recurringExpenses";
```

Replace it with:

```ts
import { date, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { categories } from "./categories";
import { funds } from "./funds";
import { householdMembers } from "./householdMembers";
import { households } from "./households";
import { recurringExpenses } from "./recurringExpenses";
```

In `src/db/schema/expenses.ts` (change 2 of 2), find:

```ts
  savingsPotId: uuid("savings_pot_id").references(() => savingsPots.id, { onDelete: "set null" }),
  // The priority-list item this expense paid for, if any.
  savingsItemId: uuid("savings_item_id").references(() => savingsItems.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

Replace it with:

```ts
  savingsPotId: uuid("savings_pot_id").references(() => savingsPots.id, { onDelete: "set null" }),
  // The priority-list item this expense paid for, if any.
  savingsItemId: uuid("savings_item_id").references(() => savingsItems.id, { onDelete: "set null" }),
  // Set when a fund paid for this expense. fundAmount is the part it paid (up
  // to its balance); the rest counts as the month's normal spending.
  fundId: uuid("fund_id").references(() => funds.id, { onDelete: "set null" }),
  fundAmount: numeric("fund_amount", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

In `src/db/schema/activityLogs.ts`, find:

```ts
  "dhuku",
  "dhuku_entry",
  "expense",
  "household_settings",
  "income",
  "loan",
```

Replace it with:

```ts
  "dhuku",
  "dhuku_entry",
  "expense",
  "fund",
  "fund_top_up",
  "household_settings",
  "income",
  "loan",
```

In `src/modules/activity/lib/activity-format.ts`, find:

```ts
  dhuku: "a dhuku",
  dhuku_entry: "a dhuku entry",
  expense: "an expense",
  household_settings: "household settings",
  income: "income",
  loan: "a loan",
```

Replace it with:

```ts
  dhuku: "a dhuku",
  dhuku_entry: "a dhuku entry",
  expense: "an expense",
  fund: "a fund",
  fund_top_up: "money in a fund",
  household_settings: "household settings",
  income: "income",
  loan: "a loan",
```

In `src/modules/activity/lib/sections.ts`, find:

```ts
// How the Activity page groups entity types into its "Section" filter.
export const ACTIVITY_SECTIONS = [
  { entityTypes: ["expense", "payback"], label: "Expenses", value: "expenses" },
  { entityTypes: ["budget_item", "income"], label: "Income & budget", value: "budget" },
  {
    entityTypes: ["savings_pot", "savings_item", "savings_deposit", "savings_goal", "savings_contribution"],
    label: "Savings",
```

Replace it with:

```ts
// How the Activity page groups entity types into its "Section" filter.
export const ACTIVITY_SECTIONS = [
  { entityTypes: ["expense", "payback"], label: "Expenses", value: "expenses" },
  { entityTypes: ["budget_item", "income", "fund", "fund_top_up"], label: "Income & budget", value: "budget" },
  {
    entityTypes: ["savings_pot", "savings_item", "savings_deposit", "savings_goal", "savings_contribution"],
    label: "Savings",
```

- [ ] **Step 2: Generate the migration**

Run:

```bash
npm run db:generate
```

Expected: it prints `Your SQL migration file ➜ drizzle\0024_<random_words>.sql` and asks nothing. The new file must contain exactly these statements (the file name's words will differ):

```sql
ALTER TYPE "public"."activity_entity_type" ADD VALUE 'fund' BEFORE 'household_settings';--> statement-breakpoint
ALTER TYPE "public"."activity_entity_type" ADD VALUE 'fund_top_up' BEFORE 'household_settings';--> statement-breakpoint
CREATE TABLE "fund_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fund_id" uuid NOT NULL,
	"from_year" integer NOT NULL,
	"from_month" integer NOT NULL,
	"monthly_amount" numeric(12, 2) NOT NULL,
	CONSTRAINT "fund_plans_fund_id_from_year_from_month_unique" UNIQUE("fund_id","from_year","from_month")
);
--> statement-breakpoint
CREATE TABLE "fund_top_ups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fund_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"owner_member_id" uuid NOT NULL,
	"name" text NOT NULL,
	"target" numeric(12, 2),
	"due_year" integer,
	"due_month" integer,
	"start_year" integer NOT NULL,
	"start_month" integer NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "fund_id" uuid;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "fund_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "fund_plans" ADD CONSTRAINT "fund_plans_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fund_top_ups" ADD CONSTRAINT "fund_top_ups_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funds" ADD CONSTRAINT "funds_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funds" ADD CONSTRAINT "funds_owner_member_id_household_members_id_fk" FOREIGN KEY ("owner_member_id") REFERENCES "public"."household_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE set null ON UPDATE no action;
```

If it asks a question or the SQL differs, stop and report.

- [ ] **Step 3: Check types and lint**

Run:

```bash
npx tsc --noEmit
npm run lint -- --fix
npm run lint
```

Expected: `tsc` prints nothing; lint shows 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/db/schema/funds.ts src/db/schema/index.ts src/db/schema/expenses.ts src/db/schema/activityLogs.ts src/modules/activity/lib/activity-format.ts src/modules/activity/lib/sections.ts drizzle
git commit -m "feat(db): funds"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.


### Task 4.2: Fund maths, and the part of an expense paid from pay

A fund's balance is every monthly set-aside from its first month on (at the amount in force each month) plus money added, less what expenses took. The suggested monthly amount spreads what's still needed over the months up to the due month. When a fund pays for an expense it pays up to its balance, and only the part paid from pay counts as Spent.

**Files:**
- Create: `src/modules/funds/lib/fund-math.test.ts`
- Create: `src/modules/funds/lib/fund-math.ts`
- Create: `src/modules/expenses/lib/pay-amount.test.ts`
- Create: `src/modules/expenses/lib/pay-amount.ts`
- Modify: `src/modules/budget/lib/set-aside.test.ts`
- Modify: `src/modules/budget/lib/set-aside.ts`

**Interfaces:**
- Produces: `type YearMonth`, `type FundPlan`, `setAsideFor`, `totalSetAside`, `fundBalance`, `fundBalances`, `suggestedMonthly`, `fundShare` in `src/modules/funds/lib/fund-math.ts`; `payAmount`, `payRows` in `src/modules/expenses/lib/pay-amount.ts`; `fundSetAsides` in `set-aside.ts`.

- [ ] **Step 1: Write the failing tests**

Create `src/modules/funds/lib/fund-math.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

import { fundBalance, fundBalances, fundShare, setAsideFor, suggestedMonthly, totalSetAside } from "./fund-math";

const ASOJ = { month: 6, year: 2083 };
const KARTIK = { month: 7, year: 2083 };
const POUSH = { month: 9, year: 2083 };

describe("setAsideFor", () => {
  const plans = [
    { fromMonth: 6, fromYear: 2083, monthlyAmount: 1225 },
    { fromMonth: 9, fromYear: 2083, monthlyAmount: 1500 },
  ];

  it("uses the latest plan starting on or before the month", () => {
    expect(setAsideFor(plans, KARTIK)).toBe(1225);
    expect(setAsideFor(plans, POUSH)).toBe(1500);
    expect(setAsideFor(plans, { month: 3, year: 2084 })).toBe(1500);
  });

  it("is 0 before the first plan", () => {
    expect(setAsideFor(plans, { month: 5, year: 2083 })).toBe(0);
  });
});

describe("totalSetAside", () => {
  it("adds every month from the start through the given month at the amount in force", () => {
    const plans = [
      { fromMonth: 6, fromYear: 2083, monthlyAmount: 1000 },
      { fromMonth: 8, fromYear: 2083, monthlyAmount: 2000 },
    ];

    // Asoj 1,000 + Kartik 1,000 + Mangsir 2,000 + Poush 2,000
    expect(totalSetAside(plans, ASOJ, POUSH)).toBe(6000);
  });

  it("runs across a year end", () => {
    const plans = [{ fromMonth: 11, fromYear: 2083, monthlyAmount: 500 }];

    expect(totalSetAside(plans, { month: 11, year: 2083 }, { month: 2, year: 2084 })).toBe(2000);
  });

  it("is 0 when the month is before the start", () => {
    expect(totalSetAside([{ fromMonth: 6, fromYear: 2083, monthlyAmount: 500 }], ASOJ, { month: 5, year: 2083 })).toBe(0);
  });
});

describe("fundBalance", () => {
  it("is everything set aside plus money added, less what expenses took", () => {
    const plans = [{ fromMonth: 6, fromYear: 2083, monthlyAmount: 1225 }];

    expect(fundBalance({ plans, spent: 1000, start: ASOJ, through: POUSH, topUps: 5000 })).toBe(1225 * 4 + 5000 - 1000);
  });
});

describe("fundBalances", () => {
  it("works out each fund's balance through a month", () => {
    const balances = fundBalances({
      funds: [
        { id: "internet", startMonth: 6, startYear: 2083 },
        { id: "festivals", startMonth: 7, startYear: 2083 },
      ],
      plans: [
        { fromMonth: 6, fromYear: 2083, fundId: "internet", monthlyAmount: 1225 },
        { fromMonth: 7, fromYear: 2083, fundId: "festivals", monthlyAmount: 2000 },
      ],
      spends: [{ amount: 1000, fundId: "festivals" }],
      through: KARTIK,
      topUps: [
        { amount: 10000, fundId: "festivals", month: 7, year: 2083 },
        { amount: 500, fundId: "internet", month: 9, year: 2083 },
      ],
    });

    expect(balances.get("internet")).toBe(2450);
    expect(balances.get("festivals")).toBe(2000 + 10000 - 1000);
  });
});

describe("suggestedMonthly", () => {
  it("spreads what's still needed over the months up to the due month", () => {
    expect(suggestedMonthly({ balance: 2690, due: { month: 6, year: 2084 }, now: ASOJ, target: 14690 })).toBe(1000);
  });

  it("is 0 when the fund already covers the target", () => {
    expect(suggestedMonthly({ balance: 15000, due: { month: 6, year: 2084 }, now: ASOJ, target: 14690 })).toBe(0);
  });

  it("asks for the whole shortfall when it's due this month or overdue", () => {
    expect(suggestedMonthly({ balance: 10000, due: ASOJ, now: ASOJ, target: 14690 })).toBe(4690);
    expect(suggestedMonthly({ balance: 10000, due: { month: 3, year: 2083 }, now: ASOJ, target: 14690 })).toBe(4690);
  });

  it("is null without a target or due month", () => {
    expect(suggestedMonthly({ balance: 0, due: null, now: ASOJ, target: 5000 })).toBeNull();
    expect(suggestedMonthly({ balance: 0, due: ASOJ, now: ASOJ, target: null })).toBeNull();
  });
});

describe("fundShare", () => {
  it("pays the whole expense when the fund covers it", () => {
    expect(fundShare(14690, 20000)).toBe(14690);
  });

  it("pays up to the balance, leaving the rest as normal spending", () => {
    expect(fundShare(14690, 12000)).toBe(12000);
  });

  it("pays nothing from an empty or overdrawn fund", () => {
    expect(fundShare(500, 0)).toBe(0);
    expect(fundShare(500, -100)).toBe(0);
  });
});
```

Create `src/modules/expenses/lib/pay-amount.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

import { payAmount, payRows } from "./pay-amount";

describe("payAmount", () => {
  it("is the whole expense when it was paid from pay", () => {
    expect(payAmount({ amount: "1500.00", fundAmount: null, savingsPotId: null })).toBe(1500);
  });

  it("is nothing when it was paid from savings", () => {
    expect(payAmount({ amount: "1500.00", fundAmount: null, savingsPotId: "pot" })).toBe(0);
  });

  it("is what the fund didn't cover when it was paid from a fund", () => {
    expect(payAmount({ amount: "14690.00", fundAmount: "12000.00", savingsPotId: null })).toBe(2690);
    expect(payAmount({ amount: "14690.00", fundAmount: "14690.00", savingsPotId: null })).toBe(0);
  });
});

describe("payRows", () => {
  it("keeps each row's shape with the pay part as its amount, dropping rows with none", () => {
    const rows = [
      { amount: "500.00", fundAmount: null, id: "lunch", savingsPotId: null },
      { amount: "14690.00", fundAmount: "12000.00", id: "internet", savingsPotId: null },
      { amount: "3000.00", fundAmount: null, id: "surgery", savingsPotId: "pot" },
    ];

    expect(payRows(rows)).toEqual([
      { amount: "500", fundAmount: null, id: "lunch", savingsPotId: null },
      { amount: "2690", fundAmount: "12000.00", id: "internet", savingsPotId: null },
    ]);
  });
});
```

In `src/modules/budget/lib/set-aside.test.ts` (change 1 of 2), find:

```ts
import { describe, expect, it } from "vitest";

import { dhukuSetAsides, loanSetAsides, savingsSetAsides } from "./set-aside";

const ME = "me";
const HER = "her";
```

Replace it with:

```ts
import { describe, expect, it } from "vitest";

import { dhukuSetAsides, fundSetAsides, loanSetAsides, savingsSetAsides } from "./set-aside";

const ME = "me";
const HER = "her";
```

In `src/modules/budget/lib/set-aside.test.ts` (change 2 of 2), find:

```ts
  });
});

describe("loanSetAsides", () => {
  const loan = {
    counterpartyName: "Raju",
```

Replace it with:

```ts
  });
});

describe("fundSetAsides", () => {
  const fund = { archived: false, id: "worldlink", name: "WorldLink", ownerMemberId: ME, startMonth: 6, startYear: 2083 };
  const plans = [{ fromMonth: 6, fromYear: 2083, fundId: "worldlink", monthlyAmount: 1225 }];

  it("sets aside this month's amount, always done", () => {
    expect(fundSetAsides({ funds: [fund], memberId: ME, month: { month: 7, year: 2083 }, plans })).toEqual([
      { done: 1225, id: "fund:worldlink", kind: "fund", label: "WorldLink", planned: 1225, sub: "Fund" },
    ]);
  });

  it("leaves out archived funds, other people's, ones not started yet and ones set to nothing", () => {
    const month = { month: 7, year: 2083 };
    expect(fundSetAsides({ funds: [{ ...fund, archived: true }], memberId: ME, month, plans })).toEqual([]);
    expect(fundSetAsides({ funds: [{ ...fund, ownerMemberId: HER }], memberId: ME, month, plans })).toEqual([]);
    expect(fundSetAsides({ funds: [{ ...fund, startMonth: 8 }], memberId: ME, month, plans })).toEqual([]);
    expect(fundSetAsides({ funds: [fund], memberId: ME, month, plans: [{ ...plans[0], monthlyAmount: 0 }] })).toEqual([]);
  });
});

describe("loanSetAsides", () => {
  const loan = {
    counterpartyName: "Raju",
```

- [ ] **Step 2: Run the tests and watch them fail**

Run:

```bash
npx vitest run src/modules/funds/lib/fund-math.test.ts src/modules/expenses/lib/pay-amount.test.ts src/modules/budget/lib/set-aside.test.ts
```

Expected: FAIL. The run can't resolve `fund-math` and `pay-amount`, and `fundSetAsides` isn't exported.

- [ ] **Step 3: Write the code**

Create `src/modules/funds/lib/fund-math.ts` with:

```ts
// A fund is a named pile inside one person's everyday account for an
// occasional cost. Nothing moves at the bank: each month the plan sets an
// amount aside, money can be added by hand, and expenses paid from the fund
// take from it.

export type YearMonth = { month: number; year: number };

// The monthly set-aside from a month on. A change adds a plan from the month
// it's made, so earlier months keep the amount they had.
export type FundPlan = { fromMonth: number; fromYear: number; monthlyAmount: number };

const monthOrder = (ym: YearMonth) => ym.year * 12 + ym.month;

// The set-aside in force for a month: the latest plan starting on or before it.
export function setAsideFor(plans: FundPlan[], ym: YearMonth): number {
  let current: FundPlan | null = null;
  for (const plan of plans) {
    const from = monthOrder({ month: plan.fromMonth, year: plan.fromYear });
    if (from > monthOrder(ym)) continue;
    if (current === null || from > monthOrder({ month: current.fromMonth, year: current.fromYear })) current = plan;
  }
  return current?.monthlyAmount ?? 0;
}

// Everything set aside from the fund's first month through `through`, at the
// amount in force each month. A month's set-aside counts from its first day.
export function totalSetAside(plans: FundPlan[], start: YearMonth, through: YearMonth): number {
  let total = 0;
  for (let order = monthOrder(start); order <= monthOrder(through); order++) {
    const year = Math.floor((order - 1) / 12);
    const month = order - year * 12;
    total += setAsideFor(plans, { month, year });
  }
  return total;
}

export function fundBalance(input: { plans: FundPlan[]; spent: number; start: YearMonth; through: YearMonth; topUps: number }): number {
  return totalSetAside(input.plans, input.start, input.through) + input.topUps - input.spent;
}

// For a fund with a target and a due month: what to set aside each month from
// next month through the due month to have it in time. 0 when it's already
// covered; the whole shortfall when it's due this month or overdue; null
// without a target or due month.
export function suggestedMonthly(input: { balance: number; due: null | YearMonth; now: YearMonth; target: null | number }): null | number {
  if (input.target === null || input.due === null) return null;
  const shortfall = input.target - input.balance;
  if (shortfall <= 0) return 0;
  const monthsLeft = monthOrder(input.due) - monthOrder(input.now);
  return monthsLeft <= 0 ? shortfall : Math.ceil(shortfall / monthsLeft);
}

// Each fund's balance through a month, from rows as they come out of the
// database (amounts already numbers). Money added counts from the month it
// was added for; what expenses took counts whenever they were paid.
export function fundBalances(input: {
  funds: { id: string; startMonth: number; startYear: number }[];
  plans: (FundPlan & { fundId: string })[];
  spends: { amount: number; fundId: string }[];
  through: YearMonth;
  topUps: { amount: number; fundId: string; month: number; year: number }[];
}): Map<string, number> {
  return new Map(
    input.funds.map((fund) => [
      fund.id,
      fundBalance({
        plans: input.plans.filter((p) => p.fundId === fund.id),
        spent: input.spends.filter((s) => s.fundId === fund.id).reduce((sum, s) => sum + s.amount, 0),
        start: { month: fund.startMonth, year: fund.startYear },
        through: input.through,
        topUps: input.topUps
          .filter((t) => t.fundId === fund.id && monthOrder(t) <= monthOrder(input.through))
          .reduce((sum, t) => sum + t.amount, 0),
      }),
    ]),
  );
}

// How much of an expense a fund pays: up to its balance. Anything above that
// counts as the month's normal spending.
export function fundShare(amount: number, balance: number): number {
  return Math.max(0, Math.min(amount, balance));
}
```

Create `src/modules/expenses/lib/pay-amount.ts` with:

```ts
type PaidFrom = { amount: number | string; fundAmount: null | number | string; savingsPotId: null | string };

// The part of an expense paid from this month's pay: nothing when it was paid
// from savings, and what's left after a fund's share when paid from a fund.
// Only this part is Spent.
export function payAmount(expense: PaidFrom): number {
  if (expense.savingsPotId !== null) return 0;
  return Number(expense.amount) - Number(expense.fundAmount ?? 0);
}

// Expense rows cut down to the part paid from pay, dropping rows paid wholly
// from savings or a fund. Each row keeps its shape, with `amount` replaced,
// so a page's sums read `amount` as before.
export function payRows<T extends { amount: string; fundAmount: null | string; savingsPotId: null | string }>(rows: T[]): T[] {
  return rows.flatMap((row) => {
    const amount = payAmount(row);
    return amount > 0 ? [{ ...row, amount: String(amount) }] : [];
  });
}
```

In `src/modules/budget/lib/set-aside.ts` (change 1 of 2), find:

```ts
// "Set aside first": money a person's plan takes off the top before any
// budget line, filled in from what Piko already knows (savings pot plans,
// dhukus, loan installments) so it's never typed twice. None of it is
// spending: it's money moved to the person's own piles or paid back.

export type SetAsideKind = "dhuku" | "fund" | "loan" | "savings";
```

Replace it with:

```ts
import { setAsideFor } from "@/modules/funds/lib/fund-math";

// "Set aside first": money a person's plan takes off the top before any
// budget line, filled in from what Piko already knows (savings pot plans,
// dhukus, loan installments, funds) so it's never typed twice. None of it is
// spending: it's money moved to the person's own piles or paid back.

export type SetAsideKind = "dhuku" | "fund" | "loan" | "savings";
```

In `src/modules/budget/lib/set-aside.ts` (change 2 of 2), find:

```ts
  });
}

// Each loan this person took that has an installment and isn't paid off: the
// installment as a monthly amount, capped at what's still owed.
export function loanSetAsides(input: {
```

Replace it with:

```ts
  });
}

// Each of this person's funds in use: this month's set-aside. A fund only
// exists in Piko, so its set-aside always counts as done.
export function fundSetAsides(input: {
  funds: { archived: boolean; id: string; name: string; ownerMemberId: string; startMonth: number; startYear: number }[];
  memberId: string;
  month: { month: number; year: number };
  plans: { fromMonth: number; fromYear: number; fundId: string; monthlyAmount: number }[];
}): SetAsideRow[] {
  return input.funds.flatMap((fund) => {
    if (fund.ownerMemberId !== input.memberId || fund.archived) return [];
    if (fund.startYear * 12 + fund.startMonth > input.month.year * 12 + input.month.month) return [];
    const planned = setAsideFor(
      input.plans.filter((p) => p.fundId === fund.id),
      input.month,
    );
    if (planned <= 0) return [];
    return [{ done: planned, id: `fund:${fund.id}`, kind: "fund" as const, label: fund.name, planned, sub: "Fund" }];
  });
}

// Each loan this person took that has an installment and isn't paid off: the
// installment as a monthly amount, capped at what's still owed.
export function loanSetAsides(input: {
```

- [ ] **Step 4: Run the tests again**

Run:

```bash
npx vitest run src/modules/funds/lib/fund-math.test.ts src/modules/expenses/lib/pay-amount.test.ts src/modules/budget/lib/set-aside.test.ts
```

Expected: PASS, 30 tests.

- [ ] **Step 5: Check types, all unit tests and lint**

Run:

```bash
npx tsc --noEmit
npm test
npm run lint -- --fix
npm run lint
```

Expected: `tsc` prints nothing; every unit test passes; lint shows 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/modules/funds/lib/fund-math.test.ts src/modules/funds/lib/fund-math.ts src/modules/expenses/lib/pay-amount.test.ts src/modules/expenses/lib/pay-amount.ts src/modules/budget/lib/set-aside.test.ts src/modules/budget/lib/set-aside.ts
git commit -m "feat(funds): fund maths and the part paid from pay"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.


### Task 4.3: Add, change, archive and top up funds

Everything for working with funds, not yet shown anywhere: queries, actions (a fund always belongs to whoever sets it up, starts this month, and changing its monthly amount applies from this month on; archiving sets it to nothing from now), Activity text, and the dialog.

**Files:**
- Create: `src/modules/funds/lib/fund-activity.test.ts`
- Create: `src/modules/funds/lib/fund-activity.ts`
- Create: `src/modules/funds/schemas/fund.schema.ts`
- Create: `src/modules/funds/api/funds.ts`
- Create: `src/modules/funds/api/funds.actions.ts`
- Create: `src/modules/funds/components/FundDialog.tsx`

**Interfaces:**
- Consumes: `setAsideFor`, `suggestedMonthly`, `YearMonth` (Task 4.2).
- Produces: `fundSchema`, `fundTopUpSchema`; `listFundData(householdId)` and `type FundData`; `createFundAction`, `updateFundAction`, `archiveFundAction`, `addFundTopUpAction`; `FundDialog` and `type FundView`.

- [ ] **Step 1: Write the failing test**

Create `src/modules/funds/lib/fund-activity.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

import { testFormatters } from "@/modules/activity/lib/test-formatters";

import { fundChanges, fundSummary, topUpSummary } from "./fund-activity";

const f = testFormatters();
const fund = { dueMonth: 10, dueYear: 2027, monthlyAmount: "1225.00", name: "WorldLink", ownerMemberId: "m-1", target: "14690.00" };

describe("fund activity", () => {
  it("summarises a fund with its owner and monthly set-aside", () => {
    expect(fundSummary(f, fund)).toBe("WorldLink · Asha · RS 1,225 a month");
  });

  it("diffs the monthly amount, target and due month", () => {
    expect(fundChanges(f, fund, { ...fund, dueMonth: 11, monthlyAmount: 1500, target: 14690 })).toEqual([
      { field: "Monthly", from: "RS 1,225", to: "RS 1,500" },
      { field: "Needed by", from: "October 2027", to: "November 2027" },
    ]);
  });

  it("summarises money added to a fund", () => {
    expect(topUpSummary(f, { amount: "5000.00", note: "Dashain bonus" }, "Festivals")).toBe("Festivals · RS 5,000 added · Dashain bonus");
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run:

```bash
npx vitest run src/modules/funds/lib/fund-activity.test.ts
```

Expected: FAIL. The run can't resolve `./fund-activity`.

- [ ] **Step 3: Write the code**

Create `src/modules/funds/lib/fund-activity.ts` with:

```ts
import type { ActivityFormatters } from "@/modules/activity/lib/activity-values";
import { diffFields, type FieldSpec } from "@/modules/activity/lib/diff";

export type FundSnapshot = {
  dueMonth: null | number;
  dueYear: null | number;
  monthlyAmount: number | string;
  name: string;
  ownerMemberId: string;
  target: null | number | string;
};

type FundDiff = { due: null | string; monthlyAmount: number | string; name: string; target: null | number | string };

// "WorldLink · Asha · RS 1,225 a month"
export function fundSummary(f: ActivityFormatters, fund: FundSnapshot): string {
  return [fund.name, f.member(fund.ownerMemberId), `${f.money(fund.monthlyAmount)} a month`].filter(Boolean).join(" · ");
}

function toDiff(f: ActivityFormatters, fund: FundSnapshot): FundDiff {
  return {
    due: fund.dueYear !== null && fund.dueMonth !== null ? f.period(fund.dueYear, fund.dueMonth) : null,
    monthlyAmount: fund.monthlyAmount,
    name: fund.name,
    target: fund.target,
  };
}

export function fundChanges(f: ActivityFormatters, before: FundSnapshot, after: FundSnapshot) {
  const specs: FieldSpec<FundDiff>[] = [
    { format: f.text, key: "name", label: "Name" },
    { format: f.money, key: "monthlyAmount", label: "Monthly" },
    { format: f.money, key: "target", label: "Target" },
    { format: f.text, key: "due", label: "Needed by" },
  ];
  return diffFields(toDiff(f, before), toDiff(f, after), specs);
}

// "WorldLink · RS 5,000 added · Dashain bonus"
export function topUpSummary(f: ActivityFormatters, topUp: { amount: number | string; note: null | string }, fundName: string): string {
  return [fundName, `${f.money(topUp.amount)} added`, f.text(topUp.note)].filter(Boolean).join(" · ");
}
```

Create `src/modules/funds/schemas/fund.schema.ts` with:

```ts
import { z } from "zod";

export const fundSchema = z.object({
  name: z.string().trim().min(1).max(60),
  // Set aside every month from now on.
  monthlyAmount: z.number().nonnegative(),
  // Optional: how much is needed, and by which household-calendar month.
  target: z.number().positive().nullable(),
  due: z.object({ month: z.number().int().min(1).max(12), year: z.number().int() }).nullable(),
});

export type FundInput = z.infer<typeof fundSchema>;

export const fundTopUpSchema = z.object({
  amount: z.number().positive(),
  note: z.string().trim().max(120).optional(),
});

export type FundTopUpInput = z.infer<typeof fundTopUpSchema>;
```

Create `src/modules/funds/api/funds.ts` with:

```ts
import { and, eq, inArray, isNotNull } from "drizzle-orm";

import { db } from "@/db/client";
import { expenses, fundPlans, funds, fundTopUps } from "@/db/schema";

// Every fund in the household and what's needed to work out their balances:
// the monthly plans, the money added by hand, and what expenses took.
export async function listFundData(householdId: string) {
  const fundRows = await db.select().from(funds).where(eq(funds.householdId, householdId)).orderBy(funds.createdAt);
  const ids = fundRows.map((f) => f.id);
  if (ids.length === 0) return { funds: [], plans: [], spends: [], topUps: [] };

  const [planRows, topUpRows, spendRows] = await Promise.all([
    db.select().from(fundPlans).where(inArray(fundPlans.fundId, ids)),
    db.select().from(fundTopUps).where(inArray(fundTopUps.fundId, ids)),
    db
      .select({ amount: expenses.fundAmount, expenseId: expenses.id, fundId: expenses.fundId })
      .from(expenses)
      .where(and(eq(expenses.householdId, householdId), isNotNull(expenses.fundId))),
  ]);

  return {
    funds: fundRows.map((f) => ({ ...f, target: f.target === null ? null : Number(f.target) })),
    plans: planRows.map((p) => ({ fromMonth: p.fromMonth, fromYear: p.fromYear, fundId: p.fundId, monthlyAmount: Number(p.monthlyAmount) })),
    spends: spendRows.flatMap((s) => (s.fundId === null ? [] : [{ amount: Number(s.amount ?? 0), expenseId: s.expenseId, fundId: s.fundId }])),
    topUps: topUpRows.map((t) => ({ amount: Number(t.amount), fundId: t.fundId, month: t.month, year: t.year })),
  };
}

export type FundData = Awaited<ReturnType<typeof listFundData>>;
```

Create `src/modules/funds/api/funds.actions.ts` with:

```ts
"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { fundPlans, funds, fundTopUps } from "@/db/schema";
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { currentPeriodYearMonth } from "@/lib/month-period";
import { getCurrentMember } from "@/lib/session";
import { activityActor, loadActivityFormatters, logActivity } from "@/modules/activity/api/activity";

import { fundChanges, fundSummary, topUpSummary } from "../lib/fund-activity";
import { setAsideFor, type YearMonth } from "../lib/fund-math";
import { type FundInput, fundSchema, type FundTopUpInput, fundTopUpSchema } from "../schemas/fund.schema";

function revalidateFundPaths() {
  revalidatePath("/budget");
  revalidatePath("/dashboard");
  revalidatePath("/expenses");
}

// Funds count in the household's own calendar months.
async function currentMonth(householdId: string): Promise<YearMonth> {
  return currentPeriodYearMonth(await getDateFormatPref(householdId));
}

async function findFundInHousehold(householdId: string, id: string) {
  const [fund] = await db
    .select()
    .from(funds)
    .where(and(eq(funds.id, id), eq(funds.householdId, householdId)));
  if (!fund) throw new Error("Fund not found");
  return fund;
}

async function monthlyNow(fundId: string, now: YearMonth): Promise<number> {
  const plans = await db.select().from(fundPlans).where(eq(fundPlans.fundId, fundId));
  return setAsideFor(
    plans.map((p) => ({ fromMonth: p.fromMonth, fromYear: p.fromYear, monthlyAmount: Number(p.monthlyAmount) })),
    now,
  );
}

// The monthly set-aside from this month on. Earlier months keep theirs.
async function setMonthlyFrom(fundId: string, now: YearMonth, monthlyAmount: number) {
  await db
    .insert(fundPlans)
    .values({ fromMonth: now.month, fromYear: now.year, fundId, monthlyAmount: String(monthlyAmount) })
    .onConflictDoUpdate({
      set: { monthlyAmount: String(monthlyAmount) },
      target: [fundPlans.fundId, fundPlans.fromYear, fundPlans.fromMonth],
    });
}

// A fund always belongs to the person who sets it up, and starts this month.
export async function createFundAction(input: FundInput) {
  const member = await getCurrentMember();
  const { householdId, memberId } = member;
  const parsed = fundSchema.parse(input);
  const now = await currentMonth(householdId);

  const [created] = await db
    .insert(funds)
    .values({
      dueMonth: parsed.due?.month ?? null,
      dueYear: parsed.due?.year ?? null,
      householdId,
      name: parsed.name,
      ownerMemberId: memberId,
      startMonth: now.month,
      startYear: now.year,
      target: parsed.target === null ? null : String(parsed.target),
    })
    .returning();
  await setMonthlyFrom(created.id, now, parsed.monthlyAmount);

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "created",
    after: created,
    entityId: created.id,
    entityType: "fund",
    summary: fundSummary(f, { ...created, monthlyAmount: parsed.monthlyAmount }),
  });

  revalidateFundPaths();
}

export async function updateFundAction(id: string, input: FundInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = fundSchema.parse(input);
  const before = await findFundInHousehold(householdId, id);
  const now = await currentMonth(householdId);
  const monthlyBefore = await monthlyNow(id, now);

  const [updated] = await db
    .update(funds)
    .set({
      dueMonth: parsed.due?.month ?? null,
      dueYear: parsed.due?.year ?? null,
      name: parsed.name,
      target: parsed.target === null ? null : String(parsed.target),
    })
    .where(and(eq(funds.id, id), eq(funds.householdId, householdId)))
    .returning();
  if (parsed.monthlyAmount !== monthlyBefore) await setMonthlyFrom(id, now, parsed.monthlyAmount);

  const f = await loadActivityFormatters(householdId);
  const after = { ...updated, monthlyAmount: parsed.monthlyAmount };
  await logActivity(activityActor(member), {
    action: "updated",
    after: updated,
    before,
    changes: fundChanges(f, { ...before, monthlyAmount: monthlyBefore }, after),
    entityId: id,
    entityType: "fund",
    summary: fundSummary(f, after),
  });

  revalidateFundPaths();
}

// Stops a fund from this month on: no more set-asides, and it drops out of
// the plan. What's in it stays, for expenses already paid from it.
export async function archiveFundAction(id: string) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const before = await findFundInHousehold(householdId, id);
  const now = await currentMonth(householdId);

  const [updated] = await db
    .update(funds)
    .set({ archived: true })
    .where(and(eq(funds.id, id), eq(funds.householdId, householdId)))
    .returning();
  await setMonthlyFrom(id, now, 0);

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "archived",
    after: updated,
    before,
    entityId: id,
    entityType: "fund",
    summary: fundSummary(f, { ...updated, monthlyAmount: 0 }),
  });

  revalidateFundPaths();
}

// Money added to a fund on top of its monthly set-aside, for this month.
export async function addFundTopUpAction(fundId: string, input: FundTopUpInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = fundTopUpSchema.parse(input);
  const fund = await findFundInHousehold(householdId, fundId);
  const now = await currentMonth(householdId);

  const [created] = await db
    .insert(fundTopUps)
    .values({ amount: String(parsed.amount), fundId, month: now.month, note: parsed.note || null, year: now.year })
    .returning();

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "created",
    after: created,
    entityId: created.id,
    entityType: "fund_top_up",
    summary: topUpSummary(f, created, fund.name),
  });

  revalidateFundPaths();
}
```

Create `src/modules/funds/components/FundDialog.tsx` with:

```tsx
"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AmountInput } from "@/components/AmountInput";
import { Modal } from "@/components/Modal";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { addFundTopUpAction, archiveFundAction, createFundAction, updateFundAction } from "@/modules/funds/api/funds.actions";
import { suggestedMonthly, type YearMonth } from "@/modules/funds/lib/fund-math";

export type FundView = {
  balance: number;
  due: null | YearMonth;
  dueLabel: null | string;
  id: string;
  monthlyAmount: number;
  name: string;
  // What to set aside each month to have the target by the due month.
  suggested: null | number;
  target: null | number;
};

type Props = {
  // Months a fund can be needed by, e.g. { label: "Asoj 2084", value: "2084-6" }.
  dueOptions: { label: string; value: string }[];
  // Edit mode when set; otherwise the dialog adds a new fund.
  fund?: FundView;
  // The month the page shows, for the suggested monthly amount.
  now: YearMonth;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

const FORM_ID = "fund-form";
const NO_DATE = "none";

export function FundDialog({ onOpenChange, open, ...rest }: Props) {
  const [pending, setPending] = useState(false);

  return (
    <Modal
      className="sm:max-w-120"
      footer={
        <>
          <Button className="min-w-35 justify-start" disabled={pending} form={FORM_ID} type="submit">
            {pending ? "Saving..." : "Save fund"}
          </Button>
          {rest.fund && (
            <Button disabled={pending} form={FORM_ID} type="submit" value="archive" variant="destructive">
              Archive fund
            </Button>
          )}
        </>
      }
      hint="Enter to save · Esc to close"
      onOpenChange={onOpenChange}
      open={open}
      subtitle="A pile in your everyday account for an occasional cost"
      title={rest.fund ? rest.fund.name : "Add a fund"}
    >
      <FundFields {...rest} onDone={() => onOpenChange(false)} onPendingChange={setPending} />
    </Modal>
  );
}

type FieldsProps = Omit<Props, "onOpenChange" | "open"> & { onDone: () => void; onPendingChange: (pending: boolean) => void };

function FundFields({ dueOptions, fund, now, onDone, onPendingChange }: FieldsProps) {
  const router = useRouter();
  const [name, setName] = useState(fund?.name ?? "");
  const [monthly, setMonthly] = useState(fund ? String(fund.monthlyAmount) : "");
  const [target, setTarget] = useState(fund?.target ? String(fund.target) : "");
  const [due, setDue] = useState(fund?.due ? `${fund.due.year}-${fund.due.month}` : NO_DATE);
  const [topUp, setTopUp] = useState("");
  const [topUpNote, setTopUpNote] = useState("");
  const [busy, setBusy] = useState(false);

  const [dueYear, dueMonth] = due.split("-").map(Number);
  const dueValue = due === NO_DATE ? null : { month: dueMonth, year: dueYear };
  const targetValue = Number(target) > 0 ? Number(target) : null;
  const suggestion = suggestedMonthly({ balance: fund?.balance ?? 0, due: dueValue, now, target: targetValue });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const intent = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ?? "save";
    if (intent !== "archive" && !name.trim()) {
      toast.error("Give the fund a name");
      return;
    }

    onPendingChange(true);
    try {
      if (intent === "archive" && fund) {
        await archiveFundAction(fund.id);
        toast.success("Fund archived");
      } else {
        const input = { due: dueValue, monthlyAmount: Number(monthly) || 0, name: name.trim(), target: targetValue };
        if (fund) {
          await updateFundAction(fund.id, input);
        } else {
          await createFundAction(input);
        }
        toast.success("Fund saved");
      }
      onDone();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      onPendingChange(false);
    }
  }

  async function addMoney() {
    if (!fund) return;
    const amount = Number(topUp);
    if (!(amount > 0)) {
      toast.error("Enter how much to add");
      return;
    }
    setBusy(true);
    try {
      await addFundTopUpAction(fund.id, { amount, note: topUpNote.trim() || undefined });
      setTopUp("");
      setTopUpNote("");
      toast.success("Money added");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form className="flex flex-col gap-5.5" id={FORM_ID} noValidate onSubmit={onSubmit}>
        <TextField data-autofocus label="Name" onChange={(event) => setName(event.target.value)} placeholder="e.g. WorldLink, Festivals, Health" value={name} />
        <AmountInput label="Set aside each month" onChange={(event) => setMonthly(event.target.value)} placeholder="0.00" value={monthly} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AmountInput label="Target (optional)" onChange={(event) => setTarget(event.target.value)} placeholder="0.00" value={target} />
          <SelectField label="Needed by" onValueChange={setDue} options={[{ label: "No date", value: NO_DATE }, ...dueOptions]} value={due} />
        </div>
        {suggestion !== null && (
          <p className="text-xs leading-normal text-n-600">
            {suggestion === 0 ? "What's in the fund already covers it." : `Set aside ${formatMoney(suggestion)} a month to have it in time.`}
          </p>
        )}
      </form>

      {fund && (
        <section className="flex flex-col gap-3 border-t border-n-300 pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold">Add money</h3>
            <span className="text-[13px] text-n-600">Holds {formatMoney(fund.balance)}</span>
          </div>
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto]">
            <AmountInput label="Amount to add" onChange={(event) => setTopUp(event.target.value)} placeholder="0.00" value={topUp} />
            <TextField label="Note" onChange={(event) => setTopUpNote(event.target.value)} placeholder="e.g. from the bonus" value={topUpNote} />
            <Button disabled={busy} onClick={() => void addMoney()} type="button" variant="outline">
              Add money
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests again**

Run:

```bash
npx vitest run src/modules/funds/lib/fund-activity.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Check types, all unit tests and lint**

Run:

```bash
npx tsc --noEmit
npm test
npm run lint -- --fix
npm run lint
```

Expected: `tsc` prints nothing; every unit test passes; lint shows 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/modules/funds/lib/fund-activity.test.ts src/modules/funds/lib/fund-activity.ts src/modules/funds/schemas/fund.schema.ts src/modules/funds/api/funds.ts src/modules/funds/api/funds.actions.ts src/modules/funds/components/FundDialog.tsx
git commit -m "feat(funds): add, change, archive and top up funds"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.


### Task 4.4: Pay an expense from a fund

The expense form's Paid from becomes a dropdown listing Pay, the savings pots and the payer's own funds. The server works out the fund's share (up to its balance today, leaving out an edited expense's own earlier share) and refuses an empty fund. Reports and the budget alert count only the part paid from pay.

**Files:**
- Create: `src/modules/expenses/schemas/expense.schema.test.ts`
- Modify: `src/modules/expenses/schemas/expense.schema.ts`
- Modify: `src/modules/expenses/lib/expense-activity.ts`
- Modify: `src/modules/activity/lib/revert/entities.ts`
- Modify: `src/modules/expenses/api/expenses.actions.ts`
- Modify: `src/modules/expenses/components/ExpenseDialog.tsx`
- Modify: `src/modules/expenses/components/ExpensesView.tsx`
- Modify: `src/modules/expenses/pages/ExpensesPage.tsx`
- Modify: `src/modules/notifications/api/notifications.actions.ts`
- Modify: `src/modules/reports/pages/ReportsPage.tsx`

**Interfaces:**
- Consumes: `listFundData` (Task 4.3), `fundBalances`, `fundShare`, `payRows` (Task 4.2).
- Changes: `expenseSchema` gains `fundId`; `ExpenseDraft` gains `fundId` and `fundAmount`; `ExpenseDialog` gains `funds`; `ExpenseRecord` gains `fundId` and `fundAmount`.

- [ ] **Step 1: The expense schema takes a fund**

Create `src/modules/expenses/schemas/expense.schema.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

import { expenseSchema } from "./expense.schema";

const FUND = "11111111-1111-4111-8111-111111111111";
const POT = "22222222-2222-4222-8222-222222222222";
const base = {
  amount: 14690,
  categoryId: "33333333-3333-4333-8333-333333333333",
  date: "2026-10-20",
  ownerMemberId: null,
  paidByMemberId: "44444444-4444-4444-8444-444444444444",
};

describe("expenseSchema and funds", () => {
  it("takes an expense paid from a fund", () => {
    expect(expenseSchema.safeParse({ ...base, fundId: FUND }).success).toBe(true);
  });

  it("refuses an expense paid from a fund that's also to be paid back", () => {
    expect(expenseSchema.safeParse({ ...base, fundId: FUND, payBackAmount: 1000 }).success).toBe(false);
  });

  it("refuses an expense paid from both a fund and savings", () => {
    expect(expenseSchema.safeParse({ ...base, fundId: FUND, savingsPotId: POT }).success).toBe(false);
  });
});
```

In `src/modules/expenses/schemas/expense.schema.ts` (change 1 of 2), find:

```ts
    // list items. Omitted = leave it as it is (edits); null = paid from pay.
    savingsItemId: z.string().uuid().nullable().optional(),
    savingsPotId: z.string().uuid().nullable().optional(),
  })
  .refine((expense) => expense.payBackAmount == null || expense.payBackAmount <= expense.amount, {
    message: "The amount to pay back can't be more than the expense",
```

Replace it with:

```ts
    // list items. Omitted = leave it as it is (edits); null = paid from pay.
    savingsItemId: z.string().uuid().nullable().optional(),
    savingsPotId: z.string().uuid().nullable().optional(),
    // Paid from one of the payer's funds. Omitted = leave it as it is (edits);
    // null = not from a fund. The fund pays up to its balance.
    fundId: z.string().uuid().nullable().optional(),
  })
  .refine((expense) => expense.payBackAmount == null || expense.payBackAmount <= expense.amount, {
    message: "The amount to pay back can't be more than the expense",
```

In `src/modules/expenses/schemas/expense.schema.ts` (change 2 of 2), find:

```ts
  .refine((expense) => expense.payBackAmount == null || !expense.savingsPotId, {
    message: "An expense paid from savings can't also be paid back",
    path: ["payBackAmount"],
  });

export type ExpenseInput = z.infer<typeof expenseSchema>;
```

Replace it with:

```ts
  .refine((expense) => expense.payBackAmount == null || !expense.savingsPotId, {
    message: "An expense paid from savings can't also be paid back",
    path: ["payBackAmount"],
  })
  .refine((expense) => !expense.fundId || (expense.payBackAmount == null && !expense.savingsPotId), {
    message: "An expense paid from a fund can't also be paid back or paid from savings",
    path: ["fundId"],
  });

export type ExpenseInput = z.infer<typeof expenseSchema>;
```

- [ ] **Step 2: Activity and undo know about funds**

In `src/modules/expenses/lib/expense-activity.ts` (change 1 of 2), find:

```ts
  amount: number | string;
  categoryId: string;
  date: string;
  note?: null | string;
  ownerMemberId: null | string;
  paidByMemberId: string;
```

Replace it with:

```ts
  amount: number | string;
  categoryId: string;
  date: string;
  fundAmount?: null | number | string;
  fundId?: null | string;
  note?: null | string;
  ownerMemberId: null | string;
  paidByMemberId: string;
```

In `src/modules/expenses/lib/expense-activity.ts` (change 2 of 2), find:

```ts
    { format: f.member, key: "paidByMemberId", label: "Paid by" },
    { format: f.money, key: "payBackAmount", label: "To be paid back" },
    { format: (value) => (value ? "Savings" : "Pay"), key: "savingsPotId", label: "Paid from" },
    { format: f.date, key: "date", label: "Date" },
    { format: f.text, key: "note", label: "Note" },
  ];
```

Replace it with:

```ts
    { format: f.member, key: "paidByMemberId", label: "Paid by" },
    { format: f.money, key: "payBackAmount", label: "To be paid back" },
    { format: (value) => (value ? "Savings" : "Pay"), key: "savingsPotId", label: "Paid from" },
    { format: (value) => (value ? "A fund" : null), key: "fundId", label: "Fund" },
    { format: f.money, key: "fundAmount", label: "From a fund" },
    { format: f.date, key: "date", label: "Date" },
    { format: f.text, key: "note", label: "Note" },
  ];
```

In `src/modules/activity/lib/revert/entities.ts`, find:

```ts
  },
  expense: {
    children: [],
    editable: ["amount", "categoryId", "date", "note", "ownerMemberId", "paidByMemberId", "payBackAmount", "savingsPotId"],
    fields: (f) => rowFields(expenseFields(f)),
    noun: "expense",
    references: (r) => ({ categoryIds: ids(r.categoryId), memberIds: ids(r.ownerMemberId, r.paidByMemberId) }),
    summary: (f, r) => expenseSummary(f, r as ExpenseSnapshot),
  },
```

Replace it with:

```ts
  },
  expense: {
    children: [],
    editable: ["amount", "categoryId", "date", "fundAmount", "fundId", "note", "ownerMemberId", "paidByMemberId", "payBackAmount", "savingsPotId"],
    fields: (f) => rowFields(expenseFields(f)),
    noun: "expense",
    // Any fund shows as "A fund", so moving between funds compares the raw id.
    opaque: ["fundId"],
    references: (r) => ({ categoryIds: ids(r.categoryId), memberIds: ids(r.ownerMemberId, r.paidByMemberId) }),
    summary: (f, r) => expenseSummary(f, r as ExpenseSnapshot),
  },
```

- [ ] **Step 3: Work out the fund's share when saving**

In `src/modules/expenses/api/expenses.actions.ts` (change 1 of 6), find:

```ts

import { db } from "@/db/client";
import { expenses, savingsItems, savingsPots } from "@/db/schema";
import type { DateFormat } from "@/lib/date-format-cookie";
import { resolvePeriod } from "@/lib/month-period";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { type ActivityActor, activityActor, loadActivityFormatters, logActivities, logActivity } from "@/modules/activity/api/activity";
import { listCategories } from "@/modules/categories/api/categories";
import { formatNPR } from "@/modules/dashboard/lib/format";
import { checkBudgetThreshold, insertNotification } from "@/modules/notifications/api/notifications.actions";

import { expenseChanges, expenseSummary } from "../lib/expense-activity";
```

Replace it with:

```ts

import { db } from "@/db/client";
import { expenses, savingsItems, savingsPots } from "@/db/schema";
import { type DateFormat, getDateFormatPref } from "@/lib/date-format-cookie";
import { currentPeriodYearMonth, resolvePeriod } from "@/lib/month-period";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { type ActivityActor, activityActor, loadActivityFormatters, logActivities, logActivity } from "@/modules/activity/api/activity";
import { listCategories } from "@/modules/categories/api/categories";
import { formatNPR } from "@/modules/dashboard/lib/format";
import { listFundData } from "@/modules/funds/api/funds";
import { fundBalances, fundShare } from "@/modules/funds/lib/fund-math";
import { checkBudgetThreshold, insertNotification } from "@/modules/notifications/api/notifications.actions";

import { expenseChanges, expenseSummary } from "../lib/expense-activity";
```

In `src/modules/expenses/api/expenses.actions.ts` (change 2 of 6), find:

```ts
  if (!item) throw new ExpenseValidationError("That list item isn't in this savings pot");
}

async function findExpenseInHousehold(householdId: string, id: string) {
  const [row] = await db
    .select()
```

Replace it with:

```ts
  if (!item) throw new ExpenseValidationError("That list item isn't in this savings pot");
}

// What a fund pays towards an expense: up to its balance today (leaving out
// this expense's own earlier share when it's being edited). The rest counts as
// the month's normal spending. A fund only pays for its owner's expenses.
async function fundPayment(
  householdId: string,
  fundId: null | string,
  paidByMemberId: string,
  amount: number,
  editingId?: string,
): Promise<{ fundAmount: null | string; fundId: null | string }> {
  if (fundId === null) return { fundAmount: null, fundId: null };
  const data = await listFundData(householdId);
  const fund = data.funds.find((f) => f.id === fundId);
  if (!fund || fund.archived) throw new ExpenseValidationError("That fund isn't available");
  if (fund.ownerMemberId !== paidByMemberId) throw new ExpenseValidationError("A fund can only pay for its owner's expenses");

  const now = currentPeriodYearMonth(await getDateFormatPref(householdId));
  const balance =
    fundBalances({ ...data, funds: [fund], spends: data.spends.filter((s) => s.expenseId !== editingId), through: now }).get(fund.id) ?? 0;
  const share = fundShare(amount, balance);
  if (share <= 0) throw new ExpenseValidationError("That fund is empty");
  return { fundAmount: String(share), fundId };
}

async function findExpenseInHousehold(householdId: string, id: string) {
  const [row] = await db
    .select()
```

In `src/modules/expenses/api/expenses.actions.ts` (change 3 of 6), find:

```ts
  const savingsPotId = parsed.savingsPotId ?? null;
  const savingsItemId = savingsPotId === null ? null : (parsed.savingsItemId ?? null);
  await assertSavingsLink(householdId, savingsPotId, savingsItemId);

  const [created] = await db
    .insert(expenses)
    .values({
      householdId,
      amount: String(parsed.amount),
      categoryId: parsed.categoryId,
      ownerMemberId: parsed.ownerMemberId,
      paidByMemberId: parsed.paidByMemberId,
```

Replace it with:

```ts
  const savingsPotId = parsed.savingsPotId ?? null;
  const savingsItemId = savingsPotId === null ? null : (parsed.savingsItemId ?? null);
  await assertSavingsLink(householdId, savingsPotId, savingsItemId);
  const fund = await fundPayment(householdId, parsed.fundId ?? null, parsed.paidByMemberId, parsed.amount);

  const [created] = await db
    .insert(expenses)
    .values({
      householdId,
      amount: String(parsed.amount),
      fundAmount: fund.fundAmount,
      fundId: fund.fundId,
      categoryId: parsed.categoryId,
      ownerMemberId: parsed.ownerMemberId,
      paidByMemberId: parsed.paidByMemberId,
```

In `src/modules/expenses/api/expenses.actions.ts` (change 4 of 6), find:

```ts
    throw new ExpenseValidationError("An expense paid from savings can't also be paid back");
  }
  await assertSavingsLink(householdId, savingsPotId, savingsItemId);

  const [updated] = await db
    .update(expenses)
```

Replace it with:

```ts
    throw new ExpenseValidationError("An expense paid from savings can't also be paid back");
  }
  await assertSavingsLink(householdId, savingsPotId, savingsItemId);
  // Same rule again: omitted means "leave it as it is". The fund's share is
  // worked out afresh, since the amount may have changed.
  const fundId = parsed.fundId === undefined ? before.fundId : parsed.fundId;
  if (fundId !== null && (payBackAmount !== null || savingsPotId !== null)) {
    throw new ExpenseValidationError("An expense paid from a fund can't also be paid back or paid from savings");
  }
  const fund = await fundPayment(householdId, fundId, parsed.paidByMemberId, parsed.amount, id);

  const [updated] = await db
    .update(expenses)
```

In `src/modules/expenses/api/expenses.actions.ts` (change 5 of 6), find:

```ts
      ownerMemberId: parsed.ownerMemberId,
      paidByMemberId: parsed.paidByMemberId,
      date: parsed.date,
      note: parsed.note ?? null,
      payBackAmount: payBackAmount === null ? null : String(payBackAmount),
      savingsItemId,
```

Replace it with:

```ts
      ownerMemberId: parsed.ownerMemberId,
      paidByMemberId: parsed.paidByMemberId,
      date: parsed.date,
      fundAmount: fund.fundAmount,
      fundId: fund.fundId,
      note: parsed.note ?? null,
      payBackAmount: payBackAmount === null ? null : String(payBackAmount),
      savingsItemId,
```

In `src/modules/expenses/api/expenses.actions.ts` (change 6 of 6), find:

```ts
    action: "updated",
    after: updated,
    before,
    changes: expenseChanges(f, before, { ...parsed, payBackAmount, savingsPotId }),
    entityId: id,
    entityType: "expense",
    summary: expenseSummary(f, parsed),
```

Replace it with:

```ts
    action: "updated",
    after: updated,
    before,
    changes: expenseChanges(f, before, { ...parsed, fundAmount: fund.fundAmount, fundId: fund.fundId, payBackAmount, savingsPotId }),
    entityId: id,
    entityType: "expense",
    summary: expenseSummary(f, parsed),
```

- [ ] **Step 4: Paid from on the Expenses page**

In `src/modules/expenses/components/ExpenseDialog.tsx` (change 1 of 8), find:

```tsx
import { Modal } from "@/components/Modal";
import { NepaliDateField } from "@/components/NepaliDateField";
import { Segmented } from "@/components/Segmented";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/today";
import { cn } from "@/lib/utils";
import { createExpenseAction, updateExpenseAction } from "@/modules/expenses/api/expenses.actions";
```

Replace it with:

```tsx
import { Modal } from "@/components/Modal";
import { NepaliDateField } from "@/components/NepaliDateField";
import { Segmented } from "@/components/Segmented";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { todayISO } from "@/lib/today";
import { cn } from "@/lib/utils";
import { createExpenseAction, updateExpenseAction } from "@/modules/expenses/api/expenses.actions";
```

In `src/modules/expenses/components/ExpenseDialog.tsx` (change 2 of 8), find:

```tsx
  amount: number;
  categoryId: string;
  date: string;
  note: null | string;
  ownerMemberId: null | string;
  paidByMemberId: string;
```

Replace it with:

```tsx
  amount: number;
  categoryId: string;
  date: string;
  fundAmount?: null | number;
  fundId?: null | string;
  note: null | string;
  ownerMemberId: null | string;
  paidByMemberId: string;
```

In `src/modules/expenses/components/ExpenseDialog.tsx` (change 3 of 8), find:

```tsx
  currentMemberId: string;
  // Edit mode when set; otherwise the dialog adds a new expense.
  expenseId?: string;
  initial?: ExpenseDraft;
  members: Member[];
  onOpenChange: (open: boolean) => void;
```

Replace it with:

```tsx
  currentMemberId: string;
  // Edit mode when set; otherwise the dialog adds a new expense.
  expenseId?: string;
  // Funds that can pay, with what each holds now. Only the payer's own show.
  funds?: { balance: number; id: string; name: string; ownerMemberId: string }[];
  initial?: ExpenseDraft;
  members: Member[];
  onOpenChange: (open: boolean) => void;
```

In `src/modules/expenses/components/ExpenseDialog.tsx` (change 4 of 8), find:

```tsx
  categories,
  currentMemberId,
  expenseId,
  initial,
  members,
  onDone,
```

Replace it with:

```tsx
  categories,
  currentMemberId,
  expenseId,
  funds = [],
  initial,
  members,
  onDone,
```

In `src/modules/expenses/components/ExpenseDialog.tsx` (change 5 of 8), find:

```tsx
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [payBack, setPayBack] = useState(initial?.payBackAmount != null);
  const [payBackText, setPayBackText] = useState(initial?.payBackAmount != null ? String(initial.payBackAmount) : "");
  const [paidFrom, setPaidFrom] = useState<string>(initial?.savingsPotId ?? PAY);
  const {
    control,
    formState: { errors },
```

Replace it with:

```tsx
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [payBack, setPayBack] = useState(initial?.payBackAmount != null);
  const [payBackText, setPayBackText] = useState(initial?.payBackAmount != null ? String(initial.payBackAmount) : "");
  const [paidFrom, setPaidFrom] = useState<string>(
    initial?.savingsPotId ? `pot:${initial.savingsPotId}` : initial?.fundId ? `fund:${initial.fundId}` : PAY,
  );
  const {
    control,
    formState: { errors },
```

In `src/modules/expenses/components/ExpenseDialog.tsx` (change 6 of 8), find:

```tsx
  const ownerMemberId = watch("ownerMemberId");
  const paidByMemberId = watch("paidByMemberId");
  const categoryId = watch("categoryId");
  const label = (m: Member) => (m.id === currentMemberId ? "Me" : m.name);
  const people = [...members.filter((m) => m.id === currentMemberId), ...members.filter((m) => m.id !== currentMemberId)];

  const fromSavings = paidFrom !== PAY;
  // The list item only stays linked while the expense stays on that item's pot.
  const keepsItem = fromSavings && Boolean(initial?.savingsItemId) && paidFrom === initial?.savingsPotId;

  // "Pay back later" needs exactly two people: the one who paid, and the
  // other one, who owes it. Money from savings is never paid back.
  const payer = members.find((m) => m.id === paidByMemberId);
  const other = members.length === 2 && !fromSavings ? (members.find((m) => m.id !== paidByMemberId) ?? null) : null;
  const payBackLabel = paidByMemberId === currentMemberId ? `${other?.name ?? "They"} will pay me back` : `I'll pay ${payer?.name ?? "them"} back`;

  const quick = (quickCategoryIds.length > 0 ? quickCategoryIds : categories.map((c) => c.id))
```

Replace it with:

```tsx
  const ownerMemberId = watch("ownerMemberId");
  const paidByMemberId = watch("paidByMemberId");
  const categoryId = watch("categoryId");
  const amount = Number(watch("amount")) || 0;
  const label = (m: Member) => (m.id === currentMemberId ? "Me" : m.name);
  const people = [...members.filter((m) => m.id === currentMemberId), ...members.filter((m) => m.id !== currentMemberId)];

  // Only the payer's own funds can pay, so switching who paid drops a fund
  // that isn't theirs back to pay.
  const payerFunds = funds.filter((fund) => fund.ownerMemberId === paidByMemberId);
  const source = paidFrom.startsWith("fund:") && !payerFunds.some((fund) => `fund:${fund.id}` === paidFrom) ? PAY : paidFrom;
  const potId = source.startsWith("pot:") ? source.slice(4) : null;
  const fund = payerFunds.find((f) => `fund:${f.id}` === source) ?? null;
  // An edited expense's own earlier share comes back to the fund first.
  const available = fund ? fund.balance + (initial?.fundId === fund.id ? (initial.fundAmount ?? 0) : 0) : 0;
  const paidFromOptions = [
    { label: "Pay", value: PAY },
    ...savingsPots.map((pot) => ({ label: `${pot.name} (savings)`, value: `pot:${pot.id}` })),
    ...payerFunds.map((f) => ({ label: `${f.name} (fund)`, value: `fund:${f.id}` })),
  ];

  // The list item only stays linked while the expense stays on that item's pot.
  const keepsItem = potId !== null && Boolean(initial?.savingsItemId) && potId === initial?.savingsPotId;

  // "Pay back later" needs exactly two people: the one who paid, and the
  // other one, who owes it. Money from savings or a fund is never paid back.
  const payer = members.find((m) => m.id === paidByMemberId);
  const other = members.length === 2 && source === PAY ? (members.find((m) => m.id !== paidByMemberId) ?? null) : null;
  const payBackLabel = paidByMemberId === currentMemberId ? `${other?.name ?? "They"} will pay me back` : `I'll pay ${payer?.name ?? "them"} back`;

  const quick = (quickCategoryIds.length > 0 ? quickCategoryIds : categories.map((c) => c.id))
```

In `src/modules/expenses/components/ExpenseDialog.tsx` (change 7 of 8), find:

```tsx
    onPendingChange(true);
    const payload = {
      ...values,
      note: values.note?.trim() || undefined,
      payBackAmount,
      savingsItemId: keepsItem ? (initial?.savingsItemId ?? null) : null,
      savingsPotId: fromSavings ? paidFrom : null,
    };
    try {
      if (expenseId) {
```

Replace it with:

```tsx
    onPendingChange(true);
    const payload = {
      ...values,
      fundId: fund?.id ?? null,
      note: values.note?.trim() || undefined,
      payBackAmount,
      savingsItemId: keepsItem ? (initial?.savingsItemId ?? null) : null,
      savingsPotId: potId,
    };
    try {
      if (expenseId) {
```

In `src/modules/expenses/components/ExpenseDialog.tsx` (change 8 of 8), find:

```tsx
        />
      </div>

      {savingsPots.length > 0 && (
        <div className="flex flex-col gap-2">
          <Segmented
            label="Paid from"
            onChange={setPaidFrom}
            options={[{ label: "Pay", value: PAY }, ...savingsPots.map((pot) => ({ label: pot.name, value: pot.id }))]}
            value={paidFrom}
          />
          {keepsItem && <p className="text-[13px] text-n-700">For list item: {initial?.savingsItemName ?? "a savings item"}</p>}
        </div>
      )}

```

Replace it with:

```tsx
        />
      </div>

      {paidFromOptions.length > 1 && (
        <div className="flex flex-col gap-2">
          <SelectField label="Paid from" onValueChange={setPaidFrom} options={paidFromOptions} value={source} />
          {keepsItem && <p className="text-[13px] text-n-700">For list item: {initial?.savingsItemName ?? "a savings item"}</p>}
          {fund && amount > available && (
            <p className="text-[13px] text-n-700">
              {fund.name} has {formatMoney(Math.max(0, available))}. The other {formatMoney(amount - Math.max(0, available))} counts as this
              month&apos;s spending.
            </p>
          )}
        </div>
      )}

```

In `src/modules/expenses/components/ExpensesView.tsx` (change 1 of 3), find:

```tsx
type Member = { id: string; name: string };

export type ExpenseRecord = Omit<ExpenseItem, "categoryName"> & {
  payBackAmount: null | number;
  recurringExpenseId: null | string;
  savingsItemId: null | string;
```

Replace it with:

```tsx
type Member = { id: string; name: string };

export type ExpenseRecord = Omit<ExpenseItem, "categoryName"> & {
  fundAmount: null | number;
  fundId: null | string;
  payBackAmount: null | number;
  recurringExpenseId: null | string;
  savingsItemId: null | string;
```

In `src/modules/expenses/components/ExpensesView.tsx` (change 2 of 3), find:

```tsx
  daysLeft: null | number;
  expenses: ExpenseRecord[];
  exportRows: ExpenseExportRow[];
  income: number;
  members: Member[];
  monthLabel: string;
```

Replace it with:

```tsx
  daysLeft: null | number;
  expenses: ExpenseRecord[];
  exportRows: ExpenseExportRow[];
  funds: { balance: number; id: string; name: string; ownerMemberId: string }[];
  income: number;
  members: Member[];
  monthLabel: string;
```

In `src/modules/expenses/components/ExpensesView.tsx` (change 3 of 3), find:

```tsx
        categories={categories}
        currentMemberId={currentMemberId}
        expenseId={editing?.id}
        initial={
          editing
            ? {
                amount: editing.amount,
                categoryId: editing.categoryId,
                date: editing.date,
                note: editing.note,
                ownerMemberId: editing.ownerMemberId,
                paidByMemberId: editing.paidByMemberId,
```

Replace it with:

```tsx
        categories={categories}
        currentMemberId={currentMemberId}
        expenseId={editing?.id}
        funds={props.funds}
        initial={
          editing
            ? {
                amount: editing.amount,
                categoryId: editing.categoryId,
                date: editing.date,
                fundAmount: editing.fundAmount,
                fundId: editing.fundId,
                note: editing.note,
                ownerMemberId: editing.ownerMemberId,
                paidByMemberId: editing.paidByMemberId,
```

In `src/modules/expenses/pages/ExpensesPage.tsx` (change 1 of 3), find:

```tsx
import { ExpensesView, type UpcomingBill } from "@/modules/expenses/components/ExpensesView";
import { topCategoryIds } from "@/modules/expenses/lib/expense-view";
import { roleForOwner } from "@/modules/expenses/lib/member-tone";
import { listRecurringExpenses } from "@/modules/recurring/api/recurring.actions";
import { listSavingsPots } from "@/modules/savings/api/savings.actions";

```

Replace it with:

```tsx
import { ExpensesView, type UpcomingBill } from "@/modules/expenses/components/ExpensesView";
import { topCategoryIds } from "@/modules/expenses/lib/expense-view";
import { roleForOwner } from "@/modules/expenses/lib/member-tone";
import { listFundData } from "@/modules/funds/api/funds";
import { fundBalances } from "@/modules/funds/lib/fund-math";
import { listRecurringExpenses } from "@/modules/recurring/api/recurring.actions";
import { listSavingsPots } from "@/modules/savings/api/savings.actions";

```

In `src/modules/expenses/pages/ExpensesPage.tsx` (change 2 of 3), find:

```tsx
  const isCurrentMonth = year === current.year && month === current.month;
  const period = resolvePeriod(year, month, dateFormat);

  const [members, categories, expenseRows, income, recurringItems, savingsPots] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    listExpensesForMonth(year, month, dateFormat),
    householdIncome(householdId, year, month),
    listRecurringExpenses(householdId),
    listSavingsPots(householdId),
  ]);

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? "Unknown";
  const expenses = expenseRows.map((e) => ({
    amount: Number(e.amount),
    categoryId: e.categoryId,
    date: e.date,
    id: e.id,
    note: e.note,
    ownerMemberId: e.ownerMemberId,
```

Replace it with:

```tsx
  const isCurrentMonth = year === current.year && month === current.month;
  const period = resolvePeriod(year, month, dateFormat);

  const [members, categories, expenseRows, income, recurringItems, savingsPots, fundData] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    listExpensesForMonth(year, month, dateFormat),
    householdIncome(householdId, year, month),
    listRecurringExpenses(householdId),
    listSavingsPots(householdId),
    listFundData(householdId),
  ]);

  // Funds that can pay for an expense, with what each holds today.
  const activeFunds = fundData.funds.filter((f) => !f.archived);
  const balances = fundBalances({ ...fundData, funds: activeFunds, through: current });

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? "Unknown";
  const expenses = expenseRows.map((e) => ({
    amount: Number(e.amount),
    categoryId: e.categoryId,
    date: e.date,
    fundAmount: e.fundAmount === null ? null : Number(e.fundAmount),
    fundId: e.fundId,
    id: e.id,
    note: e.note,
    ownerMemberId: e.ownerMemberId,
```

In `src/modules/expenses/pages/ExpensesPage.tsx` (change 3 of 3), find:

```tsx
      daysLeft={isCurrentMonth ? daysLeftInMonth(year, month, dateFormat) : null}
      expenses={expenses}
      exportRows={exportRows}
      income={income}
      members={members.map((m) => ({ id: m.id, name: m.user.name }))}
      monthLabel={monthLabel}
```

Replace it with:

```tsx
      daysLeft={isCurrentMonth ? daysLeftInMonth(year, month, dateFormat) : null}
      expenses={expenses}
      exportRows={exportRows}
      funds={activeFunds.map((f) => ({ balance: balances.get(f.id) ?? 0, id: f.id, name: f.name, ownerMemberId: f.ownerMemberId }))}
      income={income}
      members={members.map((m) => ({ id: m.id, name: m.user.name }))}
      monthLabel={monthLabel}
```

- [ ] **Step 5: Count only the part paid from pay**

In `src/modules/notifications/api/notifications.actions.ts` (change 1 of 2), find:

```ts
import { formatNPR } from "@/modules/dashboard/lib/format";
import { walletShares } from "@/modules/dashboard/lib/wallet";
import { cycleStatus, expectedNextAmount, nextEntryDueDate } from "@/modules/dhuku/lib/dhuku-stats";
import { formatDueDate } from "@/modules/recurring/lib/recurring-stats";
import { periodOfDate } from "@/modules/savings/lib/savings-forecast";

```

Replace it with:

```ts
import { formatNPR } from "@/modules/dashboard/lib/format";
import { walletShares } from "@/modules/dashboard/lib/wallet";
import { cycleStatus, expectedNextAmount, nextEntryDueDate } from "@/modules/dhuku/lib/dhuku-stats";
import { payRows } from "@/modules/expenses/lib/pay-amount";
import { formatDueDate } from "@/modules/recurring/lib/recurring-stats";
import { periodOfDate } from "@/modules/savings/lib/savings-forecast";

```

In `src/modules/notifications/api/notifications.actions.ts` (change 2 of 2), find:

```ts
        lte(expenses.date, period.endDate),
      ),
    );
  // What came out of this person's own wallet, the same as the Budget page.
  const memberIds = members.map((m) => m.id);
  const spent = monthExpenses
    .flatMap((e) =>
      walletShares(
        { amount: Number(e.amount), paidByMemberId: e.paidByMemberId, payBackAmount: e.payBackAmount === null ? null : Number(e.payBackAmount) },
```

Replace it with:

```ts
        lte(expenses.date, period.endDate),
      ),
    );
  // What came out of this person's own wallet, the same as the Budget page
  // (leaving out any part a fund paid).
  const memberIds = members.map((m) => m.id);
  const spent = payRows(monthExpenses)
    .flatMap((e) =>
      walletShares(
        { amount: Number(e.amount), paidByMemberId: e.paidByMemberId, payBackAmount: e.payBackAmount === null ? null : Number(e.payBackAmount) },
```

In `src/modules/reports/pages/ReportsPage.tsx` (change 1 of 2), find:

```tsx
import { pctOfIncome } from "@/modules/dashboard/lib/format";
import { listExpensesForMonth, listExpensesForRange } from "@/modules/expenses/api/expenses.actions";
import { roleForOwner } from "@/modules/expenses/lib/member-tone";
import { ReportsView } from "@/modules/reports/components/ReportsView";
import {
  budgetVsActual,
```

Replace it with:

```tsx
import { pctOfIncome } from "@/modules/dashboard/lib/format";
import { listExpensesForMonth, listExpensesForRange } from "@/modules/expenses/api/expenses.actions";
import { roleForOwner } from "@/modules/expenses/lib/member-tone";
import { payRows } from "@/modules/expenses/lib/pay-amount";
import { ReportsView } from "@/modules/reports/components/ReportsView";
import {
  budgetVsActual,
```

In `src/modules/reports/pages/ReportsPage.tsx` (change 2 of 2), find:

```tsx
    listSavingsExpenses(householdId),
  ]);

  // Spending from pay only, the same Spent as Home and Budget. Expenses paid
  // from savings are listed on the Savings tab instead.
  const payExpenseRows = expenseRows.filter((e) => e.savingsPotId === null);
  const payPrevExpenseRows = prevExpenseRows.filter((e) => e.savingsPotId === null);
  const payRangeExpenseRows = rangeExpenseRows.filter((e) => e.savingsPotId === null);

  const memberById = new Map(members.map((m) => [m.id, m]));
  const category = (id: string) => categories.find((c) => c.id === id);
```

Replace it with:

```tsx
    listSavingsExpenses(householdId),
  ]);

  // Spending from pay only, the same Spent as Home and Budget: the part a
  // fund paid is left out. Expenses paid from savings are listed on the
  // Savings tab instead.
  const payExpenseRows = payRows(expenseRows);
  const payPrevExpenseRows = payRows(prevExpenseRows);
  const payRangeExpenseRows = payRows(rangeExpenseRows);

  const memberById = new Map(members.map((m) => [m.id, m]));
  const category = (id: string) => categories.find((c) => c.id === id);
```

- [ ] **Step 6: Check types, unit tests and lint**

Run:

```bash
npx tsc --noEmit
npx vitest run src/modules/expenses/schemas/expense.schema.test.ts src/modules/activity/lib/revert/plan.test.ts
npm test
npm run lint -- --fix
npm run lint
```

Expected: `tsc` prints nothing; every unit test passes (the named ones: 27 tests); lint shows 0 errors.

- [ ] **Step 7: Run the browser tests for this task**

Run:

```bash
npx playwright test e2e/expenses.spec.ts e2e/reports.spec.ts --reporter=line
```

Expected: all pass. This builds the app and resets its own test database first (1–3 minutes). If one fails with `ECONNRESET` or a timeout, re-run it alone (see Global Constraints) before treating it as a real failure. Expenses and Reports should behave exactly as before for anything not paid from a fund.

- [ ] **Step 8: Commit**

```bash
git add src/modules/expenses/schemas/expense.schema.test.ts src/modules/expenses/schemas/expense.schema.ts src/modules/expenses/lib/expense-activity.ts src/modules/activity/lib/revert/entities.ts src/modules/expenses/api/expenses.actions.ts src/modules/expenses/components/ExpenseDialog.tsx src/modules/expenses/components/ExpensesView.tsx src/modules/expenses/pages/ExpensesPage.tsx src/modules/notifications/api/notifications.actions.ts src/modules/reports/pages/ReportsPage.tsx
git commit -m "feat(expenses): pay an expense from a fund"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.


### Task 4.5: Funds on Budget and Home

Funds show on the Budget page (a Funds section, and their set-aside under Set aside first) and on Home (Balances, Moved this month, and "paid from funds" under Spent). Only your own funds can be added to or changed.

**Files:**
- Modify: `src/modules/dashboard/lib/moved.test.ts`
- Modify: `src/modules/dashboard/lib/moved.ts`
- Modify: `src/modules/budget/pages/BudgetPage.tsx`
- Modify: `src/modules/budget/components/BudgetView.tsx`
- Modify: `src/modules/dashboard/pages/DashboardPage.tsx`
- Modify: `src/modules/dashboard/components/HomeView.tsx`
- Modify: `e2e/budget.spec.ts`

**Interfaces:**
- Consumes: Tasks 4.2–4.4.
- Changes: `movedThisMonth` takes `funds` and returns it; `PersonView` gains `funds`; `BudgetView` gains `dueOptions` and `now`; `HomeView`'s ledger gains `paidFromFunds`.

- [ ] **Step 1: Moved this month includes money into funds**

In `src/modules/dashboard/lib/moved.test.ts` (change 1 of 2), find:

```ts
        { amount: 100, date: "2026-10-04", type: "fine" },
        { amount: 34200, date: "2026-10-04", type: "payout" },
      ],
      loanPayments: [
        { amount: 5000, date: "2026-10-10", direction: "taken" },
        { amount: 2000, date: "2026-10-12", direction: "given" },
      ],
    });

    expect(moved).toEqual({ dhuku: 3400, loans: 5000, savings: 10000, total: 18400 });
  });

  it("ignores anything outside the month", () => {
```

Replace it with:

```ts
        { amount: 100, date: "2026-10-04", type: "fine" },
        { amount: 34200, date: "2026-10-04", type: "payout" },
      ],
      funds: 0,
      loanPayments: [
        { amount: 5000, date: "2026-10-10", direction: "taken" },
        { amount: 2000, date: "2026-10-12", direction: "given" },
      ],
    });

    expect(moved).toEqual({ dhuku: 3400, funds: 0, loans: 5000, savings: 10000, total: 18400 });
  });

  it("adds money put into funds", () => {
    const moved = movedThisMonth({ ...OCTOBER, deposits: [], dhukuEntries: [], funds: 1225, loanPayments: [] });

    expect(moved).toEqual({ dhuku: 0, funds: 1225, loans: 0, savings: 0, total: 1225 });
  });

  it("ignores anything outside the month", () => {
```

In `src/modules/dashboard/lib/moved.test.ts` (change 2 of 2), find:

```ts
      ...OCTOBER,
      deposits: [{ amount: 10000, date: "2026-09-30", kind: "deposit" }],
      dhukuEntries: [{ amount: 3000, date: "2026-11-01", type: "contribution" }],
      loanPayments: [{ amount: 5000, date: "2026-09-15", direction: "taken" }],
    });

    expect(moved).toEqual({ dhuku: 0, loans: 0, savings: 0, total: 0 });
  });
});
```

Replace it with:

```ts
      ...OCTOBER,
      deposits: [{ amount: 10000, date: "2026-09-30", kind: "deposit" }],
      dhukuEntries: [{ amount: 3000, date: "2026-11-01", type: "contribution" }],
      funds: 0,
      loanPayments: [{ amount: 5000, date: "2026-09-15", direction: "taken" }],
    });

    expect(moved).toEqual({ dhuku: 0, funds: 0, loans: 0, savings: 0, total: 0 });
  });
});
```

Replace the whole of `src/modules/dashboard/lib/moved.ts` with:

```ts
export type MovedThisMonth = { dhuku: number; funds: number; loans: number; savings: number; total: number };

// Money that left this month's pay for your own piles rather than being
// spent: savings deposits, dhuku payments, repayments on loans you took, and
// money put into funds. Dhuku payments count in full here because their cost
// part (food, interest, fines) isn't in Spent; the Dhuku page shows that
// cost. Money coming back (a payout, a loan repaid to you) isn't subtracted.
// `funds` is worked out by the caller: this month's set-asides plus money
// added, since a fund only exists in Piko.
export function movedThisMonth(input: {
  deposits: { amount: number; date: string; kind: string }[];
  dhukuEntries: { amount: number; date: string; type: string }[];
  endDate: string;
  funds: number;
  loanPayments: { amount: number; date: string; direction: "given" | "taken" }[];
  startDate: string;
}): MovedThisMonth {
  const inMonth = (date: string) => date >= input.startDate && date <= input.endDate;
  const sum = (values: number[]) => Math.round(values.reduce((total, value) => total + value, 0) * 100) / 100;
  const savings = sum(input.deposits.filter((d) => d.kind === "deposit" && inMonth(d.date)).map((d) => d.amount));
  const dhuku = sum(input.dhukuEntries.filter((e) => e.type !== "payout" && inMonth(e.date)).map((e) => e.amount));
  const loans = sum(input.loanPayments.filter((p) => p.direction === "taken" && inMonth(p.date)).map((p) => p.amount));
  return { dhuku, funds: input.funds, loans, savings, total: sum([savings, dhuku, loans, input.funds]) };
}
```

- [ ] **Step 2: Funds on the Budget page**

In `src/modules/budget/pages/BudgetPage.tsx` (change 1 of 8), find:

```tsx
import { buildBudgetLead, buildPersonPlan, overBudgetRows, sharedRows } from "@/modules/budget/lib/budget-view";
import { monthIncome } from "@/modules/budget/lib/income";
import { lastKindByCategory } from "@/modules/budget/lib/plan-lines";
import { dhukuSetAsides, loanSetAsides, savingsSetAsides } from "@/modules/budget/lib/set-aside";
import { listCategories } from "@/modules/categories/api/categories";
import { walletShares } from "@/modules/dashboard/lib/wallet";
import { listDhukuEntries, listDhukus } from "@/modules/dhuku/api/dhuku.actions";
import { listExpensesForMonth } from "@/modules/expenses/api/expenses.actions";
import { listLoanPayments, listLoans } from "@/modules/loans/api/loans.actions";
import { checkBudgetReminder } from "@/modules/notifications/api/notifications.actions";
import { listSavingsDeposits, listSavingsPotPlans, listSavingsPots } from "@/modules/savings/api/savings.actions";

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
```

Replace it with:

```tsx
import { buildBudgetLead, buildPersonPlan, overBudgetRows, sharedRows } from "@/modules/budget/lib/budget-view";
import { monthIncome } from "@/modules/budget/lib/income";
import { lastKindByCategory } from "@/modules/budget/lib/plan-lines";
import { dhukuSetAsides, fundSetAsides, loanSetAsides, savingsSetAsides } from "@/modules/budget/lib/set-aside";
import { listCategories } from "@/modules/categories/api/categories";
import { walletShares } from "@/modules/dashboard/lib/wallet";
import { listDhukuEntries, listDhukus } from "@/modules/dhuku/api/dhuku.actions";
import { listExpensesForMonth } from "@/modules/expenses/api/expenses.actions";
import { payRows } from "@/modules/expenses/lib/pay-amount";
import { listFundData } from "@/modules/funds/api/funds";
import { fundBalances, setAsideFor, suggestedMonthly } from "@/modules/funds/lib/fund-math";
import { listLoanPayments, listLoans } from "@/modules/loans/api/loans.actions";
import { checkBudgetReminder } from "@/modules/notifications/api/notifications.actions";
import { listSavingsDeposits, listSavingsPotPlans, listSavingsPots } from "@/modules/savings/api/savings.actions";
import { monthAfter } from "@/modules/savings/lib/savings-forecast";

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
```

In `src/modules/budget/pages/BudgetPage.tsx` (change 2 of 8), find:

```tsx
    dhukuEntryRows,
    loanRows,
    loanPaymentRows,
  ] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
```

Replace it with:

```tsx
    dhukuEntryRows,
    loanRows,
    loanPaymentRows,
    fundData,
  ] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
```

In `src/modules/budget/pages/BudgetPage.tsx` (change 3 of 8), find:

```tsx
    listDhukuEntries(householdId),
    listLoans(householdId),
    listLoanPayments(householdId),
  ]);

  if (isCurrentMonth) {
```

Replace it with:

```tsx
    listDhukuEntries(householdId),
    listLoans(householdId),
    listLoanPayments(householdId),
    listFundData(householdId),
  ]);

  if (isCurrentMonth) {
```

In `src/modules/budget/pages/BudgetPage.tsx` (change 4 of 8), find:

```tsx
  const categoryList = categories.map((c) => ({ budgetType: c.budgetType, groupName: c.groupName, id: c.id, name: c.name }));

  // Each person's spending is what left their own wallet, the same as Home.
  // Expenses paid from savings were saved for in earlier months, so they don't
  // count against this month's budget.
  const shares = expenseRows
    .filter((e) => e.savingsPotId === null)
    .flatMap((e) =>
      walletShares(
        { amount: Number(e.amount), paidByMemberId: e.paidByMemberId, payBackAmount: e.payBackAmount === null ? null : Number(e.payBackAmount) },
        memberIds,
```

Replace it with:

```tsx
  const categoryList = categories.map((c) => ({ budgetType: c.budgetType, groupName: c.groupName, id: c.id, name: c.name }));

  // Each person's spending is what left their own wallet, the same as Home.
  // Expenses paid from savings or a fund were saved for in earlier months, so
  // only the part paid from pay counts against this month's budget.
  const shares = payRows(expenseRows).flatMap((e) =>
      walletShares(
        { amount: Number(e.amount), paidByMemberId: e.paidByMemberId, payBackAmount: e.payBackAmount === null ? null : Number(e.payBackAmount) },
        memberIds,
```

In `src/modules/budget/pages/BudgetPage.tsx` (change 5 of 8), find:

```tsx
    principalAmount: Number(l.principalAmount),
  }));
  const payments = loanPaymentRows.map((p) => ({ amount: Number(p.amount), date: p.date, loanId: p.loanId }));

  const ordered = [...members.filter((m) => m.id === memberId), ...members.filter((m) => m.id !== memberId)];
  const people: PersonView[] = ordered.map((member) => {
```

Replace it with:

```tsx
    principalAmount: Number(l.principalAmount),
  }));
  const payments = loanPaymentRows.map((p) => ({ amount: Number(p.amount), date: p.date, loanId: p.loanId }));
  const thisMonth = { month, year };

  const ordered = [...members.filter((m) => m.id === memberId), ...members.filter((m) => m.id !== memberId)];
  const people: PersonView[] = ordered.map((member) => {
```

In `src/modules/budget/pages/BudgetPage.tsx` (change 6 of 8), find:

```tsx
      ...savingsSetAsides({ deposits, memberId: member.id, period, plans, pots: potRows }),
      ...dhukuSetAsides({ dhukus, entries: dhukuEntries, memberId: member.id, period }),
      ...loanSetAsides({ loans, memberId: member.id, payments, period }),
    ];
    const setAside = setAsideRows.reduce((sum, row) => sum + row.planned, 0);
    // The plan runs on pay only: extra income never makes room in it.
    const unplanned = income.pay - setAside - plan.budgeted;
    const carried = lines.find((l) => l.inherited);
    const payCarriedFrom = income.payCarriedFrom ? formatPeriodLabel(income.payCarriedFrom.year, income.payCarriedFrom.month, dateFormat) : null;

    return {
      carriedFrom: carried ? formatPeriodLabel(carried.year, carried.month, dateFormat) : null,
      key: member.id === memberId ? ("me" as const) : ("partner" as const),
      lastKinds: lastKindByCategory(datedLines, member.id),
      lead: buildBudgetLead({
```

Replace it with:

```tsx
      ...savingsSetAsides({ deposits, memberId: member.id, period, plans, pots: potRows }),
      ...dhukuSetAsides({ dhukus, entries: dhukuEntries, memberId: member.id, period }),
      ...loanSetAsides({ loans, memberId: member.id, payments, period }),
      ...fundSetAsides({ funds: fundData.funds, memberId: member.id, month: thisMonth, plans: fundData.plans }),
    ];
    const setAside = setAsideRows.reduce((sum, row) => sum + row.planned, 0);
    // The plan runs on pay only: extra income never makes room in it.
    const unplanned = income.pay - setAside - plan.budgeted;
    const carried = lines.find((l) => l.inherited);
    const personFunds = fundData.funds.filter((f) => f.ownerMemberId === member.id && !f.archived);
    const fundBalance = fundBalances({ ...fundData, funds: personFunds, through: thisMonth });
    const payCarriedFrom = income.payCarriedFrom ? formatPeriodLabel(income.payCarriedFrom.year, income.payCarriedFrom.month, dateFormat) : null;

    return {
      carriedFrom: carried ? formatPeriodLabel(carried.year, carried.month, dateFormat) : null,
      funds: personFunds.map((fund) => {
        const balance = fundBalance.get(fund.id) ?? 0;
        const due = fund.dueYear !== null && fund.dueMonth !== null ? { month: fund.dueMonth, year: fund.dueYear } : null;
        return {
          balance,
          due,
          dueLabel: due ? formatPeriodLabel(due.year, due.month, dateFormat) : null,
          id: fund.id,
          monthlyAmount: setAsideFor(
            fundData.plans.filter((p) => p.fundId === fund.id),
            thisMonth,
          ),
          name: fund.name,
          suggested: suggestedMonthly({ balance, due, now: thisMonth, target: fund.target }),
          target: fund.target,
        };
      }),
      key: member.id === memberId ? ("me" as const) : ("partner" as const),
      lastKinds: lastKindByCategory(datedLines, member.id),
      lead: buildBudgetLead({
```

In `src/modules/budget/pages/BudgetPage.tsx` (change 7 of 8), find:

```tsx
  return (
    <BudgetView
      categories={categoryList}
      month={month}
      monthLabel={formatPeriodLabel(year, month, dateFormat)}
      monthNav={buildMonthNav({
```

Replace it with:

```tsx
  return (
    <BudgetView
      categories={categoryList}
      dueOptions={Array.from({ length: 36 }, (_, i) => monthAfter(currentYear, currentMonth, i)).map((ym) => ({
        label: formatPeriodLabel(ym.year, ym.month, dateFormat),
        value: `${ym.year}-${ym.month}`,
      }))}
      month={month}
      monthLabel={formatPeriodLabel(year, month, dateFormat)}
      monthNav={buildMonthNav({
```

In `src/modules/budget/pages/BudgetPage.tsx` (change 8 of 8), find:

```tsx
        dateFormat,
        selected: { month, year },
      })}
      people={people}
      shared={sharedRows(planLines, categoryList)}
      year={year}
```

Replace it with:

```tsx
        dateFormat,
        selected: { month, year },
      })}
      now={thisMonth}
      people={people}
      shared={sharedRows(planLines, categoryList)}
      year={year}
```

In `src/modules/budget/components/BudgetView.tsx` (change 1 of 8), find:

```tsx
import type { ExtraIncome } from "@/modules/budget/lib/income";
import type { BudgetLineKind } from "@/modules/budget/lib/plan-lines";
import type { SetAsideRow } from "@/modules/budget/lib/set-aside";

type Category = { budgetType: "fixed" | "flexible"; groupName: string; id: string; name: string };

```

Replace it with:

```tsx
import type { ExtraIncome } from "@/modules/budget/lib/income";
import type { BudgetLineKind } from "@/modules/budget/lib/plan-lines";
import type { SetAsideRow } from "@/modules/budget/lib/set-aside";
import { FundDialog, type FundView } from "@/modules/funds/components/FundDialog";
import type { YearMonth } from "@/modules/funds/lib/fund-math";

type Category = { budgetType: "fixed" | "flexible"; groupName: string; id: string; name: string };

```

In `src/modules/budget/components/BudgetView.tsx` (change 2 of 8), find:

```tsx
export type PersonView = {
  // Set when this month shows a plan carried over from an earlier month.
  carriedFrom: null | string;
  key: "me" | "partner";
  lastKinds: Record<string, BudgetLineKind>;
  lead: BudgetLead;
```

Replace it with:

```tsx
export type PersonView = {
  // Set when this month shows a plan carried over from an earlier month.
  carriedFrom: null | string;
  funds: FundView[];
  key: "me" | "partner";
  lastKinds: Record<string, BudgetLineKind>;
  lead: BudgetLead;
```

In `src/modules/budget/components/BudgetView.tsx` (change 3 of 8), find:

```tsx

type Props = {
  categories: Category[];
  month: number;
  monthLabel: string;
  monthNav: MonthNavModel;
  people: PersonView[];
  shared: SharedRow[];
  year: number;
```

Replace it with:

```tsx

type Props = {
  categories: Category[];
  // Months a fund can be needed by.
  dueOptions: { label: string; value: string }[];
  month: number;
  monthLabel: string;
  monthNav: MonthNavModel;
  now: YearMonth;
  people: PersonView[];
  shared: SharedRow[];
  year: number;
```

In `src/modules/budget/components/BudgetView.tsx` (change 4 of 8), find:

```tsx
  const [openUnbudgeted, setOpenUnbudgeted] = useState(false);
  const [dialog, setDialog] = useState<{ defaultCategoryId?: string; initial?: BudgetDraft; open: boolean }>({ open: false });
  const [payOpen, setPayOpen] = useState(false);
  const [fillPending, setFillPending] = useState(false);

  const person = tab === "shared" ? null : (props.people.find((p) => p.key === tab) ?? props.people[0]);
```

Replace it with:

```tsx
  const [openUnbudgeted, setOpenUnbudgeted] = useState(false);
  const [dialog, setDialog] = useState<{ defaultCategoryId?: string; initial?: BudgetDraft; open: boolean }>({ open: false });
  const [payOpen, setPayOpen] = useState(false);
  // The fund is looked up by id on every render, so its balance updates after "Add money".
  const [fundDialog, setFundDialog] = useState<{ fundId?: string; open: boolean }>({ open: false });
  const [fillPending, setFillPending] = useState(false);

  const person = tab === "shared" ? null : (props.people.find((p) => p.key === tab) ?? props.people[0]);
```

In `src/modules/budget/components/BudgetView.tsx` (change 5 of 8), find:

```tsx
        />
      )}

      {tab === "shared" && (
        <>
          <RowGroupHead columns={COLUMNS} first>
```

Replace it with:

```tsx
        />
      )}

      {person && (
        <FundRows
          canEdit={person.key === "me"}
          funds={person.funds}
          onAdd={() => setFundDialog({ open: true })}
          onFund={(fund) => setFundDialog({ fundId: fund.id, open: true })}
        />
      )}

      {tab === "shared" && (
        <>
          <RowGroupHead columns={COLUMNS} first>
```

In `src/modules/budget/components/BudgetView.tsx` (change 6 of 8), find:

```tsx
        />
      )}

      {person && (
        <PayDialog
          extras={person.pay.extras}
```

Replace it with:

```tsx
        />
      )}

      {person?.key === "me" && (
        <FundDialog
          dueOptions={props.dueOptions}
          fund={person.funds.find((f) => f.id === fundDialog.fundId)}
          now={props.now}
          onOpenChange={(value) => !value && setFundDialog({ open: false })}
          open={fundDialog.open}
        />
      )}

      {person && (
        <PayDialog
          extras={person.pay.extras}
```

In `src/modules/budget/components/BudgetView.tsx` (change 7 of 8), find:

```tsx
      <RowGroupHead columns={COLUMNS} first>
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="text-[15px] font-semibold whitespace-nowrap">Set aside first</span>
          <span className="truncate text-[13px] text-n-600">Filled in from savings, dhuku and loans</span>
        </div>
        <div className="text-right text-[15px] font-semibold">
          <Money value={setAside.planned} />
```

Replace it with:

```tsx
      <RowGroupHead columns={COLUMNS} first>
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="text-[15px] font-semibold whitespace-nowrap">Set aside first</span>
          <span className="truncate text-[13px] text-n-600">Filled in from savings, dhuku, loans and funds</span>
        </div>
        <div className="text-right text-[15px] font-semibold">
          <Money value={setAside.planned} />
```

In `src/modules/budget/components/BudgetView.tsx` (change 8 of 8), find:

```tsx
  );
}

type PersonRowsProps = {
  // The "Set aside first" group sits above, so the first kind group isn't first on the page.
  afterSetAside: boolean;
```

Replace it with:

```tsx
  );
}

type FundRowsProps = {
  // Funds are their owner's: only your own can be added to or changed.
  canEdit: boolean;
  funds: FundView[];
  onAdd: () => void;
  onFund: (fund: FundView) => void;
};

// Funds: each one's monthly set-aside, what it holds, and its target.
function FundRows({ canEdit, funds, onAdd, onFund }: FundRowsProps) {
  if (!canEdit && funds.length === 0) return null;
  return (
    <>
      <RowGroupHead columns={COLUMNS}>
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="text-[15px] font-semibold whitespace-nowrap">Funds</span>
          <span className="truncate text-[13px] text-n-600">
            {funds.length === 0 ? "Money set aside for occasional costs" : "Monthly, holds, target"}
          </span>
        </div>
        <div className="col-span-4 flex justify-end">
          {canEdit && (
            <Button className="h-auto px-1.5 py-0.75 text-[13px]" onClick={onAdd} type="button" variant="ghost">
              <Plus />
              Add fund
            </Button>
          )}
        </div>
      </RowGroupHead>
      {funds.map((fund) => {
        const ratio = fund.target ? Math.max(0, fund.balance / fund.target) : 0;
        const short = fund.suggested !== null && fund.suggested > fund.monthlyAmount;
        return (
          <Row columns={COLUMNS} key={fund.id} onClick={canEdit ? () => onFund(fund) : undefined}>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[15px] whitespace-nowrap">{fund.name}</span>
              {fund.dueLabel && (
                <span className={cn("truncate text-xs", short ? "text-signal-ink" : "text-n-600")}>
                  Needed by {fund.dueLabel}
                  {short && fund.suggested !== null ? ` · needs ${formatMoney(fund.suggested)} a month` : ""}
                </span>
              )}
            </div>
            <div className="text-right text-[15px]">
              <Money value={fund.monthlyAmount} />
            </div>
            <div className="text-right text-[15px]">
              <Money tone={fund.balance < 0 ? "negative" : "default"} value={fund.balance} />
            </div>
            <div className="text-right text-[15px]">{fund.target === null ? <span className="text-n-500">—</span> : <Money value={fund.target} />}</div>
            <div className="flex min-w-0 items-center gap-2.5">
              {fund.target !== null && (
                <>
                  <Meter className="flex-1" ratio={Math.min(1, ratio)} />
                  <span className="w-10.5 text-right text-[13px] text-n-700">{pct(ratio)}</span>
                </>
              )}
            </div>
          </Row>
        );
      })}
    </>
  );
}

type PersonRowsProps = {
  // The "Set aside first" group sits above, so the first kind group isn't first on the page.
  afterSetAside: boolean;
```

- [ ] **Step 3: Funds on Home**

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 1 of 9), find:

```tsx
import { listIncomeRows, listPlanLines } from "@/modules/budget/api/budget";
import { buildPersonPlan, overrunFromPlan, overrunNote } from "@/modules/budget/lib/budget-view";
import { monthIncome } from "@/modules/budget/lib/income";
import { listCategories } from "@/modules/categories/api/categories";
import {
  type HomeBalanceRow,
```

Replace it with:

```tsx
import { listIncomeRows, listPlanLines } from "@/modules/budget/api/budget";
import { buildPersonPlan, overrunFromPlan, overrunNote } from "@/modules/budget/lib/budget-view";
import { monthIncome } from "@/modules/budget/lib/income";
import { fundSetAsides } from "@/modules/budget/lib/set-aside";
import { listCategories } from "@/modules/categories/api/categories";
import {
  type HomeBalanceRow,
```

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 2 of 9), find:

```tsx
import { dhukuPosition } from "@/modules/dhuku/lib/dhuku-money";
import { listExpensesForMonth, listRecentExpenses } from "@/modules/expenses/api/expenses.actions";
import { groupByDay } from "@/modules/expenses/lib/expense-view";
import { listLoanPayments, listLoans } from "@/modules/loans/api/loans.actions";
import { buildLoanCards, loanOverviewStats } from "@/modules/loans/lib/loan-stats";
import { checkBudgetReminder } from "@/modules/notifications/api/notifications.actions";
```

Replace it with:

```tsx
import { dhukuPosition } from "@/modules/dhuku/lib/dhuku-money";
import { listExpensesForMonth, listRecentExpenses } from "@/modules/expenses/api/expenses.actions";
import { groupByDay } from "@/modules/expenses/lib/expense-view";
import { payRows } from "@/modules/expenses/lib/pay-amount";
import { listFundData } from "@/modules/funds/api/funds";
import { fundBalances } from "@/modules/funds/lib/fund-math";
import { listLoanPayments, listLoans } from "@/modules/loans/api/loans.actions";
import { buildLoanCards, loanOverviewStats } from "@/modules/loans/lib/loan-stats";
import { checkBudgetReminder } from "@/modules/notifications/api/notifications.actions";
```

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 3 of 9), find:

```tsx
    dhukuEntryRows,
    loanRows,
    loanPaymentRows,
  ] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
```

Replace it with:

```tsx
    dhukuEntryRows,
    loanRows,
    loanPaymentRows,
    fundData,
  ] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
```

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 4 of 9), find:

```tsx
    listDhukuEntries(householdId),
    listLoans(householdId),
    listLoanPayments(householdId),
  ]);

  if (isCurrentMonth) {
    await checkBudgetReminder(householdId, year, month, planLines.length);
  }

  // Expenses paid from a savings pot came out of money set aside over many
  // months, not this month's pay. Spent, Left and the weekly allowance leave
  // them out; Home shows the viewer's on their own.
  const payExpenseRows = expenseRows.filter((e) => e.savingsPotId === null);
  const paidFromSavings = expenseRows
    .filter((e) => e.savingsPotId !== null && e.paidByMemberId === memberId)
    .reduce((s, e) => s + Number(e.amount), 0);

  // Pay carries forward from earlier months; extra income counts in its own month.
  const incomes = members.map((m) => ({ amount: monthIncome(incomeRows, m.id, { month, year }).total, memberId: m.id }));
```

Replace it with:

```tsx
    listDhukuEntries(householdId),
    listLoans(householdId),
    listLoanPayments(householdId),
    listFundData(householdId),
  ]);

  if (isCurrentMonth) {
    await checkBudgetReminder(householdId, year, month, planLines.length);
  }

  // Expenses paid from a savings pot or a fund came out of money set aside
  // over earlier months, not this month's pay. Spent, Left and the weekly
  // allowance count only the part paid from pay; Home shows the viewer's
  // savings and fund parts on their own.
  const payExpenseRows = payRows(expenseRows);
  const viewerPaid = expenseRows.filter((e) => e.paidByMemberId === memberId);
  const paidFromSavings = viewerPaid.filter((e) => e.savingsPotId !== null).reduce((s, e) => s + Number(e.amount), 0);
  const paidFromFunds = viewerPaid.reduce((s, e) => s + Number(e.fundAmount ?? 0), 0);

  // Pay carries forward from earlier months; extra income counts in its own month.
  const incomes = members.map((m) => ({ amount: monthIncome(incomeRows, m.id, { month, year }).total, memberId: m.id }));
```

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 5 of 9), find:

```tsx
  const period = resolvePeriod(year, month, dateFormat);
  const memberIds = members.map((m) => m.id);
  const viewerShares = (rows: typeof expenseRows) =>
    rows
      .filter((e) => e.savingsPotId === null)
      .flatMap((e) =>
        walletShares(
          { amount: Number(e.amount), paidByMemberId: e.paidByMemberId, payBackAmount: e.payBackAmount === null ? null : Number(e.payBackAmount) },
          memberIds,
```

Replace it with:

```tsx
  const period = resolvePeriod(year, month, dateFormat);
  const memberIds = members.map((m) => m.id);
  const viewerShares = (rows: typeof expenseRows) =>
    payRows(rows).flatMap((e) =>
        walletShares(
          { amount: Number(e.amount), paidByMemberId: e.paidByMemberId, payBackAmount: e.payBackAmount === null ? null : Number(e.payBackAmount) },
          memberIds,
```

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 6 of 9), find:

```tsx
      reserveFull: balance >= reserveMinimum,
    };
  });
  // Money the viewer moved into their own piles this month: their savings
  // deposits, their dhukus' payments and their repayments on loans they took.
  // Unallocated takes it off too, since it's no longer free to spend.
  const viewerDhukuIds = new Set(dhukuRows.filter((d) => d.ownerMemberId === memberId).map((d) => d.id));
  const moved = movedThisMonth({
    deposits: deposits.filter((d) => d.memberId === memberId),
```

Replace it with:

```tsx
      reserveFull: balance >= reserveMinimum,
    };
  });
  // The viewer's funds: what each holds now, and what went into them this
  // month (the set-aside plus money added).
  const viewerFunds = fundData.funds.filter((f) => f.ownerMemberId === memberId && !f.archived);
  const balancesByFund = fundBalances({ ...fundData, funds: viewerFunds, through: { month, year } });
  const intoFunds =
    fundSetAsides({ funds: viewerFunds, memberId, month: { month, year }, plans: fundData.plans }).reduce((s, r) => s + r.planned, 0) +
    fundData.topUps
      .filter((t) => t.month === month && t.year === year && viewerFunds.some((f) => f.id === t.fundId))
      .reduce((s, t) => s + t.amount, 0);

  // Money the viewer moved into their own piles this month: their savings
  // deposits, their dhukus' payments, their repayments on loans they took and
  // what went into their funds. Unallocated takes it off too, since it's no
  // longer free to spend.
  const viewerDhukuIds = new Set(dhukuRows.filter((d) => d.ownerMemberId === memberId).map((d) => d.id));
  const moved = movedThisMonth({
    deposits: deposits.filter((d) => d.memberId === memberId),
```

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 7 of 9), find:

```tsx
      .filter((e) => viewerDhukuIds.has(e.dhukuId))
      .map((e) => ({ amount: Number(e.amount), date: e.date, type: e.type })),
    endDate: period.endDate,
    loanPayments: loanPaymentRows.flatMap((p) => {
      const loan = loanRows.find((l) => l.id === p.loanId);
      return loan && p.memberId === memberId ? [{ amount: Number(p.amount), date: p.date, direction: loan.direction }] : [];
```

Replace it with:

```tsx
      .filter((e) => viewerDhukuIds.has(e.dhukuId))
      .map((e) => ({ amount: Number(e.amount), date: e.date, type: e.type })),
    endDate: period.endDate,
    funds: intoFunds,
    loanPayments: loanPaymentRows.flatMap((p) => {
      const loan = loanRows.find((l) => l.id === p.loanId);
      return loan && p.memberId === memberId ? [{ amount: Number(p.amount), date: p.date, direction: loan.direction }] : [];
```

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 8 of 9), find:

```tsx
  });
  const balances: HomeBalanceRow[] = [
    ...savings.map((pot) => ({ amount: pot.balance, id: `pot:${pot.id}`, label: pot.name, sub: "Savings" })),
    ...dhukuBalances,
    ...(loanStats.outstandingToReceive > 0
      ? [{ amount: loanStats.outstandingToReceive, id: "loans:owed", label: "Loans owed to you", sub: "Still to be paid back" }]
```

Replace it with:

```tsx
  });
  const balances: HomeBalanceRow[] = [
    ...savings.map((pot) => ({ amount: pot.balance, id: `pot:${pot.id}`, label: pot.name, sub: "Savings" })),
    ...viewerFunds.map((fund) => ({ amount: balancesByFund.get(fund.id) ?? 0, id: `fund:${fund.id}`, label: fund.name, sub: "Fund" })),
    ...dhukuBalances,
    ...(loanStats.outstandingToReceive > 0
      ? [{ amount: loanStats.outstandingToReceive, id: "loans:owed", label: "Loans owed to you", sub: "Still to be paid back" }]
```

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 9 of 9), find:

```tsx
      essentials={essentials}
      ledger={{
        moved,
        paidFromSavings,
        pay: viewerIncome.pay,
        payNote: viewerIncome.extra > 0 ? `+ ${formatMoney(viewerIncome.extra)} extra` : payCarriedFrom ? `Carried over from ${payCarriedFrom}` : null,
```

Replace it with:

```tsx
      essentials={essentials}
      ledger={{
        moved,
        paidFromFunds,
        paidFromSavings,
        pay: viewerIncome.pay,
        payNote: viewerIncome.extra > 0 ? `+ ${formatMoney(viewerIncome.extra)} extra` : payCarriedFrom ? `Carried over from ${payCarriedFrom}` : null,
```

In `src/modules/dashboard/components/HomeView.tsx` (change 1 of 3), find:

```tsx
  essentials: HomeEssential[];
  // The figures of the person viewing Home.
  ledger: {
    moved: { dhuku: number; loans: number; savings: number; total: number };
    paidFromSavings: number;
    pay: number;
    payNote: null | string;
```

Replace it with:

```tsx
  essentials: HomeEssential[];
  // The figures of the person viewing Home.
  ledger: {
    moved: { dhuku: number; funds: number; loans: number; savings: number; total: number };
    paidFromFunds: number;
    paidFromSavings: number;
    pay: number;
    payNote: null | string;
```

In `src/modules/dashboard/components/HomeView.tsx` (change 2 of 3), find:

```tsx
              )}
              {spentTrend && <span>{spentTrend}</span>}
              {ledger.paidFromSavings > 0 && <span>{formatMoney(ledger.paidFromSavings)} paid from savings</span>}
            </>
          }
        >
```

Replace it with:

```tsx
              )}
              {spentTrend && <span>{spentTrend}</span>}
              {ledger.paidFromSavings > 0 && <span>{formatMoney(ledger.paidFromSavings)} paid from savings</span>}
              {ledger.paidFromFunds > 0 && <span>{formatMoney(ledger.paidFromFunds)} paid from funds</span>}
            </>
          }
        >
```

In `src/modules/dashboard/components/HomeView.tsx` (change 3 of 3), find:

```tsx
          label="Moved this month"
          note={
            ledger.moved.total > 0
              ? `Savings ${formatMoney(ledger.moved.savings)} · Dhuku ${formatMoney(ledger.moved.dhuku)} · Loans ${formatMoney(ledger.moved.loans)}`
              : "Nothing moved yet"
          }
        >
```

Replace it with:

```tsx
          label="Moved this month"
          note={
            ledger.moved.total > 0
              ? `Savings ${formatMoney(ledger.moved.savings)} · Dhuku ${formatMoney(ledger.moved.dhuku)} · Loans ${formatMoney(ledger.moved.loans)} · Funds ${formatMoney(ledger.moved.funds)}`
              : "Nothing moved yet"
          }
        >
```

- [ ] **Step 4: Test funds in the browser**

In `e2e/budget.spec.ts`, find:

```ts
  });
});

test.describe("budget", () => {
  test.beforeEach(async ({ page }) => {
    await gotoRoute(page, "/budget");
```

Replace it with:

```ts
  });
});

test.describe("funds", () => {
  test.beforeEach(() => test.slow());

  test("a fund sets money aside each month and can take money added", async ({ page }) => {
    const name = `e2e fund ${Date.now()}`;
    await gotoRoute(page, "/budget");

    await page.getByRole("button", { name: "Add fund" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill(name);
    await dialog.getByLabel("Set aside each month").fill("1225");
    await dialog.getByRole("button", { name: "Save fund" }).click();
    await expect(dialog).toBeHidden({ timeout: 20_000 });
    await page.reload();

    // Once under "Set aside first", once under Funds.
    await expect(budgetRow(page, name)).toHaveCount(2);

    await budgetRow(page, name).last().click();
    await dialog.getByLabel("Amount to add").fill("5000");
    await dialog.getByRole("button", { name: "Add money" }).click();
    await expect(dialog.getByText("Holds Rs 6,225.00")).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("budget", () => {
  test.beforeEach(async ({ page }) => {
    await gotoRoute(page, "/budget");
```

- [ ] **Step 5: Check types, unit tests and lint**

Run:

```bash
npx tsc --noEmit
npx vitest run src/modules/dashboard/lib/moved.test.ts
npm test
npm run lint -- --fix
npm run lint
```

Expected: `tsc` prints nothing; every unit test passes (the named ones: 3 tests); lint shows 0 errors.

- [ ] **Step 6: Run the browser tests for this task**

Run:

```bash
npx playwright test e2e/budget.spec.ts e2e/dashboard.spec.ts --reporter=line
```

Expected: all pass. This builds the app and resets its own test database first (1–3 minutes). If one fails with `ECONNRESET` or a timeout, re-run it alone (see Global Constraints) before treating it as a real failure. The new funds test adds a fund in the current month; nothing else reads its numbers.

- [ ] **Step 7: Commit**

```bash
git add src/modules/dashboard/lib/moved.test.ts src/modules/dashboard/lib/moved.ts src/modules/budget/pages/BudgetPage.tsx src/modules/budget/components/BudgetView.tsx src/modules/dashboard/pages/DashboardPage.tsx src/modules/dashboard/components/HomeView.tsx e2e/budget.spec.ts
git commit -m "feat(funds): funds on Budget and Home"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.


### Phase 4 checkpoint: STOP

Stop here. Do not start Phase 5.

Send the owner a short report:

- The task commits made in this phase (`git log --oneline` since the phase began).
- The new migration file's name, and that it adds the `funds`, `fund_plans` and `fund_top_ups` tables, the `expenses.fund_id` and `expenses.fund_amount` columns and the `fund` / `fund_top_up` activity types. The owner should check: Budget's Funds section adds a fund (monthly amount, optional target and needed-by month) and it appears under Set aside first; Add money raises its balance; Archive takes it out of the plan; on Expenses, Paid from lists the payer's funds, and paying more than a fund holds shows how much counts as this month's spending; Home's Balances shows the funds and Moved this month includes them.
- The results of `npx tsc --noEmit`, `npm test`, `npm run lint` and `npm run test:e2e` (say which e2e tests failed, if any, and whether they passed when re-run alone).
- Anything that didn't match the plan and what you did about it.

Then wait. The owner applies the migration (`npm run db:migrate`) on their database themselves, tries the app, and tells you whether to go on.

## Phase 5: Extra money and the cushion

From the first day of a new month, Home asks what to do with last month's leftover: put it into savings, funds or loans, or keep it as cushion. A month that went over is taken from the cushion. The cushion shows in Balances with a target.

### Task 5.1: The cushion and month settlements

The cushion's entries and target, a row per decided month, and two new activity types with their Activity wording.

**Files:**
- Create: `src/db/schema/cushions.ts`
- Modify: `src/db/schema/index.ts`
- Modify: `src/db/schema/activityLogs.ts`
- Modify: `src/modules/activity/lib/activity-format.ts`
- Modify: `src/modules/activity/lib/sections.ts`
- Generate: a new migration under `drizzle/` (with `npm run db:generate`)

- [ ] **Step 1: Change the schema**

Create `src/db/schema/cushions.ts` with:

```ts
import { integer, numeric, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { householdMembers } from "./householdMembers";
import { households } from "./households";

export const cushionEntryKindEnum = pgEnum("cushion_entry_kind", ["kept", "overspend", "adjust"]);

// Each person's cushion: money in their everyday account beyond the month's
// plan. It only ever changes through these entries: money kept from a month
// ("kept"), a month that went over ("overspend", negative), or a correction
// by hand ("adjust"). year/month is the month the entry is about.
export const cushionEntries = pgTable("cushion_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  memberId: uuid("member_id")
    .notNull()
    .references(() => householdMembers.id, { onDelete: "cascade" }),
  kind: cushionEntryKindEnum("kind").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// The cushion a person is aiming for.
export const cushionTargets = pgTable("cushion_targets", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  memberId: uuid("member_id")
    .notNull()
    .unique()
    .references(() => householdMembers.id, { onDelete: "cascade" }),
  target: numeric("target", { precision: 12, scale: 2 }).notNull(),
});

// A month whose leftover (or overspend) its person has decided on. Its row
// is what stops Home asking about that month again. amount is what was left
// to decide at the time.
export const monthSettlements = pgTable(
  "month_settlements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => householdMembers.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [unique().on(table.memberId, table.year, table.month)],
);
```

In `src/db/schema/index.ts`, find:

```ts
export * from "./paybacks";
export * from "./savings";
export * from "./funds";
export * from "./notifications";
export * from "./loans";
export * from "./dhukus";
```

Replace it with:

```ts
export * from "./paybacks";
export * from "./savings";
export * from "./funds";
export * from "./cushions";
export * from "./notifications";
export * from "./loans";
export * from "./dhukus";
```

In `src/db/schema/activityLogs.ts` (change 1 of 2), find:

```ts
  "account",
  "budget_item",
  "category",
  "dhuku",
  "dhuku_entry",
  "expense",
```

Replace it with:

```ts
  "account",
  "budget_item",
  "category",
  "cushion",
  "dhuku",
  "dhuku_entry",
  "expense",
```

In `src/db/schema/activityLogs.ts` (change 2 of 2), find:

```ts
  "income",
  "loan",
  "loan_payment",
  "payback",
  "recurring_expense",
  "savings_contribution",
```

Replace it with:

```ts
  "income",
  "loan",
  "loan_payment",
  "month_settlement",
  "payback",
  "recurring_expense",
  "savings_contribution",
```

In `src/modules/activity/lib/activity-format.ts` (change 1 of 2), find:

```ts
  account: "their account",
  budget_item: "a budget line",
  category: "a category",
  dhuku: "a dhuku",
  dhuku_entry: "a dhuku entry",
  expense: "an expense",
```

Replace it with:

```ts
  account: "their account",
  budget_item: "a budget line",
  category: "a category",
  cushion: "the cushion",
  dhuku: "a dhuku",
  dhuku_entry: "a dhuku entry",
  expense: "an expense",
```

In `src/modules/activity/lib/activity-format.ts` (change 2 of 2), find:

```ts
  income: "income",
  loan: "a loan",
  loan_payment: "a loan payment",
  payback: "a payback",
  recurring_expense: "a recurring bill",
  savings_contribution: "a savings contribution",
```

Replace it with:

```ts
  income: "income",
  loan: "a loan",
  loan_payment: "a loan payment",
  month_settlement: "a month's leftover",
  payback: "a payback",
  recurring_expense: "a recurring bill",
  savings_contribution: "a savings contribution",
```

In `src/modules/activity/lib/sections.ts`, find:

```ts
// How the Activity page groups entity types into its "Section" filter.
export const ACTIVITY_SECTIONS = [
  { entityTypes: ["expense", "payback"], label: "Expenses", value: "expenses" },
  { entityTypes: ["budget_item", "income", "fund", "fund_top_up"], label: "Income & budget", value: "budget" },
  {
    entityTypes: ["savings_pot", "savings_item", "savings_deposit", "savings_goal", "savings_contribution"],
    label: "Savings",
```

Replace it with:

```ts
// How the Activity page groups entity types into its "Section" filter.
export const ACTIVITY_SECTIONS = [
  { entityTypes: ["expense", "payback"], label: "Expenses", value: "expenses" },
  { entityTypes: ["budget_item", "income", "fund", "fund_top_up", "month_settlement", "cushion"], label: "Income & budget", value: "budget" },
  {
    entityTypes: ["savings_pot", "savings_item", "savings_deposit", "savings_goal", "savings_contribution"],
    label: "Savings",
```

- [ ] **Step 2: Generate the migration**

Run:

```bash
npm run db:generate
```

Expected: it prints `Your SQL migration file ➜ drizzle\0025_<random_words>.sql` and asks nothing. The new file must contain exactly these statements (the file name's words will differ):

```sql
CREATE TYPE "public"."cushion_entry_kind" AS ENUM('kept', 'overspend', 'adjust');--> statement-breakpoint
ALTER TYPE "public"."activity_entity_type" ADD VALUE 'cushion' BEFORE 'dhuku';--> statement-breakpoint
ALTER TYPE "public"."activity_entity_type" ADD VALUE 'month_settlement' BEFORE 'payback';--> statement-breakpoint
CREATE TABLE "cushion_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"kind" "cushion_entry_kind" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cushion_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"target" numeric(12, 2) NOT NULL,
	CONSTRAINT "cushion_targets_member_id_unique" UNIQUE("member_id")
);
--> statement-breakpoint
CREATE TABLE "month_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "month_settlements_member_id_year_month_unique" UNIQUE("member_id","year","month")
);
--> statement-breakpoint
ALTER TABLE "cushion_entries" ADD CONSTRAINT "cushion_entries_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cushion_entries" ADD CONSTRAINT "cushion_entries_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cushion_targets" ADD CONSTRAINT "cushion_targets_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cushion_targets" ADD CONSTRAINT "cushion_targets_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "month_settlements" ADD CONSTRAINT "month_settlements_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "month_settlements" ADD CONSTRAINT "month_settlements_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE cascade ON UPDATE no action;
```

If it asks a question or the SQL differs, stop and report.

- [ ] **Step 3: Check types and lint**

Run:

```bash
npx tsc --noEmit
npm run lint -- --fix
npm run lint
```

Expected: `tsc` prints nothing; lint shows 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/db/schema/cushions.ts src/db/schema/index.ts src/db/schema/activityLogs.ts src/modules/activity/lib/activity-format.ts src/modules/activity/lib/sections.ts drizzle
git commit -m "feat(db): the cushion and month settlements"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.


### Task 5.2: One person's month, and closing it

One person's month worked out once (pay and extra, what left their wallet from pay, what they moved, and what's unallocated), so Home's Unallocated and the amount to decide on at month end always agree. Plus the rules for splitting a leftover (exactly, no part below zero; a month that went over is taken from the cushion whole) and the cushion balance.

**Files:**
- Create: `src/modules/dashboard/lib/month-money.test.ts`
- Create: `src/modules/dashboard/lib/month-money.ts`
- Create: `src/modules/cushion/lib/month-close.test.ts`
- Create: `src/modules/cushion/lib/month-close.ts`
- Create: `src/modules/cushion/lib/cushion-activity.test.ts`
- Create: `src/modules/cushion/lib/cushion-activity.ts`

**Interfaces:**
- Produces: `type MonthMoneyInput`, `type MonthMoney`, `personMonthMoney(input)` in `src/modules/dashboard/lib/month-money.ts`; `type SettlementParts`, `checkSplit`, `cushionBalance` in `src/modules/cushion/lib/month-close.ts`; `settlementSummary`, `cushionSummary`.

- [ ] **Step 1: Write the failing tests**

Create `src/modules/dashboard/lib/month-money.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

import { type MonthMoneyInput, personMonthMoney } from "./month-money";

const ME = "me";
const HER = "her";
const KARTIK = { month: 7, year: 2083 };
const PERIOD = { endDate: "2026-11-16", startDate: "2026-10-18" };

function expense(overrides: Partial<MonthMoneyInput["expenses"][number]>): MonthMoneyInput["expenses"][number] {
  return {
    amount: "1000.00",
    categoryId: "lunch",
    date: "2026-10-20",
    fundAmount: null,
    paidByMemberId: ME,
    payBackAmount: null,
    savingsPotId: null,
    ...overrides,
  };
}

const EMPTY: MonthMoneyInput = {
  deposits: [],
  dhukuEntries: [],
  dhukus: [],
  expenses: [],
  fundData: { funds: [], plans: [], topUps: [] },
  incomeRows: [],
  loanPayments: [],
  loans: [],
  memberId: ME,
  memberIds: [ME, HER],
  month: KARTIK,
  period: PERIOD,
};

describe("personMonthMoney", () => {
  it("counts only what left this person's wallet from pay", () => {
    const money = personMonthMoney({
      ...EMPTY,
      expenses: [
        expense({ amount: "1000.00" }),
        expense({ amount: "2000.00", paidByMemberId: HER, payBackAmount: "500.00" }),
        expense({ amount: "14690.00", fundAmount: "12000.00" }),
        expense({ amount: "3000.00", savingsPotId: "pot" }),
        expense({ amount: "9000.00", paidByMemberId: HER }),
      ],
    });

    // 1,000 + 500 to pay back + 2,690 the fund didn't cover.
    expect(money.spent).toBe(4190);
    expect(money.spending).toHaveLength(3);
  });

  it("moves savings deposits, own dhukus, repayments on loans taken and money into funds", () => {
    const money = personMonthMoney({
      ...EMPTY,
      deposits: [
        { amount: 5000, date: "2026-10-20", kind: "deposit", memberId: ME },
        { amount: 9000, date: "2026-10-20", kind: "deposit", memberId: HER },
      ],
      dhukuEntries: [
        { amount: 3000, date: "2026-10-19", dhukuId: "mine", type: "contribution" },
        { amount: 3300, date: "2026-10-19", dhukuId: "hers", type: "contribution" },
      ],
      dhukus: [
        { id: "mine", ownerMemberId: ME },
        { id: "hers", ownerMemberId: HER },
      ],
      fundData: {
        funds: [{ archived: false, id: "internet", name: "WorldLink", ownerMemberId: ME, startMonth: 6, startYear: 2083 }],
        plans: [{ fromMonth: 6, fromYear: 2083, fundId: "internet", monthlyAmount: 1225 }],
        topUps: [{ amount: 775, fundId: "internet", month: 7, year: 2083 }],
      },
      loanPayments: [{ amount: 5000, date: "2026-10-30", loanId: "raju", memberId: ME }],
      loans: [{ direction: "taken", id: "raju" }],
    });

    expect(money.moved).toEqual({ dhuku: 3000, funds: 2000, loans: 5000, savings: 5000, total: 15000 });
  });

  it("leaves what's unallocated: pay and extra less spent and moved", () => {
    const money = personMonthMoney({
      ...EMPTY,
      deposits: [{ amount: 5000, date: "2026-10-20", kind: "deposit", memberId: ME }],
      expenses: [expense({ amount: "40000.00" })],
      incomeRows: [
        { amount: 62000, id: "pay", kind: "pay", memberId: ME, month: 6, note: null, year: 2083 },
        { amount: 38000, id: "bonus", kind: "extra", memberId: ME, month: 7, note: "bonus", year: 2083 },
      ],
    });

    expect(money.income.pay).toBe(62000);
    expect(money.unallocated).toBe(62000 + 38000 - 40000 - 5000);
  });
});
```

Create `src/modules/cushion/lib/month-close.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

import { checkSplit, cushionBalance } from "./month-close";

const NONE = { cushion: 0, funds: [], loans: [], savings: [] };

describe("checkSplit", () => {
  it("accepts extra money split exactly", () => {
    expect(
      checkSplit(10000, {
        cushion: 2000,
        funds: [{ amount: 3000, fundId: "festivals" }],
        loans: [{ amount: 4000, loanId: "raju" }],
        savings: [{ amount: 1000, potId: "shared" }],
      }),
    ).toBeNull();
  });

  it("refuses a split that doesn't add up", () => {
    expect(checkSplit(10000, { ...NONE, cushion: 9000 })).toBe("The parts add up to Rs 9,000.00, not Rs 10,000.00");
  });

  it("refuses a part below zero", () => {
    expect(checkSplit(1000, { ...NONE, cushion: 2000, savings: [{ amount: -1000, potId: "shared" }] })).toBe("No part can be below zero");
  });

  it("settles a month that went over from the cushion, whole", () => {
    expect(checkSplit(-2000, { ...NONE, cushion: -2000 })).toBeNull();
    expect(checkSplit(-2000, { ...NONE, cushion: -1000 })).toBe("A month that went over comes from the cushion");
    expect(checkSplit(-2000, { ...NONE, cushion: -2000, savings: [{ amount: 0, potId: "shared" }] })).toBe(
      "A month that went over comes from the cushion",
    );
  });

  it("takes a month that came out even", () => {
    expect(checkSplit(0, NONE)).toBeNull();
  });
});

describe("cushionBalance", () => {
  it("adds up money kept, months that went over and corrections", () => {
    expect(cushionBalance([{ amount: 20000 }, { amount: -2500.5 }, { amount: 4200 }])).toBe(21699.5);
  });

  it("starts at zero", () => {
    expect(cushionBalance([])).toBe(0);
  });
});
```

Create `src/modules/cushion/lib/cushion-activity.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

import { testFormatters } from "@/modules/activity/lib/test-formatters";

import { cushionSummary, settlementSummary } from "./cushion-activity";

const f = testFormatters();

describe("cushion activity", () => {
  it("summarises how a month's leftover was split", () => {
    expect(
      settlementSummary(f, { amount: 4200, month: 10, year: 2026 }, [
        { amount: 2000, label: "Shared savings" },
        { amount: 0, label: "WorldLink fund" },
        { amount: 2200, label: "kept" },
      ]),
    ).toBe("October 2026 · RS 4,200 left · Shared savings RS 2,000 · kept RS 2,200");
  });

  it("summarises a month that went over", () => {
    expect(settlementSummary(f, { amount: -2000, month: 10, year: 2026 }, [])).toBe(
      "October 2026 · went over by RS 2,000, taken from the cushion",
    );
  });

  it("summarises a month that came out even", () => {
    expect(settlementSummary(f, { amount: 0, month: 10, year: 2026 }, [])).toBe("October 2026 · came out even");
  });

  it("summarises the cushion with its target", () => {
    expect(cushionSummary(f, { balance: 20000, target: 30000 })).toBe("Cushion · RS 20,000 · aiming for RS 30,000");
    expect(cushionSummary(f, { balance: 0, target: null })).toBe("Cushion · RS 0");
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run:

```bash
npx vitest run src/modules/dashboard/lib/month-money.test.ts src/modules/cushion/lib/month-close.test.ts src/modules/cushion/lib/cushion-activity.test.ts
```

Expected: FAIL. The run can't resolve `./month-money`, `./month-close` and `./cushion-activity`.

- [ ] **Step 3: Write the code**

Create `src/modules/dashboard/lib/month-money.ts` with:

```ts
import { type IncomeRow, monthIncome, type MonthIncome } from "@/modules/budget/lib/income";
import { fundSetAsides } from "@/modules/budget/lib/set-aside";
import { payRows } from "@/modules/expenses/lib/pay-amount";

import { movedThisMonth, type MovedThisMonth } from "./moved";
import { walletShares } from "./wallet";

type ExpenseRow = {
  amount: string;
  categoryId: string;
  date: string;
  fundAmount: null | string;
  paidByMemberId: string;
  payBackAmount: null | string;
  savingsPotId: null | string;
};

export type MonthMoneyInput = {
  deposits: { amount: number; date: string; kind: string; memberId: null | string }[];
  dhukuEntries: { amount: number; date: string; dhukuId: string; type: string }[];
  dhukus: { id: string; ownerMemberId: null | string }[];
  // The month's expenses.
  expenses: ExpenseRow[];
  fundData: {
    funds: { archived: boolean; id: string; name: string; ownerMemberId: string; startMonth: number; startYear: number }[];
    plans: { fromMonth: number; fromYear: number; fundId: string; monthlyAmount: number }[];
    topUps: { amount: number; fundId: string; month: number; year: number }[];
  };
  incomeRows: IncomeRow[];
  loanPayments: { amount: number; date: string; loanId: string; memberId: string }[];
  loans: { direction: "given" | "taken"; id: string }[];
  memberId: string;
  memberIds: string[];
  month: { month: number; year: number };
  period: { endDate: string; startDate: string };
};

export type MonthMoney = {
  income: MonthIncome;
  moved: MovedThisMonth;
  // What left this person's own wallet from pay, expense by expense.
  spending: { amount: number; categoryId: string; date: string }[];
  spent: number;
  // Pay and extra less spent and moved: Home's Unallocated, and at month end
  // the amount left to decide on (negative when the month went over).
  unallocated: number;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

// One person's month: their pay and extra, what left their own wallet from
// pay, and what they moved to their own piles. Home and closing a month both
// use it, so the amount to decide on is always Home's Unallocated.
export function personMonthMoney(input: MonthMoneyInput): MonthMoney {
  const { memberId } = input;
  const spending = payRows(input.expenses).flatMap((e) =>
    walletShares(
      { amount: Number(e.amount), paidByMemberId: e.paidByMemberId, payBackAmount: e.payBackAmount === null ? null : Number(e.payBackAmount) },
      input.memberIds,
    ).flatMap((share) => (share.memberId === memberId ? [{ amount: share.amount, categoryId: e.categoryId, date: e.date }] : [])),
  );
  const spent = round2(spending.reduce((s, e) => s + e.amount, 0));
  const income = monthIncome(input.incomeRows, memberId, input.month);

  // What went into their funds this month: the set-asides plus money added.
  const ownFunds = input.fundData.funds.filter((f) => f.ownerMemberId === memberId && !f.archived);
  const intoFunds =
    fundSetAsides({ funds: ownFunds, memberId, month: input.month, plans: input.fundData.plans }).reduce((s, r) => s + r.planned, 0) +
    input.fundData.topUps
      .filter((t) => t.month === input.month.month && t.year === input.month.year && ownFunds.some((f) => f.id === t.fundId))
      .reduce((s, t) => s + t.amount, 0);

  const ownDhukuIds = new Set(input.dhukus.filter((d) => d.ownerMemberId === memberId).map((d) => d.id));
  const moved = movedThisMonth({
    deposits: input.deposits.filter((d) => d.memberId === memberId),
    dhukuEntries: input.dhukuEntries.filter((e) => ownDhukuIds.has(e.dhukuId)),
    endDate: input.period.endDate,
    funds: intoFunds,
    loanPayments: input.loanPayments.flatMap((p) => {
      const loan = input.loans.find((l) => l.id === p.loanId);
      return loan && p.memberId === memberId ? [{ amount: p.amount, date: p.date, direction: loan.direction }] : [];
    }),
    startDate: input.period.startDate,
  });

  return { income, moved, spending, spent, unallocated: round2(income.pay + income.extra - spent - moved.total) };
}
```

Create `src/modules/cushion/lib/month-close.ts` with:

```ts
import { formatMoney } from "@/lib/money";

// Closing a month: how a person splits what was left (or covers what went
// over), and the cushion that's left in their everyday account. The amount
// to decide on is the month's Unallocated (personMonthMoney).

const round2 = (value: number) => Math.round(value * 100) / 100;
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

export type SettlementParts = {
  cushion: number;
  funds: { amount: number; fundId: string }[];
  loans: { amount: number; loanId: string }[];
  savings: { amount: number; potId: string }[];
};

// null when the split is fine, otherwise what's wrong with it. Extra money is
// split exactly, with no part below zero; a month that went over is settled
// whole from the cushion.
export function checkSplit(amount: number, parts: SettlementParts): null | string {
  const others = [...parts.funds, ...parts.loans, ...parts.savings];
  if (amount < 0) {
    return others.length === 0 && round2(parts.cushion) === round2(amount) ? null : "A month that went over comes from the cushion";
  }
  if (parts.cushion < 0 || others.some((p) => p.amount < 0)) return "No part can be below zero";
  const total = round2(parts.cushion + sum(others.map((p) => p.amount)));
  if (total !== round2(amount)) return `The parts add up to ${formatMoney(total)}, not ${formatMoney(amount)}`;
  return null;
}

// The cushion is only ever what its entries add up to.
export function cushionBalance(entries: { amount: number }[]): number {
  return round2(sum(entries.map((e) => e.amount)));
}
```

Create `src/modules/cushion/lib/cushion-activity.ts` with:

```ts
import type { ActivityFormatters } from "@/modules/activity/lib/activity-values";

// "Asoj 2083 · RS 4,200 left · Shared savings RS 2,000 · kept RS 2,200",
// or "Asoj 2083 · went over by RS 2,000, taken from the cushion".
export function settlementSummary(
  f: ActivityFormatters,
  settlement: { amount: number; month: number; year: number },
  parts: { amount: number; label: string }[],
): string {
  const period = f.period(settlement.year, settlement.month);
  if (settlement.amount < 0) return `${period} · went over by ${f.money(-settlement.amount)}, taken from the cushion`;
  if (settlement.amount === 0) return `${period} · came out even`;
  return [period, `${f.money(settlement.amount)} left`, ...parts.filter((p) => p.amount > 0).map((p) => `${p.label} ${f.money(p.amount)}`)].join(" · ");
}

// "Cushion · RS 20,000 · aiming for RS 30,000"
export function cushionSummary(f: ActivityFormatters, cushion: { balance: number; target: null | number }): string {
  return ["Cushion", f.money(cushion.balance), cushion.target === null ? null : `aiming for ${f.money(cushion.target)}`].filter(Boolean).join(" · ");
}
```

- [ ] **Step 4: Run the tests again**

Run:

```bash
npx vitest run src/modules/dashboard/lib/month-money.test.ts src/modules/cushion/lib/month-close.test.ts src/modules/cushion/lib/cushion-activity.test.ts
```

Expected: PASS, 14 tests.

- [ ] **Step 5: Check types, all unit tests and lint**

Run:

```bash
npx tsc --noEmit
npm test
npm run lint -- --fix
npm run lint
```

Expected: `tsc` prints nothing; every unit test passes; lint shows 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/modules/dashboard/lib/month-money.test.ts src/modules/dashboard/lib/month-money.ts src/modules/cushion/lib/month-close.test.ts src/modules/cushion/lib/month-close.ts src/modules/cushion/lib/cushion-activity.test.ts src/modules/cushion/lib/cushion-activity.ts
git commit -m "feat(cushion): one person's month, and closing it"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.


### Task 5.3: Decide a month's leftover and set the cushion

The server side. Settling works the month out again on the server (never trusting the browser), checks the split and that every pot, fund and loan is the person's own, and records it in one transaction: deposits and loan repayments dated the month's last day (so they count in that month's Moved), fund money for that month, a cushion entry, and the settlement row. Setting the cushion records a correction for any difference and saves the target.

**Files:**
- Create: `src/modules/cushion/api/cushion.ts`
- Create: `src/modules/dashboard/api/month-money.ts`
- Create: `src/modules/cushion/schemas/cushion.schema.ts`
- Create: `src/modules/cushion/api/cushion.actions.ts`

**Interfaces:**
- Consumes: `personMonthMoney`, `checkSplit`, `cushionBalance`, `settlementSummary`, `cushionSummary` (Task 5.2), `listFundData` (Task 4.3).
- Produces: `listCushionData(householdId)`; `loadPersonMonthMoney(householdId, memberId, year, month)`; `settleMonthSchema`, `setCushionSchema`; `settleMonthAction`, `setCushionAction`.

- [ ] **Step 1: Queries**

Create `src/modules/cushion/api/cushion.ts` with:

```ts
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { cushionEntries, cushionTargets, monthSettlements } from "@/db/schema";

// Everyone's cushion entries and targets, and the months they've decided on.
export async function listCushionData(householdId: string) {
  const [entries, targets, settlements] = await Promise.all([
    db.select().from(cushionEntries).where(eq(cushionEntries.householdId, householdId)),
    db.select().from(cushionTargets).where(eq(cushionTargets.householdId, householdId)),
    db.select().from(monthSettlements).where(eq(monthSettlements.householdId, householdId)),
  ]);
  return {
    entries: entries.map((e) => ({ amount: Number(e.amount), memberId: e.memberId })),
    settlements: settlements.map((s) => ({ memberId: s.memberId, month: s.month, year: s.year })),
    targets: targets.map((t) => ({ memberId: t.memberId, target: Number(t.target) })),
  };
}
```

Create `src/modules/dashboard/api/month-money.ts` with:

```ts
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { resolvePeriod } from "@/lib/month-period";
import { getHouseholdMembers } from "@/lib/session";
import { listIncomeRows } from "@/modules/budget/api/budget";
import { listDhukuEntries, listDhukus } from "@/modules/dhuku/api/dhuku.actions";
import { listExpensesForMonth } from "@/modules/expenses/api/expenses.actions";
import { listFundData } from "@/modules/funds/api/funds";
import { listLoanPayments, listLoans } from "@/modules/loans/api/loans.actions";
import { listSavingsDeposits } from "@/modules/savings/api/savings.actions";

import { personMonthMoney } from "../lib/month-money";

// One person's month, worked out from the database the same way Home does,
// for closing the month on the server.
export async function loadPersonMonthMoney(householdId: string, memberId: string, year: number, month: number) {
  const dateFormat = await getDateFormatPref(householdId);
  const [members, incomeRows, expenses, deposits, dhukus, dhukuEntries, loans, loanPayments, fundData] = await Promise.all([
    getHouseholdMembers(householdId),
    listIncomeRows(householdId),
    listExpensesForMonth(year, month, dateFormat),
    listSavingsDeposits(householdId),
    listDhukus(householdId),
    listDhukuEntries(householdId),
    listLoans(householdId),
    listLoanPayments(householdId),
    listFundData(householdId),
  ]);

  return personMonthMoney({
    deposits: deposits.map((d) => ({ amount: Number(d.amount), date: d.date, kind: d.kind, memberId: d.memberId })),
    dhukuEntries: dhukuEntries.map((e) => ({ amount: Number(e.amount), date: e.date, dhukuId: e.dhukuId, type: e.type })),
    dhukus,
    expenses,
    fundData,
    incomeRows,
    loanPayments: loanPayments.map((p) => ({ amount: Number(p.amount), date: p.date, loanId: p.loanId, memberId: p.memberId })),
    loans,
    memberId,
    memberIds: members.map((m) => m.id),
    month: { month, year },
    period: resolvePeriod(year, month, dateFormat),
  });
}
```

- [ ] **Step 2: Settle a month and set the cushion**

Create `src/modules/cushion/schemas/cushion.schema.ts` with:

```ts
import { z } from "zod";

// How a person splits a month's leftover. The cushion part takes the rest; it
// is negative when the month went over.
export const settleMonthSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  parts: z.object({
    cushion: z.number(),
    funds: z.array(z.object({ amount: z.number().nonnegative(), fundId: z.string().uuid() })),
    loans: z.array(z.object({ amount: z.number().nonnegative(), loanId: z.string().uuid() })),
    savings: z.array(z.object({ amount: z.number().nonnegative(), potId: z.string().uuid() })),
  }),
});

export type SettleMonthInput = z.infer<typeof settleMonthSchema>;

// What the cushion is aiming for, and what it really holds now.
export const setCushionSchema = z.object({
  balance: z.number(),
  target: z.number().positive().nullable(),
});

export type SetCushionInput = z.infer<typeof setCushionSchema>;
```

Create `src/modules/cushion/api/cushion.actions.ts` with:

```ts
"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { cushionEntries, cushionTargets, fundTopUps, loanPayments, monthSettlements, savingsDeposits } from "@/db/schema";
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { currentPeriodYearMonth, resolvePeriod } from "@/lib/month-period";
import { getCurrentMember } from "@/lib/session";
import { activityActor, loadActivityFormatters, logActivity } from "@/modules/activity/api/activity";
import { loadPersonMonthMoney } from "@/modules/dashboard/api/month-money";
import { listFundData } from "@/modules/funds/api/funds";
import { listLoans } from "@/modules/loans/api/loans.actions";
import { listSavingsPots } from "@/modules/savings/api/savings.actions";

import { cushionSummary, settlementSummary } from "../lib/cushion-activity";
import { checkSplit, cushionBalance } from "../lib/month-close";
import { type SetCushionInput, setCushionSchema, type SettleMonthInput, settleMonthSchema } from "../schemas/cushion.schema";

const LEFTOVER_NOTE = "From the month's leftover";

function revalidateCushionPaths() {
  revalidatePath("/dashboard");
  revalidatePath("/budget");
  revalidatePath("/savings");
  revalidatePath("/loans");
}

// Decides a month's leftover for the person signed in: money into their
// savings pots and funds, toward loans they took, and the rest kept as
// cushion. A month that went over is taken from the cushion. The amount is
// worked out again here, never trusted from the browser. Money moved is
// dated the month's last day, so it counts in that month's Moved and leaves
// the next month alone.
export async function settleMonthAction(input: SettleMonthInput) {
  const member = await getCurrentMember();
  const { householdId, memberId } = member;
  const parsed = settleMonthSchema.parse(input);
  const { month, year } = parsed;

  const [settled] = await db
    .select()
    .from(monthSettlements)
    .where(and(eq(monthSettlements.memberId, memberId), eq(monthSettlements.year, year), eq(monthSettlements.month, month)));
  if (settled) throw new Error("That month is already decided");

  const money = await loadPersonMonthMoney(householdId, memberId, year, month);
  const parts = {
    cushion: parsed.parts.cushion,
    funds: parsed.parts.funds.filter((p) => p.amount > 0),
    loans: parsed.parts.loans.filter((p) => p.amount > 0),
    savings: parsed.parts.savings.filter((p) => p.amount > 0),
  };
  const problem = checkSplit(money.unallocated, parts);
  if (problem) throw new Error(problem);

  // Only the person's own piles: shared or own pots, their active funds, loans they took.
  const [pots, fundData, loans] = await Promise.all([listSavingsPots(householdId), listFundData(householdId), listLoans(householdId)]);
  const labels: { amount: number; label: string }[] = [];
  for (const part of parts.savings) {
    const pot = pots.find((p) => p.id === part.potId);
    if (!pot || (pot.ownerMemberId !== null && pot.ownerMemberId !== memberId)) throw new Error("That savings pot isn't yours");
    labels.push({ amount: part.amount, label: pot.name });
  }
  for (const part of parts.funds) {
    const fund = fundData.funds.find((f) => f.id === part.fundId);
    if (!fund || fund.ownerMemberId !== memberId || fund.archived) throw new Error("That fund isn't yours");
    labels.push({ amount: part.amount, label: `${fund.name} fund` });
  }
  for (const part of parts.loans) {
    const loan = loans.find((l) => l.id === part.loanId);
    if (!loan || loan.ownerMemberId !== memberId || loan.direction !== "taken") throw new Error("That loan isn't yours to repay");
    labels.push({ amount: part.amount, label: `toward ${loan.counterpartyName}` });
  }
  labels.push({ amount: parts.cushion, label: "kept" });

  const lastDay = resolvePeriod(year, month, await getDateFormatPref(householdId)).endDate;
  const settlement = await db.transaction(async (tx) => {
    for (const part of parts.savings) {
      await tx.insert(savingsDeposits).values({ amount: String(part.amount), date: lastDay, kind: "deposit", memberId, potId: part.potId });
    }
    for (const part of parts.funds) {
      await tx.insert(fundTopUps).values({ amount: String(part.amount), fundId: part.fundId, month, note: LEFTOVER_NOTE, year });
    }
    for (const part of parts.loans) {
      await tx.insert(loanPayments).values({ amount: String(part.amount), date: lastDay, loanId: part.loanId, memberId, note: LEFTOVER_NOTE });
    }
    if (parts.cushion !== 0) {
      await tx.insert(cushionEntries).values({
        amount: String(parts.cushion),
        householdId,
        kind: parts.cushion < 0 ? "overspend" : "kept",
        memberId,
        month,
        year,
      });
    }
    const [row] = await tx
      .insert(monthSettlements)
      .values({ amount: String(money.unallocated), householdId, memberId, month, year })
      .returning();
    return row;
  });

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "created",
    after: settlement,
    entityId: settlement.id,
    entityType: "month_settlement",
    summary: settlementSummary(f, { amount: money.unallocated, month, year }, labels),
  });

  revalidateCushionPaths();
}

// Sets what the person's cushion is aiming for, and corrects it to what's
// really in their account (recorded as an "adjust" entry for the difference).
export async function setCushionAction(input: SetCushionInput) {
  const member = await getCurrentMember();
  const { householdId, memberId } = member;
  const parsed = setCushionSchema.parse(input);

  const entries = await db.select().from(cushionEntries).where(eq(cushionEntries.memberId, memberId));
  const current = cushionBalance(entries.map((e) => ({ amount: Number(e.amount) })));
  const difference = Math.round((parsed.balance - current) * 100) / 100;
  if (difference !== 0) {
    const now = currentPeriodYearMonth(await getDateFormatPref(householdId));
    await db.insert(cushionEntries).values({
      amount: String(difference),
      householdId,
      kind: "adjust",
      memberId,
      month: now.month,
      note: "Corrected by hand",
      year: now.year,
    });
  }

  if (parsed.target === null) {
    await db.delete(cushionTargets).where(eq(cushionTargets.memberId, memberId));
  } else {
    await db
      .insert(cushionTargets)
      .values({ householdId, memberId, target: String(parsed.target) })
      .onConflictDoUpdate({ set: { target: String(parsed.target) }, target: cushionTargets.memberId });
  }

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "updated",
    entityId: memberId,
    entityType: "cushion",
    summary: cushionSummary(f, { balance: parsed.balance, target: parsed.target }),
  });

  revalidatePath("/dashboard");
}
```

- [ ] **Step 3: Check types, unit tests and lint**

Run:

```bash
npx tsc --noEmit
npm test
npm run lint -- --fix
npm run lint
```

Expected: `tsc` prints nothing; every unit test passes; lint shows 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/modules/cushion/api/cushion.ts src/modules/dashboard/api/month-money.ts src/modules/cushion/schemas/cushion.schema.ts src/modules/cushion/api/cushion.actions.ts
git commit -m "feat(cushion): decide a month's leftover and set the cushion"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.


### Task 5.4: Last month's leftover and the cushion on Home

Home asks about last month's leftover until it's decided (only on the current month, and only with buttons for the person signed in), and Balances starts with the cushion and a Change button for its target.

**Files:**
- Create: `src/modules/cushion/components/SettleCard.tsx`
- Create: `src/modules/cushion/components/CushionDialog.tsx`
- Modify: `src/modules/dashboard/pages/DashboardPage.tsx`
- Modify: `src/modules/dashboard/components/HomeView.tsx`
- Modify: `e2e/dashboard.spec.ts`

**Interfaces:**
- Consumes: Tasks 5.2–5.3.
- Changes: `HomeView` gains `cushion` and `settle` and exports `type HomeSettle`; Home now uses `personMonthMoney` for the viewer's figures.

- [ ] **Step 1: The card and the cushion dialog**

Create `src/modules/cushion/components/SettleCard.tsx` with:

```tsx
"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Money } from "@/components/Money";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { formatMoney, sanitizeAmountInput } from "@/lib/money";
import { cn } from "@/lib/utils";
import { settleMonthAction } from "@/modules/cushion/api/cushion.actions";

export type SettleOptions = {
  funds: { id: string; name: string }[];
  loans: { id: string; name: string; owed: number }[];
  pots: { id: string; name: string }[];
};

type Props = SettleOptions & {
  // What was left of the month: negative when it went over.
  amount: number;
  // Only the person whose month it is can decide (not someone viewing as them).
  canSettle: boolean;
  month: number;
  monthLabel: string;
  year: number;
};

// Home's card for last month's leftover: split it between savings, funds and
// loans, and the rest is kept as cushion. A month that went over is taken from
// the cushion once acknowledged.
export function SettleCard({ amount, canSettle, funds, loans, month, monthLabel, pots, year }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  const value = (key: string) => Number(values[key]) || 0;
  const assigned = [...pots.map((p) => `pot:${p.id}`), ...funds.map((f) => `fund:${f.id}`), ...loans.map((l) => `loan:${l.id}`)].reduce(
    (sum, key) => sum + value(key),
    0,
  );
  const kept = Math.round((amount - assigned) * 100) / 100;
  const over = amount < 0;

  async function settle() {
    setPending(true);
    try {
      await settleMonthAction({
        month,
        parts: {
          cushion: over ? amount : kept,
          funds: over ? [] : funds.map((f) => ({ amount: value(`fund:${f.id}`), fundId: f.id })),
          loans: over ? [] : loans.map((l) => ({ amount: value(`loan:${l.id}`), loanId: l.id })),
          savings: over ? [] : pots.map((p) => ({ amount: value(`pot:${p.id}`), potId: p.id })),
        },
        year,
      });
      toast.success(`${monthLabel} decided`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setPending(false);
    }
  }

  const field = (key: string, label: string) => (
    <TextField
      inputMode="decimal"
      key={key}
      label={label}
      onChange={(event) => setValues((prev) => ({ ...prev, [key]: sanitizeAmountInput(event.target.value) }))}
      placeholder="0"
      value={values[key] ?? ""}
    />
  );

  return (
    <section aria-label={`${monthLabel} to decide`} className="mb-9 border-t-2 border-ink pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-xl leading-tight font-extrabold tracking-[-0.01em]">
          {over ? `${monthLabel} went over` : `${monthLabel}: what was left`}
        </h2>
        <span className={cn("text-xl font-extrabold", over && "text-signal-ink")}>
          <Money tone={over ? "negative" : "default"} value={amount} />
        </span>
      </div>

      {over ? (
        <p className="mt-2 max-w-[60ch] text-[15px] text-n-800">
          Spending and money moved came to {formatMoney(-amount)} more than pay and extra. It comes out of your cushion.
        </p>
      ) : (
        <>
          <p className="mt-2 max-w-[60ch] text-[15px] text-n-800">Put it to work, or keep it as cushion. Whatever you don&apos;t put anywhere is kept.</p>
          {canSettle && (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 @min-[780px]:grid-cols-3">
              {pots.map((p) => field(`pot:${p.id}`, `Into ${p.name}`))}
              {funds.map((f) => field(`fund:${f.id}`, `Into the ${f.name} fund`))}
              {loans.map((l) => field(`loan:${l.id}`, `Toward ${l.name} (${formatMoney(l.owed)} owed)`))}
            </div>
          )}
          <p className={cn("mt-3 text-sm", kept < 0 ? "text-signal-ink" : "text-n-700")}>
            {kept < 0 ? `That's ${formatMoney(-kept)} more than was left.` : `Kept as cushion: ${formatMoney(kept)}`}
          </p>
        </>
      )}

      {canSettle ? (
        <Button className="mt-4" disabled={pending || kept < 0} onClick={() => void settle()} type="button">
          {pending ? "Saving..." : over ? "OK, take it from the cushion" : "Done"}
        </Button>
      ) : (
        <p className="mt-3 text-[13px] text-n-600">Only the person whose month it is can decide this.</p>
      )}
    </section>
  );
}
```

Create `src/modules/cushion/components/CushionDialog.tsx` with:

```tsx
"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AmountInput } from "@/components/AmountInput";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { setCushionAction } from "@/modules/cushion/api/cushion.actions";

type Props = {
  balance: number;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  target: null | number;
};

const FORM_ID = "cushion-form";

// The cushion's target, and a correction when it doesn't match the bank.
export function CushionDialog({ onOpenChange, open, ...rest }: Props) {
  const [pending, setPending] = useState(false);

  return (
    <Modal
      className="sm:max-w-100"
      footer={
        <Button className="min-w-35 justify-start" disabled={pending} form={FORM_ID} type="submit">
          {pending ? "Saving..." : "Save cushion"}
        </Button>
      }
      hint="Enter to save · Esc to close"
      onOpenChange={onOpenChange}
      open={open}
      subtitle="Money in your everyday account beyond this month's plan"
      title="Cushion"
    >
      <CushionFields {...rest} onDone={() => onOpenChange(false)} onPendingChange={setPending} />
    </Modal>
  );
}

type FieldsProps = Omit<Props, "onOpenChange" | "open"> & { onDone: () => void; onPendingChange: (pending: boolean) => void };

function CushionFields({ balance, onDone, onPendingChange, target }: FieldsProps) {
  const router = useRouter();
  const [targetText, setTargetText] = useState(target ? String(target) : "");
  const [balanceText, setBalanceText] = useState(String(balance));

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onPendingChange(true);
    try {
      await setCushionAction({ balance: Number(balanceText) || 0, target: Number(targetText) > 0 ? Number(targetText) : null });
      toast.success("Cushion saved");
      onDone();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      onPendingChange(false);
    }
  }

  return (
    <form className="flex flex-col gap-5.5" id={FORM_ID} noValidate onSubmit={onSubmit}>
      <div className="flex flex-col gap-1.5">
        <AmountInput data-autofocus label="Aiming for" onChange={(event) => setTargetText(event.target.value)} placeholder="e.g. one month of essentials" value={targetText} />
        <p className="text-xs leading-normal text-n-600">About one month of essentials is a good first target.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <AmountInput label="It holds" onChange={(event) => setBalanceText(event.target.value)} placeholder="0.00" value={balanceText} />
        <p className="text-xs leading-normal text-n-600">Change this only to match what&apos;s really in your account.</p>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Home**

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 1 of 9), find:

```tsx
  MIN_NAVIGABLE_YEAR,
  resolvePeriod,
} from "@/lib/month-period";
import { getEffectiveMember, getHouseholdMembers } from "@/lib/session";
import { todayISO } from "@/lib/today";
import { listIncomeRows, listPlanLines } from "@/modules/budget/api/budget";
import { buildPersonPlan, overrunFromPlan, overrunNote } from "@/modules/budget/lib/budget-view";
import { monthIncome } from "@/modules/budget/lib/income";
import { fundSetAsides } from "@/modules/budget/lib/set-aside";
import { listCategories } from "@/modules/categories/api/categories";
import {
  type HomeBalanceRow,
  type HomeEssential,
```

Replace it with:

```tsx
  MIN_NAVIGABLE_YEAR,
  resolvePeriod,
} from "@/lib/month-period";
import { getCurrentMember, getEffectiveMember, getHouseholdMembers } from "@/lib/session";
import { todayISO } from "@/lib/today";
import { listIncomeRows, listPlanLines } from "@/modules/budget/api/budget";
import { buildPersonPlan, overrunFromPlan, overrunNote } from "@/modules/budget/lib/budget-view";
import { monthIncome } from "@/modules/budget/lib/income";
import { listCategories } from "@/modules/categories/api/categories";
import { listCushionData } from "@/modules/cushion/api/cushion";
import { cushionBalance } from "@/modules/cushion/lib/month-close";
import {
  type HomeBalanceRow,
  type HomeEssential,
```

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 2 of 9), find:

```tsx
  type HomePacing,
  type HomeRecentGroup,
  type HomeSavingsPot,
  HomeView,
} from "@/modules/dashboard/components/HomeView";
import { daysLeftInMonth, spentByDayIn } from "@/modules/dashboard/lib/cash-flow";
import { toExpenseInputs } from "@/modules/dashboard/lib/map-rows";
import { movedThisMonth } from "@/modules/dashboard/lib/moved";
import { buildPacingSchedule, currentWeekPacing, weekIndexOf, withOverrun } from "@/modules/dashboard/lib/pacing";
import { walletShares, walletSpentByMember } from "@/modules/dashboard/lib/wallet";
import { listDhukuEntries, listDhukus } from "@/modules/dhuku/api/dhuku.actions";
import { dhukuPosition } from "@/modules/dhuku/lib/dhuku-money";
import { listExpensesForMonth, listRecentExpenses } from "@/modules/expenses/api/expenses.actions";
```

Replace it with:

```tsx
  type HomePacing,
  type HomeRecentGroup,
  type HomeSavingsPot,
  type HomeSettle,
  HomeView,
} from "@/modules/dashboard/components/HomeView";
import { daysLeftInMonth, spentByDayIn } from "@/modules/dashboard/lib/cash-flow";
import { toExpenseInputs } from "@/modules/dashboard/lib/map-rows";
import { personMonthMoney } from "@/modules/dashboard/lib/month-money";
import { buildPacingSchedule, currentWeekPacing, weekIndexOf, withOverrun } from "@/modules/dashboard/lib/pacing";
import { walletSpentByMember } from "@/modules/dashboard/lib/wallet";
import { listDhukuEntries, listDhukus } from "@/modules/dhuku/api/dhuku.actions";
import { dhukuPosition } from "@/modules/dhuku/lib/dhuku-money";
import { listExpensesForMonth, listRecentExpenses } from "@/modules/expenses/api/expenses.actions";
```

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 3 of 9), find:

```tsx
type Props = { searchParams: Promise<{ month?: string; year?: string }> };

export async function DashboardPage({ searchParams }: Props) {
  const { householdId, memberId } = await getEffectiveMember();
  const dateFormat = await getDateFormatPref(householdId);
  const params = await searchParams;
  const { year: currentYear, month: currentMonth } = currentPeriodYearMonth(dateFormat);
```

Replace it with:

```tsx
type Props = { searchParams: Promise<{ month?: string; year?: string }> };

export async function DashboardPage({ searchParams }: Props) {
  // memberId is whoever Home is viewed as; only the real member can decide
  // their own month's leftover or change their cushion.
  const current = await getCurrentMember();
  const { householdId, memberId } = await getEffectiveMember(current);
  const dateFormat = await getDateFormatPref(householdId);
  const params = await searchParams;
  const { year: currentYear, month: currentMonth } = currentPeriodYearMonth(dateFormat);
```

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 4 of 9), find:

```tsx
    loanRows,
    loanPaymentRows,
    fundData,
  ] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
```

Replace it with:

```tsx
    loanRows,
    loanPaymentRows,
    fundData,
    cushionData,
  ] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
```

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 5 of 9), find:

```tsx
    listLoans(householdId),
    listLoanPayments(householdId),
    listFundData(householdId),
  ]);

  if (isCurrentMonth) {
```

Replace it with:

```tsx
    listLoans(householdId),
    listLoanPayments(householdId),
    listFundData(householdId),
    listCushionData(householdId),
  ]);

  if (isCurrentMonth) {
```

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 6 of 9), find:

```tsx
    },
  ];

  // Home's figures and hero follow the person viewing it: their Spent is what
  // left their own wallet, and their plan is their own lines.
  const period = resolvePeriod(year, month, dateFormat);
  const memberIds = members.map((m) => m.id);
  const viewerShares = (rows: typeof expenseRows) =>
    payRows(rows).flatMap((e) =>
        walletShares(
          { amount: Number(e.amount), paidByMemberId: e.paidByMemberId, payBackAmount: e.payBackAmount === null ? null : Number(e.payBackAmount) },
          memberIds,
        ).flatMap((share) => (share.memberId === memberId ? [{ amount: share.amount, categoryId: e.categoryId, date: e.date }] : [])),
      );
  const viewerSpending = viewerShares(expenseRows);
  const viewerSpent = viewerSpending.reduce((s, e) => s + e.amount, 0);
  const viewerPrevSpent = viewerShares(prevExpenseRows).reduce((s, e) => s + e.amount, 0);
  const viewerIncome = monthIncome(incomeRows, memberId, { month, year });
  const payCarriedFrom = viewerIncome.payCarriedFrom
    ? formatPeriodLabel(viewerIncome.payCarriedFrom.year, viewerIncome.payCarriedFrom.month, dateFormat)
    : null;
```

Replace it with:

```tsx
    },
  ];

  // Home's figures and hero follow the person viewing it. Their month is
  // worked out the same way closing a month does, so Unallocated and the
  // amount left to decide on always agree; their plan is their own lines.
  const period = resolvePeriod(year, month, dateFormat);
  const moneyInput = {
    deposits: depositRows.map((d) => ({ amount: Number(d.amount), date: d.date, kind: d.kind, memberId: d.memberId })),
    dhukuEntries: dhukuEntryRows.map((e) => ({ amount: Number(e.amount), date: e.date, dhukuId: e.dhukuId, type: e.type })),
    dhukus: dhukuRows,
    fundData,
    incomeRows,
    loanPayments: loanPaymentRows.map((p) => ({ amount: Number(p.amount), date: p.date, loanId: p.loanId, memberId: p.memberId })),
    loans: loanRows,
    memberId,
    memberIds: members.map((m) => m.id),
  };
  const viewerMoney = personMonthMoney({ ...moneyInput, expenses: expenseRows, month: { month, year }, period });
  const prevMoney = personMonthMoney({ ...moneyInput, expenses: prevExpenseRows, month: prev, period: resolvePeriod(prev.year, prev.month, dateFormat) });
  const viewerSpending = viewerMoney.spending;
  const viewerIncome = viewerMoney.income;
  const payCarriedFrom = viewerIncome.payCarriedFrom
    ? formatPeriodLabel(viewerIncome.payCarriedFrom.year, viewerIncome.payCarriedFrom.month, dateFormat)
    : null;
```

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 7 of 9), find:

```tsx
      reserveFull: balance >= reserveMinimum,
    };
  });
  // The viewer's funds: what each holds now, and what went into them this
  // month (the set-aside plus money added).
  const viewerFunds = fundData.funds.filter((f) => f.ownerMemberId === memberId && !f.archived);
  const balancesByFund = fundBalances({ ...fundData, funds: viewerFunds, through: { month, year } });
  const intoFunds =
    fundSetAsides({ funds: viewerFunds, memberId, month: { month, year }, plans: fundData.plans }).reduce((s, r) => s + r.planned, 0) +
    fundData.topUps
      .filter((t) => t.month === month && t.year === year && viewerFunds.some((f) => f.id === t.fundId))
      .reduce((s, t) => s + t.amount, 0);

  // Money the viewer moved into their own piles this month: their savings
  // deposits, their dhukus' payments, their repayments on loans they took and
  // what went into their funds. Unallocated takes it off too, since it's no
  // longer free to spend.
  const viewerDhukuIds = new Set(dhukuRows.filter((d) => d.ownerMemberId === memberId).map((d) => d.id));
  const moved = movedThisMonth({
    deposits: deposits.filter((d) => d.memberId === memberId),
    dhukuEntries: dhukuEntryRows
      .filter((e) => viewerDhukuIds.has(e.dhukuId))
      .map((e) => ({ amount: Number(e.amount), date: e.date, type: e.type })),
    endDate: period.endDate,
    funds: intoFunds,
    loanPayments: loanPaymentRows.flatMap((p) => {
      const loan = loanRows.find((l) => l.id === p.loanId);
      return loan && p.memberId === memberId ? [{ amount: Number(p.amount), date: p.date, direction: loan.direction }] : [];
    }),
    startDate: period.startDate,
  });
  const unallocated = viewerIncome.pay + viewerIncome.extra - viewerSpent - moved.total;

  // Balances: where each pile stands, apart from this month's spending.
  // Positive = yours, or owed to you; negative = you owe it.
  const loanStats = loanOverviewStats(
    buildLoanCards(
      loanRows,
      loanPaymentRows.map((p) => ({ amount: Number(p.amount), loanId: p.loanId })),
      new Map(members.map((m) => [m.id, m])),
    ),
  );
  const dhukuBalances: HomeBalanceRow[] = dhukuRows.flatMap((dhuku) => {
    const entries = dhukuEntryRows.filter((e) => e.dhukuId === dhuku.id).map((e) => ({ amount: Number(e.amount), type: e.type }));
    const contributions = entries.filter((e) => e.type === "contribution").length;
```

Replace it with:

```tsx
      reserveFull: balance >= reserveMinimum,
    };
  });
  // What each of the viewer's funds holds now.
  const viewerFunds = fundData.funds.filter((f) => f.ownerMemberId === memberId && !f.archived);
  const balancesByFund = fundBalances({ ...fundData, funds: viewerFunds, through: { month, year } });

  // Balances: where each pile stands, apart from this month's spending.
  // Positive = yours, or owed to you; negative = you owe it.
  const loanCards = buildLoanCards(
    loanRows,
    loanPaymentRows.map((p) => ({ amount: Number(p.amount), loanId: p.loanId })),
    new Map(members.map((m) => [m.id, m])),
  );
  const loanStats = loanOverviewStats(loanCards);

  // Last month's leftover waits on Home (in the current month) until the
  // viewer decides on it: into savings, funds or loans, or kept as cushion.
  const settled = cushionData.settlements.some((s) => s.memberId === memberId && s.month === prev.month && s.year === prev.year);
  const settle: HomeSettle | null =
    isCurrentMonth && !settled && (prevMoney.income.pay > 0 || prevMoney.spent > 0)
      ? {
          amount: prevMoney.unallocated,
          canSettle: memberId === current.memberId,
          funds: viewerFunds.map((f) => ({ id: f.id, name: f.name })),
          loans: loanCards
            .filter((l) => l.ownerMemberId === memberId && l.direction === "taken" && l.outstanding > 0)
            .map((l) => ({ id: l.id, name: l.counterpartyName, owed: l.outstanding })),
          month: prev.month,
          monthLabel: formatPeriodLabel(prev.year, prev.month, dateFormat),
          pots: potRows.filter((p) => p.ownerMemberId === null || p.ownerMemberId === memberId).map((p) => ({ id: p.id, name: p.name })),
          year: prev.year,
        }
      : null;
  const dhukuBalances: HomeBalanceRow[] = dhukuRows.flatMap((dhuku) => {
    const entries = dhukuEntryRows.filter((e) => e.dhukuId === dhuku.id).map((e) => ({ amount: Number(e.amount), type: e.type }));
    const contributions = entries.filter((e) => e.type === "contribution").length;
```

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 8 of 9), find:

```tsx
    <HomeView
      balances={balances}
      currentMemberId={memberId}
      daysLeft={daysLeftInMonth(year, month, dateFormat)}

      essentials={essentials}
      ledger={{
        moved,
        paidFromFunds,
        paidFromSavings,
        pay: viewerIncome.pay,
        payNote: viewerIncome.extra > 0 ? `+ ${formatMoney(viewerIncome.extra)} extra` : payCarriedFrom ? `Carried over from ${payCarriedFrom}` : null,
        spent: viewerSpent,
        spentMeterRatio: viewerIncome.pay > 0 ? viewerSpent / viewerIncome.pay : 0,
        spentPctOfPay: percent(viewerSpent, viewerIncome.pay),
        spentTrendPct: trendPct(viewerSpent, viewerPrevSpent),
        unallocated,
      }}
      members={members.map((m) => ({ id: m.id, name: m.user.name }))}
      month={month}
```

Replace it with:

```tsx
    <HomeView
      balances={balances}
      currentMemberId={memberId}
      cushion={{
        balance: cushionBalance(cushionData.entries.filter((e) => e.memberId === memberId)),
        canEdit: memberId === current.memberId,
        target: cushionData.targets.find((t) => t.memberId === memberId)?.target ?? null,
      }}
      daysLeft={daysLeftInMonth(year, month, dateFormat)}

      essentials={essentials}
      ledger={{
        moved: viewerMoney.moved,
        paidFromFunds,
        paidFromSavings,
        pay: viewerIncome.pay,
        payNote: viewerIncome.extra > 0 ? `+ ${formatMoney(viewerIncome.extra)} extra` : payCarriedFrom ? `Carried over from ${payCarriedFrom}` : null,
        spent: viewerMoney.spent,
        spentMeterRatio: viewerIncome.pay > 0 ? viewerMoney.spent / viewerIncome.pay : 0,
        spentPctOfPay: percent(viewerMoney.spent, viewerIncome.pay),
        spentTrendPct: trendPct(viewerMoney.spent, prevMoney.spent),
        unallocated: viewerMoney.unallocated,
      }}
      members={members.map((m) => ({ id: m.id, name: m.user.name }))}
      month={month}
```

In `src/modules/dashboard/pages/DashboardPage.tsx` (change 9 of 9), find:

```tsx
      recent={recent}
      recentPaybacks={recentPaybacks}
      savings={savings}
      spentMonthName={monthLabel.split(" ")[0]}
      year={year}
    />
```

Replace it with:

```tsx
      recent={recent}
      recentPaybacks={recentPaybacks}
      savings={savings}
      settle={settle}
      spentMonthName={monthLabel.split(" ")[0]}
      year={year}
    />
```

In `src/modules/dashboard/components/HomeView.tsx` (change 1 of 9), find:

```tsx
import { PayDialog } from "@/modules/budget/components/PayDialog";
import type { ExtraIncome } from "@/modules/budget/lib/income";
import { CategoryIcon } from "@/modules/categories/components/CategoryIcon";
import { deletePaybackAction } from "@/modules/paybacks/api/paybacks.actions";
import { PaybackDialog } from "@/modules/paybacks/components/PaybackDialog";
import type { PaybackBalance } from "@/modules/paybacks/lib/payback-balance";
```

Replace it with:

```tsx
import { PayDialog } from "@/modules/budget/components/PayDialog";
import type { ExtraIncome } from "@/modules/budget/lib/income";
import { CategoryIcon } from "@/modules/categories/components/CategoryIcon";
import { CushionDialog } from "@/modules/cushion/components/CushionDialog";
import { SettleCard, type SettleOptions } from "@/modules/cushion/components/SettleCard";
import { deletePaybackAction } from "@/modules/paybacks/api/paybacks.actions";
import { PaybackDialog } from "@/modules/paybacks/components/PaybackDialog";
import type { PaybackBalance } from "@/modules/paybacks/lib/payback-balance";
```

In `src/modules/dashboard/components/HomeView.tsx` (change 2 of 9), find:

```tsx

export type HomeEssential = { categoryName: string; planned: number; spent: number };

export type HomePacing = {
  carryIn: number;
  nextWeekAllowance: number;
```

Replace it with:

```tsx

export type HomeEssential = { categoryName: string; planned: number; spent: number };

// Last month's leftover, waiting to be decided on.
export type HomeSettle = SettleOptions & { amount: number; canSettle: boolean; month: number; monthLabel: string; year: number };

export type HomePacing = {
  carryIn: number;
  nextWeekAllowance: number;
```

In `src/modules/dashboard/components/HomeView.tsx` (change 3 of 9), find:

```tsx
type Props = {
  balances: HomeBalanceRow[];
  currentMemberId: string;
  daysLeft: number;
  // The essential lines of the person viewing Home.
  essentials: HomeEssential[];
```

Replace it with:

```tsx
type Props = {
  balances: HomeBalanceRow[];
  currentMemberId: string;
  // The viewer's cushion; canEdit only when it's the person signed in.
  cushion: { balance: number; canEdit: boolean; target: null | number };
  daysLeft: number;
  // The essential lines of the person viewing Home.
  essentials: HomeEssential[];
```

In `src/modules/dashboard/components/HomeView.tsx` (change 4 of 9), find:

```tsx
  recent: HomeRecentGroup[];
  recentPaybacks: HomePaybackRow[];
  savings: HomeSavingsPot[];
  spentMonthName: string;
  year: number;
};
```

Replace it with:

```tsx
  recent: HomeRecentGroup[];
  recentPaybacks: HomePaybackRow[];
  savings: HomeSavingsPot[];
  settle: HomeSettle | null;
  spentMonthName: string;
  year: number;
};
```

In `src/modules/dashboard/components/HomeView.tsx` (change 5 of 9), find:

```tsx
  const [explain, setExplain] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [paybackOpen, setPaybackOpen] = useState(false);
  const router = useRouter();
  const nameOf = (id: string) => props.members.find((m) => m.id === id)?.name ?? "Partner";

```

Replace it with:

```tsx
  const [explain, setExplain] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [paybackOpen, setPaybackOpen] = useState(false);
  const [cushionOpen, setCushionOpen] = useState(false);
  const router = useRouter();
  const nameOf = (id: string) => props.members.find((m) => m.id === id)?.name ?? "Partner";

```

In `src/modules/dashboard/components/HomeView.tsx` (change 6 of 9), find:

```tsx
        title="Home"
      />

      <section className="grid grid-cols-1 gap-x-14 gap-y-5 border-t-2 border-ink pt-5 pb-2 @min-[780px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-2.5">
          {pacing ? (
```

Replace it with:

```tsx
        title="Home"
      />

      {props.settle && <SettleCard {...props.settle} />}

      <section className="grid grid-cols-1 gap-x-14 gap-y-5 border-t-2 border-ink pt-5 pb-2 @min-[780px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-2.5">
          {pacing ? (
```

In `src/modules/dashboard/components/HomeView.tsx` (change 7 of 9), find:

```tsx
        })}
      </section>

      {props.balances.length > 0 && (
        <section className="mt-13 max-w-160">
          <SectionHeading sub="Where your money stands, apart from this month's spending">Balances</SectionHeading>
          {props.balances.map((row) => (
            <div className="flex items-baseline justify-between gap-4 border-b border-n-300 py-3" key={row.id}>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[15px]">{row.label}</span>
```

Replace it with:

```tsx
        })}
      </section>

      <section className="mt-13 max-w-160">
        <SectionHeading sub="Where your money stands, apart from this month's spending">Balances</SectionHeading>
        <div className="flex items-baseline justify-between gap-4 border-b border-n-300 py-3">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[15px]">Cushion</span>
            <span className="text-[13px] text-n-600">
              {props.cushion.target === null ? "Money beyond this month's plan" : `Aiming for ${formatMoney(props.cushion.target)}`}
            </span>
          </span>
          <span className="flex items-baseline gap-3">
            {props.cushion.canEdit && (
              <Button className="h-auto px-1.5 py-0.5 text-[13px]" onClick={() => setCushionOpen(true)} type="button" variant="ghost">
                Change
              </Button>
            )}
            <span className={cn("text-[15px] font-semibold", props.cushion.balance < 0 && "text-signal-ink")}>
              <Money tone={props.cushion.balance < 0 ? "negative" : "default"} value={props.cushion.balance} />
            </span>
          </span>
        </div>
        {props.balances.map((row) => (
            <div className="flex items-baseline justify-between gap-4 border-b border-n-300 py-3" key={row.id}>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[15px]">{row.label}</span>
```

In `src/modules/dashboard/components/HomeView.tsx` (change 8 of 9), find:

```tsx
              </span>
            </div>
          ))}
        </section>
      )}

      <div className="mt-13 grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-12">
        <section className="min-w-0">
```

Replace it with:

```tsx
              </span>
            </div>
          ))}
      </section>

      <div className="mt-13 grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-12">
        <section className="min-w-0">
```

In `src/modules/dashboard/components/HomeView.tsx` (change 9 of 9), find:

```tsx
        year={props.year}
      />

      <PaybackDialog
        currentMemberId={props.currentMemberId}
        defaults={props.payback ? { amount: props.payback.amount, fromMemberId: props.payback.debtorId } : null}
```

Replace it with:

```tsx
        year={props.year}
      />

      <CushionDialog balance={props.cushion.balance} onOpenChange={setCushionOpen} open={cushionOpen} target={props.cushion.target} />

      <PaybackDialog
        currentMemberId={props.currentMemberId}
        defaults={props.payback ? { amount: props.payback.amount, fromMemberId: props.payback.debtorId } : null}
```

- [ ] **Step 3: Test it in the browser**

In `e2e/dashboard.spec.ts`, find:

```ts
    await expect(page.getByText(/taken from your spending money\.$/)).toBeVisible();
  });

  test("exposes previous/next month navigation", async ({ page }) => {
    await expect(page.getByLabel("Previous month")).toBeVisible();
    await expect(page.getByLabel("Next month")).toBeVisible();
```

Replace it with:

```ts
    await expect(page.getByText(/taken from your spending money\.$/)).toBeVisible();
  });

  test("asks about last month's leftover until it's decided", async ({ page }) => {
    test.slow();
    // The seed leaves member 1 money over in the previous month.
    const card = page.getByRole("region", { name: /to decide$/ });
    await expect(card).toBeVisible();

    await card.getByRole("button", { name: "Done" }).click();

    await expect(card).toBeHidden({ timeout: 20_000 });
    await expect(page.getByText("Cushion", { exact: true })).toBeVisible();

    // A decided month isn't asked about again.
    await page.reload();
    await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible();
    await expect(card).toHaveCount(0);
  });

  test("exposes previous/next month navigation", async ({ page }) => {
    await expect(page.getByLabel("Previous month")).toBeVisible();
    await expect(page.getByLabel("Next month")).toBeVisible();
```

- [ ] **Step 4: Check types, unit tests and lint**

Run:

```bash
npx tsc --noEmit
npm test
npm run lint -- --fix
npm run lint
```

Expected: `tsc` prints nothing; every unit test passes; lint shows 0 errors.

- [ ] **Step 5: Run the browser tests for this task**

Run:

```bash
npx playwright test e2e/dashboard.spec.ts --reporter=line
```

Expected: all pass. This builds the app and resets its own test database first (1–3 minutes). If one fails with `ECONNRESET` or a timeout, re-run it alone (see Global Constraints) before treating it as a real failure.

- [ ] **Step 6: Commit**

```bash
git add src/modules/cushion/components/SettleCard.tsx src/modules/cushion/components/CushionDialog.tsx src/modules/dashboard/pages/DashboardPage.tsx src/modules/dashboard/components/HomeView.tsx e2e/dashboard.spec.ts
git commit -m "feat(home): last month's leftover and the cushion on Home"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.


### Task 5.5: Describe the budget model in the architecture doc

`docs/architecture.md` is what people and agents read first (see `AGENTS.md`). It gets the new tables, the Budget model section, the new pacing rule and which new entities aren't revertible.

**Files:**
- Modify: `docs/architecture.md`

- [ ] **Step 1: Update the architecture doc**

In `docs/architecture.md` (change 1 of 6), find:

```
  optional `recurringExpenseId`; `payBackAmount` = the part the other member will pay
  back; `savingsPotId` + optional `savingsItemId` = paid from a savings pot — an expense
  can't be both), `paybacks` (`fromMemberId` → `toMemberId`, any amount, not matched to
  expenses), `incomes` (per member/month), `recurring_expenses` (bills with
  `nextDueDate`, `frequency` monthly/quarterly/yearly), `monthly_budgets` +
  `budget_items` (planned amount per category/owner).
- **Goals & obligations** — `savings_pots` (at most one shared + one per member, with a
  `reserveMinimum`; `heldByMemberId` is a label only) + `savings_pot_plans` (monthly
  amount per member) + `savings_items` (the ordered priority list, optional `neededBy`;
```

Replace it with:

```
  optional `recurringExpenseId`; `payBackAmount` = the part the other member will pay
  back; `savingsPotId` + optional `savingsItemId` = paid from a savings pot — an expense
  can't be both), `paybacks` (`fromMemberId` → `toMemberId`, any amount, not matched to
  expenses; `fundId` + `fundAmount` = the part a fund paid), `incomes` (per member and
  month; `kind` pay — one per member/month, carried forward — or extra, any number),
  `recurring_expenses` (bills with `nextDueDate`, `frequency` monthly/quarterly/yearly),
  `monthly_budgets` + `budget_items` (planned amount per category and person; `kind`
  fixed/essential/can_cut, null = follow the category's fixed/flexible; old shared
  lines have no owner).
- **Goals & obligations** — `savings_pots` (at most one shared + one per member, with a
  `reserveMinimum`; `heldByMemberId` is a label only) + `savings_pot_plans` (monthly
  amount per member) + `savings_items` (the ordered priority list, optional `neededBy`;
```

In `docs/architecture.md` (change 2 of 6), find:

```
  (rotating savings group: entry `type` contribution/payout/fine — a fine never counts
  as a month paid; `potDeduction` = taken from each pot, e.g. the meeting's food;
  `interestPerMonth` paid after taking the pot; `completedAt` set when marked complete,
  otherwise derived from the logged months).
- **System** — `notifications` (deduped via unique `(householdId, dedupeKey)`),
  `activity_logs` (append-only audit trail: actor, entity, action, display-ready
  summary + field diffs, web/mobile source; written by actions via `logActivity`,
```

Replace it with:

```
  (rotating savings group: entry `type` contribution/payout/fine — a fine never counts
  as a month paid; `potDeduction` = taken from each pot, e.g. the meeting's food;
  `interestPerMonth` paid after taking the pot; `completedAt` set when marked complete,
  otherwise derived from the logged months), `funds` (one person's named pile inside
  their everyday account: optional target and due month, start month, archived) +
  `fund_plans` (monthly set-aside from a month on) + `fund_top_ups` (money added for a
  month), `cushion_entries` (kept / overspend / adjust) + `cushion_targets` +
  `month_settlements` (one per person per decided month).
- **System** — `notifications` (deduped via unique `(householdId, dedupeKey)`),
  `activity_logs` (append-only audit trail: actor, entity, action, display-ready
  summary + field diffs, web/mobile source; written by actions via `logActivity`,
```

In `docs/architecture.md` (change 3 of 6), find:

```
section of `docs/superpowers/plans/2026-10-11-money-model.md`; read it before changing
any of these numbers. The maths lives in pure, tested helpers under each module's `lib/`.

- **Spent** — the same number on Home, Reports and Budget: expenses paid from pay. Each
  page drops rows with a `savingsPotId` and shows them separately as "Paid from
  savings". Savings deposits, dhuku payments, loan repayments and paybacks are never Spent.
- **Who it counts against** — Home's per-person Spent and Left count by who paid
  (`walletSpentByMember`, `dashboard/lib/wallet.ts`). Budget counts by who it was for
  (`ownerMemberId`), because it's for planning. Home's shared row is "Spent on us", for
  information only and not taken from anyone's Left. The two members keep separate
  money, so paying for each other isn't debt.
- **Pay back later** — the ticked `payBackAmount` counts as the *other* member's
  spending. `paybackBalance` (`paybacks/lib/payback-balance.ts`) keeps one running net
  balance, like a shop's credit book: ticked amounts add to it, paybacks take it down,
  and amounts owed both ways cancel. It needs exactly two household members.
- **Moved this month** (`dashboard/lib/moved.ts`) — savings deposits (not opening
  balances or bank interest), dhuku contributions and fines in full, and repayments on
  loans you took. Money coming back isn't subtracted. Home: Unallocated = income − Spent
  − Moved.
- **Balances** (Home) — each pot's balance, each active dhuku's position (`dhukuPosition`:
  + the group owes you, − you owe the group), loans owed to you and loans you owe, and
  the pay-back balance.
```

Replace it with:

```
section of `docs/superpowers/plans/2026-10-11-money-model.md`; read it before changing
any of these numbers. The maths lives in pure, tested helpers under each module's `lib/`.

- **Spent** — the same number on Home, Reports and Budget: the part of each expense paid
  from pay (`payAmount` / `payRows`, `expenses/lib/pay-amount.ts`). Expenses paid from
  savings drop out and show as "Paid from savings"; a fund's share drops out and shows
  as "paid from funds". Savings deposits, dhuku payments, loan repayments, money into
  funds and paybacks are never Spent.
- **Who it counts against** — Home and Budget both count by who paid (`walletShares` /
  `walletSpentByMember`, `dashboard/lib/wallet.ts`). Home's shared row is "Spent on us",
  for information only and not taken from anyone's Left. The two members keep separate
  money, so paying for each other isn't debt.
- **Pay back later** — the ticked `payBackAmount` counts as the *other* member's
  spending. `paybackBalance` (`paybacks/lib/payback-balance.ts`) keeps one running net
  balance, like a shop's credit book: ticked amounts add to it, paybacks take it down,
  and amounts owed both ways cancel. It needs exactly two household members.
- **Moved this month** (`dashboard/lib/moved.ts`) — savings deposits (not opening
  balances or bank interest), dhuku contributions and fines in full, repayments on loans
  you took, and money into funds. Money coming back isn't subtracted. Home:
  Unallocated = pay + extra − Spent − Moved, all for the person viewing.
- **Balances** (Home) — each pot's balance, each active dhuku's position (`dhukuPosition`:
  + the group owes you, − you owe the group), loans owed to you and loans you owe, and
  the pay-back balance.
```

In `docs/architecture.md` (change 4 of 6), find:

```
  expenses paid from the pot. `forecastPot` fills the reserve first, then items in strict
  order: months = ⌈(reserve + cumulative cost − balance) ÷ planned monthly total⌉, `null`
  when nothing is planned. `neededByCheck` and `whatIfFirst` drive the deadline warnings
  and the "doing this first" hints. Budget shows a Savings line from the pot plans, and
  Left to plan = income − budgeted − planned savings.
- **Dhuku cost** (`dhuku/lib/dhuku-money.ts`) — `expectedPot` at meeting *k* = members ×
  contribution − pot deduction + interest × (*k* − 1). `dhukuRealCost` (food share +
  interest + fines − what came back inside your pot) is shown on the Dhuku page only.
- **Fill from recurring** (`budget/lib/recurring-budget.ts`,
  `fillBudgetFromRecurringAction`) — a budget line per category + owner from the bills
  due that month (every active monthly bill; quarterly/yearly only when `nextDueDate`
  falls in it). Lines that already exist are left alone.

## Cross-cutting concerns

- **Migrations** live in `drizzle/` (generated by `drizzle-kit generate`, applied by
```

Replace it with:

```
  expenses paid from the pot. `forecastPot` fills the reserve first, then items in strict
  order: months = ⌈(reserve + cumulative cost − balance) ÷ planned monthly total⌉, `null`
  when nothing is planned. `neededByCheck` and `whatIfFirst` drive the deadline warnings
  and the "doing this first" hints. A person's pot plans appear under Budget's "Set
  aside first".
- **Dhuku cost** (`dhuku/lib/dhuku-money.ts`) — `expectedPot` at meeting *k* = members ×
  contribution − pot deduction + interest × (*k* − 1). `dhukuRealCost` (food share +
  interest + fines − what came back inside your pot) is shown on the Dhuku page only.
- **Fill from recurring** (`budget/lib/recurring-budget.ts`,
  `fillBudgetFromRecurringAction`) — fixed lines in one person's plan from their own bills
  due that month (every active monthly bill; quarterly/yearly only when `nextDueDate`
  falls in it). Lines that already exist are left alone.

## Budget model

Each person plans their own money. The agreed design is in the "Design (agreed)" section
of `docs/superpowers/plans/2026-10-12-budget-model.md`.

- **A month's plan** (`budget/lib/plan-lines.ts`, `listPlanLines`) — a person's own lines
  in that month, or, when they have none there, their lines from their latest earlier
  month (minus archived categories). Nothing is written to carry a plan forward: the first
  change to such a month copies it in (`materializeMonth` in `budget.actions.ts`), and
  removing a person's last line keeps it at 0 so the month stays its own. One person's
  save or removal never touches the other person's lines.
- **Kinds** — fixed, essential, can cut, on each person's line (`kindOf` falls back to the
  category). A can-cut line's amount is its cap.
- **Pay vs extra** (`budget/lib/income.ts`, `monthIncome`) — pay carries forward; extra
  counts only in its own month. The plan runs on pay only.
- **Set aside first** (`budget/lib/set-aside.ts`) — filled in from savings pot plans,
  the person's dhukus (interest from the month after they took the pot), loans they took
  with an installment, and their funds. Left to plan = pay − set aside − budgeted.
- **Safe to spend** — runs over the viewer's can-cut lines only (see pacing below).
  Anything over plan elsewhere (`overrunFromPlan`: other lines past their amount plus
  spending with no line) comes off the weeks left (`withOverrun`), with a note on Home.
- **Funds** (`funds/lib/fund-math.ts`) — balance = set-asides from the first month on (at
  the amount in force each month) + money added − what expenses took. A fund pays up to
  its balance (`fundShare`); the rest of the expense is normal spending.
- **Closing a month** (`dashboard/lib/month-money.ts`, `cushion/`) — `personMonthMoney`
  works out one person's month for both Home and `settleMonthAction`, so the amount to
  decide on is always Home's Unallocated. Settling records deposits and loan repayments
  on the month's last day, fund money for that month, and the rest as a cushion entry;
  a month that went over is taken from the cushion.

## Cross-cutting concerns

- **Migrations** live in `drizzle/` (generated by `drizzle-kit generate`, applied by
```

In `docs/architecture.md` (change 5 of 6), find:

```
  chains so the real Postgres error is visible server-side — the client error boundary
  (`src/components/ErrorState.tsx`) only sees a stripped message.
- **Safe-to-spend pacing** (`src/modules/dashboard/lib/pacing.ts`): splits the
  month's flexible budget into a weekly release with a last-week buffer, carries
  unspent allowance forward between weeks, and surfaces `safeToday` (remaining ÷
  days left in the week) on the dashboard hero. Fixed-category expenses and
  expenses paid from savings don't count against the allowance (`allowanceSpentByDay`
  in `dashboard/lib/cash-flow.ts`); ones in archived or unknown categories still do.
- **App releases**: publishing is gated by `APP_RELEASE_ADMIN_EMAILS`
  (`src/lib/release-admin.ts`); APKs are uploaded to Vercel Blob via a client-token
  flow (`src/app/api/app-releases/upload/route.ts`). `handleUpload` requires
```

Replace it with:

```
  chains so the real Postgres error is visible server-side — the client error boundary
  (`src/components/ErrorState.tsx`) only sees a stripped message.
- **Safe-to-spend pacing** (`src/modules/dashboard/lib/pacing.ts`): splits the
  viewer's can-cut lines into a weekly release with a last-week buffer, carries
  unspent allowance forward between weeks, and surfaces `safeToday` (remaining ÷
  days left in the week) on the dashboard hero. Only the viewer's can-cut spending
  from pay counts against it day by day (`spentByDayIn` in `dashboard/lib/cash-flow.ts`);
  overruns elsewhere shrink the weeks left instead.
- **App releases**: publishing is gated by `APP_RELEASE_ADMIN_EMAILS`
  (`src/lib/release-admin.ts`); APKs are uploaded to Vercel Blob via a client-token
  flow (`src/app/api/app-releases/upload/route.ts`). `handleUpload` requires
```

In `docs/architecture.md` (change 6 of 6), find:

```
  Entries also store raw `before`/`after` snapshots (and cascaded `related` rows on
  deletes); `src/modules/activity/lib/revert/` plans a revert (pure, per-entity
  registry in `entities.ts`) and `api/revert.actions.ts` applies it — household-scoped,
  re-planned at apply time, and logged with `revertOfId`. Paybacks and the savings
  entities (`savings_pot`, `savings_item`, `savings_deposit`) are logged but not
  revertible, because they aren't in `ENTITY_REVERT`. `savings_goal` and
  `savings_contribution` are still in the enum, though their tables were dropped.

## Task playbooks

```

Replace it with:

```
  Entries also store raw `before`/`after` snapshots (and cascaded `related` rows on
  deletes); `src/modules/activity/lib/revert/` plans a revert (pure, per-entity
  registry in `entities.ts`) and `api/revert.actions.ts` applies it — household-scoped,
  re-planned at apply time, and logged with `revertOfId`. Paybacks, the savings
  entities (`savings_pot`, `savings_item`, `savings_deposit`), funds (`fund`,
  `fund_top_up`), `cushion` and `month_settlement` are logged but not revertible,
  because they aren't in `ENTITY_REVERT`. `savings_goal` and `savings_contribution` are
  still in the enum, though their tables were dropped.

## Task playbooks

```

- [ ] **Step 2: Check types, unit tests and lint**

Run:

```bash
npx tsc --noEmit
npm test
npm run lint -- --fix
npm run lint
```

Expected: `tsc` prints nothing; every unit test passes; lint shows 0 errors.

- [ ] **Step 3: Commit**

```bash
git add docs/architecture.md
git commit -m "docs(architecture): describe the budget model"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.


### Phase 5 checkpoint: STOP

Stop here. Do not start Phase 6.

Send the owner a short report:

- The task commits made in this phase (`git log --oneline` since the phase began).
- The new migration file's name, and that it adds the `cushion_entry_kind` type, the `cushion_entries`, `cushion_targets` and `month_settlements` tables and the `cushion` / `month_settlement` activity types. The owner should check: Home shows last month's card ("what was left" or "went over"); splitting it and pressing Done records the deposits, fund money and loan repayments on that month's last day and keeps the rest as cushion; the card doesn't come back; Balances shows the cushion, and Change sets a target or corrects it; viewing as the other person shows their card without buttons.
- The results of `npx tsc --noEmit`, `npm test`, `npm run lint` and `npm run test:e2e` (say which e2e tests failed, if any, and whether they passed when re-run alone).
- Anything that didn't match the plan and what you did about it.

Then wait. The owner applies the migration (`npm run db:migrate`) on their database themselves, tries the app, and tells you whether to go on.
