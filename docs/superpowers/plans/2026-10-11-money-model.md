# Piko Money Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. If you don't have those skills, do the tasks in order, one step at a time. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Piko count money the way this household actually lives. Spending is only money that's gone, and money moved into savings, dhuku or loan repayments is a transfer. Each person's figures follow their own wallet. The plan adds "pay back later", fixes dhuku, replaces savings goals with pots and a priority list, adds a Balances view, and adds a "Fill from recurring" budget button.

**Architecture:** Seven phases, each shippable on its own and each ending in a STOP for the owner to review, apply the database migration and test. Logic lives in small pure functions under `src/modules/<feature>/lib/` with Vitest tests written first. Server actions follow the existing `getCurrentMember()` + household-scoped query + `logActivity` pattern. Database changes are Drizzle schema edits plus generated migrations. The executor generates migrations but never applies them.

**Tech Stack:** Next.js 16 (App Router, server components, server actions), React 19, TypeScript, Drizzle ORM + PostgreSQL, Zod v4, Vitest (node, no DOM), Playwright e2e, ESLint with `eslint-plugin-perfectionist`, Husky pre-commit hook.

**Spec:** There is no separate spec file. The agreed design is the "Design (agreed)" section below, which the household owner approved point by point on 2026-10-10 and 2026-10-11. Read it fully before starting.

**Verified:** on 2026-10-11 this whole plan was dry-run end to end in a throwaway copy of the repo (commit `ef7134e`):
- Every edit applied cleanly, in order.
- `npm run db:generate` produced the four expected migrations without asking anything.
- `tsc` passed, `eslint` showed 0 errors, all 357 unit tests passed, and `next build` succeeded.

If a step doesn't match what you see, something has changed since then. Stop and report rather than improvise.

## How to use this plan

- Do the phases **in order**: 1 → 2 → 3 → 4 → 5 → 6 → 7. Inside a phase, do the tasks in order.
- Every phase ends with a **STOP checkpoint**. When you reach it, stop working and send the owner the report it describes. **Do not start the next phase until the owner says to go on.** Between phases the owner applies the migration to their database and tests the app.
- Code blocks are complete. Where a step says "replace the whole file", paste the whole block. Where it says "replace this block", find the exact old text (match by text, not line number) and replace it with the new text.
- Before Phase 1, create the branch once: `git switch -c feat/money-model`. Every task commits to that branch.

## Design (agreed)

### Counting rules (all phases)

1. Every money movement is either **spending** (money that's gone) or a **transfer** (money moved between your own piles, or lent and repaid). Only spending counts in "Spent".
2. **Spent** on Home, Reports and Budget is the same number: expenses paid from pay. From Phase 4, an expense marked "paid from savings" is left out of Spent, left out of each person's Left and left out of the weekly allowance. It still shows separately as "Paid from savings".
3. **Weekly allowance** (Home's "Safe to spend today"): sized from the flexible budget lines. Expenses count against it unless their category is `fixed`. Expenses in archived or unknown categories still count.
4. **Loan repayments** never count as spending. From Phase 5 they appear under "Moved this month", and what's owed appears in Balances. Loan interest is out of scope.

### Between the two members (Phase 2)

5. They live apart with fully separate money. Paying for each other (dates, gifts) is generosity, not debt. There is **no** automatic "who owes whom".
6. **Home's per-person Spent and Left count by who paid** (`paidByMemberId`), not who it was for. **Budget keeps counting by who it was for**, because Budget is for planning ("what we spend on us"). Home's Shared row becomes **"Spent on us"**: the total of shared expenses, shown for information and not taken from anyone's Left.
7. **Pay back later:** the expense form gets a tick with an amount (defaults to the full expense; can be part of it, e.g. half a date). The member who did **not** pay owes that amount, and it counts as **their** spending, not the payer's. There is **one running balance** between the two members, like a shop's credit book (udhaaro khata): ticked amounts add to it, a **"Record a payback"** of any amount takes it down, and amounts owed both ways **cancel out**. Paybacks are transfers, not spending. Both members see the balance on Home. It needs exactly two household members.

### Dhuku (Phase 3)

8. The owner's real dhuku has 12 members paying Rs 3,000 a month, a meeting on the first Sunday, and Rs 3,000 taken from each pot for food. Leftover food money carries over, and the last taker gets what's left. After taking the pot a member pays Rs 300 interest every month to the end. Fines are Rs 100 for coming late and Rs 100 for missing 3 meetings in a row. Interest and fines go into that month's pot.
9. **New:** a **"fine"** entry type, which never counts as a month paid. A **"taken from each pot"** field on a dhuku (e.g. Rs 3,000).
10. **Expected pot** at meeting *k* = members × contribution − taken from each pot + interest × (*k* − 1).
11. **Real cost so far** is shown **on the Dhuku page only**: your food share (taken from each pot ÷ members × contributions logged) + interest paid + fines paid − (payout received − base pot). Everything else is your own money going in and out. Dhuku stays out of Spent.

### Savings (Phases 4 and 6)

12. Savings goals are **replaced** by **pots**: at most one **shared** pot plus one pot **per member**, all visible to both. A pot has:
    - a name;
    - whose account holds it (a label);
    - a **minimum emergency reserve**;
    - a **planned monthly amount per person**;
    - an **opening balance** (what's in the account at setup).
13. Each pot has an ordered **priority list** of items, each with a name, an estimated cost and an optional note. From Phase 6, an item can also have a "needed by" date.
14. **Balance** = opening balance + money put in + bank interest − expenses paid from the pot.
15. **Forecast:**
    - The **reserve always fills first**. List items never use it.
    - **Strict order:** an item becomes affordable once the balance covers the reserve plus every item up to and including it.
    - Months = ⌈(reserve + cumulative cost − balance) ÷ planned monthly total⌉. That's 0 when already covered, and "not on the current plan" when nothing is planned.
16. **Paying for an item** = an expense with "Paid from" set to that pot and linked to the item. Paying for an emergency is the same, without the item link. A linked item counts as done.
17. **Budget** shows a Savings line built from the pot plans (planned against put in this month). "Left to plan" = income − budgeted − planned savings.
18. **Phase 6 extras:**
    - "Needed by" warnings: "affordable in Jestha, needed by Chaitra", plus "add Rs X a month" to close the gap.
    - A "what if first" hint: "doing this first pushes Surgery back 4 months".
    - Bank interest entries.
19. Savings were never recorded in Piko before, so **no data migration**. The old goals tables are empty, and the drop migration refuses to run if they aren't. The "Savings" category leaves the defaults for new households; the owner archives their own copy by hand.

### Balances (Phase 5)

20. Home gets a **Balances** section. It shows:
    - each pot's balance;
    - each active dhuku's position: + means the group owes you, − means you owe the group;
    - loans owed to you and loans you owe;
    - the pay-back balance.
21. Home's "Saved" cell becomes **"Moved this month"**: savings deposits + dhuku payments (contributions and fines, in full, because their cost part isn't in Spent) + repayments on loans you took. **Unallocated = income − Spent − Moved.**

### Budget (Phase 7)

22. A **"Fill from recurring"** button on Budget. It adds a budget line for each category and owner that has active recurring bills due in that month, and skips lines that already exist.

### Out of scope (do NOT build)

- Voice entry privacy and masking.
- Loan interest split.
- More than one income entry per month.
- Sinking funds.
- Budget rollover.
- Moving money between pots.
- Paying for an item in parts.
- A history of plan amounts.
- Undo (revert) for the new entity types. They are logged in Activity but not revertible, which happens automatically because they are not registered in `ENTITY_REVERT`.
- A phone bottom-bar change. The phone already has a floating "Add expense" button, so that item from the review is dropped.

## Global Constraints

- **Uncommitted user files:** the owner has uncommitted work in `src/app/globals.css` and `src/components/nav/SidebarNav.tsx`. **Never stage, edit, revert or stash those two files.**
- **Staging:** stage files only by exact path. Never use `git add -A`, `git add .`, `git commit -a`, `git stash`, `git checkout -- <file>` or `git reset --hard`.
- **Shell:** this is a Windows machine. The commands below work in both PowerShell and Git Bash. Run them from the repo root `C:\Users\nirja\OneDrive\Documents\piko`.
- **Line endings:** files are checked out with Windows line endings (CRLF), while the code blocks in this plan use LF. If your edit tool matches text byte for byte, compare line by line and ignore `\r`. Don't convert whole files' line endings.
- **Migrations:**
  - Generate them with `npm run db:generate`. It only writes files into `drizzle/` and needs no database.
  - **Never run `npm run db:migrate`, `npm run db:seed`, or anything that writes to the owner's database.**
  - Never hand-edit `drizzle/meta/*`.
  - If `npm run db:generate` asks an interactive question (for example "Is X created or renamed from Y?"), **stop and report it**. Don't answer it. This plan only adds things or only drops things in a single migration, so it shouldn't ask.
- **Pre-commit hook:** it runs `npx tsc --noEmit` then `npm run build` and takes 1–2 minutes. That's expected. **Never use `--no-verify`.** If the hook fails, read the error, fix the code, `git add` the same files again, and commit again.
- **Lint ordering is enforced:**
  - Imports are grouped react → third-party → `@/…` → relative, with a blank line between groups and alphabetical order inside each group.
  - Named import lists, type and interface properties, and JSX props are alphabetical.
  - After editing, run `npm run lint -- --fix`, then `npm run lint`, which must show **0 errors**. 8 existing `<img>` warnings are fine.
- **Money from the database is a string** (Drizzle `numeric`). Convert with `Number(x)` when reading, and `String(x)` when writing.
- **Household scoping:** every query must be scoped to the household: `householdId` from `getCurrentMember()` for writes, or through a parent table that has `householdId`. Never trust an id from the client without checking it belongs to the household.
- **Comments:** short `//` comments that say *why*, matching the surrounding code.
- **Next.js 16:** use only APIs already used in this repo. If you think you need a new Next API, stop and read `node_modules/next/dist/docs/` first.
- **Edits:** change only what each step says. Don't rename, reformat or "tidy" other code.
- **When an old block doesn't match:**
  - Line numbers in this plan are from before any edits and drift as you go, so always find code by its text.
  - If a "replace this" block doesn't match exactly, it's usually because `npm run lint -- --fix` re-sorted imports or props in an earlier task. Find the same code by meaning and make the same change.
  - If you can't find it at all, stop and report. Don't guess.
- **Tests:** new logic gets a Vitest test first. Run one file with `npx vitest run <path>` and everything with `npm test`.
- **After each commit,** run `graphify update .`. It only touches the gitignored `graphify-out/`, so there's nothing to commit.

## Review Focus

These are the five cases most likely to hurt a real user. Each one has a test or check in the task named.

1. **A fixed bill paid early in a week** must not wipe out that week's "safe to spend" (Task 1.1 test "leaves fixed ones out").
2. **An edit to an expense must never silently clear its "pay back later" amount or its "paid from savings" link.** An omitted field means "leave it as it is" (Task 2.3 Step 4 and Task 4.4 Step 3, both through the `=== undefined ? before…` rule).
3. **Amounts owed both ways must cancel**, and paying back more than is owed must flip the direction instead of going negative (Task 2.2 `paybackBalance` tests).
4. **A dhuku fine must never count as a month paid,** or the cycle "completes" early (Task 3.2 `monthsLogged` and `dhukuProgress` tests).
5. **A pot whose reserve isn't full yet** must push every list item back until the reserve fills, and "nothing planned" must read "not on the current plan" instead of a fake date (Task 4.2 `forecastPot` tests).

---
## Phase 1: The numbers agree

**What this phase delivers:**
- The weekly allowance stops counting fixed bills.
- Home's Spent stops counting loan repayments, so Home, Reports and Budget agree.
- The unused cash-flow helpers are deleted.

No database change.

### Task 1.1: The weekly allowance ignores fixed-category bills

**Files:**
- Modify: `src/modules/dashboard/lib/cash-flow.ts` (append a new function at the end)
- Modify: `src/modules/dashboard/lib/cash-flow.test.ts` (add an import and a `describe` block)
- Modify: `src/modules/dashboard/pages/DashboardPage.tsx` (lines 3–11 imports, line 18 import, lines 171–184)
- Modify: `docs/architecture.md` (the "Safe-to-spend pacing" bullet, lines 165–168)

**Interfaces:**
- Produces: `export type AllowanceExpenseRow = { amount: string; categoryId: string; date: string }` and `export function allowanceSpentByDay(expenseRows: AllowanceExpenseRow[], fixedCategoryIds: ReadonlySet<string>, year: number, month: number, dateFormat: DateFormat): number[]`. It returns one number per day of the period, with index 0 being day 1.
- Consumes: `resolvePeriod(year, month, dateFormat)` and `dayNumberInPeriod(dateStr, year, month, dateFormat)` from `@/lib/month-period`. Both are already imported in `cash-flow.ts`.

- [ ] **Step 1: Create the branch**

Run: `git switch -c feat/money-model`
Expected: `Switched to a new branch 'feat/money-model'`.

- [ ] **Step 2: Write the failing tests**

In `src/modules/dashboard/lib/cash-flow.test.ts`, replace the import block at the top (lines 2–13):

```ts
import { describe, expect, it } from "vitest";

import {
  type CashFlowEvent,
  dailyCashFlowPoints,
  daysLeftInMonth,
  dhukuCashFlow,
  loanNetFlowByOwner,
  loanPaymentCashFlow,
  netMonthlyOutflow,
  safeToSpendToday,
} from "./cash-flow";
```

with:

```ts
import { describe, expect, it } from "vitest";

import { resolvePeriod } from "@/lib/month-period";

import {
  allowanceSpentByDay,
  type CashFlowEvent,
  dailyCashFlowPoints,
  daysLeftInMonth,
  dhukuCashFlow,
  loanNetFlowByOwner,
  loanPaymentCashFlow,
  netMonthlyOutflow,
  safeToSpendToday,
} from "./cash-flow";
```

Then append this block at the very end of the same file:

```ts

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
    );

    expect(spent.every((value) => value === 0)).toBe(true);
  });

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
    );

    expect(spent).toHaveLength(period.daysInPeriod);
    expect(spent[0]).toBe(100);
    expect(spent[period.daysInPeriod - 1]).toBe(300);
  });
});
```

- [ ] **Step 3: Run the tests and watch them fail**

Run: `npx vitest run src/modules/dashboard/lib/cash-flow.test.ts`
Expected: FAIL. Either the 4 new `allowanceSpentByDay` tests fail with `TypeError: allowanceSpentByDay is not a function`, or the whole file fails to load with an error naming `allowanceSpentByDay`. Both mean the test is correctly waiting for the code. Any other error means Step 2 was pasted wrongly; fix that first.

- [ ] **Step 4: Add the helper**

Append this at the very end of `src/modules/dashboard/lib/cash-flow.ts`, after `daysLeftInMonth`. The imports it needs (`DateFormat`, `dayNumberInPeriod`, `resolvePeriod`) are already at the top of the file.

```ts

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
): number[] {
  const period = resolvePeriod(year, month, dateFormat);
  const spent = new Array<number>(period.daysInPeriod).fill(0);
  for (const expense of expenseRows) {
    if (fixedCategoryIds.has(expense.categoryId)) continue;
    const day = dayNumberInPeriod(expense.date, year, month, dateFormat);
    if (day !== null) spent[day - 1] += Number(expense.amount);
  }
  return spent;
}
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npx vitest run src/modules/dashboard/lib/cash-flow.test.ts`
Expected: all tests in the file PASS, including the 4 new ones.

- [ ] **Step 6: Use the helper on Home**

In `src/modules/dashboard/pages/DashboardPage.tsx`, make three edits.

**(a)** Line 18. Replace:

```ts
import { daysLeftInMonth, loanNetFlowByOwner } from "@/modules/dashboard/lib/cash-flow";
```

with:

```ts
import { allowanceSpentByDay, daysLeftInMonth, loanNetFlowByOwner } from "@/modules/dashboard/lib/cash-flow";
```

**(b)** The `@/lib/month-period` import (lines 3–11). Delete the line `  dayNumberInPeriod,` and nothing else. The other names in that import stay.

**(c)** Replace this block (lines 171–184):

```ts
  // Weekly pacing over the flexible part of the budget (fixed commitments are
  // already spoken for): the hero's safe-to-spend figure and its carry-over.
  const period = resolvePeriod(year, month, dateFormat);
  const flexiblePlanned = budgetItemRows
    .filter((b) => category(b.categoryId)?.budgetType === "flexible")
    .reduce((s, b) => s + Number(b.plannedAmount), 0);
  const pacingSchedule =
    flexiblePlanned > 0 ? buildPacingSchedule({ daysInPeriod: period.daysInPeriod, flexibleTotal: flexiblePlanned }) : null;
  const dayOfPeriod = isCurrentMonth ? daysElapsedInPeriod(period) : period.daysInPeriod;
  const spentByDay = new Array<number>(period.daysInPeriod).fill(0);
  for (const expense of expenseRows) {
    const day = dayNumberInPeriod(expense.date, year, month, dateFormat);
    if (day !== null) spentByDay[day - 1] += Number(expense.amount);
  }
```

with:

```ts
  // Weekly pacing over the flexible part of the budget (fixed commitments are
  // already spoken for): the hero's safe-to-spend figure and its carry-over.
  // Fixed-category expenses don't count against it, for the same reason.
  const period = resolvePeriod(year, month, dateFormat);
  const flexiblePlanned = budgetItemRows
    .filter((b) => category(b.categoryId)?.budgetType === "flexible")
    .reduce((s, b) => s + Number(b.plannedAmount), 0);
  const pacingSchedule =
    flexiblePlanned > 0 ? buildPacingSchedule({ daysInPeriod: period.daysInPeriod, flexibleTotal: flexiblePlanned }) : null;
  const dayOfPeriod = isCurrentMonth ? daysElapsedInPeriod(period) : period.daysInPeriod;
  const fixedCategoryIds = new Set(categories.filter((c) => c.budgetType === "fixed").map((c) => c.id));
  const spentByDay = allowanceSpentByDay(expenseRows, fixedCategoryIds, year, month, dateFormat);
```

- [ ] **Step 7: Update the architecture doc**

In `docs/architecture.md`, replace:

```md
- **Safe-to-spend pacing** (`src/modules/dashboard/lib/pacing.ts`): splits the
  month's flexible budget into a weekly release with a last-week buffer, carries
  unspent allowance forward between weeks, and surfaces `safeToday` (remaining ÷
  days left in the week) on the dashboard hero.
```

with:

```md
- **Safe-to-spend pacing** (`src/modules/dashboard/lib/pacing.ts`): splits the
  month's flexible budget into a weekly release with a last-week buffer, carries
  unspent allowance forward between weeks, and surfaces `safeToday` (remaining ÷
  days left in the week) on the dashboard hero. Fixed-category expenses don't
  count against the allowance (`allowanceSpentByDay` in `dashboard/lib/cash-flow.ts`).
```

- [ ] **Step 8: Check types, lint and all unit tests**

Run, in order:

1. `npx tsc --noEmit`. Expected: no output (no errors).
2. `npm run lint -- --fix`, then `npm run lint`. Expected: 0 errors.
3. `npm test`. Expected: every test passes, with 4 more than before this task.

If `tsc` reports `'dayNumberInPeriod' is declared but never used` or `Cannot find name 'dayNumberInPeriod'`, Step 6(b) or 6(c) wasn't done exactly. Redo it.

- [ ] **Step 9: Commit**

```bash
git add src/modules/dashboard/lib/cash-flow.ts src/modules/dashboard/lib/cash-flow.test.ts src/modules/dashboard/pages/DashboardPage.tsx docs/architecture.md
git commit -m "fix(home): weekly allowance ignores fixed-category bills"
```

Expected: the hook runs `tsc` and `next build` (1–2 min), then the commit is created. Afterwards, run `git status`: `src/app/globals.css` and `src/components/nav/SidebarNav.tsx` must still show as modified and **not** committed.

---

### Task 1.2: Home's "Spent" stops counting loan repayments

**Files:**
- Modify: `src/modules/dashboard/pages/DashboardPage.tsx` (imports at lines 18 and 23, `Promise.all` at lines 57–83, the loan block at lines 97–107, `ownerSpent` at lines 112–113, the `ledger` prop at lines 264–274)
- Modify: `src/modules/dashboard/lib/cash-flow.ts` (delete `loanNetFlowByOwner` and its comment)
- Modify: `src/modules/dashboard/lib/cash-flow.test.ts` (delete the `loanNetFlowByOwner` tests and import)

**Interfaces:**
- Consumes: `dashboardSummary(incomes, expenses)` from `@/modules/budget/lib/calculations`, already called in this file. It returns `{ combinedIncome: number; totalExpenses: number; unallocated: number }`, where `unallocated = combinedIncome - totalExpenses`. Reports and Budget use the same expense totals.
- Produces: nothing new. `loanNetFlowByOwner` is removed.

- [ ] **Step 1: Remove the loan queries from the page**

In `src/modules/dashboard/pages/DashboardPage.tsx`:

**(a)** Delete this whole import line (line 23):

```ts
import { listLoanPayments, listLoans } from "@/modules/loans/api/loans.actions";
```

**(b)** Replace the cash-flow import (from Task 1.1):

```ts
import { allowanceSpentByDay, daysLeftInMonth, loanNetFlowByOwner } from "@/modules/dashboard/lib/cash-flow";
```

with:

```ts
import { allowanceSpentByDay, daysLeftInMonth } from "@/modules/dashboard/lib/cash-flow";
```

**(c)** Replace the `Promise.all` block (lines 57–83):

```ts
  const [
    members,
    categories,
    incomeRows,
    budgetItemRows,
    expenseRows,
    prevIncomeRows,
    prevExpenseRows,
    recentExpenseRows,
    goalRows,
    contributionRows,
    loanRows,
    loanPaymentRows,
  ] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    getIncomesForMonth(year, month),
    getBudgetItemsForMonth(year, month),
    listExpensesForMonth(year, month, dateFormat),
    getIncomesForMonth(prev.year, prev.month),
    listExpensesForMonth(prev.year, prev.month, dateFormat),
    listRecentExpenses(5),
    listSavingsGoals(householdId),
    listSavingsContributions(householdId),
    listLoans(householdId),
    listLoanPayments(householdId),
  ]);
```

with:

```ts
  const [
    members,
    categories,
    incomeRows,
    budgetItemRows,
    expenseRows,
    prevIncomeRows,
    prevExpenseRows,
    recentExpenseRows,
    goalRows,
    contributionRows,
  ] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    getIncomesForMonth(year, month),
    getBudgetItemsForMonth(year, month),
    listExpensesForMonth(year, month, dateFormat),
    getIncomesForMonth(prev.year, prev.month),
    listExpensesForMonth(prev.year, prev.month, dateFormat),
    listRecentExpenses(5),
    listSavingsGoals(householdId),
    listSavingsContributions(householdId),
  ]);
```

- [ ] **Step 2: Remove the loan maths**

Still in `DashboardPage.tsx`:

**(a)** Delete this whole block (lines 97–107) and the blank line after it:

```ts
  // Loan payments live in their own table, separate from `expenses`, so
  // dashboardSummary never sees them. Fold their net cash flow into the
  // spent figures the same way Safe to Spend's totalActual does, so a
  // recorded loan payment actually shows up in what's been spent.
  const loanFlowByOwner = loanNetFlowByOwner(loanPaymentRows, loanRows, year, month, dateFormat);
  const prevLoanFlowByOwner = loanNetFlowByOwner(loanPaymentRows, loanRows, prev.year, prev.month, dateFormat);
  const loanNetTotal = [...loanFlowByOwner.values()].reduce((s, v) => s + v, 0);
  const prevLoanNetTotal = [...prevLoanFlowByOwner.values()].reduce((s, v) => s + v, 0);
  const totalExpensesWithLoans = summary.totalExpenses + loanNetTotal;
  const prevTotalExpensesWithLoans = prevSummary.totalExpenses + prevLoanNetTotal;
  const unallocatedWithLoans = summary.combinedIncome - totalExpensesWithLoans;
```

**(b)** Replace:

```ts
  const ownerSpent = (ownerId: null | string) =>
    expenses.filter((e) => e.ownerMemberId === ownerId).reduce((s, e) => s + e.amount, 0) + (loanFlowByOwner.get(ownerId) ?? 0);
```

with:

```ts
  const ownerSpent = (ownerId: null | string) =>
    expenses.filter((e) => e.ownerMemberId === ownerId).reduce((s, e) => s + e.amount, 0);
```

**(c)** In the `ledger={{ ... }}` prop near the bottom, replace these five lines:

```ts
        spent: totalExpensesWithLoans,
        spentMeterRatio: summary.combinedIncome > 0 ? totalExpensesWithLoans / summary.combinedIncome : 0,
        spentPctOfIncome: percent(totalExpensesWithLoans, summary.combinedIncome),
        spentTrendPct: trendPct(totalExpensesWithLoans, prevTotalExpensesWithLoans),
        unallocated: unallocatedWithLoans,
```

with:

```ts
        spent: summary.totalExpenses,
        spentMeterRatio: summary.combinedIncome > 0 ? summary.totalExpenses / summary.combinedIncome : 0,
        spentPctOfIncome: percent(summary.totalExpenses, summary.combinedIncome),
        spentTrendPct: trendPct(summary.totalExpenses, prevSummary.totalExpenses),
        unallocated: summary.unallocated,
```

- [ ] **Step 3: Delete `loanNetFlowByOwner` and its tests**

**(a)** In `src/modules/dashboard/lib/cash-flow.ts`, delete the comment and function from `// Net loan cash flow for the month, signed so it can be added directly to` down to the closing `}` of `loanNetFlowByOwner` (currently lines 32–56). Leave `LoanPaymentRow`, `LoanDirectionRow` and `loanPaymentCashFlow` in place for now; Task 1.3 removes them.

**(b)** In `src/modules/dashboard/lib/cash-flow.test.ts`, delete the line `  loanNetFlowByOwner,` from the import list. Then delete the whole `describe("loanNetFlowByOwner", () => { ... });` block (4 tests).

- [ ] **Step 4: Confirm nothing still uses the removed names**

Run: `git grep -n -E "loanNetFlowByOwner|totalExpensesWithLoans|unallocatedWithLoans|loanFlowByOwner|listLoanPayments\(householdId\)" -- src`
Expected: no output.

Run: `git grep -n "listLoanPayments" -- src`
Expected: matches only inside `src/modules/loans/` (the Loans page still uses it). No match in `src/modules/dashboard/`.

- [ ] **Step 5: Check types, lint and all unit tests**

Run, in order:

1. `npx tsc --noEmit`. Expected: no output.
2. `npm run lint -- --fix`, then `npm run lint`. Expected: 0 errors.
3. `npm test`. Expected: every test passes, with 4 fewer than after Task 1.1 (the deleted `loanNetFlowByOwner` tests).

- [ ] **Step 6: Check the result in the app (only if it runs locally)**

Do this only if `npm run dev` starts and you can log in. If the app can't start (database not reachable, or no login), skip this step and say so in your hand-back.

1. Run `npm run dev` and open `http://localhost:3000/dashboard`.
2. Note "Spent in <month>" on Home.
3. Open `http://localhost:3000/reports` for the same month (Expenses tab) and note the month's total spent.
4. Expected: the two numbers are **equal**.
5. If the household has a loan payment logged this month, Home's "Spent" must not include it. Opening `/loans` shows the payment is still listed there.
6. Stop the dev server with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
git add src/modules/dashboard/pages/DashboardPage.tsx src/modules/dashboard/lib/cash-flow.ts src/modules/dashboard/lib/cash-flow.test.ts
git commit -m "fix(home): loan repayments no longer count as spending"
```

Expected: the hook passes and the commit is created. `git status` still shows `src/app/globals.css` and `src/components/nav/SidebarNav.tsx` as modified and not committed.

---

### Task 1.3: Delete the unused cash-flow helpers

**Files:**
- Modify (replace the whole file): `src/modules/dashboard/lib/cash-flow.ts`
- Modify (replace the whole file): `src/modules/dashboard/lib/cash-flow.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `cash-flow.ts` exports exactly `daysLeftInMonth`, `AllowanceExpenseRow` and `allowanceSpentByDay`. These are used by `src/modules/dashboard/pages/DashboardPage.tsx` and `src/modules/expenses/pages/ExpensesPage.tsx`.

- [ ] **Step 1: Confirm the helpers have no callers**

Run: `git grep -n -E "dhukuCashFlow|loanPaymentCashFlow|dailyCashFlowPoints|netMonthlyOutflow|safeToSpendToday|CashFlowEvent|DhukuEntryRow|LoanPaymentRow|LoanDirectionRow|DayPoint" -- src e2e scripts`
Expected: matches **only** in `src/modules/dashboard/lib/cash-flow.ts` and `src/modules/dashboard/lib/cash-flow.test.ts`. If anything else matches, stop and report it. Don't delete.

- [ ] **Step 2: Replace `cash-flow.ts`**

Replace the entire contents of `src/modules/dashboard/lib/cash-flow.ts` with:

```ts
// src/modules/dashboard/lib/cash-flow.ts
import type { DateFormat } from "@/lib/date-format-cookie";
import { currentPeriodYearMonth, dayNumberInPeriod, daysElapsedInPeriod, resolvePeriod } from "@/lib/month-period";

export function daysLeftInMonth(year: number, month: number, dateFormat: DateFormat): number {
  const period = resolvePeriod(year, month, dateFormat);
  const current = currentPeriodYearMonth(dateFormat);
  if (year !== current.year || month !== current.month) return period.daysInPeriod;
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
): number[] {
  const period = resolvePeriod(year, month, dateFormat);
  const spent = new Array<number>(period.daysInPeriod).fill(0);
  for (const expense of expenseRows) {
    if (fixedCategoryIds.has(expense.categoryId)) continue;
    const day = dayNumberInPeriod(expense.date, year, month, dateFormat);
    if (day !== null) spent[day - 1] += Number(expense.amount);
  }
  return spent;
}
```

- [ ] **Step 3: Replace `cash-flow.test.ts`**

Replace the entire contents of `src/modules/dashboard/lib/cash-flow.test.ts` with:

```ts
// src/modules/dashboard/lib/cash-flow.test.ts
import { describe, expect, it } from "vitest";

import { resolvePeriod } from "@/lib/month-period";

import { allowanceSpentByDay, daysLeftInMonth } from "./cash-flow";

describe("daysLeftInMonth", () => {
  it("returns the full day count for a month that isn't the current one", () => {
    expect(daysLeftInMonth(2020, 2, "english")).toBe(29); // Feb 2020 is a leap year
  });

  it("returns the full day count for a 30-day past month", () => {
    expect(daysLeftInMonth(2020, 4, "english")).toBe(30);
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
    );

    expect(spent.every((value) => value === 0)).toBe(true);
  });

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
    );

    expect(spent).toHaveLength(period.daysInPeriod);
    expect(spent[0]).toBe(100);
    expect(spent[period.daysInPeriod - 1]).toBe(300);
  });
});
```

- [ ] **Step 4: Confirm the helpers are gone everywhere**

Run: `git grep -n -E "dhukuCashFlow|loanPaymentCashFlow|dailyCashFlowPoints|netMonthlyOutflow|safeToSpendToday|CashFlowEvent" -- src e2e scripts docs/architecture.md`
Expected: no output.

- [ ] **Step 5: Check types, lint and all unit tests**

Run, in order:

1. `npx tsc --noEmit`. Expected: no output.
2. `npm run lint -- --fix`, then `npm run lint`. Expected: 0 errors.
3. `npm test`. Expected: every test passes. `cash-flow.test.ts` now has exactly 6 tests: 2 for `daysLeftInMonth` and 4 for `allowanceSpentByDay`.

- [ ] **Step 6: Commit**

```bash
git add src/modules/dashboard/lib/cash-flow.ts src/modules/dashboard/lib/cash-flow.test.ts
git commit -m "chore(home): remove unused cash-flow helpers"
```

Expected: the hook passes and the commit is created.

---

### Phase 1 checkpoint: STOP

- [ ] **Step 1: Run the full checks**

Run, in order:
1. `npm test`. Expected: all pass.
2. `npm run lint`. Expected: 0 errors.
3. `npx tsc --noEmit`. Expected: no output.

- [ ] **Step 2: Run the e2e suite (optional)**

Run: `npm run test:e2e`.
- It builds the app and runs it against a **separate e2e database** (see `scripts/seed-e2e.ts`, which refuses any database not ending in `_e2e`).
- If it fails with a database or connection error, don't try to fix it. Note it in the report.
- Any other failure is a real bug: fix it before stopping.

- [ ] **Step 3: Report to the owner, then STOP**

Tell the owner, in plain language:
- **What changed:** the commits made, one line each.
- **Test results:** unit test totals, and whether e2e ran.
- **What they'll notice on Home:**
  - Rent or EMI no longer wipes out the week's "Safe to spend".
  - Loan repayments no longer appear in Spent; they're still on the Loans page.
  - Home's Spent now matches Reports for the same month.
- **Migrations:** this phase has no database change, so there's nothing to apply.

Then **wait for the owner to say go on** before starting Phase 2.

---

## Phase 2: Two wallets

**What this phase delivers:**
- Home's per-person Spent and Left count by who paid.
- The Shared row becomes "Spent on us".
- The "pay back later" tick on expenses, with one running balance between the two members and a "Record a payback" button on Home.

Design rules 5–7 apply.

**Database change:** a new `expenses.pay_back_amount` column, a new `paybacks` table, and a new activity entity type `payback`.

### Task 2.1: Schema for pay back later

**Files:**
- Modify: `src/db/schema/expenses.ts`
- Create: `src/db/schema/paybacks.ts`
- Modify: `src/db/schema/index.ts`
- Modify: `src/db/schema/activityLogs.ts`
- Modify: `src/modules/activity/lib/sections.ts`
- Modify: `src/modules/activity/lib/activity-format.ts`
- Create (generated): `drizzle/00NN_<random>.sql` and a new `drizzle/meta/00NN_snapshot.json` (the number is the next free one, probably `0018`)

**Interfaces:**
- Produces: the `expenses.payBackAmount` column (`numeric`, nullable; Drizzle returns `string | null`). A `paybacks` table export with columns `id, householdId, fromMemberId, toMemberId, amount, date, note, createdAt`. The `"payback"` member of `ActivityEntityType`.

- [ ] **Step 1: Add the column to expenses**

In `src/db/schema/expenses.ts`, replace:

```ts
  recurringExpenseId: uuid("recurring_expense_id").references(() => recurringExpenses.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
```

with:

```ts
  recurringExpenseId: uuid("recurring_expense_id").references(() => recurringExpenses.id, {
    onDelete: "set null",
  }),
  // The part of `amount` the other household member will pay back (the
  // "pay back later" tick). null = nothing to pay back.
  payBackAmount: numeric("pay_back_amount", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
```

- [ ] **Step 2: Create the paybacks table**

Create `src/db/schema/paybacks.ts`:

```ts
import { date, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { householdMembers } from "./householdMembers";
import { households } from "./households";

// Money one member hands the other to bring down the "pay back later"
// balance between them. Any amount; it isn't matched to particular expenses.
export const paybacks = pgTable("paybacks", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  fromMemberId: uuid("from_member_id")
    .notNull()
    .references(() => householdMembers.id, { onDelete: "cascade" }),
  toMemberId: uuid("to_member_id")
    .notNull()
    .references(() => householdMembers.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  date: date("date").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

In `src/db/schema/index.ts`, replace:

```ts
export * from "./expenses";
```

with:

```ts
export * from "./expenses";
export * from "./paybacks";
```

- [ ] **Step 3: Add the activity entity type**

In `src/db/schema/activityLogs.ts`, replace:

```ts
  "loan_payment",
  "recurring_expense",
```

with:

```ts
  "loan_payment",
  "payback",
  "recurring_expense",
```

In `src/modules/activity/lib/sections.ts`, replace:

```ts
  { entityTypes: ["expense"], label: "Expenses", value: "expenses" },
```

with:

```ts
  { entityTypes: ["expense", "payback"], label: "Expenses", value: "expenses" },
```

In `src/modules/activity/lib/activity-format.ts`, replace:

```ts
  loan_payment: "a loan payment",
  recurring_expense: "a recurring bill",
```

with:

```ts
  loan_payment: "a loan payment",
  payback: "a payback",
  recurring_expense: "a recurring bill",
```

- [ ] **Step 4: Generate the migration**

Run: `npm run db:generate`
Expected: it prints that it wrote one new SQL file in `drizzle/`. It must **not** ask any question. If it asks one, stop and report it.

Then check what it generated:

Run: `git status --short drizzle`
Expected: one new `drizzle/00NN_*.sql`, one new `drizzle/meta/00NN_snapshot.json`, and a modified `drizzle/meta/_journal.json`.

Open the new `.sql` file. It must contain all of these:
- `ALTER TABLE "expenses" ADD COLUMN "pay_back_amount" numeric(12, 2)`
- `CREATE TABLE "paybacks"`
- `ALTER TYPE "public"."activity_entity_type" ADD VALUE 'payback'`

It must **not** contain `DROP`. If it does, stop and report.

- [ ] **Step 5: Check types and tests**

Run: `npx tsc --noEmit`. Expected: no output.
Run: `npm test`. Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema/expenses.ts src/db/schema/paybacks.ts src/db/schema/index.ts src/db/schema/activityLogs.ts src/modules/activity/lib/sections.ts src/modules/activity/lib/activity-format.ts drizzle
git commit -m "feat(db): pay back later column and paybacks table"
```

---

### Task 2.2: Wallet and pay-back maths

**Files:**
- Create: `src/modules/dashboard/lib/wallet.ts`
- Create: `src/modules/dashboard/lib/wallet.test.ts`
- Create: `src/modules/paybacks/lib/payback-balance.ts`
- Create: `src/modules/paybacks/lib/payback-balance.test.ts`

**Interfaces:**
- Produces: `export type WalletExpense = { amount: number; paidByMemberId: string; payBackAmount: null | number }` and `export function walletSpentByMember(expenses: WalletExpense[], memberIds: string[]): Map<string, number>`.
- Produces: `export type PayBackExpense = { amount: number; paidByMemberId: string; payBackAmount: number }`, `export type Payback = { amount: number; fromMemberId: string; toMemberId: string }`, `export type PaybackBalance = { amount: number; creditorId: string; debtorId: string }` and `export function paybackBalance(expenses: PayBackExpense[], paybacks: Payback[], members: [string, string]): null | PaybackBalance`.

- [ ] **Step 1: Write the failing tests**

Create `src/modules/dashboard/lib/wallet.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { walletSpentByMember } from "./wallet";

const ME = "me";
const HER = "her";

describe("walletSpentByMember", () => {
  it("counts each expense against whoever paid, shared ones and gifts included", () => {
    const totals = walletSpentByMember(
      [
        { amount: 1000, paidByMemberId: ME, payBackAmount: null }, // my phone bill
        { amount: 2000, paidByMemberId: ME, payBackAmount: null }, // a date, logged as shared
        { amount: 1500, paidByMemberId: ME, payBackAmount: null }, // a gift for her
      ],
      [ME, HER],
    );

    expect(totals.get(ME)).toBe(4500);
    expect(totals.get(HER)).toBe(0);
  });

  it("moves the to-be-paid-back part onto the other person", () => {
    const totals = walletSpentByMember([{ amount: 3000, paidByMemberId: HER, payBackAmount: 3000 }], [ME, HER]);

    expect(totals.get(HER)).toBe(0);
    expect(totals.get(ME)).toBe(3000);
  });

  it("splits an expense where only half is to be paid back", () => {
    const totals = walletSpentByMember([{ amount: 3000, paidByMemberId: HER, payBackAmount: 1500 }], [ME, HER]);

    expect(totals.get(HER)).toBe(1500);
    expect(totals.get(ME)).toBe(1500);
  });

  it("never moves more than the expense itself", () => {
    const totals = walletSpentByMember([{ amount: 1000, paidByMemberId: HER, payBackAmount: 5000 }], [ME, HER]);

    expect(totals.get(HER)).toBe(0);
    expect(totals.get(ME)).toBe(1000);
  });

  it("ignores pay-back amounts when the household has one person", () => {
    const totals = walletSpentByMember([{ amount: 1000, paidByMemberId: ME, payBackAmount: 1000 }], [ME]);

    expect(totals.get(ME)).toBe(1000);
  });
});
```

Create `src/modules/paybacks/lib/payback-balance.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { paybackBalance } from "./payback-balance";

const ME = "me";
const HER = "her";

// The example month the owner agreed: she covers a recharge, a dinner, and
// half of a date, then I hand her Rs 5,000.
const SHE_COVERED = [
  { amount: 800, paidByMemberId: HER, payBackAmount: 800 },
  { amount: 3000, paidByMemberId: HER, payBackAmount: 3000 },
  { amount: 3000, paidByMemberId: HER, payBackAmount: 1500 },
];

describe("paybackBalance", () => {
  it("adds up what one person covered for the other", () => {
    expect(paybackBalance(SHE_COVERED, [], [ME, HER])).toEqual({ amount: 5300, creditorId: HER, debtorId: ME });
  });

  it("takes a payback of any amount off the running total", () => {
    const balance = paybackBalance(SHE_COVERED, [{ amount: 5000, fromMemberId: ME, toMemberId: HER }], [ME, HER]);

    expect(balance).toEqual({ amount: 300, creditorId: HER, debtorId: ME });
  });

  it("cancels amounts owed in both directions", () => {
    const balance = paybackBalance([...SHE_COVERED, { amount: 1000, paidByMemberId: ME, payBackAmount: 1000 }], [], [ME, HER]);

    expect(balance).toEqual({ amount: 4300, creditorId: HER, debtorId: ME });
  });

  it("flips direction when someone pays back more than they owe", () => {
    const balance = paybackBalance(SHE_COVERED, [{ amount: 6000, fromMemberId: ME, toMemberId: HER }], [ME, HER]);

    expect(balance).toEqual({ amount: 700, creditorId: ME, debtorId: HER });
  });

  it("returns null when the two are square", () => {
    const balance = paybackBalance(
      [{ amount: 800, paidByMemberId: HER, payBackAmount: 800 }],
      [{ amount: 800, fromMemberId: ME, toMemberId: HER }],
      [ME, HER],
    );

    expect(balance).toBeNull();
  });

  it("never owes more than the expense itself", () => {
    const balance = paybackBalance([{ amount: 1000, paidByMemberId: HER, payBackAmount: 5000 }], [], [ME, HER]);

    expect(balance).toEqual({ amount: 1000, creditorId: HER, debtorId: ME });
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run src/modules/dashboard/lib/wallet.test.ts src/modules/paybacks/lib/payback-balance.test.ts`
Expected: FAIL, because the modules `./wallet` and `./payback-balance` can't be found.

- [ ] **Step 3: Write the code**

Create `src/modules/dashboard/lib/wallet.ts`:

```ts
// Money that left each person's own wallet. Spending counts against whoever
// paid it, not who it was for: the two members keep separate money, and
// paying for each other is generosity, not debt. The exception is an expense
// ticked "to be paid back": that part counts against the other person, since
// they're the one who'll end up paying for it.
export type WalletExpense = { amount: number; paidByMemberId: string; payBackAmount: null | number };

export function walletSpentByMember(expenses: WalletExpense[], memberIds: string[]): Map<string, number> {
  const totals = new Map(memberIds.map((id) => [id, 0]));
  for (const expense of expenses) {
    const payer = expense.paidByMemberId;
    const other = memberIds.length === 2 ? memberIds.find((id) => id !== payer) : undefined;
    const repay = other && expense.payBackAmount ? Math.min(expense.payBackAmount, expense.amount) : 0;
    totals.set(payer, (totals.get(payer) ?? 0) + expense.amount - repay);
    if (other && repay > 0) totals.set(other, (totals.get(other) ?? 0) + repay);
  }
  return totals;
}
```

Create `src/modules/paybacks/lib/payback-balance.ts`:

```ts
export type PayBackExpense = { amount: number; paidByMemberId: string; payBackAmount: number };
export type Payback = { amount: number; fromMemberId: string; toMemberId: string };
export type PaybackBalance = { amount: number; creditorId: string; debtorId: string };

// One running balance between the two members, like a shop's credit book:
// expenses ticked "to be paid back" add to it, paybacks of any amount take it
// down, and amounts owed in both directions cancel out. null = square.
export function paybackBalance(expenses: PayBackExpense[], paybacks: Payback[], [a, b]: [string, string]): null | PaybackBalance {
  let aOwesB = 0;
  for (const expense of expenses) {
    const owed = Math.min(expense.payBackAmount, expense.amount);
    if (expense.paidByMemberId === b) aOwesB += owed;
    else if (expense.paidByMemberId === a) aOwesB -= owed;
  }
  for (const payback of paybacks) {
    if (payback.fromMemberId === a && payback.toMemberId === b) aOwesB -= payback.amount;
    else if (payback.fromMemberId === b && payback.toMemberId === a) aOwesB += payback.amount;
  }
  const rounded = Math.round(aOwesB * 100) / 100;
  if (rounded === 0) return null;
  return rounded > 0 ? { amount: rounded, creditorId: b, debtorId: a } : { amount: -rounded, creditorId: a, debtorId: b };
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run src/modules/dashboard/lib/wallet.test.ts src/modules/paybacks/lib/payback-balance.test.ts`
Expected: all 11 tests PASS.

- [ ] **Step 5: Lint and commit**

Run: `npm run lint -- --fix`, then `npm run lint`. Expected: 0 errors.

```bash
git add src/modules/dashboard/lib/wallet.ts src/modules/dashboard/lib/wallet.test.ts src/modules/paybacks/lib/payback-balance.ts src/modules/paybacks/lib/payback-balance.test.ts
git commit -m "feat(paybacks): wallet and pay-back balance maths"
```

---

### Task 2.3: The "pay back later" tick on expenses

**Files:**
- Modify (replace the whole file): `src/modules/expenses/schemas/expense.schema.ts`
- Modify: `src/modules/expenses/api/expenses.actions.ts`
- Modify: `src/modules/expenses/lib/expense-activity.ts`
- Modify: `src/modules/activity/lib/revert/entities.ts`
- Modify (replace the whole file): `src/modules/expenses/components/ExpenseDialog.tsx`
- Modify: `src/modules/expenses/components/ExpensesView.tsx`
- Modify: `src/modules/expenses/pages/ExpensesPage.tsx`

**Interfaces:**
- Consumes: the `expenses.payBackAmount` column (Task 2.1).
- Produces: `ExpenseInput.payBackAmount?: null | number`. **Omitted means "leave it as it is"** (on edits); `null` means nothing to pay back. Also `ExpenseDraft.payBackAmount?: null | number`, and `ExpenseRecord.payBackAmount: null | number`.

- [ ] **Step 1: Replace the expense schema**

Replace the whole of `src/modules/expenses/schemas/expense.schema.ts` with:

```ts
import { z } from "zod";

export const expenseSchema = z
  .object({
    amount: z.number().positive(),
    categoryId: z.string().uuid(),
    ownerMemberId: z.string().uuid().nullable(),
    paidByMemberId: z.string().uuid(),
    date: z.string(), // "YYYY-MM-DD"
    note: z.string().optional(),
    // The part of `amount` the other member will pay back ("pay back later").
    // Omitted = leave it as it is (edits); null = nothing to pay back.
    payBackAmount: z.number().positive().nullable().optional(),
  })
  .refine((expense) => expense.payBackAmount == null || expense.payBackAmount <= expense.amount, {
    message: "The amount to pay back can't be more than the expense",
    path: ["payBackAmount"],
  });

export type ExpenseInput = z.infer<typeof expenseSchema>;
```

- [ ] **Step 2: Record it in the activity log**

In `src/modules/expenses/lib/expense-activity.ts`, replace:

```ts
  ownerMemberId: null | string;
  paidByMemberId: string;
};
```

with:

```ts
  ownerMemberId: null | string;
  paidByMemberId: string;
  payBackAmount?: null | number | string;
};
```

and replace:

```ts
    { format: f.member, key: "paidByMemberId", label: "Paid by" },
```

with:

```ts
    { format: f.member, key: "paidByMemberId", label: "Paid by" },
    { format: f.money, key: "payBackAmount", label: "To be paid back" },
```

In `src/modules/activity/lib/revert/entities.ts`, inside the `expense:` entry, replace:

```ts
    editable: ["amount", "categoryId", "date", "note", "ownerMemberId", "paidByMemberId"],
```

with:

```ts
    editable: ["amount", "categoryId", "date", "note", "ownerMemberId", "paidByMemberId", "payBackAmount"],
```

- [ ] **Step 3: Save it when creating an expense**

In `src/modules/expenses/api/expenses.actions.ts`, add this helper directly after the `assertCategoryInHousehold` function (before `findExpenseInHousehold`):

```ts
// "Pay back later" moves part of an expense onto the other member, so it
// only makes sense in a two-person household.
async function assertCanPayBack(householdId: string, payBackAmount: null | number | undefined) {
  if (payBackAmount == null) return;
  const members = await getHouseholdMembers(householdId);
  if (members.length !== 2) {
    throw new ExpenseValidationError("Pay back later needs exactly two people in the household");
  }
}
```

In `createExpenseForHousehold`, replace:

```ts
  await assertMemberInHousehold(householdId, parsed.paidByMemberId);
  if (parsed.ownerMemberId) {
    await assertMemberInHousehold(householdId, parsed.ownerMemberId);
  }

  const [created] = await db
    .insert(expenses)
    .values({
      householdId,
      amount: String(parsed.amount),
      categoryId: parsed.categoryId,
      ownerMemberId: parsed.ownerMemberId,
      paidByMemberId: parsed.paidByMemberId,
      date: parsed.date,
      note: parsed.note,
    })
    .returning();
```

with:

```ts
  await assertMemberInHousehold(householdId, parsed.paidByMemberId);
  if (parsed.ownerMemberId) {
    await assertMemberInHousehold(householdId, parsed.ownerMemberId);
  }
  await assertCanPayBack(householdId, parsed.payBackAmount);

  const [created] = await db
    .insert(expenses)
    .values({
      householdId,
      amount: String(parsed.amount),
      categoryId: parsed.categoryId,
      ownerMemberId: parsed.ownerMemberId,
      paidByMemberId: parsed.paidByMemberId,
      date: parsed.date,
      note: parsed.note,
      payBackAmount: parsed.payBackAmount == null ? null : String(parsed.payBackAmount),
    })
    .returning();
```

- [ ] **Step 4: Keep it on edits unless the form changes it**

In `updateExpenseAction`, replace:

```ts
  const before = await findExpenseInHousehold(householdId, id);
  if (!before) return;

  const [updated] = await db
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
    .where(and(eq(expenses.id, id), eq(expenses.householdId, householdId)))
    .returning();

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "updated",
    after: updated,
    before,
    changes: expenseChanges(f, before, parsed),
```

with:

```ts
  const before = await findExpenseInHousehold(householdId, id);
  if (!before) return;

  // Omitted means "leave it as it is", so a caller that doesn't know about
  // pay back later can never clear it by accident.
  const payBackAmount =
    parsed.payBackAmount === undefined ? (before.payBackAmount === null ? null : Number(before.payBackAmount)) : parsed.payBackAmount;
  if (payBackAmount !== null && payBackAmount > parsed.amount) {
    throw new ExpenseValidationError("The amount to pay back can't be more than the expense");
  }
  await assertCanPayBack(householdId, payBackAmount);

  const [updated] = await db
    .update(expenses)
    .set({
      amount: String(parsed.amount),
      categoryId: parsed.categoryId,
      ownerMemberId: parsed.ownerMemberId,
      paidByMemberId: parsed.paidByMemberId,
      date: parsed.date,
      note: parsed.note ?? null,
      payBackAmount: payBackAmount === null ? null : String(payBackAmount),
      updatedAt: new Date(),
    })
    .where(and(eq(expenses.id, id), eq(expenses.householdId, householdId)))
    .returning();

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "updated",
    after: updated,
    before,
    changes: expenseChanges(f, before, { ...parsed, payBackAmount }),
```

Leave `createExpensesBulkAction` alone. Bulk rows never send `payBackAmount`, so the column stays `null`.

- [ ] **Step 5: Replace the expense dialog**

Replace the whole of `src/modules/expenses/components/ExpenseDialog.tsx` with:

```tsx
"use client";

import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { AmountInput } from "@/components/AmountInput";
import { CategoryComboboxField } from "@/components/CategoryComboboxField";
import { Modal } from "@/components/Modal";
import { NepaliDateField } from "@/components/NepaliDateField";
import { Segmented } from "@/components/Segmented";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/today";
import { cn } from "@/lib/utils";
import { createExpenseAction, updateExpenseAction } from "@/modules/expenses/api/expenses.actions";
import { type ExpenseInput, expenseSchema } from "@/modules/expenses/schemas/expense.schema";

type Member = { id: string; name: string };
type Category = { groupName: string; id: string; name: string };

export type ExpenseDraft = {
  amount: number;
  categoryId: string;
  date: string;
  note: null | string;
  ownerMemberId: null | string;
  paidByMemberId: string;
  payBackAmount?: null | number;
};

type Props = {
  categories: Category[];
  currentMemberId: string;
  // Edit mode when set; otherwise the dialog adds a new expense.
  expenseId?: string;
  initial?: ExpenseDraft;
  members: Member[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  // Most-used categories, offered as one-tap chips under the picker.
  quickCategoryIds?: string[];
};

const FORM_ID = "expense-form";
const SHARED = "shared";
const QUICK_CHIPS = 5;

// The Add / Edit expense dialog from the Expenses mockup. Its fields unmount
// with the dialog (Radix unmounts closed content), so every open starts from
// `initial` again; only the pending flag lives up here, for the footer button.
export function ExpenseDialog({ expenseId, onOpenChange, open, ...rest }: Props) {
  const [pending, setPending] = useState(false);
  const editing = Boolean(expenseId);

  return (
    <Modal
      className="sm:max-w-125"
      footer={
        <Button className="min-w-37.5 justify-start" disabled={pending} form={FORM_ID} type="submit">
          {pending ? "Saving..." : editing ? "Save changes" : "Add expense"}
        </Button>
      }
      hint="Enter to save · Esc to close"
      onOpenChange={onOpenChange}
      open={open}
      title={editing ? "Edit expense" : "Add expense"}
    >
      <ExpenseFields {...rest} expenseId={expenseId} onDone={() => onOpenChange(false)} onPendingChange={setPending} />
    </Modal>
  );
}

type FieldsProps = Omit<Props, "onOpenChange" | "open"> & { onDone: () => void; onPendingChange: (pending: boolean) => void };

function ExpenseFields({ categories, currentMemberId, expenseId, initial, members, onDone, onPendingChange, quickCategoryIds = [] }: FieldsProps) {
  const router = useRouter();
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [payBack, setPayBack] = useState(initial?.payBackAmount != null);
  const [payBackText, setPayBackText] = useState(initial?.payBackAmount != null ? String(initial.payBackAmount) : "");
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    setValue,
    watch,
  } = useForm<ExpenseInput>({
    defaultValues: {
      amount: initial?.amount,
      categoryId: initial?.categoryId ?? "",
      date: initial?.date ?? todayISO(),
      note: initial?.note ?? "",
      ownerMemberId: initial ? initial.ownerMemberId : currentMemberId,
      paidByMemberId: initial?.paidByMemberId ?? currentMemberId,
    },
    resolver: zodResolver(expenseSchema),
  });

  const ownerMemberId = watch("ownerMemberId");
  const paidByMemberId = watch("paidByMemberId");
  const categoryId = watch("categoryId");
  const label = (m: Member) => (m.id === currentMemberId ? "Me" : m.name);
  const people = [...members.filter((m) => m.id === currentMemberId), ...members.filter((m) => m.id !== currentMemberId)];

  // "Pay back later" needs exactly two people: the one who paid, and the
  // other one, who owes it.
  const payer = members.find((m) => m.id === paidByMemberId);
  const other = members.length === 2 ? (members.find((m) => m.id !== paidByMemberId) ?? null) : null;
  const payBackLabel = paidByMemberId === currentMemberId ? `${other?.name ?? "They"} will pay me back` : `I'll pay ${payer?.name ?? "them"} back`;

  const quick = (quickCategoryIds.length > 0 ? quickCategoryIds : categories.map((c) => c.id))
    .map((id) => categoryOptions.find((c) => c.id === id))
    .filter((c): c is Category => c !== undefined)
    .slice(0, QUICK_CHIPS);

  function chooseOwner(value: string) {
    setValue("ownerMemberId", value === SHARED ? null : value);
    // Someone's own expense is usually paid by them; Shared keeps whoever was picked.
    if (value !== SHARED) setValue("paidByMemberId", value);
  }

  const onSubmit = handleSubmit(async (values) => {
    let payBackAmount: null | number = null;
    if (other && payBack) {
      payBackAmount = payBackText.trim() === "" ? values.amount : Number(payBackText);
      if (!(payBackAmount > 0) || payBackAmount > values.amount) {
        toast.error("The amount to pay back must be above 0 and no more than the expense");
        return;
      }
    }
    onPendingChange(true);
    const payload = { ...values, note: values.note?.trim() || undefined, payBackAmount };
    try {
      if (expenseId) {
        await updateExpenseAction(expenseId, payload);
      } else {
        await createExpenseAction(payload);
      }
      onDone();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      onPendingChange(false);
    }
  });

  return (
    <form className="flex flex-col gap-5.5" id={FORM_ID} noValidate onSubmit={onSubmit}>
      <AmountInput
        data-autofocus
        error={errors.amount ? "Enter an amount to continue" : undefined}
        label="Amount"
        size="xl"
        {...register("amount", { setValueAs: (value) => (value === "" || value === undefined ? Number.NaN : Number(value)) })}
      />

      <div>
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <CategoryComboboxField
              categories={categoryOptions}
              error={errors.categoryId ? "Choose a category" : undefined}
              label="Category"
              onCategoriesChange={(category) =>
                setCategoryOptions((prev) => (prev.some((c) => c.id === category.id) ? prev : [...prev, category]))
              }
              onValueChange={field.onChange}
              placeholder="Start typing — Lunch, Groceries…"
              value={field.value}
            />
          )}
        />
        {quick.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {quick.map((category) => (
              <button
                className={cn(
                  "border px-2.25 py-0.75 text-xs",
                  category.id === categoryId ? "border-signal text-signal-ink" : "border-n-300 text-n-800 hover:border-ink",
                )}
                key={category.id}
                onClick={() => setValue("categoryId", category.id, { shouldValidate: Boolean(errors.categoryId) })}
                type="button"
              >
                {category.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Segmented
          label="For"
          onChange={chooseOwner}
          options={[...people.map((m) => ({ label: label(m), value: m.id })), { label: "Shared", value: SHARED }]}
          value={ownerMemberId ?? SHARED}
        />
        <Segmented
          label="Paid by"
          onChange={(value) => setValue("paidByMemberId", value)}
          options={people.map((m) => ({ label: label(m), value: m.id }))}
          value={paidByMemberId}
        />
      </div>

      {other && (
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm text-n-800">
            <input checked={payBack} onChange={(event) => setPayBack(event.target.checked)} type="checkbox" />
            {payBackLabel}
          </label>
          {payBack && (
            <AmountInput
              label="Amount to pay back"
              onChange={(event) => setPayBackText(event.target.value)}
              placeholder="Leave empty for the full amount"
              value={payBackText}
            />
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Controller
          control={control}
          name="date"
          render={({ field }) => <NepaliDateField error={errors.date?.message} label="Date" onChange={field.onChange} value={field.value} />}
        />
        <TextField id="note" label="Note" placeholder="Optional — e.g. tea with Ram" {...register("note")} />
      </div>
    </form>
  );
}
```

- [ ] **Step 6: Pass the amount through when editing from the Expenses page**

In `src/modules/expenses/components/ExpensesView.tsx`, replace:

```ts
export type ExpenseRecord = Omit<ExpenseItem, "categoryName"> & { recurringExpenseId: null | string };
```

with:

```ts
export type ExpenseRecord = Omit<ExpenseItem, "categoryName"> & { payBackAmount: null | number; recurringExpenseId: null | string };
```

and, in the `<ExpenseDialog` at the bottom, replace:

```tsx
                ownerMemberId: editing.ownerMemberId,
                paidByMemberId: editing.paidByMemberId,
              }
```

with:

```tsx
                ownerMemberId: editing.ownerMemberId,
                paidByMemberId: editing.paidByMemberId,
                payBackAmount: editing.payBackAmount,
              }
```

In `src/modules/expenses/pages/ExpensesPage.tsx`, replace:

```ts
    paidByMemberId: e.paidByMemberId,
    recurringExpenseId: e.recurringExpenseId,
  }));
```

with:

```ts
    paidByMemberId: e.paidByMemberId,
    payBackAmount: e.payBackAmount === null ? null : Number(e.payBackAmount),
    recurringExpenseId: e.recurringExpenseId,
  }));
```

- [ ] **Step 7: Check types, lint and tests**

Run: `npx tsc --noEmit`. Expected: no output.
- If it reports that `ExpenseRecord` is missing `payBackAmount` somewhere else, add `payBackAmount: null` to that object literal.
- If it reports a voice-entry draft type, the field is optional and needs nothing; read the error again.

Run: `npm run lint -- --fix`, then `npm run lint`. Expected: 0 errors.
Run: `npm test`. Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/modules/expenses/schemas/expense.schema.ts src/modules/expenses/api/expenses.actions.ts src/modules/expenses/lib/expense-activity.ts src/modules/activity/lib/revert/entities.ts src/modules/expenses/components/ExpenseDialog.tsx src/modules/expenses/components/ExpensesView.tsx src/modules/expenses/pages/ExpensesPage.tsx
git commit -m "feat(expenses): pay back later tick"
```

---

### Task 2.4: Paybacks: actions and dialog

**Files:**
- Create: `src/modules/paybacks/schemas/payback.schema.ts`
- Create: `src/modules/paybacks/lib/payback-activity.ts`
- Create: `src/modules/paybacks/lib/payback-activity.test.ts`
- Create: `src/modules/paybacks/api/paybacks.actions.ts`
- Create: `src/modules/paybacks/components/PaybackDialog.tsx`

**Interfaces:**
- Consumes: the `paybacks` table and `expenses.payBackAmount` (Task 2.1).
- Produces:
  - `listPaybacks(householdId: string)`, which returns payback rows, newest first.
  - `listPayBackExpenses(householdId: string)`, which returns `{ amount: string; paidByMemberId: string; payBackAmount: string | null }[]`.
  - `createPaybackAction(input: PaybackInput): Promise<void>` and `deletePaybackAction(id: string): Promise<void>`.
  - `PaybackDialog` with props `{ currentMemberId: string; defaults: null | { amount: number; fromMemberId: string }; members: { id: string; name: string }[]; onOpenChange: (open: boolean) => void; open: boolean }`.

- [ ] **Step 1: Write the failing test**

Create `src/modules/paybacks/lib/payback-activity.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { testFormatters } from "@/modules/activity/lib/test-formatters";

import { paybackSummary } from "./payback-activity";

const f = testFormatters();

describe("paybackSummary", () => {
  it("names who paid back whom, and how much", () => {
    expect(paybackSummary(f, { amount: "5000", fromMemberId: "m-1", toMemberId: "m-2" })).toBe("Asha paid back RS 5,000 to Ravi");
  });
});
```

Run: `npx vitest run src/modules/paybacks/lib/payback-activity.test.ts`
Expected: FAIL, because `./payback-activity` can't be found.

- [ ] **Step 2: Write the schema and the summary**

Create `src/modules/paybacks/schemas/payback.schema.ts`:

```ts
import { z } from "zod";

export const paybackSchema = z
  .object({
    amount: z.number().positive(),
    date: z.string(), // "YYYY-MM-DD"
    fromMemberId: z.string().uuid(),
    note: z.string().optional(),
    toMemberId: z.string().uuid(),
  })
  .refine((payback) => payback.fromMemberId !== payback.toMemberId, {
    message: "Choose two different people",
    path: ["toMemberId"],
  });

export type PaybackInput = z.infer<typeof paybackSchema>;
```

Create `src/modules/paybacks/lib/payback-activity.ts`:

```ts
import type { ActivityFormatters } from "@/modules/activity/lib/activity-values";

export type PaybackSnapshot = { amount: number | string; fromMemberId: string; toMemberId: string };

// "Asha paid back RS 5,000 to Ram"
export function paybackSummary(f: ActivityFormatters, payback: PaybackSnapshot): string {
  return `${f.member(payback.fromMemberId)} paid back ${f.money(payback.amount)} to ${f.member(payback.toMemberId)}`;
}
```

Run: `npx vitest run src/modules/paybacks/lib/payback-activity.test.ts`
Expected: PASS.

- [ ] **Step 3: Write the server actions**

Create `src/modules/paybacks/api/paybacks.actions.ts`:

```ts
"use server";

import { and, desc, eq, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { expenses, paybacks } from "@/db/schema";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { activityActor, loadActivityFormatters, logActivity } from "@/modules/activity/api/activity";
import { formatNPR } from "@/modules/dashboard/lib/format";
import { insertNotification } from "@/modules/notifications/api/notifications.actions";

import { paybackSummary } from "../lib/payback-activity";
import { type PaybackInput, paybackSchema } from "../schemas/payback.schema";

export async function listPaybacks(householdId: string) {
  return db
    .select()
    .from(paybacks)
    .where(eq(paybacks.householdId, householdId))
    .orderBy(desc(paybacks.date), desc(paybacks.createdAt));
}

// Every expense ever ticked "to be paid back": the running balance spans all
// months, like a shop's credit book.
export async function listPayBackExpenses(householdId: string) {
  return db
    .select({ amount: expenses.amount, paidByMemberId: expenses.paidByMemberId, payBackAmount: expenses.payBackAmount })
    .from(expenses)
    .where(and(eq(expenses.householdId, householdId), isNotNull(expenses.payBackAmount)));
}

export async function createPaybackAction(input: PaybackInput) {
  const member = await getCurrentMember();
  const { householdId, name: actorName } = member;
  const parsed = paybackSchema.parse(input);
  const members = await getHouseholdMembers(householdId);
  const from = members.find((m) => m.id === parsed.fromMemberId);
  const to = members.find((m) => m.id === parsed.toMemberId);
  if (!from || !to) throw new Error("Member does not belong to this household");

  const [created] = await db
    .insert(paybacks)
    .values({
      amount: String(parsed.amount),
      date: parsed.date,
      fromMemberId: parsed.fromMemberId,
      householdId,
      note: parsed.note?.trim() || null,
      toMemberId: parsed.toMemberId,
    })
    .returning();

  await insertNotification({
    body: `${actorName} recorded ${from.user.name} paying back ${formatNPR(parsed.amount)} to ${to.user.name}.`,
    category: "payment",
    dedupeKey: `payback:${created.id}`,
    householdId,
    severity: "success",
    title: "Payback recorded",
  });

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "created",
    after: created,
    entityId: created.id,
    entityType: "payback",
    summary: paybackSummary(f, created),
  });

  revalidatePath("/dashboard");
}

export async function deletePaybackAction(id: string) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const [before] = await db.select().from(paybacks).where(and(eq(paybacks.id, id), eq(paybacks.householdId, householdId)));
  if (!before) return;

  await db.delete(paybacks).where(and(eq(paybacks.id, id), eq(paybacks.householdId, householdId)));

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "deleted",
    before,
    entityId: id,
    entityType: "payback",
    summary: paybackSummary(f, before),
  });

  revalidatePath("/dashboard");
}
```

- [ ] **Step 4: Write the dialog**

Create `src/modules/paybacks/components/PaybackDialog.tsx`:

```tsx
"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AmountInput } from "@/components/AmountInput";
import { Modal } from "@/components/Modal";
import { MoreDetails } from "@/components/MoreDetails";
import { NepaliDateField } from "@/components/NepaliDateField";
import { Segmented } from "@/components/Segmented";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/today";
import { createPaybackAction } from "@/modules/paybacks/api/paybacks.actions";

type Member = { id: string; name: string };

export type PaybackDefaults = { amount: number; fromMemberId: string };

type Props = {
  currentMemberId: string;
  defaults: null | PaybackDefaults;
  members: Member[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

const FORM_ID = "payback-form";

export function PaybackDialog({ currentMemberId, defaults, members, onOpenChange, open }: Props) {
  const [pending, setPending] = useState(false);

  return (
    <Modal
      className="sm:max-w-105"
      footer={
        <Button className="min-w-30 justify-start" disabled={pending} form={FORM_ID} type="submit">
          {pending ? "Saving..." : "Record payback"}
        </Button>
      }
      hint="Enter to save · Esc to close"
      onOpenChange={onOpenChange}
      open={open}
      title="Record a payback"
    >
      {defaults && (
        <PaybackFields
          currentMemberId={currentMemberId}
          defaults={defaults}
          members={members}
          onDone={() => onOpenChange(false)}
          onPendingChange={setPending}
        />
      )}
    </Modal>
  );
}

type FieldsProps = {
  currentMemberId: string;
  defaults: PaybackDefaults;
  members: Member[];
  onDone: () => void;
  onPendingChange: (pending: boolean) => void;
};

function PaybackFields({ currentMemberId, defaults, members, onDone, onPendingChange }: FieldsProps) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(defaults.amount));
  const [fromMemberId, setFromMemberId] = useState(defaults.fromMemberId);
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>();
  const label = (m: Member) => (m.id === currentMemberId ? "Me" : m.name);
  const toMemberId = members.find((m) => m.id !== fromMemberId)?.id ?? "";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!(Number(amount) > 0)) {
      setError("Enter an amount");
      return;
    }
    onPendingChange(true);
    try {
      await createPaybackAction({ amount: Number(amount), date, fromMemberId, note: note.trim() || undefined, toMemberId });
      toast.success("Payback recorded");
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
      <AmountInput
        data-autofocus
        error={error}
        label="Amount paid back"
        onChange={(event) => {
          setAmount(event.target.value);
          setError(undefined);
        }}
        size="xl"
        value={amount}
      />
      <Segmented
        label="Who paid it back"
        onChange={setFromMemberId}
        options={members.map((m) => ({ label: label(m), value: m.id }))}
        value={fromMemberId}
      />
      <MoreDetails>
        <NepaliDateField label="Date" onChange={setDate} value={date} />
        <TextField label="Note" onChange={(event) => setNote(event.target.value)} placeholder="Optional" value={note} />
      </MoreDetails>
    </form>
  );
}
```

- [ ] **Step 5: Check types, lint and tests**

Run: `npx tsc --noEmit`. Expected: no output.
Run: `npm run lint -- --fix`, then `npm run lint`. Expected: 0 errors.
Run: `npm test`. Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/modules/paybacks
git commit -m "feat(paybacks): record and delete paybacks"
```

---

### Task 2.5: Home counts by who paid and shows the pay-back balance

**Files:**
- Modify (replace the whole file): `src/modules/dashboard/pages/DashboardPage.tsx`
- Modify: `src/modules/dashboard/components/HomeView.tsx`

**Interfaces:**
- Consumes:
  - `walletSpentByMember` and `paybackBalance` (Task 2.2).
  - `listPaybacks`, `listPayBackExpenses`, `deletePaybackAction` and `PaybackDialog` (Task 2.4).
  - `PaybackBalance` type from `@/modules/paybacks/lib/payback-balance`.
- Produces: new HomeView props `payback: null | PaybackBalance` and `recentPaybacks: HomePaybackRow[]`, where `HomePaybackRow = { amount: number; dateLabel: string; fromName: string; id: string; toName: string }`.

- [ ] **Step 1: Replace the Home page server component**

Replace the whole of `src/modules/dashboard/pages/DashboardPage.tsx` with:

```tsx
import { formatShortDate } from "@/lib/date-format";
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { buildMonthNav, parseMonthParam, previousMonth } from "@/lib/month-nav";
import {
  currentPeriodYearMonth,
  daysElapsedInPeriod,
  formatPeriodLabel,
  MAX_NAVIGABLE_YEAR,
  MIN_NAVIGABLE_YEAR,
  resolvePeriod,
} from "@/lib/month-period";
import { getEffectiveMember, getHouseholdMembers } from "@/lib/session";
import { todayISO } from "@/lib/today";
import { getBudgetItemsForMonth, getIncomesForMonth } from "@/modules/budget/api/budget.actions";
import { dashboardSummary } from "@/modules/budget/lib/calculations";
import { listCategories } from "@/modules/categories/api/categories";
import { type HomeGoal, type HomeOwnerRow, type HomePacing, type HomeRecentGroup, HomeView } from "@/modules/dashboard/components/HomeView";
import { allowanceSpentByDay, daysLeftInMonth } from "@/modules/dashboard/lib/cash-flow";
import { toExpenseInputs, toIncomeInputs } from "@/modules/dashboard/lib/map-rows";
import { buildPacingSchedule, currentWeekPacing } from "@/modules/dashboard/lib/pacing";
import { walletSpentByMember } from "@/modules/dashboard/lib/wallet";
import { listExpensesForMonth, listRecentExpenses } from "@/modules/expenses/api/expenses.actions";
import { groupByDay } from "@/modules/expenses/lib/expense-view";
import { checkBudgetReminder } from "@/modules/notifications/api/notifications.actions";
import { listPayBackExpenses, listPaybacks } from "@/modules/paybacks/api/paybacks.actions";
import { paybackBalance } from "@/modules/paybacks/lib/payback-balance";
import { listSavingsContributions, listSavingsGoals } from "@/modules/savings-goals/api/savings-goals.actions";
import { savedAmountForGoal, savingsOverviewStats } from "@/modules/savings-goals/lib/savings-stats";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const GOALS_SHOWN = 3;
const PAYBACKS_SHOWN = 3;

function trendPct(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function percent(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

function weekdayOf(startDate: string, dayOfPeriod: number): string {
  const [year, month, day] = startDate.split("-").map(Number);
  return WEEKDAYS[new Date(year, month - 1, day + dayOfPeriod - 1).getDay()];
}

type Props = { searchParams: Promise<{ month?: string; year?: string }> };

export async function DashboardPage({ searchParams }: Props) {
  const { householdId, memberId } = await getEffectiveMember();
  const dateFormat = await getDateFormatPref(householdId);
  const params = await searchParams;
  const { year: currentYear, month: currentMonth } = currentPeriodYearMonth(dateFormat);
  const year = parseMonthParam(params.year, currentYear, MAX_NAVIGABLE_YEAR[dateFormat], MIN_NAVIGABLE_YEAR[dateFormat]);
  const month = parseMonthParam(params.month, currentMonth, 12);
  const prev = previousMonth(year, month);
  const isCurrentMonth = year === currentYear && month === currentMonth;

  const [
    members,
    categories,
    incomeRows,
    budgetItemRows,
    expenseRows,
    prevIncomeRows,
    prevExpenseRows,
    recentExpenseRows,
    goalRows,
    contributionRows,
    paybackRows,
    payBackExpenseRows,
  ] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    getIncomesForMonth(year, month),
    getBudgetItemsForMonth(year, month),
    listExpensesForMonth(year, month, dateFormat),
    getIncomesForMonth(prev.year, prev.month),
    listExpensesForMonth(prev.year, prev.month, dateFormat),
    listRecentExpenses(5),
    listSavingsGoals(householdId),
    listSavingsContributions(householdId),
    listPaybacks(householdId),
    listPayBackExpenses(householdId),
  ]);

  if (isCurrentMonth) {
    await checkBudgetReminder(householdId, year, month, budgetItemRows.length);
  }

  const incomes = toIncomeInputs(incomeRows);
  const expenses = toExpenseInputs(expenseRows);
  const summary = dashboardSummary(incomes, expenses);

  const prevIncomes = toIncomeInputs(prevIncomeRows);
  const prevExpensesList = toExpenseInputs(prevExpenseRows);
  const prevSummary = dashboardSummary(prevIncomes, prevExpensesList);

  const category = (id: string) => categories.find((c) => c.id === id);
  const memberName = (id: string) => members.find((m) => m.id === id)?.user.name ?? "Member";

  // Each person's Spent is what left their own wallet: counted by who paid,
  // with any "to be paid back" part moved onto the other person. Shared
  // expenses get their own row, for information only.
  const wallet = walletSpentByMember(
    expenseRows.map((e) => ({
      amount: Number(e.amount),
      paidByMemberId: e.paidByMemberId,
      payBackAmount: e.payBackAmount === null ? null : Number(e.payBackAmount),
    })),
    members.map((m) => m.id),
  );
  const ownerSpent = (ownerId: null | string) =>
    ownerId === null ? expenses.filter((e) => e.ownerMemberId === null).reduce((s, e) => s + e.amount, 0) : (wallet.get(ownerId) ?? 0);
  const ownerIncome = (id: string) => incomes.find((i) => i.memberId === id)?.amount ?? 0;
  const prevOwnerIncome = (id: string) => prevIncomes.find((i) => i.memberId === id)?.amount ?? 0;

  const partner = members.find((m) => m.id !== memberId);
  const meMonogram = { name: memberName(memberId), role: "me" as const };
  const partnerMonogram = partner ? { name: partner.user.name, role: "partner" as const } : null;

  const meIncome = ownerIncome(memberId);
  const meSpent = ownerSpent(memberId);
  const meLeft = meIncome - meSpent;
  const partnerIncome = partner ? ownerIncome(partner.id) : 0;
  const partnerSpent = partner ? ownerSpent(partner.id) : 0;
  const partnerLeft = partnerIncome - partnerSpent;

  const owners: HomeOwnerRow[] = [
    {
      income: meIncome,
      incomeTrendPct: trendPct(meIncome, prevOwnerIncome(memberId)),
      incomeUsedPct: percent(meSpent, meIncome),
      incomeUsedRatio: meIncome > 0 ? meSpent / meIncome : meSpent > 0 ? Number.POSITIVE_INFINITY : 0,
      key: "me",
      label: "Me",
      left: meLeft,
      leftNote: meLeft < 0 ? "over income" : `${percent(meSpent, meIncome) ?? 0}% of income`,
      monogram: [meMonogram],
      spent: meSpent,
    },
    ...(partner
      ? [
          {
            income: partnerIncome,
            incomeTrendPct: trendPct(partnerIncome, prevOwnerIncome(partner.id)),
            incomeUsedPct: percent(partnerSpent, partnerIncome),
            incomeUsedRatio: partnerIncome > 0 ? partnerSpent / partnerIncome : partnerSpent > 0 ? Number.POSITIVE_INFINITY : 0,
            key: "partner" as const,
            label: partner.user.name,
            left: partnerLeft,
            leftNote: partnerLeft < 0 ? "over income" : `${percent(partnerSpent, partnerIncome) ?? 0}% of income`,
            monogram: partnerMonogram ? [partnerMonogram] : [],
            spent: partnerSpent,
          },
        ]
      : []),
    {
      income: null,
      incomeTrendPct: null,
      incomeUsedPct: null,
      incomeUsedRatio: null,
      key: "shared",
      label: "Spent on us",
      left: null,
      leftNote: null,
      monogram: partnerMonogram ? [meMonogram, partnerMonogram] : [meMonogram],
      spent: ownerSpent(null),
    },
  ];

  // Weekly pacing over the flexible part of the budget (fixed commitments are
  // already spoken for): the hero's safe-to-spend figure and its carry-over.
  // Fixed-category expenses don't count against it, for the same reason.
  const period = resolvePeriod(year, month, dateFormat);
  const flexiblePlanned = budgetItemRows
    .filter((b) => category(b.categoryId)?.budgetType === "flexible")
    .reduce((s, b) => s + Number(b.plannedAmount), 0);
  const pacingSchedule =
    flexiblePlanned > 0 ? buildPacingSchedule({ daysInPeriod: period.daysInPeriod, flexibleTotal: flexiblePlanned }) : null;
  const dayOfPeriod = isCurrentMonth ? daysElapsedInPeriod(period) : period.daysInPeriod;
  const fixedCategoryIds = new Set(categories.filter((c) => c.budgetType === "fixed").map((c) => c.id));
  const spentByDay = allowanceSpentByDay(expenseRows, fixedCategoryIds, year, month, dateFormat);
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
    ? paybackBalance(
        payBackExpenseRows.flatMap((e) =>
          e.payBackAmount === null
            ? []
            : [{ amount: Number(e.amount), paidByMemberId: e.paidByMemberId, payBackAmount: Number(e.payBackAmount) }],
        ),
        paybackRows.map((p) => ({ amount: Number(p.amount), fromMemberId: p.fromMemberId, toMemberId: p.toMemberId })),
        [memberId, partner.id],
      )
    : null;
  const recentPaybacks = paybackRows.slice(0, PAYBACKS_SHOWN).map((p) => ({
    amount: Number(p.amount),
    dateLabel: formatShortDate(p.date, dateFormat),
    fromName: memberName(p.fromMemberId),
    id: p.id,
    toName: memberName(p.toMemberId),
  }));

  const savingsStats = savingsOverviewStats(
    goalRows.map((g) => ({
      createdAt: g.createdAt,
      id: g.id,
      targetAmount: g.targetAmount === null ? null : Number(g.targetAmount),
      targetDate: g.targetDate,
    })),
    contributionRows.map((c) => ({ amount: Number(c.amount), date: c.date, goalId: c.goalId })),
    year,
    month,
  );

  const contributions = contributionRows.map((c) => ({ amount: Number(c.amount), date: c.date, goalId: c.goalId }));
  const goals: HomeGoal[] = goalRows.slice(0, GOALS_SHOWN).map((g) => {
    const targetAmount = g.targetAmount === null ? null : Number(g.targetAmount);
    const saved = savedAmountForGoal(g.id, contributions);
    return {
      id: g.id,
      name: g.name,
      pct: targetAmount !== null && targetAmount > 0 ? Math.round((saved / targetAmount) * 100) : null,
      saved,
      targetAmount,
    };
  });

  const savingsBudgetAmount = budgetItemRows
    .filter((b) => category(b.categoryId)?.name === "Savings")
    .reduce((s, b) => s + Number(b.plannedAmount), 0);

  const categoryName = (id: string) => category(id)?.name ?? "Unknown";
  const recent: HomeRecentGroup[] = groupByDay(
    recentExpenseRows.map((e) => ({
      amount: Number(e.amount),
      categoryId: e.categoryId,
      categoryName: categoryName(e.categoryId),
      date: e.date,
      id: e.id,
      note: e.note,
      ownerMemberId: e.ownerMemberId,
      paidByMemberId: e.paidByMemberId,
    })),
    { dateFormat, today: todayISO() },
  ).map((group) => ({
    key: group.date,
    label: group.label,
    rows: group.rows.map((row) => ({
      amount: row.amount,
      categoryGroupName: category(row.categoryId)?.groupName ?? "",
      categoryIcon: category(row.categoryId)?.icon ?? null,
      categoryName: row.categoryName,
      id: row.id,
      note: row.note,
    })),
    sub: group.sub,
    total: group.total,
  }));

  const monthLabel = formatPeriodLabel(year, month, dateFormat);
  const saved = savingsStats.monthlyContribution;

  return (
    <HomeView
      currentMemberId={memberId}
      daysLeft={daysLeftInMonth(year, month, dateFormat)}
      goals={goals}
      incomes={Object.fromEntries(incomes.map((i) => [i.memberId, i.amount]))}
      ledger={{
        income: summary.combinedIncome,
        incomeTrendPct: trendPct(summary.combinedIncome, prevSummary.combinedIncome),
        saved,
        savedNote: saved === 0 ? "Nothing set aside yet" : "Saved this month",
        spent: summary.totalExpenses,
        spentMeterRatio: summary.combinedIncome > 0 ? summary.totalExpenses / summary.combinedIncome : 0,
        spentPctOfIncome: percent(summary.totalExpenses, summary.combinedIncome),
        spentTrendPct: trendPct(summary.totalExpenses, prevSummary.totalExpenses),
        unallocated: summary.unallocated,
      }}
      members={members.map((m) => ({ id: m.id, name: m.user.name }))}
      month={month}
      monthNav={buildMonthNav({ basePath: "/dashboard", current: { month: currentMonth, year: currentYear }, dateFormat, selected: { month, year } })}
      owners={owners}
      pacing={pacing}
      payback={payback}
      prevMonthName={formatPeriodLabel(prev.year, prev.month, dateFormat).split(" ")[0]}
      recent={recent}
      recentPaybacks={recentPaybacks}
      savingsBudgetAmount={savingsBudgetAmount > 0 ? savingsBudgetAmount : null}
      spentMonthName={monthLabel.split(" ")[0]}
      year={year}
    />
  );
}
```

- [ ] **Step 2: Add the pay-back section to the Home view**

In `src/modules/dashboard/components/HomeView.tsx`, make these edits.

**(a)** Imports. Replace:

```tsx
import { ArrowUpRight, ChevronDown, Plus } from "lucide-react";
import Link from "next/link";
```

with:

```tsx
import { ArrowUpRight, ChevronDown, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
```

and replace:

```tsx
import { CategoryIcon } from "@/modules/categories/components/CategoryIcon";
```

with:

```tsx
import { CategoryIcon } from "@/modules/categories/components/CategoryIcon";
import { deletePaybackAction } from "@/modules/paybacks/api/paybacks.actions";
import { PaybackDialog } from "@/modules/paybacks/components/PaybackDialog";
import type { PaybackBalance } from "@/modules/paybacks/lib/payback-balance";
```

**(b)** Types. Replace:

```tsx
type Props = {
  currentMemberId: string;
```

with:

```tsx
export type HomePaybackRow = { amount: number; dateLabel: string; fromName: string; id: string; toName: string };

type Props = {
  currentMemberId: string;
```

Then, inside `Props`, replace:

```tsx
  pacing: HomePacing | null;
  prevMonthName: string;
  recent: HomeRecentGroup[];
```

with:

```tsx
  pacing: HomePacing | null;
  payback: null | PaybackBalance;
  prevMonthName: string;
  recent: HomeRecentGroup[];
  recentPaybacks: HomePaybackRow[];
```

**(c)** State and the delete handler. Replace:

```tsx
  const [incomeOpen, setIncomeOpen] = useState(false);
```

with:

```tsx
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [paybackOpen, setPaybackOpen] = useState(false);
  const router = useRouter();
  const nameOf = (id: string) => props.members.find((m) => m.id === id)?.name ?? "Partner";

  async function removePayback(id: string) {
    try {
      await deletePaybackAction(id);
      toast.success("Payback deleted");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }
```

**(d)** The section under the ledger. Replace:

```tsx
      </Ledger>

      <section className="mt-13">
        <div className="mb-3.5 flex items-baseline justify-between gap-4">
          <h2 className="text-xl leading-tight font-extrabold tracking-[-0.01em]">By person</h2>
          <span className="text-[13px] text-n-600">Shared costs are paid from both incomes</span>
        </div>
```

with:

```tsx
      </Ledger>

      {props.members.length === 2 && (props.payback !== null || props.recentPaybacks.length > 0) && (
        <section className="mt-9 border-t border-n-300 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[15px]">
              {props.payback === null ? (
                "You're square. Nobody owes anything."
              ) : props.payback.debtorId === props.currentMemberId ? (
                <>
                  You owe {nameOf(props.payback.creditorId)} <strong className="font-semibold">{formatMoney(props.payback.amount)}</strong>
                </>
              ) : (
                <>
                  {nameOf(props.payback.debtorId)} owes you <strong className="font-semibold">{formatMoney(props.payback.amount)}</strong>
                </>
              )}
            </p>
            {props.payback !== null && (
              <Button className="h-9.5" onClick={() => setPaybackOpen(true)} type="button" variant="outline">
                Record a payback
              </Button>
            )}
          </div>
          {props.recentPaybacks.length > 0 && (
            <div className="mt-3 flex flex-col">
              {props.recentPaybacks.map((row) => (
                <div
                  className="grid grid-cols-[90px_minmax(0,1fr)_auto_auto] items-center gap-4 border-b border-n-200 py-1.5 last:border-0"
                  key={row.id}
                >
                  <span className="text-[13px] text-n-600">{row.dateLabel}</span>
                  <span className="truncate text-sm">
                    {row.fromName} paid back {row.toName}
                  </span>
                  <span className="text-sm font-semibold">
                    <Money value={row.amount} />
                  </span>
                  <Button
                    className="h-auto px-1.5 py-0.5 text-[13px]"
                    onClick={() => void removePayback(row.id)}
                    type="button"
                    variant="ghost"
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="mt-13">
        <div className="mb-3.5 flex items-baseline justify-between gap-4">
          <h2 className="text-xl leading-tight font-extrabold tracking-[-0.01em]">By person</h2>
          <span className="text-[13px] text-n-600">Spent is what came out of each person&apos;s own money</span>
        </div>
```

**(e)** The Shared row's last column. Replace:

```tsx
                  <span className="text-[13px] text-n-600">Split between both</span>
```

with:

```tsx
                  <span className="text-[13px] text-n-600">Already counted under whoever paid</span>
```

**(f)** The dialog. Replace:

```tsx
        open={incomeOpen}
        year={props.year}
      />
    </div>
  );
}
```

with:

```tsx
        open={incomeOpen}
        year={props.year}
      />

      <PaybackDialog
        currentMemberId={props.currentMemberId}
        defaults={props.payback ? { amount: props.payback.amount, fromMemberId: props.payback.debtorId } : null}
        members={props.members}
        onOpenChange={setPaybackOpen}
        open={paybackOpen}
      />
    </div>
  );
}
```

- [ ] **Step 3: Check types, lint and tests**

Run: `npx tsc --noEmit`. Expected: no output.
Run: `npm run lint -- --fix`, then `npm run lint`. Expected: 0 errors.
Run: `npm test`. Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/modules/dashboard/pages/DashboardPage.tsx src/modules/dashboard/components/HomeView.tsx
git commit -m "feat(home): count by who paid and show the pay-back balance"
```

---

### Phase 2 checkpoint: STOP

- [ ] **Step 1: Run the full checks**

Run, in order:
1. `npm test`. Expected: all pass.
2. `npm run lint`. Expected: 0 errors.
3. `npx tsc --noEmit`. Expected: no output.

- [ ] **Step 2: Run the e2e suite (optional)**

Run: `npm run test:e2e`.
- It applies all migrations to the e2e database by itself.
- If it fails with a database or connection error, note it in the report and don't try to fix it.
- Any other failure is a real bug: fix it before stopping.

- [ ] **Step 3: Report to the owner, then STOP**

Tell the owner, in plain language:
- **What changed:** the commits made, one line each.
- **Test results:** unit test totals, and whether e2e ran.
- **Migration:**
  - Name the new migration file (from `git log --stat -1 -- drizzle`, or `git show --stat` on the Task 2.1 commit).
  - The owner should back up the database, then run `npm run db:migrate` themselves.
- **What to try in the app:**
  - Add an expense paid by your partner, tick "I'll pay … back", and check Home shows "You owe … Rs X".
  - Record a payback and check the balance drops.
  - Check your Spent on Home now includes dates and gifts you paid for.
  - Check the third row now reads "Spent on us".

Then **wait for the owner to say go on** before starting Phase 3.

---

## Phase 3: Dhuku

**What this phase delivers:**
- A **fine** entry type.
- A **"taken from each pot"** field.
- The **expected pot** for this meeting.
- A **real cost so far** line on the Dhuku page.

Design rules 8–11 apply. Months are counted the same way everywhere: **a month counts once its contribution is logged; a payout or a fine never counts as a month.** The Dhuku page already works this way; the notification helpers in `dhuku-stats.ts` didn't, and are fixed here.

**Database change:** a new `fine` value on `dhuku_entry_type`, and a new `dhukus.pot_deduction` column.

### Task 3.1: Schema for fines and the pot deduction

**Files:**
- Modify: `src/db/schema/dhukus.ts`
- Create (generated): the next `drizzle/00NN_*.sql` and snapshot

**Interfaces:**
- Produces: the `"fine"` member of the `dhukuEntryTypeEnum`, and a `dhukus.potDeduction` column (`numeric`, nullable; Drizzle returns `string | null`).

- [ ] **Step 1: Edit the schema**

In `src/db/schema/dhukus.ts`, replace:

```ts
export const dhukuEntryTypeEnum = pgEnum("dhuku_entry_type", ["contribution", "payout"]);
```

with:

```ts
export const dhukuEntryTypeEnum = pgEnum("dhuku_entry_type", ["contribution", "payout", "fine"]);
```

and replace:

```ts
  interestPerMonth: numeric("interest_per_month", { precision: 12, scale: 2 }),
```

with:

```ts
  interestPerMonth: numeric("interest_per_month", { precision: 12, scale: 2 }),
  // Taken out of every pot before it's paid out, e.g. the meeting's food.
  // null = nothing is taken out.
  potDeduction: numeric("pot_deduction", { precision: 12, scale: 2 }),
```

- [ ] **Step 2: Generate the migration**

Run: `npm run db:generate`
Expected: one new SQL file, and **no** question asked. If it asks one, stop and report.

Open the new `.sql` file. It must contain both of these, and must **not** contain `DROP`:
- `ALTER TYPE "public"."dhuku_entry_type" ADD VALUE 'fine'`
- `ALTER TABLE "dhukus" ADD COLUMN "pot_deduction" numeric(12, 2)`

- [ ] **Step 3: Check types**

Run: `npx tsc --noEmit`.
Expected: errors may appear in dhuku files, because the entry `type` now includes `"fine"`. **Don't fix them yet.** Tasks 3.2–3.4 handle them. Write down the file names it reports.

- [ ] **Step 4: Commit**

The commit runs the pre-commit hook, which fails if `tsc` fails. So if Step 3 showed errors, **don't commit yet**: do Task 3.2 first and commit both together at the end of Task 3.2. If Step 3 showed no errors:

```bash
git add src/db/schema/dhukus.ts drizzle
git commit -m "feat(db): dhuku fines and pot deduction"
```

---

### Task 3.2: Dhuku maths

**Files:**
- Modify: `src/modules/dhuku/lib/dhuku-stats.ts`
- Modify: `src/modules/dhuku/lib/dhuku-stats.test.ts`
- Modify: `src/modules/dhuku/lib/dhuku-view.ts`
- Modify: `src/modules/dhuku/lib/dhuku-view.test.ts`
- Create: `src/modules/dhuku/lib/dhuku-money.ts`
- Create: `src/modules/dhuku/lib/dhuku-money.test.ts`

**Interfaces:**
- Produces:
  - `monthsLogged(entries)` now counts **contributions only**.
  - `DhukuEntryType = "contribution" | "fine" | "payout"`.
  - `DhukuProgress` gains `fines: number`.
  - New `dhuku-money.ts` with these exports:
    - `type DhukuTerms = { monthlyContribution: number; potDeduction: null | number; totalMembers: number }`
    - `type DhukuMoneyEntry = { amount: number; type: "contribution" | "fine" | "payout" }`
    - `basePot(terms): number`
    - `expectedPot(terms, interestPerMonth: null | number, meetingNumber: number): number`
    - `type DhukuRealCost = { finesPaid: number; foodShare: number; interestPaid: number; received: number; total: number }`
    - `dhukuRealCost(terms, entries: DhukuMoneyEntry[]): DhukuRealCost`
    - `dhukuPosition(terms, entries: DhukuMoneyEntry[]): number` (used in Phase 5)

- [ ] **Step 1: Update the existing tests to the new month rule**

In `src/modules/dhuku/lib/dhuku-stats.test.ts`, replace:

```ts
  it("counts every entry regardless of type", () => {
    expect(monthsLogged([entry(), entry({ type: "payout" }), entry()])).toBe(3);
  });
```

with:

```ts
  it("counts contributions only: a payout or a fine is never a month", () => {
    expect(monthsLogged([entry(), entry({ type: "payout" }), entry({ type: "fine" }), entry()])).toBe(2);
  });
```

In the same file, in `it("shapes rows into cards, filling in owner name and derived fields"`, replace:

```ts
    expect(card.monthsLogged).toBe(2);
```

with:

```ts
    expect(card.monthsLogged).toBe(1);
```

and replace:

```ts
    expect(card.nextDueDate).toBe("2026-03-15");
```

with:

```ts
    expect(card.nextDueDate).toBe("2026-02-15");
```

In `it("sets nextDueDate to null once the cycle is completed"`, replace:

```ts
    const entryRows: EntryRow[] = [
      { amount: "1000", date: "2026-01-15", dhukuId: "d1", id: "e1", note: null, type: "contribution" },
      { amount: "2000", date: "2026-02-15", dhukuId: "d1", id: "e2", note: null, type: "payout" },
    ];

    const [card] = buildDhukuCards(dhukuRows, entryRows, new Map());
```

with:

```ts
    const entryRows: EntryRow[] = [
      { amount: "1000", date: "2026-01-15", dhukuId: "d1", id: "e1", note: null, type: "contribution" },
      { amount: "1000", date: "2026-02-15", dhukuId: "d1", id: "e2", note: null, type: "contribution" },
      { amount: "2000", date: "2026-02-15", dhukuId: "d1", id: "e3", note: null, type: "payout" },
    ];

    const [card] = buildDhukuCards(dhukuRows, entryRows, new Map());
```

In `src/modules/dhuku/lib/dhuku-view.test.ts`, replace:

```ts
    expect(progress).toEqual({ contributed: 9000, paidCount: 3, payoutAt: 2, received: 36000 });
  });
```

with:

```ts
    expect(progress).toEqual({ contributed: 9000, fines: 0, paidCount: 3, payoutAt: 2, received: 36000 });
  });

  it("keeps fines out of the months paid and adds them up on their own", () => {
    const progress = dhukuProgress([
      { amount: 3000, date: "2026-01-01", id: "a", note: null, type: "contribution" },
      { amount: 100, date: "2026-01-01", id: "b", note: null, type: "fine" },
    ]);

    expect(progress).toEqual({ contributed: 3000, fines: 100, paidCount: 1, payoutAt: null, received: 0 });
  });
```

- [ ] **Step 2: Write the new money tests**

Create `src/modules/dhuku/lib/dhuku-money.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { basePot, dhukuPosition, dhukuRealCost, expectedPot } from "./dhuku-money";

// The owner's real dhuku: 12 members, Rs 3,000 a month, Rs 3,000 taken out of
// every pot for the meeting's food, Rs 300 interest a month after taking it.
const TERMS = { monthlyContribution: 3000, potDeduction: 3000, totalMembers: 12 };
const INTEREST = 300;

const contributions = (count: number, amount: number) => Array.from({ length: count }, () => ({ amount, type: "contribution" as const }));

// Taking the pot at meeting 5: four meetings before, the payout meeting, then
// seven more paying the extra Rs 300.
const FULL_YEAR_TAKING_AT_5 = [
  ...contributions(5, 3000),
  { amount: 34200, type: "payout" as const },
  ...contributions(7, 3300),
];

describe("basePot", () => {
  it("is everyone's contribution less what's taken out of each pot", () => {
    expect(basePot(TERMS)).toBe(33000);
  });

  it("is the full amount when nothing is taken out", () => {
    expect(basePot({ ...TERMS, potDeduction: null })).toBe(36000);
  });
});

describe("expectedPot", () => {
  it("adds Rs 300 for every member who took the pot before this meeting", () => {
    expect(expectedPot(TERMS, INTEREST, 1)).toBe(33000);
    expect(expectedPot(TERMS, INTEREST, 5)).toBe(34200);
    expect(expectedPot(TERMS, INTEREST, 12)).toBe(36300);
  });

  it("treats no interest as zero", () => {
    expect(expectedPot(TERMS, null, 12)).toBe(33000);
  });
});

describe("dhukuRealCost", () => {
  it("is the food share plus interest paid, less the interest received in the pot", () => {
    expect(dhukuRealCost(TERMS, FULL_YEAR_TAKING_AT_5)).toEqual({
      finesPaid: 0,
      foodShare: 3000,
      interestPaid: 2100,
      received: 1200,
      total: 3900,
    });
  });

  it("adds fines on top", () => {
    const cost = dhukuRealCost(TERMS, [...FULL_YEAR_TAKING_AT_5, { amount: 100, type: "fine" }]);

    expect(cost.finesPaid).toBe(100);
    expect(cost.total).toBe(4000);
  });

  it("can come out ahead when you take the pot last", () => {
    const cost = dhukuRealCost(TERMS, [...contributions(12, 3000), { amount: 36300, type: "payout" }]);

    expect(cost.total).toBe(-300);
  });
});

describe("dhukuPosition", () => {
  it("grows with each contribution before the payout", () => {
    expect(dhukuPosition(TERMS, contributions(4, 3000))).toBe(11000);
  });

  it("flips to what you owe the group once you take the pot", () => {
    expect(dhukuPosition(TERMS, [...contributions(5, 3000), { amount: 34200, type: "payout" }])).toBe(-19250);
  });

  it("is back to zero at the end of the cycle", () => {
    expect(dhukuPosition(TERMS, FULL_YEAR_TAKING_AT_5)).toBe(0);
  });
});
```

- [ ] **Step 3: Run the tests and watch them fail**

Run: `npx vitest run src/modules/dhuku/lib`
Expected:
- `dhuku-money.test.ts` fails because `./dhuku-money` can't be found.
- The edited `monthsLogged`, `buildDhukuCards` and `dhukuProgress` tests fail.

- [ ] **Step 4: Write the code**

In `src/modules/dhuku/lib/dhuku-stats.ts`, replace:

```ts
export type DhukuEntryType = "contribution" | "payout";
```

with:

```ts
export type DhukuEntryType = "contribution" | "fine" | "payout";
```

and replace:

```ts
export function monthsLogged(entries: Pick<EntryRow, "type">[]): number {
  return entries.length;
}
```

with:

```ts
// A month counts once its contribution is logged. Payouts and fines never add
// a month, the same as the Dhuku page counts them.
export function monthsLogged(entries: Pick<EntryRow, "type">[]): number {
  return entries.filter((e) => e.type === "contribution").length;
}
```

In `src/modules/dhuku/lib/dhuku-view.ts`, replace:

```ts
export type DhukuEntryLite = {
  amount: number;
  date: string;
  id: string;
  note: null | string;
  type: "contribution" | "payout";
};

export type DhukuProgress = {
  contributed: number;
  paidCount: number;
  payoutAt: null | number;
  received: number;
};

// A payout doesn't count as a month paid; it marks the month it was taken in.
export function dhukuProgress(entries: DhukuEntryLite[]): DhukuProgress {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  let paidCount = 0;
  let contributed = 0;
  let received = 0;
  let payoutAt: null | number = null;

  for (const entry of sorted) {
    if (entry.type === "payout") {
      received += entry.amount;
      if (payoutAt === null) payoutAt = paidCount;
    } else {
      paidCount += 1;
      contributed += entry.amount;
    }
  }

  return { contributed, paidCount, payoutAt, received };
}
```

with:

```ts
export type DhukuEntryLite = {
  amount: number;
  date: string;
  id: string;
  note: null | string;
  type: "contribution" | "fine" | "payout";
};

export type DhukuProgress = {
  contributed: number;
  fines: number;
  paidCount: number;
  payoutAt: null | number;
  received: number;
};

// A payout doesn't count as a month paid; it marks the month it was taken in.
// A fine isn't a month either; it's added up on its own.
export function dhukuProgress(entries: DhukuEntryLite[]): DhukuProgress {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  let paidCount = 0;
  let contributed = 0;
  let fines = 0;
  let received = 0;
  let payoutAt: null | number = null;

  for (const entry of sorted) {
    if (entry.type === "fine") {
      fines += entry.amount;
    } else if (entry.type === "payout") {
      received += entry.amount;
      if (payoutAt === null) payoutAt = paidCount;
    } else {
      paidCount += 1;
      contributed += entry.amount;
    }
  }

  return { contributed, fines, paidCount, payoutAt, received };
}
```

Create `src/modules/dhuku/lib/dhuku-money.ts`:

```ts
// What a dhuku really costs you, kept apart from the money that only moves
// between you and the group (your own savings going in, and coming back as the
// pot, or an advance you then repay).

export type DhukuTerms = { monthlyContribution: number; potDeduction: null | number; totalMembers: number };
export type DhukuMoneyEntry = { amount: number; type: "contribution" | "fine" | "payout" };

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

// The pot before any interest: everyone's contribution, less what's taken out
// of every pot (for example the meeting's food).
export function basePot({ monthlyContribution, potDeduction, totalMembers }: DhukuTerms): number {
  return monthlyContribution * totalMembers - (potDeduction ?? 0);
}

// The pot at a given meeting (1-based): the base pot plus the interest every
// member who already took theirs pays on top, one taker per meeting. Fines
// collected at that meeting come on top and aren't known in advance.
export function expectedPot(terms: DhukuTerms, interestPerMonth: null | number, meetingNumber: number): number {
  return basePot(terms) + (interestPerMonth ?? 0) * Math.max(0, meetingNumber - 1);
}

export type DhukuRealCost = { finesPaid: number; foodShare: number; interestPaid: number; received: number; total: number };

// The real cost so far: your share of what's taken out of each pot, the
// interest you paid after taking the pot, and fines, less the interest, fines
// and leftover that came to you inside your pot. Everything else is your own
// money moving in and out, so it isn't a cost.
export function dhukuRealCost(terms: DhukuTerms, entries: DhukuMoneyEntry[]): DhukuRealCost {
  const contributions = entries.filter((e) => e.type === "contribution");
  const contributed = contributions.reduce((sum, e) => sum + e.amount, 0);
  const finesPaid = entries.filter((e) => e.type === "fine").reduce((sum, e) => sum + e.amount, 0);
  const payout = entries.filter((e) => e.type === "payout").reduce((sum, e) => sum + e.amount, 0);
  const foodShare = ((terms.potDeduction ?? 0) / terms.totalMembers) * contributions.length;
  const interestPaid = Math.max(0, contributed - contributions.length * terms.monthlyContribution);
  const received = payout > 0 ? Math.max(0, payout - basePot(terms)) : 0;
  return {
    finesPaid: round(finesPaid),
    foodShare: round(foodShare),
    interestPaid: round(interestPaid),
    received: round(received),
    total: round(foodShare + interestPaid + finesPaid - received),
  };
}

// Where you stand with the group: positive = the group owes you, negative =
// you owe the group. Each contribution puts your own money in (less your food
// share); taking the pot takes the base pot out.
export function dhukuPosition(terms: DhukuTerms, entries: DhukuMoneyEntry[]): number {
  const contributions = entries.filter((e) => e.type === "contribution").length;
  const perContribution = terms.monthlyContribution - (terms.potDeduction ?? 0) / terms.totalMembers;
  const tookPot = entries.some((e) => e.type === "payout");
  return round(contributions * perContribution - (tookPot ? basePot(terms) : 0));
}
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npx vitest run src/modules/dhuku/lib`
Expected: every dhuku test passes, including the 10 new `dhuku-money` tests.

- [ ] **Step 6: Check types**

Run: `npx tsc --noEmit`
Expected: remaining errors (if any) are only in `dhuku.schema.ts`, `dhuku.actions.ts`, `dhuku-activity.ts`, `DhukuView.tsx`, `DhukuPage.tsx` or `LogEntryDialog.tsx`. Task 3.3 and Task 3.4 fix those.

- [ ] **Step 7: Commit (or keep going)**

If `npx tsc --noEmit` shows no errors, commit:

```bash
git add src/db/schema/dhukus.ts drizzle src/modules/dhuku/lib
git commit -m "feat(dhuku): fines, pot deduction and real-cost maths"
```

If it still shows errors, don't commit yet. Continue with Task 3.3 and commit everything at the end of Task 3.4.

---

### Task 3.3: Save fines and the pot deduction

**Files:**
- Modify (replace the whole file): `src/modules/dhuku/schemas/dhuku.schema.ts`
- Modify: `src/modules/dhuku/api/dhuku.actions.ts`
- Modify: `src/modules/dhuku/lib/dhuku-activity.ts`
- Modify: `src/modules/dhuku/lib/dhuku-activity.test.ts`
- Modify: `src/modules/activity/lib/revert/entities.ts`

**Interfaces:**
- Produces: `DhukuInput.potDeduction: null | number`, and `DhukuEntryInput.type: "contribution" | "fine" | "payout"`.

- [ ] **Step 1: Write the failing test**

In `src/modules/dhuku/lib/dhuku-activity.test.ts`, replace:

```ts
    expect([type.format("payout"), type.format("contribution")]).toEqual(["Payout", "Contribution"]);
  });
```

with:

```ts
    expect([type.format("payout"), type.format("contribution")]).toEqual(["Payout", "Contribution"]);
  });

  it("labels a fine", () => {
    const type = dhukuEntryFields(f).find((s) => s.key === "type")!;
    expect(type.format("fine")).toBe("Fine");
    expect(dhukuEntrySummary(f, { amount: 100, type: "fine" }, "Office dhuku")).toBe("Fine · RS 100 · Office dhuku");
  });
```

Run: `npx vitest run src/modules/dhuku/lib/dhuku-activity.test.ts`
Expected: the new test FAILs.

- [ ] **Step 2: Replace the dhuku schema**

Replace the whole of `src/modules/dhuku/schemas/dhuku.schema.ts` with:

```ts
// src/modules/dhuku/schemas/dhuku.schema.ts
import { z } from "zod";

export const dhukuSchema = z.object({
  interestPerMonth: z.number().positive().nullable(),
  monthlyContribution: z.number().positive(),
  name: z.string().min(1),
  note: z.string().optional(),
  ownerMemberId: z.string().uuid().nullable(),
  // Taken out of every pot (e.g. the meeting's food); null = nothing.
  potDeduction: z.number().positive().nullable(),
  startDate: z.string(), // "YYYY-MM-DD"
  totalMembers: z.number().int().min(2),
});

export type DhukuInput = z.infer<typeof dhukuSchema>;

export const dhukuEntrySchema = z.object({
  amount: z.number().positive(),
  date: z.string(), // "YYYY-MM-DD"
  note: z.string().optional(),
  type: z.enum(["contribution", "payout", "fine"]),
});

export type DhukuEntryInput = z.infer<typeof dhukuEntrySchema>;
```

- [ ] **Step 3: Save the new field and name fines in notifications**

In `src/modules/dhuku/api/dhuku.actions.ts`:

**(a)** In `createDhukuAction`, replace:

```ts
    ownerMemberId: parsed.ownerMemberId,
    startDate: parsed.startDate,
    totalMembers: parsed.totalMembers,
  }).returning();
```

with:

```ts
    ownerMemberId: parsed.ownerMemberId,
    potDeduction: parsed.potDeduction === null ? null : String(parsed.potDeduction),
    startDate: parsed.startDate,
    totalMembers: parsed.totalMembers,
  }).returning();
```

**(b)** In `updateDhukuAction`, replace:

```ts
      ownerMemberId: parsed.ownerMemberId,
      startDate: parsed.startDate,
      totalMembers: parsed.totalMembers,
    })
    .where(and(eq(dhukus.id, id), eq(dhukus.householdId, householdId)))
```

with:

```ts
      ownerMemberId: parsed.ownerMemberId,
      potDeduction: parsed.potDeduction === null ? null : String(parsed.potDeduction),
      startDate: parsed.startDate,
      totalMembers: parsed.totalMembers,
    })
    .where(and(eq(dhukus.id, id), eq(dhukus.householdId, householdId)))
```

**(c)** In `addDhukuEntryAction`, replace:

```ts
  const body =
    parsed.type === "payout"
      ? `${actorName} recorded receiving ${formatNPR(parsed.amount)} from ${dhuku.name}.`
      : `${actorName} recorded a ${formatNPR(parsed.amount)} contribution to ${dhuku.name}.`;
  await insertNotification({
    body,
    category: "shared",
    dedupeKey: `dhuku-entry:${created.id}`,
    householdId,
    severity: "success",
    title: parsed.type === "payout" ? "Dhuku payout recorded" : "Dhuku contribution recorded",
  });
```

with:

```ts
  const body =
    parsed.type === "payout"
      ? `${actorName} recorded receiving ${formatNPR(parsed.amount)} from ${dhuku.name}.`
      : parsed.type === "fine"
        ? `${actorName} recorded a ${formatNPR(parsed.amount)} fine in ${dhuku.name}.`
        : `${actorName} recorded a ${formatNPR(parsed.amount)} contribution to ${dhuku.name}.`;
  await insertNotification({
    body,
    category: "shared",
    dedupeKey: `dhuku-entry:${created.id}`,
    householdId,
    severity: "success",
    title: parsed.type === "payout" ? "Dhuku payout recorded" : parsed.type === "fine" ? "Dhuku fine recorded" : "Dhuku contribution recorded",
  });
```

- [ ] **Step 4: Activity labels**

In `src/modules/dhuku/lib/dhuku-activity.ts`:

**(a)** Replace:

```ts
  ownerMemberId: null | string;
  startDate: string;
  totalMembers: number;
};

// "Office dhuku · RS 10,000/month · 12 members"
```

with:

```ts
  ownerMemberId: null | string;
  potDeduction?: null | number | string;
  startDate: string;
  totalMembers: number;
};

// "Office dhuku · RS 10,000/month · 12 members"
```

**(b)** Replace:

```ts
    { format: f.money, key: "interestPerMonth", label: "Interest per month" },
```

with:

```ts
    { format: f.money, key: "interestPerMonth", label: "Interest per month" },
    { format: f.money, key: "potDeduction", label: "Taken from each pot" },
```

**(c)** Replace:

```ts
  if (value === "payout") return "Payout";
  if (value === "contribution") return "Contribution";
  return null;
```

with:

```ts
  if (value === "payout") return "Payout";
  if (value === "contribution") return "Contribution";
  if (value === "fine") return "Fine";
  return null;
```

**(d)** Replace:

```ts
  return `${entry.type === "payout" ? "Payout" : "Contribution"} · ${f.money(entry.amount)} · ${dhukuName}`;
```

with:

```ts
  return `${entryTypeLabel(entry.type) ?? "Entry"} · ${f.money(entry.amount)} · ${dhukuName}`;
```

In `src/modules/activity/lib/revert/entities.ts`:

**(e)** Inside the `dhuku:` entry, replace:

```ts
    editable: ["completedAt", "interestPerMonth", "monthlyContribution", "name", "note", "ownerMemberId", "startDate", "totalMembers"],
```

with:

```ts
    editable: ["completedAt", "interestPerMonth", "monthlyContribution", "name", "note", "ownerMemberId", "potDeduction", "startDate", "totalMembers"],
```

**(f)** Inside the `dhuku_entry:` entry, replace:

```ts
    summary: (f, r) => `${r.type === "payout" ? "Payout" : "Contribution"} · ${f.money(r.amount)}`,
```

with:

```ts
    summary: (f, r) => `${r.type === "payout" ? "Payout" : r.type === "fine" ? "Fine" : "Contribution"} · ${f.money(r.amount)}`,
```

- [ ] **Step 5: Run the dhuku tests**

Run: `npx vitest run src/modules/dhuku`
Expected: all PASS.

---

### Task 3.4: Dhuku page shows fines, the expected pot and the real cost

**Files:**
- Modify: `src/modules/dhuku/components/DhukuDialog.tsx`
- Modify (replace the whole file): `src/modules/dhuku/components/LogEntryDialog.tsx`
- Modify: `src/modules/dhuku/components/DhukuView.tsx`
- Modify (replace the whole file): `src/modules/dhuku/pages/DhukuPage.tsx`

**Interfaces:**
- Consumes: `expectedPot`, `dhukuRealCost` and `DhukuRealCost` (Task 3.2).
- Produces:
  - `DhukuEditing.potDeduction: null | number`.
  - `DhukuEntryModel.type` now includes `"fine"`.
  - `DhukuRowModel` gains `nextAmount: number` and `realCost: DhukuRealCost`.

- [ ] **Step 1: Add the field to the dhuku dialog**

In `src/modules/dhuku/components/DhukuDialog.tsx`:

**(a)** Replace:

```tsx
  ownerKey: DhukuOwnerKey;
  startDate: string;
  totalMembers: number;
};
```

with:

```tsx
  ownerKey: DhukuOwnerKey;
  potDeduction: null | number;
  startDate: string;
  totalMembers: number;
};
```

**(b)** Replace:

```tsx
  const [interest, setInterest] = useState(editing?.interestPerMonth != null ? String(editing.interestPerMonth) : "");
```

with:

```tsx
  const [interest, setInterest] = useState(editing?.interestPerMonth != null ? String(editing.interestPerMonth) : "");
  const [deduction, setDeduction] = useState(editing?.potDeduction != null ? String(editing.potDeduction) : "");
```

**(c)** Replace:

```tsx
  const monthsValue = Number(months) || 0;
```

with:

```tsx
  const monthsValue = Number(months) || 0;
  const deductionValue = Number(deduction) || 0;
```

**(d)** Replace:

```tsx
      ownerMemberId: memberIdFor(owner),
      startDate,
```

with:

```tsx
      ownerMemberId: memberIdFor(owner),
      potDeduction: deductionValue > 0 ? deductionValue : null,
      startDate,
```

**(e)** Replace:

```tsx
        {monthlyValue > 0 && monthsValue > 0
          ? `Pot when it's your turn: ${formatMoney(monthlyValue * monthsValue)}`
          : "The pot is the monthly amount × number of months."}
```

with:

```tsx
        {monthlyValue > 0 && monthsValue > 0
          ? `Pot when it's your turn: ${formatMoney(monthlyValue * monthsValue - deductionValue)}, plus interest from members who took theirs before you.`
          : "The pot is the monthly amount × number of months, less anything taken out of each pot."}
```

**(f)** Replace:

```tsx
        <NepaliDateField label="Start date" onChange={setStartDate} value={startDate} />
```

with:

```tsx
        <NepaliDateField label="Start date" onChange={setStartDate} value={startDate} />
        <AmountInput
          label="Taken from each pot"
          onChange={(event) => setDeduction(event.target.value)}
          placeholder="e.g. 3000 for the meeting's food"
          value={deduction}
        />
```

- [ ] **Step 2: Replace the log-entry dialog**

Replace the whole of `src/modules/dhuku/components/LogEntryDialog.tsx` with:

```tsx
"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AmountInput } from "@/components/AmountInput";
import { Modal } from "@/components/Modal";
import { MoreDetails } from "@/components/MoreDetails";
import { NepaliDateField } from "@/components/NepaliDateField";
import { Segmented } from "@/components/Segmented";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/today";
import { addDhukuEntryAction } from "@/modules/dhuku/api/dhuku.actions";

export type LogEntryTarget = { id: string; monthly: number; name: string; pot: number };

type EntryKind = "contribution" | "fine" | "payout";

type Props = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  target: null | LogEntryTarget;
};

const FORM_ID = "dhuku-entry-form";

const AMOUNT_LABEL: Record<EntryKind, string> = {
  contribution: "Amount paid in",
  fine: "Fine paid",
  payout: "Amount received",
};

export function LogEntryDialog({ onOpenChange, open, target }: Props) {
  const [pending, setPending] = useState(false);

  return (
    <Modal
      className="sm:max-w-115"
      footer={
        <Button className="min-w-30 justify-start" disabled={pending} form={FORM_ID} type="submit">
          {pending ? "Saving..." : "Save entry"}
        </Button>
      }
      hint="Enter to save · Esc to close"
      onOpenChange={onOpenChange}
      open={open}
      subtitle={target?.name}
      title="Log entry"
    >
      {target && <LogEntryFields onDone={() => onOpenChange(false)} onPendingChange={setPending} target={target} />}
    </Modal>
  );
}

function LogEntryFields({ onDone, onPendingChange, target }: { onDone: () => void; onPendingChange: (pending: boolean) => void; target: LogEntryTarget }) {
  const router = useRouter();
  const [kind, setKind] = useState<EntryKind>("contribution");
  const [amount, setAmount] = useState(String(target.monthly));
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>();

  function chooseKind(value: EntryKind) {
    setKind(value);
    // A fine has no usual amount, so it starts empty.
    setAmount(value === "contribution" ? String(target.monthly) : value === "payout" ? String(target.pot) : "");
    setError(undefined);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!(Number(amount) > 0)) {
      setError("Enter an amount");
      return;
    }
    onPendingChange(true);
    try {
      await addDhukuEntryAction(target.id, { amount: Number(amount), date, note: note.trim() || undefined, type: kind });
      toast.success("Entry saved");
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
      <Segmented
        label="Entry type"
        onChange={chooseKind}
        options={[
          { label: "Contribution", value: "contribution" },
          { label: "Payout received", value: "payout" },
          { label: "Fine", value: "fine" },
        ]}
        value={kind}
      />
      <AmountInput
        data-autofocus
        error={error}
        label={AMOUNT_LABEL[kind]}
        onChange={(event) => {
          setAmount(event.target.value);
          setError(undefined);
        }}
        size="xl"
        value={amount}
      />
      <NepaliDateField label="Date" onChange={setDate} value={date} />
      <MoreDetails>
        <TextField label="Note" onChange={(event) => setNote(event.target.value)} placeholder="Optional" value={note} />
      </MoreDetails>
    </form>
  );
}
```

- [ ] **Step 3: Show fines and the real cost on the page**

In `src/modules/dhuku/components/DhukuView.tsx`:

**(a)** Replace:

```tsx
import { cn } from "@/lib/utils";
```

with:

```tsx
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
```

and replace:

```tsx
import type { DhukuCell } from "@/modules/dhuku/lib/dhuku-view";
```

with:

```tsx
import type { DhukuRealCost } from "@/modules/dhuku/lib/dhuku-money";
import type { DhukuCell } from "@/modules/dhuku/lib/dhuku-view";
```

**(b)** Replace:

```tsx
export type DhukuEntryModel = { amount: number; dateLabel: string; id: string; type: "contribution" | "payout" };
```

with:

```tsx
export type DhukuEntryModel = { amount: number; dateLabel: string; id: string; type: "contribution" | "fine" | "payout" };
```

**(c)** Replace:

```tsx
  monthText: string;
  name: string;
  nextLabel: string;
```

with:

```tsx
  monthText: string;
  name: string;
  nextAmount: number;
  nextLabel: string;
```

and replace:

```tsx
  pct: number;
  pot: number;
};
```

with:

```tsx
  pct: number;
  pot: number;
  realCost: DhukuRealCost;
};
```

**(d)** Replace:

```tsx
                    onClick={() => setLogTarget({ id: row.id, monthly: row.monthly, name: row.name, pot: row.pot })}
```

with:

```tsx
                    onClick={() => setLogTarget({ id: row.id, monthly: row.nextAmount, name: row.name, pot: row.pot })}
```

**(e)** Replace:

```tsx
            {open && row.entries.length > 0 && (
              <div className="border-b border-n-300 bg-ink/3 px-2 py-2">
                {row.entries.map((entry) => (
```

with:

```tsx
            {open && row.entries.length > 0 && (
              <div className="border-b border-n-300 bg-ink/3 px-2 py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-n-200 pb-2 text-[13px] text-n-700">
                  <span>
                    Real cost so far: <strong className="font-semibold text-ink">{formatMoney(row.realCost.total)}</strong>
                  </span>
                  <span>
                    Food share {formatMoney(row.realCost.foodShare)} · interest {formatMoney(row.realCost.interestPaid)} · fines{" "}
                    {formatMoney(row.realCost.finesPaid)} · less {formatMoney(row.realCost.received)} received in your pot
                  </span>
                </div>
                {row.entries.map((entry) => (
```

**(f)** Replace:

```tsx
                    <span className="text-sm">{entry.type === "payout" ? "Payout received" : "Contribution"}</span>
```

with:

```tsx
                    <span className="text-sm">{entry.type === "payout" ? "Payout received" : entry.type === "fine" ? "Fine" : "Contribution"}</span>
```

- [ ] **Step 4: Replace the Dhuku page server component**

Replace the whole of `src/modules/dhuku/pages/DhukuPage.tsx` with:

```tsx
import { formatDate } from "@/lib/date-format";
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { currentPeriodYearMonth, formatPeriodLabel, resolvePeriod } from "@/lib/month-period";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { todayISO } from "@/lib/today";
import { listDhukuEntries, listDhukus } from "@/modules/dhuku/api/dhuku.actions";
import { type DhukuEntryModel, type DhukuRowModel, DhukuView } from "@/modules/dhuku/components/DhukuView";
import { dhukuRealCost, expectedPot } from "@/modules/dhuku/lib/dhuku-money";
import { addMonths, dhukuMonthCells, dhukuProgress } from "@/modules/dhuku/lib/dhuku-view";

export async function DhukuPage() {
  const { householdId, memberId } = await getCurrentMember();
  const dateFormat = await getDateFormatPref(householdId);
  const { year, month } = currentPeriodYearMonth(dateFormat);
  const period = resolvePeriod(year, month, dateFormat);
  const today = todayISO();
  const monthName = formatPeriodLabel(year, month, dateFormat).split(" ")[0];

  const [members, dhukuRows, entryRows] = await Promise.all([
    getHouseholdMembers(householdId),
    listDhukus(householdId),
    listDhukuEntries(householdId),
  ]);

  const roleFor = (ownerMemberId: null | string): "me" | "partner" | "shared" =>
    ownerMemberId === null ? "shared" : ownerMemberId === memberId ? "me" : "partner";

  const computed = dhukuRows.map((dhuku) => {
    const rawEntries = entryRows.filter((e) => e.dhukuId === dhuku.id);
    const entriesLite = rawEntries.map((e) => ({ amount: Number(e.amount), date: e.date, id: e.id, note: e.note, type: e.type }));
    const progress = dhukuProgress(entriesLite);
    const months = dhuku.totalMembers;
    const completed = dhuku.completedAt !== null || progress.paidCount >= months;
    const active = !completed;
    const monthly = Number(dhuku.monthlyContribution);
    const interest = dhuku.interestPerMonth === null ? null : Number(dhuku.interestPerMonth);
    const potDeduction = dhuku.potDeduction === null ? null : Number(dhuku.potDeduction);
    const terms = { monthlyContribution: monthly, potDeduction, totalMembers: months };
    const nextDueDate = completed ? null : addMonths(dhuku.startDate, progress.paidCount);
    const nextAmount = progress.payoutAt !== null ? monthly + (interest ?? 0) : monthly;
    // This month's meeting is the next one unless its contribution is already
    // logged; one member takes the pot at each meeting.
    const paidThisPeriod = rawEntries.some((e) => e.type === "contribution" && e.date >= period.startDate && e.date <= period.endDate);
    const meetingNumber = Math.min(months, Math.max(1, paidThisPeriod ? progress.paidCount : progress.paidCount + 1));
    const pot = expectedPot(terms, interest, meetingNumber);
    const realCost = dhukuRealCost(terms, entriesLite);
    return {
      active,
      completed,
      dhuku,
      interest,
      manualCompleted: dhuku.completedAt !== null,
      monthly,
      months,
      nextAmount,
      nextDueDate,
      pot,
      potDeduction,
      progress,
      rawEntries,
      realCost,
    };
  });

  const rows: DhukuRowModel[] = computed.map(
    ({ active, completed, dhuku, interest, manualCompleted, monthly, months, nextAmount, nextDueDate, pot, potDeduction, progress, rawEntries, realCost }) => {
      let nextSub: string;
      let nextTone: "default" | "muted" | "negative";
      if (completed || nextDueDate === null) {
        nextSub = "—";
        nextTone = "muted";
      } else if (nextDueDate < today) {
        nextSub = "Overdue — log it if already paid";
        nextTone = "negative";
      } else if (nextDueDate <= period.endDate) {
        nextSub = `Rs ${Math.round(nextAmount).toLocaleString("en-US")} due this month`;
        nextTone = "default";
      } else {
        nextSub = `Rs ${Math.round(nextAmount).toLocaleString("en-US")} upcoming`;
        nextTone = "muted";
      }

      const entries: DhukuEntryModel[] = rawEntries.map((e) => ({
        amount: Number(e.amount),
        dateLabel: formatDate(e.date, dateFormat),
        id: e.id,
        type: e.type,
      }));

      return {
        active,
        cells: dhukuMonthCells(months, progress.paidCount, progress.payoutAt, completed),
        completed,
        contributed: progress.contributed,
        editing: {
          id: dhuku.id,
          interestPerMonth: interest,
          monthlyContribution: monthly,
          name: dhuku.name,
          note: dhuku.note,
          ownerKey: roleFor(dhuku.ownerMemberId),
          potDeduction,
          startDate: dhuku.startDate,
          totalMembers: months,
        },
        entries,
        id: dhuku.id,
        manualCompleted,
        monthly,
        monthText: completed ? `All ${months} months paid` : `Month ${progress.paidCount + 1} of ${months}`,
        name: dhuku.name,
        nextAmount,
        nextLabel: completed || nextDueDate === null ? "Completed" : formatDate(nextDueDate, dateFormat),
        nextSub,
        nextTone,
        ownerKey: roleFor(dhuku.ownerMemberId),
        pct: months > 0 ? Math.round((progress.paidCount / months) * 100) : 0,
        pot,
        realCost,
      };
    },
  );

  const due = computed.filter((c) => c.active && c.nextDueDate !== null && c.nextDueDate <= period.endDate);
  const activeCount = computed.filter((c) => c.active).length;
  const completedCount = computed.filter((c) => c.completed).length;
  const contributedTotal = computed.reduce((sum, c) => sum + c.progress.contributed, 0);
  const receivedTotal = computed.reduce((sum, c) => sum + c.progress.received, 0);

  return (
    <DhukuView
      currentMemberId={memberId}
      defaultStartDate={period.startDate}
      ledger={{
        active: String(activeCount),
        activeSub: `${completedCount} completed`,
        contributed: contributedTotal,
        due: due.reduce((sum, c) => sum + c.nextAmount, 0),
        dueSub: due.length > 0 ? due.map((c) => c.dhuku.name).join(", ") : `Nothing due in ${monthName}`,
        received: receivedTotal,
        recvSub: receivedTotal > 0 ? "Payouts taken" : "No payout taken yet",
      }}
      members={members.map((m) => ({ id: m.id, name: m.user.name }))}
      rows={rows}
    />
  );
}
```

- [ ] **Step 5: Check types, lint and tests**

Run: `npx tsc --noEmit`. Expected: no output.
Run: `npm run lint -- --fix`, then `npm run lint`. Expected: 0 errors.
Run: `npm test`. Expected: all pass.

- [ ] **Step 6: Commit**

This commits everything from Tasks 3.1–3.4 that isn't committed yet:

```bash
git add src/db/schema/dhukus.ts drizzle src/modules/dhuku src/modules/activity/lib/revert/entities.ts
git commit -m "feat(dhuku): fines, taken-from-each-pot, expected pot and real cost"
```

---

### Phase 3 checkpoint: STOP

- [ ] **Step 1: Run the full checks**

Run, in order:
1. `npm test`. Expected: all pass.
2. `npm run lint`. Expected: 0 errors.
3. `npx tsc --noEmit`. Expected: no output.
4. Optional: `npm run test:e2e`.

- [ ] **Step 2: Report to the owner, then STOP**

Tell the owner, in plain language:
- **What changed:** the commits made, one line each.
- **Test results:** unit test totals, and whether e2e ran.
- **Migration:**
  - Name the new migration file.
  - Back up the database, then run `npm run db:migrate`.
- **What to try in the app:**
  - Edit the dhuku and set "Taken from each pot" to 3,000.
  - Log a Rs 100 fine.
  - Open the dhuku row and check the "Real cost so far" line.
  - Check the month count didn't go up for the fine.

Then **wait for the owner to say go on** before starting Phase 4.

---

## Phase 4: Savings, the core

**What this phase delivers:** savings goals are replaced by **pots** with an **emergency reserve**, a **priority list** and a **forecast**. Expenses can be **paid from savings**. Home, Reports and Budget treat savings correctly, and the old goals code and tables are removed. Design rules 2 and 12–19 apply.

**Database change (two migrations):**
- **Migration A (Task 4.1)** adds:
  - the tables `savings_pots`, `savings_pot_plans`, `savings_items` and `savings_deposits`;
  - the enum `savings_deposit_kind`;
  - the columns `expenses.savings_pot_id` and `expenses.savings_item_id`;
  - three activity entity types.
- **Migration B (Task 4.7)** drops the empty `savings_goals` and `savings_contributions` tables, after a guard that refuses to run if they hold any rows.

They are separate so `db:generate` never has to ask whether a table was renamed.

### Task 4.1: Schema for pots

**Files:**
- Create: `src/db/schema/savings.ts`
- Modify: `src/db/schema/expenses.ts`
- Modify: `src/db/schema/index.ts`
- Modify: `src/db/schema/activityLogs.ts`
- Modify: `src/modules/activity/lib/sections.ts`
- Modify: `src/modules/activity/lib/sections.test.ts`
- Modify: `src/modules/activity/lib/activity-format.ts`
- Create (generated): the next `drizzle/00NN_*.sql` and snapshot

**Interfaces:**
- Produces these table exports:
  - `savingsPots` (`id, householdId, ownerMemberId, name, heldByMemberId, reserveMinimum, createdAt`)
  - `savingsPotPlans` (`id, potId, memberId, monthlyAmount`)
  - `savingsItems` (`id, potId, name, cost, position, neededBy, note, createdAt`)
  - `savingsDeposits` (`id, potId, kind, memberId, amount, date, createdAt`), with `kind` being `"deposit" | "opening" | "interest"`
- Produces the columns `expenses.savingsPotId` and `expenses.savingsItemId` (`string | null`).
- Produces the entity types `"savings_deposit" | "savings_item" | "savings_pot"`.

- [ ] **Step 1: Create the savings schema**

Create `src/db/schema/savings.ts`:

```ts
import { sql } from "drizzle-orm";
import { date, integer, numeric, pgEnum, pgTable, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { householdMembers } from "./householdMembers";
import { households } from "./households";

export const savingsDepositKindEnum = pgEnum("savings_deposit_kind", ["deposit", "opening", "interest"]);

// One pot per real savings account: at most one shared pot (no owner) and one
// per member. The plain unique covers members; Postgres treats NULLs as
// distinct, so the partial index below covers the single shared pot.
export const savingsPots = pgTable(
  "savings_pots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    // null = shared
    ownerMemberId: uuid("owner_member_id").references(() => householdMembers.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    // Whose bank account holds the money. A label only.
    heldByMemberId: uuid("held_by_member_id").references(() => householdMembers.id, {
      onDelete: "set null",
    }),
    // Kept untouched by the priority list; it always fills first.
    reserveMinimum: numeric("reserve_minimum", { precision: 12, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique().on(table.householdId, table.ownerMemberId),
    uniqueIndex("savings_pots_one_shared").on(table.householdId).where(sql`${table.ownerMemberId} is null`),
  ],
);

// How much each person plans to put into a pot every month. It drives the
// forecast.
export const savingsPotPlans = pgTable(
  "savings_pot_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    potId: uuid("pot_id")
      .notNull()
      .references(() => savingsPots.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => householdMembers.id, { onDelete: "cascade" }),
    monthlyAmount: numeric("monthly_amount", { precision: 12, scale: 2 }).notNull(),
  },
  (table) => [unique().on(table.potId, table.memberId)],
);

// The priority list; a lower position comes first. An item is done once an
// expense paid from savings links to it (expenses.savingsItemId).
export const savingsItems = pgTable("savings_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  potId: uuid("pot_id")
    .notNull()
    .references(() => savingsPots.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  cost: numeric("cost", { precision: 12, scale: 2 }).notNull(),
  position: integer("position").notNull(),
  neededBy: date("needed_by"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Money into a pot. "opening" = what was already in the account when the pot
// was set up, and "interest" = bank interest; neither has a member.
export const savingsDeposits = pgTable("savings_deposits", {
  id: uuid("id").defaultRandom().primaryKey(),
  potId: uuid("pot_id")
    .notNull()
    .references(() => savingsPots.id, { onDelete: "cascade" }),
  kind: savingsDepositKindEnum("kind").notNull().default("deposit"),
  memberId: uuid("member_id").references(() => householdMembers.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  date: date("date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

- [ ] **Step 2: Link expenses to pots and items**

In `src/db/schema/expenses.ts`, replace:

```ts
import { recurringExpenses } from "./recurringExpenses";
```

with:

```ts
import { recurringExpenses } from "./recurringExpenses";
import { savingsItems, savingsPots } from "./savings";
```

and replace:

```ts
  payBackAmount: numeric("pay_back_amount", { precision: 12, scale: 2 }),
```

with:

```ts
  payBackAmount: numeric("pay_back_amount", { precision: 12, scale: 2 }),
  // Set when this expense was paid from a savings pot instead of from pay.
  savingsPotId: uuid("savings_pot_id").references(() => savingsPots.id, { onDelete: "set null" }),
  // The priority-list item this expense paid for, if any.
  savingsItemId: uuid("savings_item_id").references(() => savingsItems.id, { onDelete: "set null" }),
```

In `src/db/schema/index.ts`, replace:

```ts
export * from "./savingsGoals";
```

with:

```ts
export * from "./savingsGoals";
export * from "./savings";
```

- [ ] **Step 3: Add the activity entity types**

In `src/db/schema/activityLogs.ts`, replace:

```ts
  "savings_contribution",
  "savings_goal",
]);
```

with:

```ts
  "savings_contribution",
  "savings_deposit",
  "savings_goal",
  "savings_item",
  "savings_pot",
]);
```

In `src/modules/activity/lib/sections.ts`, replace:

```ts
  { entityTypes: ["savings_goal", "savings_contribution"], label: "Savings", value: "savings" },
```

with:

```ts
  {
    entityTypes: ["savings_pot", "savings_item", "savings_deposit", "savings_goal", "savings_contribution"],
    label: "Savings",
    value: "savings",
  },
```

In `src/modules/activity/lib/sections.test.ts`, replace:

```ts
    expect(entityTypesForSection("savings")).toEqual(["savings_goal", "savings_contribution"]);
```

with:

```ts
    expect(entityTypesForSection("savings")).toEqual(["savings_pot", "savings_item", "savings_deposit", "savings_goal", "savings_contribution"]);
```

In `src/modules/activity/lib/activity-format.ts`, replace:

```ts
  savings_contribution: "a savings contribution",
  savings_goal: "a savings goal",
};
```

with:

```ts
  savings_contribution: "a savings contribution",
  savings_deposit: "money in savings",
  savings_goal: "a savings goal",
  savings_item: "a savings list item",
  savings_pot: "a savings pot",
};
```

- [ ] **Step 4: Generate migration A**

Run: `npm run db:generate`
Expected: one new SQL file, and **no** question asked. If it asks, stop and report.

Open the new `.sql` file. It must contain all of these, and must **not** contain `DROP TABLE`:
- `CREATE TYPE "public"."savings_deposit_kind"`
- `CREATE TABLE "savings_pots"`
- `CREATE TABLE "savings_pot_plans"`
- `CREATE TABLE "savings_items"`
- `CREATE TABLE "savings_deposits"`
- `ADD COLUMN "savings_pot_id"`
- `ADD COLUMN "savings_item_id"`
- `CREATE UNIQUE INDEX "savings_pots_one_shared"`
- three `ALTER TYPE "public"."activity_entity_type" ADD VALUE` lines

- [ ] **Step 5: Check types and tests**

Run: `npx tsc --noEmit`. Expected: no output.
Run: `npm test`. Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema/savings.ts src/db/schema/expenses.ts src/db/schema/index.ts src/db/schema/activityLogs.ts src/modules/activity/lib/sections.ts src/modules/activity/lib/sections.test.ts src/modules/activity/lib/activity-format.ts drizzle
git commit -m "feat(db): savings pots, plans, list items and deposits"
```

---

### Task 4.2: Pot maths and the forecast

**Files:**
- Create: `src/modules/savings/lib/savings-math.ts`
- Create: `src/modules/savings/lib/savings-math.test.ts`
- Create: `src/modules/savings/lib/savings-forecast.ts`
- Create: `src/modules/savings/lib/savings-forecast.test.ts`

**Interfaces:**
- Produces from `savings-math.ts`:
  - `type DepositRow = { amount: number; date: string; kind: "deposit" | "interest" | "opening"; memberId: null | string; potId: string }`
  - `type SavingsSpend = { amount: number; savingsPotId: string }`
  - `potBalance(potId: string, deposits: DepositRow[], spends: SavingsSpend[]): number`
  - `putInBetween(potId: string, deposits: DepositRow[], startDate: string, endDate: string): number`
- Produces from `savings-forecast.ts`:
  - `type ForecastItem = { cost: number; id: string }`
  - `type ForecastInput = { balance: number; items: ForecastItem[]; monthlyInflow: number; reserveMinimum: number }`
  - `type ItemForecast = { cumulativeCost: number; id: string; monthsFromNow: null | number }`
  - `type PotForecast = { items: ItemForecast[]; reserveFullInMonths: null | number }`
  - `forecastPot(input: ForecastInput): PotForecast`
  - `monthAfter(year: number, month: number, months: number): { month: number; year: number }`

- [ ] **Step 1: Write the failing tests**

Create `src/modules/savings/lib/savings-math.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { potBalance, putInBetween } from "./savings-math";

const DEPOSITS = [
  { amount: 40000, date: "2026-10-01", kind: "opening" as const, memberId: null, potId: "shared" },
  { amount: 10000, date: "2026-10-02", kind: "deposit" as const, memberId: "me", potId: "shared" },
  { amount: 5000, date: "2026-10-07", kind: "deposit" as const, memberId: "her", potId: "shared" },
  { amount: 250, date: "2026-10-31", kind: "interest" as const, memberId: null, potId: "shared" },
  { amount: 10000, date: "2026-09-02", kind: "deposit" as const, memberId: "me", potId: "shared" },
  { amount: 3000, date: "2026-10-03", kind: "deposit" as const, memberId: "me", potId: "mine" },
];

describe("potBalance", () => {
  it("is everything put in, opening balance and interest included, less what was paid from it", () => {
    const balance = potBalance("shared", DEPOSITS, [
      { amount: 20000, savingsPotId: "shared" },
      { amount: 999, savingsPotId: "mine" },
    ]);

    expect(balance).toBe(45250);
  });

  it("only looks at its own pot", () => {
    expect(potBalance("mine", DEPOSITS, [])).toBe(3000);
  });
});

describe("putInBetween", () => {
  it("counts real deposits in the dates given, not the opening balance or interest", () => {
    expect(putInBetween("shared", DEPOSITS, "2026-10-01", "2026-10-31")).toBe(15000);
  });
});
```

Create `src/modules/savings/lib/savings-forecast.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { forecastPot, monthAfter } from "./savings-forecast";

describe("forecastPot", () => {
  it("fills the emergency reserve before anything on the list", () => {
    const forecast = forecastPot({ balance: 15000, items: [{ cost: 60000, id: "trip" }], monthlyInflow: 15000, reserveMinimum: 100000 });

    expect(forecast.reserveFullInMonths).toBe(6);
    // (100,000 reserve + 60,000 trip − 15,000 already in) ÷ 15,000 a month = 9.67, so 10 months.
    expect(forecast.items[0].monthsFromNow).toBe(10);
  });

  it("pays for the list strictly in order", () => {
    const forecast = forecastPot({
      balance: 100000,
      items: [
        { cost: 300000, id: "surgery" },
        { cost: 60000, id: "vacation" },
      ],
      monthlyInflow: 15000,
      reserveMinimum: 100000,
    });

    expect(forecast.items.map((item) => item.monthsFromNow)).toEqual([20, 24]);
    expect(forecast.items.map((item) => item.cumulativeCost)).toEqual([300000, 360000]);
  });

  it("says affordable now when the pot already covers it", () => {
    const forecast = forecastPot({ balance: 200000, items: [{ cost: 50000, id: "phone" }], monthlyInflow: 0, reserveMinimum: 100000 });

    expect(forecast.reserveFullInMonths).toBe(0);
    expect(forecast.items[0].monthsFromNow).toBe(0);
  });

  it("gives no date when nothing is planned going in", () => {
    const forecast = forecastPot({ balance: 10000, items: [{ cost: 50000, id: "phone" }], monthlyInflow: 0, reserveMinimum: 100000 });

    expect(forecast.reserveFullInMonths).toBeNull();
    expect(forecast.items[0].monthsFromNow).toBeNull();
  });
});

describe("monthAfter", () => {
  it("rolls over into the next year", () => {
    expect(monthAfter(2083, 11, 3)).toEqual({ month: 2, year: 2084 });
  });

  it("returns the same month for zero", () => {
    expect(monthAfter(2083, 6, 0)).toEqual({ month: 6, year: 2083 });
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npx vitest run src/modules/savings/lib`
Expected: FAIL, because `./savings-math` and `./savings-forecast` can't be found.

- [ ] **Step 3: Write the code**

Create `src/modules/savings/lib/savings-math.ts`:

```ts
export type DepositRow = { amount: number; date: string; kind: "deposit" | "interest" | "opening"; memberId: null | string; potId: string };
export type SavingsSpend = { amount: number; savingsPotId: string };

// Everything that went in (opening balance, deposits, bank interest), less the
// expenses paid from the pot.
export function potBalance(potId: string, deposits: DepositRow[], spends: SavingsSpend[]): number {
  const moneyIn = deposits.filter((d) => d.potId === potId).reduce((sum, d) => sum + d.amount, 0);
  const moneyOut = spends.filter((s) => s.savingsPotId === potId).reduce((sum, s) => sum + s.amount, 0);
  return Math.round((moneyIn - moneyOut) * 100) / 100;
}

// What people actually put in between two dates (inclusive). Only real
// deposits count, not the opening balance or bank interest.
export function putInBetween(potId: string, deposits: DepositRow[], startDate: string, endDate: string): number {
  return deposits
    .filter((d) => d.potId === potId && d.kind === "deposit" && d.date >= startDate && d.date <= endDate)
    .reduce((sum, d) => sum + d.amount, 0);
}
```

Create `src/modules/savings/lib/savings-forecast.ts`:

```ts
import { nextMonth } from "@/lib/month-nav";

export type ForecastItem = { cost: number; id: string };
export type ForecastInput = { balance: number; items: ForecastItem[]; monthlyInflow: number; reserveMinimum: number };
export type ItemForecast = { cumulativeCost: number; id: string; monthsFromNow: null | number };
export type PotForecast = { items: ItemForecast[]; reserveFullInMonths: null | number };

// Strict priority order, with the emergency reserve always filling first: an
// item becomes affordable once the pot covers the reserve plus every item up
// to and including it. monthsFromNow is 0 when that's already true, and null
// when it never will be on the current plan (nothing planned going in).
export function forecastPot({ balance, items, monthlyInflow, reserveMinimum }: ForecastInput): PotForecast {
  const monthsToCover = (target: number): null | number => {
    const short = target - balance;
    if (short <= 0) return 0;
    if (monthlyInflow <= 0) return null;
    return Math.ceil(short / monthlyInflow);
  };
  let cumulativeCost = 0;
  return {
    items: items.map((item) => {
      cumulativeCost += item.cost;
      return { cumulativeCost, id: item.id, monthsFromNow: monthsToCover(reserveMinimum + cumulativeCost) };
    }),
    reserveFullInMonths: monthsToCover(reserveMinimum),
  };
}

// The (year, month) a number of months after the given one, in the
// household's own calendar (BS and AD years both have 12 months).
export function monthAfter(year: number, month: number, months: number): { month: number; year: number } {
  let current = { month, year };
  for (let i = 0; i < months; i++) current = nextMonth(current.year, current.month);
  return current;
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run src/modules/savings/lib`
Expected: all 9 tests PASS.

- [ ] **Step 5: Lint and commit**

Run: `npm run lint -- --fix`, then `npm run lint`. Expected: 0 errors.

```bash
git add src/modules/savings/lib
git commit -m "feat(savings): pot balance and forecast maths"
```

---

### Task 4.3: Savings server actions

**Files:**
- Create: `src/modules/savings/schemas/savings.schema.ts`
- Create: `src/modules/savings/lib/savings-activity.ts`
- Create: `src/modules/savings/lib/savings-activity.test.ts`
- Create: `src/modules/savings/api/savings.actions.ts`

**Interfaces:**
- Consumes: the tables from Task 4.1.
- Produces these types:
  - `CreatePotInput = { heldByMemberId: null | string; name: string; openingBalance: number; ownerMemberId: null | string; plans: { memberId: string; monthlyAmount: number }[]; reserveMinimum: number }`
  - `UpdatePotInput` = the same without `openingBalance` and `ownerMemberId`
  - `DepositInput = { amount: number; date: string; kind: "deposit" | "interest"; memberId: null | string }`
  - `ItemInput = { cost: number; name: string; neededBy: null | string; note?: string }`
- Produces these list functions, each taking `householdId`: `listSavingsPots`, `listSavingsPotPlans`, `listSavingsItems` (ordered by position), `listSavingsDeposits` (newest first), and `listSavingsExpenses` (returns `{ amount: string; date: string; id: string; savingsItemId: string | null; savingsPotId: string | null }[]`).
- Produces these actions:
  - `createSavingsPotAction(input)` and `updateSavingsPotAction(id, input)`
  - `addSavingsDepositAction(potId, input)` and `deleteSavingsDepositAction(id)`
  - `createSavingsItemAction(potId, input)`, `updateSavingsItemAction(id, input)` and `deleteSavingsItemAction(id)`
  - `moveSavingsItemAction(id, direction: "down" | "up")`

- [ ] **Step 1: Write the failing test**

Create `src/modules/savings/lib/savings-activity.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { testFormatters } from "@/modules/activity/lib/test-formatters";

import { depositSummary, itemSummary, potSummary } from "./savings-activity";

const f = testFormatters();

describe("savings activity summaries", () => {
  it("summarises a pot", () => {
    expect(potSummary(f, { name: "Shared savings", ownerMemberId: null, reserveMinimum: "100000" })).toBe(
      "Shared savings · Shared · reserve RS 100,000",
    );
  });

  it("summarises a list item", () => {
    expect(itemSummary(f, { cost: 300000, name: "Surgery" }, "Shared savings")).toBe("Surgery · RS 300,000 · Shared savings");
  });

  it("names who put money in, or what kind of money it was", () => {
    expect(depositSummary(f, { amount: "10000", kind: "deposit", memberId: "m-1" }, "Shared savings")).toBe(
      "RS 10,000 into Shared savings · by Asha",
    );
    expect(depositSummary(f, { amount: 40000, kind: "opening", memberId: null }, "Shared savings")).toBe(
      "RS 40,000 into Shared savings · opening balance",
    );
  });
});
```

Run: `npx vitest run src/modules/savings/lib/savings-activity.test.ts`
Expected: FAIL, because `./savings-activity` can't be found.

- [ ] **Step 2: Write the activity summaries**

Create `src/modules/savings/lib/savings-activity.ts`:

```ts
import type { ActivityFormatters } from "@/modules/activity/lib/activity-values";

// "Shared savings · Shared · reserve RS 100,000"
export function potSummary(f: ActivityFormatters, pot: { name: string; ownerMemberId: null | string; reserveMinimum: number | string }): string {
  return [pot.name, f.owner(pot.ownerMemberId), `reserve ${f.money(pot.reserveMinimum)}`].join(" · ");
}

// "Surgery · RS 300,000 · Shared savings"
export function itemSummary(f: ActivityFormatters, item: { cost: number | string; name: string }, potName: string): string {
  return `${item.name} · ${f.money(item.cost)} · ${potName}`;
}

// "RS 10,000 into Shared savings · by Asha"
export function depositSummary(
  f: ActivityFormatters,
  deposit: { amount: number | string; kind: string; memberId: null | string },
  potName: string,
): string {
  const source = deposit.kind === "opening" ? "opening balance" : deposit.kind === "interest" ? "bank interest" : `by ${f.member(deposit.memberId)}`;
  return `${f.money(deposit.amount)} into ${potName} · ${source}`;
}
```

Run: `npx vitest run src/modules/savings/lib/savings-activity.test.ts`
Expected: PASS.

- [ ] **Step 3: Write the schemas**

Create `src/modules/savings/schemas/savings.schema.ts`:

```ts
import { z } from "zod";

export const potPlanSchema = z.object({
  memberId: z.string().uuid(),
  monthlyAmount: z.number().min(0),
});

export const createPotSchema = z.object({
  // Whose account holds a shared pot; an individual pot is always its owner's.
  heldByMemberId: z.string().uuid().nullable(),
  name: z.string().trim().min(1),
  // What's already in the account when the pot is set up.
  openingBalance: z.number().min(0),
  ownerMemberId: z.string().uuid().nullable(),
  plans: z.array(potPlanSchema),
  reserveMinimum: z.number().min(0),
});

export type CreatePotInput = z.infer<typeof createPotSchema>;

export const updatePotSchema = createPotSchema.omit({ openingBalance: true, ownerMemberId: true });

export type UpdatePotInput = z.infer<typeof updatePotSchema>;

export const depositSchema = z.object({
  amount: z.number().positive(),
  date: z.string(), // "YYYY-MM-DD"
  kind: z.enum(["deposit", "interest"]),
  // Who put the money in; null for bank interest.
  memberId: z.string().uuid().nullable(),
});

export type DepositInput = z.infer<typeof depositSchema>;

export const itemSchema = z.object({
  cost: z.number().positive(),
  name: z.string().trim().min(1),
  neededBy: z.string().nullable(), // "YYYY-MM-DD"
  note: z.string().optional(),
});

export type ItemInput = z.infer<typeof itemSchema>;
```

- [ ] **Step 4: Write the actions**

Create `src/modules/savings/api/savings.actions.ts`:

```ts
"use server";

import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { expenses, savingsDeposits, savingsItems, savingsPotPlans, savingsPots } from "@/db/schema";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { todayISO } from "@/lib/today";
import { activityActor, loadActivityFormatters, logActivity } from "@/modules/activity/api/activity";
import { formatNPR } from "@/modules/dashboard/lib/format";
import { insertNotification } from "@/modules/notifications/api/notifications.actions";

import { depositSummary, itemSummary, potSummary } from "../lib/savings-activity";
import {
  type CreatePotInput,
  createPotSchema,
  type DepositInput,
  depositSchema,
  type ItemInput,
  itemSchema,
  type UpdatePotInput,
  updatePotSchema,
} from "../schemas/savings.schema";

type PlanInput = { memberId: string; monthlyAmount: number };

function revalidateSavingsPaths() {
  revalidatePath("/savings");
  revalidatePath("/dashboard");
  revalidatePath("/budget");
  revalidatePath("/reports");
}

export async function listSavingsPots(householdId: string) {
  return db.select().from(savingsPots).where(eq(savingsPots.householdId, householdId)).orderBy(asc(savingsPots.createdAt));
}

async function potIdsOf(householdId: string) {
  return (await listSavingsPots(householdId)).map((pot) => pot.id);
}

export async function listSavingsPotPlans(householdId: string) {
  const potIds = await potIdsOf(householdId);
  if (potIds.length === 0) return [];
  return db.select().from(savingsPotPlans).where(inArray(savingsPotPlans.potId, potIds));
}

export async function listSavingsItems(householdId: string) {
  const potIds = await potIdsOf(householdId);
  if (potIds.length === 0) return [];
  return db.select().from(savingsItems).where(inArray(savingsItems.potId, potIds)).orderBy(asc(savingsItems.position));
}

export async function listSavingsDeposits(householdId: string) {
  const potIds = await potIdsOf(householdId);
  if (potIds.length === 0) return [];
  return db
    .select()
    .from(savingsDeposits)
    .where(inArray(savingsDeposits.potId, potIds))
    .orderBy(desc(savingsDeposits.date), desc(savingsDeposits.createdAt));
}

// Every expense ever paid from a pot: for pot balances and finished items.
export async function listSavingsExpenses(householdId: string) {
  return db
    .select({
      amount: expenses.amount,
      date: expenses.date,
      id: expenses.id,
      savingsItemId: expenses.savingsItemId,
      savingsPotId: expenses.savingsPotId,
    })
    .from(expenses)
    .where(and(eq(expenses.householdId, householdId), isNotNull(expenses.savingsPotId)));
}

async function findPotInHousehold(householdId: string, potId: string) {
  const [pot] = await db.select().from(savingsPots).where(and(eq(savingsPots.id, potId), eq(savingsPots.householdId, householdId)));
  if (!pot) throw new Error("Savings pot does not belong to this household");
  return pot;
}

async function findItemInHousehold(householdId: string, itemId: string) {
  const [item] = await db.select().from(savingsItems).where(eq(savingsItems.id, itemId));
  if (!item) throw new Error("List item not found");
  const pot = await findPotInHousehold(householdId, item.potId);
  return { item, pot };
}

// Replaces a pot's monthly plans. Only household members count, and an
// individual pot only takes its owner's plan.
async function savePlans(potId: string, ownerMemberId: null | string, plans: PlanInput[], memberIds: Set<string>) {
  const rows = plans
    .filter((p) => memberIds.has(p.memberId) && (ownerMemberId === null || p.memberId === ownerMemberId) && p.monthlyAmount > 0)
    .map((p) => ({ memberId: p.memberId, monthlyAmount: String(p.monthlyAmount), potId }));
  await db.delete(savingsPotPlans).where(eq(savingsPotPlans.potId, potId));
  if (rows.length > 0) await db.insert(savingsPotPlans).values(rows);
}

export async function createSavingsPotAction(input: CreatePotInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = createPotSchema.parse(input);
  const members = await getHouseholdMembers(householdId);
  const memberIds = new Set(members.map((m) => m.id));
  if (parsed.ownerMemberId !== null && !memberIds.has(parsed.ownerMemberId)) {
    throw new Error("Member does not belong to this household");
  }
  const existing = await listSavingsPots(householdId);
  if (existing.some((pot) => pot.ownerMemberId === parsed.ownerMemberId)) {
    throw new Error("That pot is already set up");
  }
  // An individual pot is always held by its owner.
  const heldByMemberId =
    parsed.ownerMemberId ?? (parsed.heldByMemberId !== null && memberIds.has(parsed.heldByMemberId) ? parsed.heldByMemberId : null);

  const [created] = await db
    .insert(savingsPots)
    .values({
      heldByMemberId,
      householdId,
      name: parsed.name,
      ownerMemberId: parsed.ownerMemberId,
      reserveMinimum: String(parsed.reserveMinimum),
    })
    .returning();
  await savePlans(created.id, created.ownerMemberId, parsed.plans, memberIds);
  if (parsed.openingBalance > 0) {
    await db.insert(savingsDeposits).values({
      amount: String(parsed.openingBalance),
      date: todayISO(),
      kind: "opening",
      memberId: null,
      potId: created.id,
    });
  }

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "created",
    after: created,
    entityId: created.id,
    entityType: "savings_pot",
    summary: potSummary(f, created),
  });

  revalidateSavingsPaths();
}

export async function updateSavingsPotAction(id: string, input: UpdatePotInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = updatePotSchema.parse(input);
  const before = await findPotInHousehold(householdId, id);
  const members = await getHouseholdMembers(householdId);
  const memberIds = new Set(members.map((m) => m.id));
  const heldByMemberId =
    before.ownerMemberId ?? (parsed.heldByMemberId !== null && memberIds.has(parsed.heldByMemberId) ? parsed.heldByMemberId : null);

  const [updated] = await db
    .update(savingsPots)
    .set({ heldByMemberId, name: parsed.name, reserveMinimum: String(parsed.reserveMinimum) })
    .where(and(eq(savingsPots.id, id), eq(savingsPots.householdId, householdId)))
    .returning();
  await savePlans(id, before.ownerMemberId, parsed.plans, memberIds);

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "updated",
    after: updated,
    before,
    entityId: id,
    entityType: "savings_pot",
    summary: potSummary(f, updated),
  });

  revalidateSavingsPaths();
}

export async function addSavingsDepositAction(potId: string, input: DepositInput) {
  const member = await getCurrentMember();
  const { householdId, name: actorName } = member;
  const parsed = depositSchema.parse(input);
  const pot = await findPotInHousehold(householdId, potId);

  let memberId: null | string = null;
  if (parsed.kind === "deposit") {
    // An individual pot only ever gets money from its owner.
    memberId = pot.ownerMemberId ?? parsed.memberId;
    const members = await getHouseholdMembers(householdId);
    if (memberId === null || !members.some((m) => m.id === memberId)) {
      throw new Error("Choose who put the money in");
    }
  }

  const [created] = await db
    .insert(savingsDeposits)
    .values({ amount: String(parsed.amount), date: parsed.date, kind: parsed.kind, memberId, potId })
    .returning();

  if (parsed.kind === "deposit") {
    await insertNotification({
      body: `${actorName} added ${formatNPR(parsed.amount)} to ${pot.name}.`,
      category: "goal",
      dedupeKey: `savings-deposit:${created.id}`,
      householdId,
      severity: "success",
      title: "Money added to savings",
    });
  }

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "created",
    after: created,
    entityId: created.id,
    entityType: "savings_deposit",
    summary: depositSummary(f, created, pot.name),
  });

  revalidateSavingsPaths();
}

export async function deleteSavingsDepositAction(id: string) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const [before] = await db.select().from(savingsDeposits).where(eq(savingsDeposits.id, id));
  if (!before) return;
  const pot = await findPotInHousehold(householdId, before.potId);

  await db.delete(savingsDeposits).where(eq(savingsDeposits.id, id));

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "deleted",
    before,
    entityId: id,
    entityType: "savings_deposit",
    summary: depositSummary(f, before, pot.name),
  });

  revalidateSavingsPaths();
}

export async function createSavingsItemAction(potId: string, input: ItemInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = itemSchema.parse(input);
  const pot = await findPotInHousehold(householdId, potId);
  const positions = await db.select({ position: savingsItems.position }).from(savingsItems).where(eq(savingsItems.potId, potId));
  const position = Math.max(0, ...positions.map((p) => p.position)) + 1;

  const [created] = await db
    .insert(savingsItems)
    .values({
      cost: String(parsed.cost),
      name: parsed.name,
      neededBy: parsed.neededBy,
      note: parsed.note?.trim() || null,
      position,
      potId,
    })
    .returning();

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "created",
    after: created,
    entityId: created.id,
    entityType: "savings_item",
    summary: itemSummary(f, created, pot.name),
  });

  revalidateSavingsPaths();
}

export async function updateSavingsItemAction(id: string, input: ItemInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = itemSchema.parse(input);
  const { item: before, pot } = await findItemInHousehold(householdId, id);

  const [updated] = await db
    .update(savingsItems)
    .set({ cost: String(parsed.cost), name: parsed.name, neededBy: parsed.neededBy, note: parsed.note?.trim() || null })
    .where(eq(savingsItems.id, id))
    .returning();

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "updated",
    after: updated,
    before,
    entityId: id,
    entityType: "savings_item",
    summary: itemSummary(f, updated, pot.name),
  });

  revalidateSavingsPaths();
}

export async function deleteSavingsItemAction(id: string) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const { item: before, pot } = await findItemInHousehold(householdId, id);

  // An expense that paid for it keeps its "from savings" flag; the foreign key
  // only clears the link to the item.
  await db.delete(savingsItems).where(eq(savingsItems.id, id));

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "deleted",
    before,
    entityId: id,
    entityType: "savings_item",
    summary: itemSummary(f, before, pot.name),
  });

  revalidateSavingsPaths();
}

// Swaps an item with its neighbour among the items not paid for yet, which is
// the order the Savings page shows.
export async function moveSavingsItemAction(id: string, direction: "down" | "up") {
  const member = await getCurrentMember();
  const { householdId } = member;
  const { item, pot } = await findItemInHousehold(householdId, id);

  const potItems = await db.select().from(savingsItems).where(eq(savingsItems.potId, pot.id)).orderBy(asc(savingsItems.position));
  const paid = await db
    .select({ savingsItemId: expenses.savingsItemId })
    .from(expenses)
    .where(and(eq(expenses.householdId, householdId), eq(expenses.savingsPotId, pot.id), isNotNull(expenses.savingsItemId)));
  const paidIds = new Set(paid.map((p) => p.savingsItemId));
  const open = potItems.filter((i) => !paidIds.has(i.id));
  const index = open.findIndex((i) => i.id === id);
  const neighbour = open[direction === "up" ? index - 1 : index + 1];
  if (index === -1 || !neighbour) return;

  await db.update(savingsItems).set({ position: neighbour.position }).where(eq(savingsItems.id, item.id));
  await db.update(savingsItems).set({ position: item.position }).where(eq(savingsItems.id, neighbour.id));

  const f = await loadActivityFormatters(householdId);
  await logActivity(activityActor(member), {
    action: "updated",
    after: { ...item, position: neighbour.position },
    before: item,
    entityId: item.id,
    entityType: "savings_item",
    summary: `${itemSummary(f, item, pot.name)} · moved ${direction}`,
  });

  revalidateSavingsPaths();
}
```

- [ ] **Step 5: Check types, lint and tests**

Run: `npx tsc --noEmit`. Expected: no output.
Run: `npm run lint -- --fix`, then `npm run lint`. Expected: 0 errors.
Run: `npm test`. Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/modules/savings
git commit -m "feat(savings): pot, list and deposit actions"
```

---

### Task 4.4: Expenses can be paid from savings

**Files:**
- Modify (replace the whole file): `src/modules/expenses/schemas/expense.schema.ts`
- Modify: `src/modules/expenses/api/expenses.actions.ts`
- Modify: `src/modules/expenses/lib/expense-activity.ts`
- Modify: `src/modules/activity/lib/revert/entities.ts`
- Modify: `src/modules/activity/api/revert-store.ts`
- Modify: `src/modules/notifications/api/notifications.actions.ts`
- Modify (replace the whole file): `src/modules/expenses/components/ExpenseDialog.tsx`
- Modify: `src/modules/expenses/components/ExpensesView.tsx`
- Modify: `src/modules/expenses/pages/ExpensesPage.tsx`

**Interfaces:**
- Consumes: `listSavingsPots` (Task 4.3) and the `expenses.savingsPotId` / `expenses.savingsItemId` columns (Task 4.1).
- Produces:
  - `ExpenseInput.savingsPotId?: null | string` and `ExpenseInput.savingsItemId?: null | string`. **Omitted means "leave it as it is"**; `null` means paid from pay.
  - `ExpenseDraft` gains `savingsItemId?: null | string`, `savingsItemName?: null | string` and `savingsPotId?: null | string`.
  - `ExpenseDialog` gains an optional prop `savingsPots?: { id: string; name: string }[]`. When it's non-empty, the dialog shows a "Paid from" choice.

- [ ] **Step 1: Replace the expense schema**

Replace the whole of `src/modules/expenses/schemas/expense.schema.ts` with:

```ts
import { z } from "zod";

export const expenseSchema = z
  .object({
    amount: z.number().positive(),
    categoryId: z.string().uuid(),
    ownerMemberId: z.string().uuid().nullable(),
    paidByMemberId: z.string().uuid(),
    date: z.string(), // "YYYY-MM-DD"
    note: z.string().optional(),
    // The part of `amount` the other member will pay back ("pay back later").
    // Omitted = leave it as it is (edits); null = nothing to pay back.
    payBackAmount: z.number().positive().nullable().optional(),
    // Paid from a savings pot instead of from pay, optionally for one of its
    // list items. Omitted = leave it as it is (edits); null = paid from pay.
    savingsItemId: z.string().uuid().nullable().optional(),
    savingsPotId: z.string().uuid().nullable().optional(),
  })
  .refine((expense) => expense.payBackAmount == null || expense.payBackAmount <= expense.amount, {
    message: "The amount to pay back can't be more than the expense",
    path: ["payBackAmount"],
  })
  .refine((expense) => !expense.savingsItemId || Boolean(expense.savingsPotId), {
    message: "A list item needs its savings pot",
    path: ["savingsItemId"],
  })
  .refine((expense) => expense.payBackAmount == null || !expense.savingsPotId, {
    message: "An expense paid from savings can't also be paid back",
    path: ["payBackAmount"],
  });

export type ExpenseInput = z.infer<typeof expenseSchema>;
```

- [ ] **Step 2: Check the pot and item belong to the household, on create**

In `src/modules/expenses/api/expenses.actions.ts`:

**(a)** Replace:

```ts
import { expenses } from "@/db/schema";
```

with:

```ts
import { expenses, savingsItems, savingsPots } from "@/db/schema";
```

**(b)** Add this helper directly after the `assertCanPayBack` function:

```ts
// A pot must be this household's, and a list item must be on that pot.
async function assertSavingsLink(householdId: string, savingsPotId: null | string, savingsItemId: null | string) {
  if (savingsPotId === null) return;
  const [pot] = await db
    .select({ id: savingsPots.id })
    .from(savingsPots)
    .where(and(eq(savingsPots.id, savingsPotId), eq(savingsPots.householdId, householdId)));
  if (!pot) throw new ExpenseValidationError("Savings pot does not belong to this household");
  if (savingsItemId === null) return;
  const [item] = await db
    .select({ id: savingsItems.id })
    .from(savingsItems)
    .where(and(eq(savingsItems.id, savingsItemId), eq(savingsItems.potId, savingsPotId)));
  if (!item) throw new ExpenseValidationError("That list item isn't in this savings pot");
}
```

**(c)** In `createExpenseForHousehold`, replace:

```ts
  await assertCanPayBack(householdId, parsed.payBackAmount);

  const [created] = await db
```

with:

```ts
  await assertCanPayBack(householdId, parsed.payBackAmount);
  const savingsPotId = parsed.savingsPotId ?? null;
  const savingsItemId = savingsPotId === null ? null : (parsed.savingsItemId ?? null);
  await assertSavingsLink(householdId, savingsPotId, savingsItemId);

  const [created] = await db
```

and replace:

```ts
      payBackAmount: parsed.payBackAmount == null ? null : String(parsed.payBackAmount),
    })
    .returning();

  const categoryName = categories.find((c) => c.id === parsed.categoryId)?.name ?? "Unknown";
```

with:

```ts
      payBackAmount: parsed.payBackAmount == null ? null : String(parsed.payBackAmount),
      savingsItemId,
      savingsPotId,
    })
    .returning();

  const categoryName = categories.find((c) => c.id === parsed.categoryId)?.name ?? "Unknown";
```

- [ ] **Step 3: Keep the savings link on edits unless the form changes it**

Still in `expenses.actions.ts`, in `updateExpenseAction`, replace:

```ts
  await assertCanPayBack(householdId, payBackAmount);

  const [updated] = await db
```

with:

```ts
  await assertCanPayBack(householdId, payBackAmount);
  // Same rule as pay back later: omitted means "leave it as it is".
  const savingsPotId = parsed.savingsPotId === undefined ? before.savingsPotId : parsed.savingsPotId;
  const savingsItemId = savingsPotId === null ? null : parsed.savingsItemId === undefined ? before.savingsItemId : parsed.savingsItemId;
  if (savingsPotId !== null && payBackAmount !== null) {
    throw new ExpenseValidationError("An expense paid from savings can't also be paid back");
  }
  await assertSavingsLink(householdId, savingsPotId, savingsItemId);

  const [updated] = await db
```

and replace:

```ts
      payBackAmount: payBackAmount === null ? null : String(payBackAmount),
      updatedAt: new Date(),
```

with:

```ts
      payBackAmount: payBackAmount === null ? null : String(payBackAmount),
      savingsItemId,
      savingsPotId,
      updatedAt: new Date(),
```

and replace:

```ts
    changes: expenseChanges(f, before, { ...parsed, payBackAmount }),
```

with:

```ts
    changes: expenseChanges(f, before, { ...parsed, payBackAmount, savingsPotId }),
```

- [ ] **Step 4: Activity, undo and budget alerts**

In `src/modules/expenses/lib/expense-activity.ts`, replace:

```ts
  payBackAmount?: null | number | string;
};
```

with:

```ts
  payBackAmount?: null | number | string;
  savingsPotId?: null | string;
};
```

and replace:

```ts
    { format: f.money, key: "payBackAmount", label: "To be paid back" },
```

with:

```ts
    { format: f.money, key: "payBackAmount", label: "To be paid back" },
    { format: (value) => (value ? "Savings" : "Pay"), key: "savingsPotId", label: "Paid from" },
```

In `src/modules/activity/lib/revert/entities.ts`, inside `expense:`, replace:

```ts
    editable: ["amount", "categoryId", "date", "note", "ownerMemberId", "paidByMemberId", "payBackAmount"],
```

with:

```ts
    editable: ["amount", "categoryId", "date", "note", "ownerMemberId", "paidByMemberId", "payBackAmount", "savingsPotId"],
```

In `src/modules/activity/api/revert-store.ts`:

**(a)** In the big `import { … } from "@/db/schema";` list, replace:

```ts
  savingsContributions,
  savingsGoals,
} from "@/db/schema";
```

with:

```ts
  savingsContributions,
  savingsGoals,
  savingsItems,
  savingsPots,
} from "@/db/schema";
```

**(b)** In `expenseStore`, replace:

```ts
      if (!bill) values.recurringExpenseId = null;
    }
    await tx.insert(expenses).values(values);
```

with:

```ts
      if (!bill) values.recurringExpenseId = null;
    }
    // Its savings pot or list item may have gone since; like those foreign
    // keys' "set null", the expense then comes back without the link.
    if (values.savingsPotId) {
      const [pot] = await tx
        .select({ id: savingsPots.id })
        .from(savingsPots)
        .where(and(eq(savingsPots.id, values.savingsPotId), eq(savingsPots.householdId, h)));
      if (!pot) {
        values.savingsPotId = null;
        values.savingsItemId = null;
      }
    }
    if (values.savingsItemId) {
      const [item] = await tx.select({ id: savingsItems.id }).from(savingsItems).where(eq(savingsItems.id, values.savingsItemId));
      if (!item) values.savingsItemId = null;
    }
    await tx.insert(expenses).values(values);
```

In `src/modules/notifications/api/notifications.actions.ts`, inside `checkBudgetThreshold`, replace:

```ts
        eq(expenses.categoryId, categoryId),
        monthExpenseOwnerCondition,
        gte(expenses.date, monthStart),
```

with:

```ts
        eq(expenses.categoryId, categoryId),
        monthExpenseOwnerCondition,
        // Paid from savings: saved for in earlier months, so not against this budget.
        isNull(expenses.savingsPotId),
        gte(expenses.date, monthStart),
```

- [ ] **Step 5: Replace the expense dialog**

Replace the whole of `src/modules/expenses/components/ExpenseDialog.tsx` with:

```tsx
"use client";

import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { AmountInput } from "@/components/AmountInput";
import { CategoryComboboxField } from "@/components/CategoryComboboxField";
import { Modal } from "@/components/Modal";
import { NepaliDateField } from "@/components/NepaliDateField";
import { Segmented } from "@/components/Segmented";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/today";
import { cn } from "@/lib/utils";
import { createExpenseAction, updateExpenseAction } from "@/modules/expenses/api/expenses.actions";
import { type ExpenseInput, expenseSchema } from "@/modules/expenses/schemas/expense.schema";

type Member = { id: string; name: string };
type Category = { groupName: string; id: string; name: string };

export type ExpenseDraft = {
  amount: number;
  categoryId: string;
  date: string;
  note: null | string;
  ownerMemberId: null | string;
  paidByMemberId: string;
  payBackAmount?: null | number;
  savingsItemId?: null | string;
  savingsItemName?: null | string;
  savingsPotId?: null | string;
};

type Props = {
  categories: Category[];
  currentMemberId: string;
  // Edit mode when set; otherwise the dialog adds a new expense.
  expenseId?: string;
  initial?: ExpenseDraft;
  members: Member[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  // Most-used categories, offered as one-tap chips under the picker.
  quickCategoryIds?: string[];
  // Savings pots that can pay for this expense. Leave out to hide "Paid from".
  savingsPots?: { id: string; name: string }[];
};

const FORM_ID = "expense-form";
const SHARED = "shared";
const PAY = "pay";
const QUICK_CHIPS = 5;

// The Add / Edit expense dialog from the Expenses mockup. Its fields unmount
// with the dialog (Radix unmounts closed content), so every open starts from
// `initial` again; only the pending flag lives up here, for the footer button.
export function ExpenseDialog({ expenseId, onOpenChange, open, ...rest }: Props) {
  const [pending, setPending] = useState(false);
  const editing = Boolean(expenseId);

  return (
    <Modal
      className="sm:max-w-125"
      footer={
        <Button className="min-w-37.5 justify-start" disabled={pending} form={FORM_ID} type="submit">
          {pending ? "Saving..." : editing ? "Save changes" : "Add expense"}
        </Button>
      }
      hint="Enter to save · Esc to close"
      onOpenChange={onOpenChange}
      open={open}
      title={editing ? "Edit expense" : "Add expense"}
    >
      <ExpenseFields {...rest} expenseId={expenseId} onDone={() => onOpenChange(false)} onPendingChange={setPending} />
    </Modal>
  );
}

type FieldsProps = Omit<Props, "onOpenChange" | "open"> & { onDone: () => void; onPendingChange: (pending: boolean) => void };

function ExpenseFields({
  categories,
  currentMemberId,
  expenseId,
  initial,
  members,
  onDone,
  onPendingChange,
  quickCategoryIds = [],
  savingsPots = [],
}: FieldsProps) {
  const router = useRouter();
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [payBack, setPayBack] = useState(initial?.payBackAmount != null);
  const [payBackText, setPayBackText] = useState(initial?.payBackAmount != null ? String(initial.payBackAmount) : "");
  const [paidFrom, setPaidFrom] = useState<string>(initial?.savingsPotId ?? PAY);
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    setValue,
    watch,
  } = useForm<ExpenseInput>({
    defaultValues: {
      amount: initial?.amount,
      categoryId: initial?.categoryId ?? "",
      date: initial?.date ?? todayISO(),
      note: initial?.note ?? "",
      ownerMemberId: initial ? initial.ownerMemberId : currentMemberId,
      paidByMemberId: initial?.paidByMemberId ?? currentMemberId,
    },
    resolver: zodResolver(expenseSchema),
  });

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
    .map((id) => categoryOptions.find((c) => c.id === id))
    .filter((c): c is Category => c !== undefined)
    .slice(0, QUICK_CHIPS);

  function chooseOwner(value: string) {
    setValue("ownerMemberId", value === SHARED ? null : value);
    // Someone's own expense is usually paid by them; Shared keeps whoever was picked.
    if (value !== SHARED) setValue("paidByMemberId", value);
  }

  const onSubmit = handleSubmit(async (values) => {
    let payBackAmount: null | number = null;
    if (other && payBack) {
      payBackAmount = payBackText.trim() === "" ? values.amount : Number(payBackText);
      if (!(payBackAmount > 0) || payBackAmount > values.amount) {
        toast.error("The amount to pay back must be above 0 and no more than the expense");
        return;
      }
    }
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
        await updateExpenseAction(expenseId, payload);
      } else {
        await createExpenseAction(payload);
      }
      onDone();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      onPendingChange(false);
    }
  });

  return (
    <form className="flex flex-col gap-5.5" id={FORM_ID} noValidate onSubmit={onSubmit}>
      <AmountInput
        data-autofocus
        error={errors.amount ? "Enter an amount to continue" : undefined}
        label="Amount"
        size="xl"
        {...register("amount", { setValueAs: (value) => (value === "" || value === undefined ? Number.NaN : Number(value)) })}
      />

      <div>
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <CategoryComboboxField
              categories={categoryOptions}
              error={errors.categoryId ? "Choose a category" : undefined}
              label="Category"
              onCategoriesChange={(category) =>
                setCategoryOptions((prev) => (prev.some((c) => c.id === category.id) ? prev : [...prev, category]))
              }
              onValueChange={field.onChange}
              placeholder="Start typing — Lunch, Groceries…"
              value={field.value}
            />
          )}
        />
        {quick.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {quick.map((category) => (
              <button
                className={cn(
                  "border px-2.25 py-0.75 text-xs",
                  category.id === categoryId ? "border-signal text-signal-ink" : "border-n-300 text-n-800 hover:border-ink",
                )}
                key={category.id}
                onClick={() => setValue("categoryId", category.id, { shouldValidate: Boolean(errors.categoryId) })}
                type="button"
              >
                {category.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Segmented
          label="For"
          onChange={chooseOwner}
          options={[...people.map((m) => ({ label: label(m), value: m.id })), { label: "Shared", value: SHARED }]}
          value={ownerMemberId ?? SHARED}
        />
        <Segmented
          label="Paid by"
          onChange={(value) => setValue("paidByMemberId", value)}
          options={people.map((m) => ({ label: label(m), value: m.id }))}
          value={paidByMemberId}
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

      {other && (
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm text-n-800">
            <input checked={payBack} onChange={(event) => setPayBack(event.target.checked)} type="checkbox" />
            {payBackLabel}
          </label>
          {payBack && (
            <AmountInput
              label="Amount to pay back"
              onChange={(event) => setPayBackText(event.target.value)}
              placeholder="Leave empty for the full amount"
              value={payBackText}
            />
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Controller
          control={control}
          name="date"
          render={({ field }) => <NepaliDateField error={errors.date?.message} label="Date" onChange={field.onChange} value={field.value} />}
        />
        <TextField id="note" label="Note" placeholder="Optional — e.g. tea with Ram" {...register("note")} />
      </div>
    </form>
  );
}
```

- [ ] **Step 6: Offer "Paid from" on the Expenses page**

In `src/modules/expenses/components/ExpensesView.tsx`:

**(a)** Replace:

```ts
export type ExpenseRecord = Omit<ExpenseItem, "categoryName"> & { payBackAmount: null | number; recurringExpenseId: null | string };
```

with:

```ts
export type ExpenseRecord = Omit<ExpenseItem, "categoryName"> & {
  payBackAmount: null | number;
  recurringExpenseId: null | string;
  savingsItemId: null | string;
  savingsPotId: null | string;
};
```

**(b)** In `type Props`, replace:

```ts
  recurringFrequencies: Record<string, "monthly" | "quarterly" | "yearly">;
  today: string;
```

with:

```ts
  recurringFrequencies: Record<string, "monthly" | "quarterly" | "yearly">;
  savingsPots: { id: string; name: string }[];
  today: string;
```

**(c)** In the `<ExpenseDialog` at the bottom, replace:

```tsx
                payBackAmount: editing.payBackAmount,
              }
```

with:

```tsx
                payBackAmount: editing.payBackAmount,
                savingsItemId: editing.savingsItemId,
                savingsPotId: editing.savingsPotId,
              }
```

and replace:

```tsx
        open={editing !== null}
        quickCategoryIds={props.quickCategoryIds}
      />
```

with:

```tsx
        open={editing !== null}
        quickCategoryIds={props.quickCategoryIds}
        savingsPots={props.savingsPots}
      />
```

In `src/modules/expenses/pages/ExpensesPage.tsx`:

**(d)** Replace:

```ts
import { listRecurringExpenses } from "@/modules/recurring/api/recurring.actions";
```

with:

```ts
import { listRecurringExpenses } from "@/modules/recurring/api/recurring.actions";
import { listSavingsPots } from "@/modules/savings/api/savings.actions";
```

**(e)** Replace:

```ts
  const [members, categories, expenseRows, incomeRows, recurringItems] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    listExpensesForMonth(year, month, dateFormat),
    getIncomesForMonth(year, month),
    listRecurringExpenses(householdId),
  ]);
```

with:

```ts
  const [members, categories, expenseRows, incomeRows, recurringItems, savingsPots] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    listExpensesForMonth(year, month, dateFormat),
    getIncomesForMonth(year, month),
    listRecurringExpenses(householdId),
    listSavingsPots(householdId),
  ]);
```

**(f)** Replace:

```ts
    payBackAmount: e.payBackAmount === null ? null : Number(e.payBackAmount),
    recurringExpenseId: e.recurringExpenseId,
  }));
```

with:

```ts
    payBackAmount: e.payBackAmount === null ? null : Number(e.payBackAmount),
    recurringExpenseId: e.recurringExpenseId,
    savingsItemId: e.savingsItemId,
    savingsPotId: e.savingsPotId,
  }));
```

**(g)** Replace:

```tsx
      recurringFrequencies={Object.fromEntries(recurringItems.map((r) => [r.id, r.frequency]))}
```

with:

```tsx
      recurringFrequencies={Object.fromEntries(recurringItems.map((r) => [r.id, r.frequency]))}
      savingsPots={savingsPots.map((pot) => ({ id: pot.id, name: pot.name }))}
```

- [ ] **Step 7: Check types, lint and tests**

Run: `npx tsc --noEmit`. Expected: no output.
- If `revert-store.ts` complains that `values.savingsPotId` can't be `null`, check that you edited the `expenses` table in Task 4.1 Step 2.

Run: `npm run lint -- --fix`, then `npm run lint`. Expected: 0 errors.
Run: `npm test`. Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/modules/expenses src/modules/activity/lib/revert/entities.ts src/modules/activity/api/revert-store.ts src/modules/notifications/api/notifications.actions.ts
git commit -m "feat(expenses): pay an expense from a savings pot"
```

---

### Task 4.5: The Savings page

**Files:**
- Create: `src/modules/savings/index.tsx`
- Create: `src/app/(app)/savings/page.tsx`
- Create: `src/modules/savings/pages/SavingsPage.tsx`
- Create: `src/modules/savings/components/SavingsView.tsx`
- Create: `src/modules/savings/components/PotDialog.tsx`
- Create: `src/modules/savings/components/DepositDialog.tsx`
- Create: `src/modules/savings/components/ItemDialog.tsx`

**Interfaces:**
- Consumes: Task 4.2's maths, Task 4.3's list functions and actions, and Task 4.4's `ExpenseDialog` with `savingsPots`.
- Produces these exported types from `SavingsView.tsx`:
  - `PotOwnerKey = "me" | "partner" | "shared"`
  - `SavingsItemModel = { affordable: string; cost: number; id: string; name: string; neededBy: null | string; note: null | string }`
  - `SavingsDoneModel`, `SavingsDepositModel`, and `SavingsPotModel` (fields as written in the file below)
- Phase 6 extends `SavingsItemModel` and the dialogs.

- [ ] **Step 1: Create the route and module entry**

Create `src/modules/savings/index.tsx`:

```tsx
export { SavingsPage } from "./pages/SavingsPage";
```

Create `src/app/(app)/savings/page.tsx`:

```tsx
import type { Metadata } from "next";

export { SavingsPage as default } from "@/modules/savings";

export const metadata: Metadata = { title: "Savings" };
```

- [ ] **Step 2: Create the view**

Create `src/modules/savings/components/SavingsView.tsx`:

```tsx
"use client";

import { useState } from "react";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { EmptyState } from "@/components/EmptyState";
import { Ledger, LedgerCell } from "@/components/Ledger";
import { Meter } from "@/components/Meter";
import { Money } from "@/components/Money";
import { PageHeader } from "@/components/PageHeader";
import { RowMenu } from "@/components/RowMenu";
import { Row, type RowColumns, RowsHeader } from "@/components/Rows";
import { SectionHeading } from "@/components/SectionHeading";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { todayISO } from "@/lib/today";
import { ExpenseDialog } from "@/modules/expenses/components/ExpenseDialog";
import { deleteSavingsDepositAction, deleteSavingsItemAction, moveSavingsItemAction } from "@/modules/savings/api/savings.actions";
import { DepositDialog } from "@/modules/savings/components/DepositDialog";
import { ItemDialog } from "@/modules/savings/components/ItemDialog";
import { PotDialog } from "@/modules/savings/components/PotDialog";

type Member = { id: string; name: string };
type Category = { groupName: string; id: string; name: string };

export type PotOwnerKey = "me" | "partner" | "shared";
export type SavingsItemModel = { affordable: string; cost: number; id: string; name: string; neededBy: null | string; note: null | string };
export type SavingsDoneModel = { id: string; name: string; paid: number };
export type SavingsDepositModel = { amount: number; byLabel: string; dateLabel: string; id: string };
export type SavingsPotModel = {
  balance: number;
  deposits: SavingsDepositModel[];
  done: SavingsDoneModel[];
  heldByMemberId: null | string;
  id: string;
  items: SavingsItemModel[];
  name: string;
  ownerKey: PotOwnerKey;
  ownerMemberId: null | string;
  planned: number;
  plans: { memberId: string; monthlyAmount: number }[];
  putIn: number;
  reserveMinimum: number;
  reserveNote: string;
};

type Props = {
  categories: Category[];
  currentMemberId: string;
  members: Member[];
  missing: PotOwnerKey[];
  pots: SavingsPotModel[];
};

type ItemDialogState = { editing: null | SavingsItemModel; open: boolean; potId: null | string };
type PotDialogState = { editing: null | SavingsPotModel; open: boolean; ownerKey: PotOwnerKey };

const COLUMNS: RowColumns = {
  lg: "32px minmax(160px,1.6fr) minmax(0,0.9fr) minmax(0,1.1fr) 150px",
  md: "28px minmax(130px,1.4fr) minmax(0,0.9fr) minmax(0,1.1fr) 140px",
  sm: "24px minmax(110px,1.4fr) minmax(0,0.9fr) minmax(0,1fr) 128px",
};

export function SavingsView(props: Props) {
  const { currentMemberId, members } = props;
  const router = useRouter();
  const [potDialog, setPotDialog] = useState<PotDialogState>({ editing: null, open: false, ownerKey: "shared" });
  const [depositPot, setDepositPot] = useState<null | SavingsPotModel>(null);
  const [itemDialog, setItemDialog] = useState<ItemDialogState>({ editing: null, open: false, potId: null });
  const [paying, setPaying] = useState<null | { item: SavingsItemModel; pot: SavingsPotModel }>(null);

  const partner = members.find((m) => m.id !== currentMemberId) ?? null;
  const memberName = (id: null | string) => members.find((m) => m.id === id)?.name ?? null;
  const potLabel = (key: PotOwnerKey) => (key === "shared" ? "the shared pot" : key === "me" ? "my pot" : `${partner?.name ?? "Partner"}'s pot`);

  async function run(action: () => Promise<unknown>, done: string) {
    try {
      await action();
      toast.success(done);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function removeItem(item: SavingsItemModel) {
    if (!window.confirm(`Delete "${item.name}" from the list?`)) return;
    return run(() => deleteSavingsItemAction(item.id), "Item deleted");
  }

  return (
    <div>
      <PageHeader
        actions={
          props.missing.length > 0 ? (
            <>
              {props.missing.map((key) => (
                <Button
                  className="h-9.5"
                  key={key}
                  onClick={() => setPotDialog({ editing: null, open: true, ownerKey: key })}
                  type="button"
                  variant="outline"
                >
                  <Plus />
                  Set up {potLabel(key)}
                </Button>
              ))}
            </>
          ) : undefined
        }
        subtitle="What you've put aside, and when you can afford what's next"
        title="Savings"
      />

      {props.pots.length === 0 && (
        <EmptyState
          body="Set up a pot for each real savings account: the shared one, and your own if you have one. Then list what you're saving for, most important first."
          size="lg"
          title="No savings set up yet"
        />
      )}

      {props.pots.map((pot) => {
        const heldBy = memberName(pot.heldByMemberId);
        const planText =
          pot.plans.length > 0
            ? pot.plans.map((p) => `${memberName(p.memberId) ?? "Former member"} ${formatMoney(p.monthlyAmount)}`).join(" · ")
            : "Nothing planned yet";
        const short = pot.planned - pot.putIn;
        return (
          <section className="mt-11" key={pot.id}>
            <SectionHeading
              aside={
                <span className="flex items-center gap-1">
                  <Button className="h-auto px-2.5 py-1.25 text-[13px]" onClick={() => setDepositPot(pot)} type="button" variant="outline">
                    Add money
                  </Button>
                  <RowMenu items={[{ label: "Pot settings", onSelect: () => setPotDialog({ editing: pot, open: true, ownerKey: pot.ownerKey }) }]} />
                </span>
              }
              sub={heldBy ? `In ${heldBy}'s account` : undefined}
            >
              {pot.name}
            </SectionHeading>

            <Ledger>
              <LedgerCell label="Balance" lead note={`${pot.items.length} on the list`}>
                <Money size="lead" value={pot.balance} />
              </LedgerCell>
              <LedgerCell
                bar={<Meter ratio={pot.reserveMinimum > 0 ? Math.min(1, Math.max(0, pot.balance) / pot.reserveMinimum) : 1} />}
                label="Emergency reserve"
                note={pot.reserveNote}
              >
                <Money size="cell" value={pot.reserveMinimum} />
              </LedgerCell>
              <LedgerCell label="Planned a month" note={planText}>
                <Money size="cell" value={pot.planned} />
              </LedgerCell>
              <LedgerCell
                label="Put in this month"
                note={pot.planned === 0 ? "No plan set" : short > 0 ? `${formatMoney(short)} short of the plan` : "On plan"}
              >
                <Money size="cell" value={pot.putIn} />
              </LedgerCell>
            </Ledger>

            <div className="mt-8">
              <RowsHeader columns={COLUMNS}>
                <span>#</span>
                <span>Saving for</span>
                <span className="text-right">Cost</span>
                <span>Affordable</span>
                <span />
              </RowsHeader>

              {pot.items.map((item, index) => (
                <Row columns={COLUMNS} key={item.id} onClick={() => setItemDialog({ editing: item, open: true, potId: pot.id })}>
                  <span className="text-[13px] text-n-600 tabular-nums">{index + 1}</span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[15px]">{item.name}</span>
                    {item.note && <span className="truncate text-[13px] text-n-600">{item.note}</span>}
                  </div>
                  <span className="text-right text-[15px] font-semibold">
                    <Money value={item.cost} />
                  </span>
                  <span className="text-sm">{item.affordable}</span>
                  <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                    <Button className="h-auto px-1.5 py-0.75 text-[13px]" onClick={() => setPaying({ item, pot })} type="button" variant="ghost">
                      Pay for this
                    </Button>
                    <RowMenu
                      items={[
                        ...(index > 0 ? [{ label: "Move up", onSelect: () => void run(() => moveSavingsItemAction(item.id, "up"), "Moved up") }] : []),
                        ...(index < pot.items.length - 1
                          ? [{ label: "Move down", onSelect: () => void run(() => moveSavingsItemAction(item.id, "down"), "Moved down") }]
                          : []),
                        { label: "Edit", onSelect: () => setItemDialog({ editing: item, open: true, potId: pot.id }) },
                        { destructive: true, label: "Delete", onSelect: () => void removeItem(item) },
                      ]}
                    />
                  </div>
                </Row>
              ))}

              {pot.items.length === 0 && (
                <div className="border-b border-n-300 px-2 py-6 text-sm text-n-700">
                  Nothing on the list yet. Add what you&apos;re saving for, most important first.
                </div>
              )}

              <button
                className="flex w-full items-center gap-2 border-b border-n-300 px-2 py-3.5 text-left text-sm text-n-700 hover:bg-ink/4 hover:text-ink"
                onClick={() => setItemDialog({ editing: null, open: true, potId: pot.id })}
                type="button"
              >
                <Plus aria-hidden className="size-3.75" />
                Add to the list
              </button>
            </div>

            {(pot.deposits.length > 0 || pot.done.length > 0) && (
              <div className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-x-12 gap-y-8">
                {pot.deposits.length > 0 && (
                  <div className="min-w-0">
                    <div className="micro-label border-b-2 border-rule pb-2.5 text-n-600">Recent money in</div>
                    {pot.deposits.map((deposit) => (
                      <div className="grid grid-cols-[90px_minmax(0,1fr)_auto_auto] items-center gap-4 border-b border-n-300 py-2" key={deposit.id}>
                        <span className="text-[13px] text-n-600">{deposit.dateLabel}</span>
                        <span className="truncate text-sm">{deposit.byLabel}</span>
                        <span className="text-sm font-semibold">
                          <Money value={deposit.amount} />
                        </span>
                        <Button
                          className="h-auto px-1.5 py-0.5 text-[13px]"
                          onClick={() => void run(() => deleteSavingsDepositAction(deposit.id), "Entry deleted")}
                          type="button"
                          variant="ghost"
                        >
                          Delete
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {pot.done.length > 0 && (
                  <div className="min-w-0">
                    <div className="micro-label border-b-2 border-rule pb-2.5 text-n-600">Done</div>
                    {pot.done.map((item) => (
                      <div className="flex items-baseline justify-between gap-4 border-b border-n-300 py-2" key={item.id}>
                        <span className="truncate text-sm">{item.name}</span>
                        <span className="text-sm">
                          <Money value={item.paid} />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}

      <PotDialog
        currentMemberId={currentMemberId}
        editing={potDialog.editing}
        members={members}
        onOpenChange={(open) => !open && setPotDialog((prev) => ({ ...prev, editing: null, open: false }))}
        open={potDialog.open}
        ownerKey={potDialog.ownerKey}
      />

      <DepositDialog
        currentMemberId={currentMemberId}
        members={members}
        onOpenChange={(open) => !open && setDepositPot(null)}
        open={depositPot !== null}
        pot={depositPot}
      />

      <ItemDialog
        editing={itemDialog.editing}
        onOpenChange={(open) => !open && setItemDialog({ editing: null, open: false, potId: null })}
        open={itemDialog.open}
        potId={itemDialog.potId}
      />

      <ExpenseDialog
        categories={props.categories}
        currentMemberId={currentMemberId}
        initial={
          paying
            ? {
                amount: paying.item.cost,
                categoryId: "",
                date: todayISO(),
                note: paying.item.name,
                ownerMemberId: paying.pot.ownerMemberId,
                paidByMemberId: paying.pot.heldByMemberId ?? currentMemberId,
                savingsItemId: paying.item.id,
                savingsItemName: paying.item.name,
                savingsPotId: paying.pot.id,
              }
            : undefined
        }
        members={members}
        onOpenChange={(open) => !open && setPaying(null)}
        open={paying !== null}
        savingsPots={props.pots.map((pot) => ({ id: pot.id, name: pot.name }))}
      />
    </div>
  );
}
```

- [ ] **Step 3: Create the pot dialog**

Create `src/modules/savings/components/PotDialog.tsx`:

```tsx
"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AmountInput } from "@/components/AmountInput";
import { Modal } from "@/components/Modal";
import { Segmented } from "@/components/Segmented";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { createSavingsPotAction, updateSavingsPotAction } from "@/modules/savings/api/savings.actions";
import type { PotOwnerKey, SavingsPotModel } from "@/modules/savings/components/SavingsView";

type Member = { id: string; name: string };

type Props = {
  currentMemberId: string;
  editing: null | SavingsPotModel;
  members: Member[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  ownerKey: PotOwnerKey;
};

const FORM_ID = "savings-pot-form";

export function PotDialog({ onOpenChange, open, ...rest }: Props) {
  const [pending, setPending] = useState(false);

  return (
    <Modal
      className="sm:max-w-120"
      footer={
        <Button className="min-w-35 justify-start" disabled={pending} form={FORM_ID} type="submit">
          {pending ? "Saving..." : rest.editing ? "Save changes" : "Set up pot"}
        </Button>
      }
      hint="Enter to save · Esc to close"
      onOpenChange={onOpenChange}
      open={open}
      title={rest.editing ? "Pot settings" : "Set up a savings pot"}
    >
      <PotFields {...rest} onDone={() => onOpenChange(false)} onPendingChange={setPending} />
    </Modal>
  );
}

type FieldsProps = Omit<Props, "onOpenChange" | "open"> & { onDone: () => void; onPendingChange: (pending: boolean) => void };

function PotFields({ currentMemberId, editing, members, onDone, onPendingChange, ownerKey }: FieldsProps) {
  const router = useRouter();
  const partner = members.find((m) => m.id !== currentMemberId) ?? null;
  const key = editing?.ownerKey ?? ownerKey;
  const ownerMemberId = key === "shared" ? null : key === "me" ? currentMemberId : (partner?.id ?? currentMemberId);
  // A shared pot takes money from both; an individual pot only from its owner.
  const contributors = key === "shared" ? members : members.filter((m) => m.id === ownerMemberId);
  const defaultName = key === "shared" ? "Shared savings" : key === "me" ? "My savings" : `${partner?.name ?? "Partner"}'s savings`;
  const label = (m: Member) => (m.id === currentMemberId ? "Me" : m.name);
  const planFor = (memberId: string) => editing?.plans.find((p) => p.memberId === memberId)?.monthlyAmount;

  const [name, setName] = useState(editing?.name ?? defaultName);
  const [heldBy, setHeldBy] = useState(editing?.heldByMemberId ?? currentMemberId);
  const [opening, setOpening] = useState("");
  const [reserve, setReserve] = useState(editing ? String(editing.reserveMinimum) : "");
  const [plans, setPlans] = useState<Record<string, string>>(() =>
    Object.fromEntries(contributors.map((m) => [m.id, planFor(m.id) !== undefined ? String(planFor(m.id)) : ""])),
  );
  const [error, setError] = useState<string | undefined>();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Name the pot");
      return;
    }
    const common = {
      heldByMemberId: key === "shared" ? heldBy : ownerMemberId,
      name: name.trim(),
      plans: contributors.map((m) => ({ memberId: m.id, monthlyAmount: Number(plans[m.id]) || 0 })),
      reserveMinimum: Number(reserve) || 0,
    };
    onPendingChange(true);
    try {
      if (editing) {
        await updateSavingsPotAction(editing.id, common);
        toast.success("Pot updated");
      } else {
        await createSavingsPotAction({ ...common, openingBalance: Number(opening) || 0, ownerMemberId });
        toast.success("Pot set up");
      }
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
      <TextField
        data-autofocus
        error={error}
        label="Name"
        onChange={(event) => {
          setName(event.target.value);
          setError(undefined);
        }}
        value={name}
      />
      {key === "shared" && members.length > 1 && (
        <Segmented label="Whose account holds it" onChange={setHeldBy} options={members.map((m) => ({ label: label(m), value: m.id }))} value={heldBy} />
      )}
      {!editing && <AmountInput label="In the account today" onChange={(event) => setOpening(event.target.value)} placeholder="0" value={opening} />}
      <div className="flex flex-col gap-1.5">
        <AmountInput label="Emergency reserve (minimum)" onChange={(event) => setReserve(event.target.value)} placeholder="0" value={reserve} />
        <p className="text-[13px] text-n-700">This fills first, and the list never touches it.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {contributors.map((m) => (
          <AmountInput
            key={m.id}
            label={`Monthly plan · ${label(m)}`}
            onChange={(event) => setPlans((prev) => ({ ...prev, [m.id]: event.target.value }))}
            placeholder="0"
            value={plans[m.id] ?? ""}
          />
        ))}
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Create the money-in dialog**

Create `src/modules/savings/components/DepositDialog.tsx`:

```tsx
"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AmountInput } from "@/components/AmountInput";
import { Modal } from "@/components/Modal";
import { MoreDetails } from "@/components/MoreDetails";
import { NepaliDateField } from "@/components/NepaliDateField";
import { Segmented } from "@/components/Segmented";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/today";
import { addSavingsDepositAction } from "@/modules/savings/api/savings.actions";
import type { SavingsPotModel } from "@/modules/savings/components/SavingsView";

type Member = { id: string; name: string };

type Props = {
  currentMemberId: string;
  members: Member[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pot: null | SavingsPotModel;
};

const FORM_ID = "savings-deposit-form";

export function DepositDialog({ currentMemberId, members, onOpenChange, open, pot }: Props) {
  const [pending, setPending] = useState(false);

  return (
    <Modal
      className="sm:max-w-105"
      footer={
        <Button className="min-w-30 justify-start" disabled={pending} form={FORM_ID} type="submit">
          {pending ? "Adding..." : "Add"}
        </Button>
      }
      hint="Enter to add · Esc to close"
      onOpenChange={onOpenChange}
      open={open}
      subtitle={pot?.name}
      title="Add money"
    >
      {pot && (
        <DepositFields currentMemberId={currentMemberId} members={members} onDone={() => onOpenChange(false)} onPendingChange={setPending} pot={pot} />
      )}
    </Modal>
  );
}

type FieldsProps = {
  currentMemberId: string;
  members: Member[];
  onDone: () => void;
  onPendingChange: (pending: boolean) => void;
  pot: SavingsPotModel;
};

function DepositFields({ currentMemberId, members, onDone, onPendingChange, pot }: FieldsProps) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [memberId, setMemberId] = useState(pot.ownerMemberId ?? currentMemberId);
  const [error, setError] = useState<string | undefined>();
  const label = (m: Member) => (m.id === currentMemberId ? "Me" : m.name);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!(Number(amount) > 0)) {
      setError("Enter an amount");
      return;
    }
    onPendingChange(true);
    try {
      await addSavingsDepositAction(pot.id, { amount: Number(amount), date, kind: "deposit", memberId });
      toast.success("Money added");
      onDone();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add");
    } finally {
      onPendingChange(false);
    }
  }

  return (
    <form className="flex flex-col gap-5.5" id={FORM_ID} noValidate onSubmit={onSubmit}>
      <AmountInput
        data-autofocus
        error={error}
        label="Amount"
        onChange={(event) => {
          setAmount(event.target.value);
          setError(undefined);
        }}
        size="xl"
        value={amount}
      />
      <MoreDetails>
        <NepaliDateField label="Date" onChange={setDate} value={date} />
        {pot.ownerMemberId === null && (
          <Segmented label="Put in by" onChange={setMemberId} options={members.map((m) => ({ label: label(m), value: m.id }))} value={memberId} />
        )}
      </MoreDetails>
    </form>
  );
}
```

- [ ] **Step 5: Create the list-item dialog**

Create `src/modules/savings/components/ItemDialog.tsx`:

```tsx
"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AmountInput } from "@/components/AmountInput";
import { Modal } from "@/components/Modal";
import { MoreDetails } from "@/components/MoreDetails";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { createSavingsItemAction, updateSavingsItemAction } from "@/modules/savings/api/savings.actions";
import type { SavingsItemModel } from "@/modules/savings/components/SavingsView";

type Props = {
  editing: null | SavingsItemModel;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  potId: null | string;
};

const FORM_ID = "savings-item-form";
const NAME_ERROR = "Say what you're saving for";
const COST_ERROR = "Enter what it should cost";

export function ItemDialog({ editing, onOpenChange, open, potId }: Props) {
  const [pending, setPending] = useState(false);

  return (
    <Modal
      className="sm:max-w-110"
      footer={
        <Button className="min-w-30 justify-start" disabled={pending} form={FORM_ID} type="submit">
          {pending ? "Saving..." : editing ? "Save changes" : "Add"}
        </Button>
      }
      hint="Enter to save · Esc to close"
      onOpenChange={onOpenChange}
      open={open}
      title={editing ? "Edit list item" : "Add to the list"}
    >
      {(editing !== null || potId !== null) && (
        <ItemFields editing={editing} onDone={() => onOpenChange(false)} onPendingChange={setPending} potId={potId} />
      )}
    </Modal>
  );
}

type FieldsProps = { editing: null | SavingsItemModel; onDone: () => void; onPendingChange: (pending: boolean) => void; potId: null | string };

function ItemFields({ editing, onDone, onPendingChange, potId }: FieldsProps) {
  const router = useRouter();
  const [name, setName] = useState(editing?.name ?? "");
  const [cost, setCost] = useState(editing ? String(editing.cost) : "");
  const [note, setNote] = useState(editing?.note ?? "");
  const [error, setError] = useState<string | undefined>();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError(NAME_ERROR);
      return;
    }
    if (!(Number(cost) > 0)) {
      setError(COST_ERROR);
      return;
    }
    // neededBy is kept as it is; Phase 6 adds a field for it.
    const payload = { cost: Number(cost), name: name.trim(), neededBy: editing?.neededBy ?? null, note: note.trim() || undefined };
    onPendingChange(true);
    try {
      if (editing) await updateSavingsItemAction(editing.id, payload);
      else if (potId) await createSavingsItemAction(potId, payload);
      toast.success(editing ? "Item updated" : "Added to the list");
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
      <TextField
        data-autofocus
        error={error === NAME_ERROR ? error : undefined}
        label="What you're saving for"
        onChange={(event) => {
          setName(event.target.value);
          setError(undefined);
        }}
        placeholder="e.g. Mum's surgery"
        value={name}
      />
      <AmountInput
        error={error === COST_ERROR ? error : undefined}
        label="Estimated cost"
        onChange={(event) => {
          setCost(event.target.value);
          setError(undefined);
        }}
        size="xl"
        value={cost}
      />
      <MoreDetails>
        <TextField label="Note" onChange={(event) => setNote(event.target.value)} placeholder="Optional" value={note} />
      </MoreDetails>
    </form>
  );
}
```

- [ ] **Step 6: Create the server page**

Create `src/modules/savings/pages/SavingsPage.tsx`:

```tsx
import { formatShortDate } from "@/lib/date-format";
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { formatMoney } from "@/lib/money";
import { currentPeriodYearMonth, formatPeriodLabel, resolvePeriod } from "@/lib/month-period";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { listCategories } from "@/modules/categories/api/categories";
import {
  listSavingsDeposits,
  listSavingsExpenses,
  listSavingsItems,
  listSavingsPotPlans,
  listSavingsPots,
} from "@/modules/savings/api/savings.actions";
import { type PotOwnerKey, type SavingsPotModel, SavingsView } from "@/modules/savings/components/SavingsView";
import { forecastPot, monthAfter } from "@/modules/savings/lib/savings-forecast";
import { potBalance, putInBetween } from "@/modules/savings/lib/savings-math";

const DEPOSITS_SHOWN = 5;
// Shared pot first, then mine, then my partner's.
const POT_ORDER: Record<PotOwnerKey, number> = { me: 1, partner: 2, shared: 0 };

export async function SavingsPage() {
  const { householdId, memberId } = await getCurrentMember();
  const dateFormat = await getDateFormatPref(householdId);
  const current = currentPeriodYearMonth(dateFormat);
  const period = resolvePeriod(current.year, current.month, dateFormat);

  const [members, categories, potRows, planRows, itemRows, depositRows, spendRows] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    listSavingsPots(householdId),
    listSavingsPotPlans(householdId),
    listSavingsItems(householdId),
    listSavingsDeposits(householdId),
    listSavingsExpenses(householdId),
  ]);

  const partner = members.find((m) => m.id !== memberId) ?? null;
  const nameOf = (id: null | string) => members.find((m) => m.id === id)?.user.name ?? null;
  const ownerKeyOf = (ownerMemberId: null | string): PotOwnerKey =>
    ownerMemberId === null ? "shared" : ownerMemberId === memberId ? "me" : "partner";
  const monthLabel = (months: number) => {
    const when = monthAfter(current.year, current.month, months);
    return formatPeriodLabel(when.year, when.month, dateFormat);
  };
  const affordableText = (months: null | number) =>
    months === null ? "Not on the current plan" : months === 0 ? "Affordable now" : `In ${monthLabel(months)}`;

  const deposits = depositRows.map((d) => ({ amount: Number(d.amount), date: d.date, id: d.id, kind: d.kind, memberId: d.memberId, potId: d.potId }));
  const spends = spendRows.flatMap((e) =>
    e.savingsPotId ? [{ amount: Number(e.amount), savingsItemId: e.savingsItemId, savingsPotId: e.savingsPotId }] : [],
  );
  const paidByItem = new Map<string, number>();
  for (const spend of spends) {
    if (spend.savingsItemId) paidByItem.set(spend.savingsItemId, (paidByItem.get(spend.savingsItemId) ?? 0) + spend.amount);
  }

  const pots: SavingsPotModel[] = potRows
    .map((pot) => {
      const balance = potBalance(pot.id, deposits, spends);
      const reserveMinimum = Number(pot.reserveMinimum);
      const plans = planRows.filter((p) => p.potId === pot.id).map((p) => ({ memberId: p.memberId, monthlyAmount: Number(p.monthlyAmount) }));
      const planned = plans.reduce((sum, p) => sum + p.monthlyAmount, 0);
      const potItems = itemRows.filter((i) => i.potId === pot.id);
      const open = potItems.filter((i) => !paidByItem.has(i.id));
      const forecast = forecastPot({
        balance,
        items: open.map((i) => ({ cost: Number(i.cost), id: i.id })),
        monthlyInflow: planned,
        reserveMinimum,
      });
      const toGo = reserveMinimum - balance;
      const reserveNote =
        reserveMinimum <= 0
          ? "No reserve set"
          : toGo <= 0
            ? "Full"
            : forecast.reserveFullInMonths === null
              ? `${formatMoney(toGo)} to go`
              : `${formatMoney(toGo)} to go, full ${forecast.reserveFullInMonths === 0 ? "now" : `in ${monthLabel(forecast.reserveFullInMonths)}`}`;
      return {
        balance,
        deposits: deposits
          .filter((d) => d.potId === pot.id)
          .slice(0, DEPOSITS_SHOWN)
          .map((d) => ({
            amount: d.amount,
            byLabel: d.kind === "opening" ? "Opening balance" : d.kind === "interest" ? "Bank interest" : (nameOf(d.memberId) ?? "Former member"),
            dateLabel: formatShortDate(d.date, dateFormat),
            id: d.id,
          })),
        done: potItems.filter((i) => paidByItem.has(i.id)).map((i) => ({ id: i.id, name: i.name, paid: paidByItem.get(i.id) ?? 0 })),
        heldByMemberId: pot.heldByMemberId,
        id: pot.id,
        items: open.map((i, index) => ({
          affordable: affordableText(forecast.items[index].monthsFromNow),
          cost: Number(i.cost),
          id: i.id,
          name: i.name,
          neededBy: i.neededBy,
          note: i.note,
        })),
        name: pot.name,
        ownerKey: ownerKeyOf(pot.ownerMemberId),
        ownerMemberId: pot.ownerMemberId,
        planned,
        plans,
        putIn: putInBetween(pot.id, deposits, period.startDate, period.endDate),
        reserveMinimum,
        reserveNote,
      };
    })
    .sort((a, b) => POT_ORDER[a.ownerKey] - POT_ORDER[b.ownerKey]);

  const existing = new Set(pots.map((pot) => pot.ownerKey));
  const possible: PotOwnerKey[] = partner ? ["shared", "me", "partner"] : ["shared", "me"];

  return (
    <SavingsView
      categories={categories.map((c) => ({ groupName: c.groupName, id: c.id, name: c.name }))}
      currentMemberId={memberId}
      members={members.map((m) => ({ id: m.id, name: m.user.name }))}
      missing={possible.filter((key) => !existing.has(key))}
      pots={pots}
    />
  );
}
```

- [ ] **Step 7: Check types, lint and tests**

Run: `npx tsc --noEmit`. Expected: no output.
Run: `npm run lint -- --fix`, then `npm run lint`. Expected: 0 errors.
Run: `npm test`. Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/modules/savings "src/app/(app)/savings"
git commit -m "feat(savings): Savings page with pots, reserve and priority list"
```

---

### Task 4.6: Home, Reports and Budget use the new savings

**Files:**
- Modify (replace the whole file): `src/modules/dashboard/pages/DashboardPage.tsx`
- Modify: `src/modules/dashboard/components/HomeView.tsx`
- Modify (replace the whole file): `src/modules/reports/pages/ReportsPage.tsx`
- Modify: `src/modules/reports/components/ReportsView.tsx`
- Modify (replace the whole file): `src/modules/budget/pages/BudgetPage.tsx`
- Modify: `src/modules/budget/components/BudgetView.tsx`
- Modify: `e2e/dashboard.spec.ts`
- Modify: `e2e/reports.spec.ts`

**Interfaces:**
- Consumes: Task 4.2's maths and Task 4.3's list functions.
- Produces:
  - HomeView prop `savings: HomeSavingsPot[]`, where `HomeSavingsPot = { balance: number; id: string; name: string; next: null | string; reserveFull: boolean }`.
  - `ledger.paidFromSavings: number`.
  - The props `goals` and `savingsBudgetAmount` are removed.
  - ReportsView `savings` prop: `{ deposits; paidFromSavings; pots; putIn; putInByPerson }` (shapes as written below).
  - BudgetView prop `savings: { planned: number; pots: { id: string; name: string; planned: number; putIn: number }[]; putIn: number }`.

- [ ] **Step 1: Replace the Home page server component**

Replace the whole of `src/modules/dashboard/pages/DashboardPage.tsx` with:

```tsx
import { formatShortDate } from "@/lib/date-format";
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { buildMonthNav, parseMonthParam, previousMonth } from "@/lib/month-nav";
import {
  currentPeriodYearMonth,
  daysElapsedInPeriod,
  formatPeriodLabel,
  MAX_NAVIGABLE_YEAR,
  MIN_NAVIGABLE_YEAR,
  resolvePeriod,
} from "@/lib/month-period";
import { getEffectiveMember, getHouseholdMembers } from "@/lib/session";
import { todayISO } from "@/lib/today";
import { getBudgetItemsForMonth, getIncomesForMonth } from "@/modules/budget/api/budget.actions";
import { dashboardSummary } from "@/modules/budget/lib/calculations";
import { listCategories } from "@/modules/categories/api/categories";
import {
  type HomeOwnerRow,
  type HomePacing,
  type HomeRecentGroup,
  type HomeSavingsPot,
  HomeView,
} from "@/modules/dashboard/components/HomeView";
import { allowanceSpentByDay, daysLeftInMonth } from "@/modules/dashboard/lib/cash-flow";
import { toExpenseInputs, toIncomeInputs } from "@/modules/dashboard/lib/map-rows";
import { buildPacingSchedule, currentWeekPacing } from "@/modules/dashboard/lib/pacing";
import { walletSpentByMember } from "@/modules/dashboard/lib/wallet";
import { listExpensesForMonth, listRecentExpenses } from "@/modules/expenses/api/expenses.actions";
import { groupByDay } from "@/modules/expenses/lib/expense-view";
import { checkBudgetReminder } from "@/modules/notifications/api/notifications.actions";
import { listPayBackExpenses, listPaybacks } from "@/modules/paybacks/api/paybacks.actions";
import { paybackBalance } from "@/modules/paybacks/lib/payback-balance";
import {
  listSavingsDeposits,
  listSavingsExpenses,
  listSavingsItems,
  listSavingsPotPlans,
  listSavingsPots,
} from "@/modules/savings/api/savings.actions";
import { forecastPot, monthAfter } from "@/modules/savings/lib/savings-forecast";
import { potBalance, putInBetween } from "@/modules/savings/lib/savings-math";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PAYBACKS_SHOWN = 3;

function trendPct(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function percent(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

function weekdayOf(startDate: string, dayOfPeriod: number): string {
  const [year, month, day] = startDate.split("-").map(Number);
  return WEEKDAYS[new Date(year, month - 1, day + dayOfPeriod - 1).getDay()];
}

type Props = { searchParams: Promise<{ month?: string; year?: string }> };

export async function DashboardPage({ searchParams }: Props) {
  const { householdId, memberId } = await getEffectiveMember();
  const dateFormat = await getDateFormatPref(householdId);
  const params = await searchParams;
  const { year: currentYear, month: currentMonth } = currentPeriodYearMonth(dateFormat);
  const year = parseMonthParam(params.year, currentYear, MAX_NAVIGABLE_YEAR[dateFormat], MIN_NAVIGABLE_YEAR[dateFormat]);
  const month = parseMonthParam(params.month, currentMonth, 12);
  const prev = previousMonth(year, month);
  const isCurrentMonth = year === currentYear && month === currentMonth;

  const [
    members,
    categories,
    incomeRows,
    budgetItemRows,
    expenseRows,
    prevIncomeRows,
    prevExpenseRows,
    recentExpenseRows,
    paybackRows,
    payBackExpenseRows,
    potRows,
    planRows,
    itemRows,
    depositRows,
    savingsSpendRows,
  ] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    getIncomesForMonth(year, month),
    getBudgetItemsForMonth(year, month),
    listExpensesForMonth(year, month, dateFormat),
    getIncomesForMonth(prev.year, prev.month),
    listExpensesForMonth(prev.year, prev.month, dateFormat),
    listRecentExpenses(5),
    listPaybacks(householdId),
    listPayBackExpenses(householdId),
    listSavingsPots(householdId),
    listSavingsPotPlans(householdId),
    listSavingsItems(householdId),
    listSavingsDeposits(householdId),
    listSavingsExpenses(householdId),
  ]);

  if (isCurrentMonth) {
    await checkBudgetReminder(householdId, year, month, budgetItemRows.length);
  }

  // Expenses paid from a savings pot came out of money set aside over many
  // months, not this month's pay. Spent, Left and the weekly allowance leave
  // them out; Home shows them on their own.
  const payExpenseRows = expenseRows.filter((e) => e.savingsPotId === null);
  const paidFromSavings = expenseRows.filter((e) => e.savingsPotId !== null).reduce((s, e) => s + Number(e.amount), 0);

  const incomes = toIncomeInputs(incomeRows);
  const expenses = toExpenseInputs(payExpenseRows);
  const summary = dashboardSummary(incomes, expenses);

  const prevIncomes = toIncomeInputs(prevIncomeRows);
  const prevExpensesList = toExpenseInputs(prevExpenseRows.filter((e) => e.savingsPotId === null));
  const prevSummary = dashboardSummary(prevIncomes, prevExpensesList);

  const category = (id: string) => categories.find((c) => c.id === id);
  const memberName = (id: string) => members.find((m) => m.id === id)?.user.name ?? "Member";

  // Each person's Spent is what left their own wallet: counted by who paid,
  // with any "to be paid back" part moved onto the other person. Shared
  // expenses get their own row, for information only.
  const wallet = walletSpentByMember(
    payExpenseRows.map((e) => ({
      amount: Number(e.amount),
      paidByMemberId: e.paidByMemberId,
      payBackAmount: e.payBackAmount === null ? null : Number(e.payBackAmount),
    })),
    members.map((m) => m.id),
  );
  const ownerSpent = (ownerId: null | string) =>
    ownerId === null ? expenses.filter((e) => e.ownerMemberId === null).reduce((s, e) => s + e.amount, 0) : (wallet.get(ownerId) ?? 0);
  const ownerIncome = (id: string) => incomes.find((i) => i.memberId === id)?.amount ?? 0;
  const prevOwnerIncome = (id: string) => prevIncomes.find((i) => i.memberId === id)?.amount ?? 0;

  const partner = members.find((m) => m.id !== memberId);
  const meMonogram = { name: memberName(memberId), role: "me" as const };
  const partnerMonogram = partner ? { name: partner.user.name, role: "partner" as const } : null;

  const meIncome = ownerIncome(memberId);
  const meSpent = ownerSpent(memberId);
  const meLeft = meIncome - meSpent;
  const partnerIncome = partner ? ownerIncome(partner.id) : 0;
  const partnerSpent = partner ? ownerSpent(partner.id) : 0;
  const partnerLeft = partnerIncome - partnerSpent;

  const owners: HomeOwnerRow[] = [
    {
      income: meIncome,
      incomeTrendPct: trendPct(meIncome, prevOwnerIncome(memberId)),
      incomeUsedPct: percent(meSpent, meIncome),
      incomeUsedRatio: meIncome > 0 ? meSpent / meIncome : meSpent > 0 ? Number.POSITIVE_INFINITY : 0,
      key: "me",
      label: "Me",
      left: meLeft,
      leftNote: meLeft < 0 ? "over income" : `${percent(meSpent, meIncome) ?? 0}% of income`,
      monogram: [meMonogram],
      spent: meSpent,
    },
    ...(partner
      ? [
          {
            income: partnerIncome,
            incomeTrendPct: trendPct(partnerIncome, prevOwnerIncome(partner.id)),
            incomeUsedPct: percent(partnerSpent, partnerIncome),
            incomeUsedRatio: partnerIncome > 0 ? partnerSpent / partnerIncome : partnerSpent > 0 ? Number.POSITIVE_INFINITY : 0,
            key: "partner" as const,
            label: partner.user.name,
            left: partnerLeft,
            leftNote: partnerLeft < 0 ? "over income" : `${percent(partnerSpent, partnerIncome) ?? 0}% of income`,
            monogram: partnerMonogram ? [partnerMonogram] : [],
            spent: partnerSpent,
          },
        ]
      : []),
    {
      income: null,
      incomeTrendPct: null,
      incomeUsedPct: null,
      incomeUsedRatio: null,
      key: "shared",
      label: "Spent on us",
      left: null,
      leftNote: null,
      monogram: partnerMonogram ? [meMonogram, partnerMonogram] : [meMonogram],
      spent: ownerSpent(null),
    },
  ];

  // Weekly pacing over the flexible part of the budget (fixed commitments are
  // already spoken for): the hero's safe-to-spend figure and its carry-over.
  // Fixed-category expenses don't count against it, for the same reason.
  const period = resolvePeriod(year, month, dateFormat);
  const flexiblePlanned = budgetItemRows
    .filter((b) => category(b.categoryId)?.budgetType === "flexible")
    .reduce((s, b) => s + Number(b.plannedAmount), 0);
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
    ? paybackBalance(
        payBackExpenseRows.flatMap((e) =>
          e.payBackAmount === null
            ? []
            : [{ amount: Number(e.amount), paidByMemberId: e.paidByMemberId, payBackAmount: Number(e.payBackAmount) }],
        ),
        paybackRows.map((p) => ({ amount: Number(p.amount), fromMemberId: p.fromMemberId, toMemberId: p.toMemberId })),
        [memberId, partner.id],
      )
    : null;
  const recentPaybacks = paybackRows.slice(0, PAYBACKS_SHOWN).map((p) => ({
    amount: Number(p.amount),
    dateLabel: formatShortDate(p.date, dateFormat),
    fromName: memberName(p.fromMemberId),
    id: p.id,
    toName: memberName(p.toMemberId),
  }));

  // Savings pots: balance, whether the reserve is full, and the next thing on
  // the list with when it becomes affordable (counted from this month).
  const deposits = depositRows.map((d) => ({ amount: Number(d.amount), date: d.date, kind: d.kind, memberId: d.memberId, potId: d.potId }));
  const spends = savingsSpendRows.flatMap((e) =>
    e.savingsPotId ? [{ amount: Number(e.amount), savingsItemId: e.savingsItemId, savingsPotId: e.savingsPotId }] : [],
  );
  const doneItemIds = new Set(spends.flatMap((s) => (s.savingsItemId ? [s.savingsItemId] : [])));
  const whenAffordable = (months: null | number) => {
    if (months === null) return "not on the current plan";
    if (months === 0) return "affordable now";
    const when = monthAfter(currentYear, currentMonth, months);
    return `in ${formatPeriodLabel(when.year, when.month, dateFormat)}`;
  };
  const savings: HomeSavingsPot[] = potRows.map((pot) => {
    const balance = potBalance(pot.id, deposits, spends);
    const reserveMinimum = Number(pot.reserveMinimum);
    const planned = planRows.filter((p) => p.potId === pot.id).reduce((s, p) => s + Number(p.monthlyAmount), 0);
    const open = itemRows.filter((i) => i.potId === pot.id && !doneItemIds.has(i.id));
    const forecast = forecastPot({ balance, items: open.map((i) => ({ cost: Number(i.cost), id: i.id })), monthlyInflow: planned, reserveMinimum });
    return {
      balance,
      id: pot.id,
      name: pot.name,
      next: open.length > 0 ? `Next: ${open[0].name}, ${whenAffordable(forecast.items[0].monthsFromNow)}` : null,
      reserveFull: balance >= reserveMinimum,
    };
  });
  const saved = potRows.reduce((s, pot) => s + putInBetween(pot.id, deposits, period.startDate, period.endDate), 0);

  const categoryName = (id: string) => category(id)?.name ?? "Unknown";
  const recent: HomeRecentGroup[] = groupByDay(
    recentExpenseRows.map((e) => ({
      amount: Number(e.amount),
      categoryId: e.categoryId,
      categoryName: categoryName(e.categoryId),
      date: e.date,
      id: e.id,
      note: e.note,
      ownerMemberId: e.ownerMemberId,
      paidByMemberId: e.paidByMemberId,
    })),
    { dateFormat, today: todayISO() },
  ).map((group) => ({
    key: group.date,
    label: group.label,
    rows: group.rows.map((row) => ({
      amount: row.amount,
      categoryGroupName: category(row.categoryId)?.groupName ?? "",
      categoryIcon: category(row.categoryId)?.icon ?? null,
      categoryName: row.categoryName,
      id: row.id,
      note: row.note,
    })),
    sub: group.sub,
    total: group.total,
  }));

  const monthLabel = formatPeriodLabel(year, month, dateFormat);

  return (
    <HomeView
      currentMemberId={memberId}
      daysLeft={daysLeftInMonth(year, month, dateFormat)}
      incomes={Object.fromEntries(incomes.map((i) => [i.memberId, i.amount]))}
      ledger={{
        income: summary.combinedIncome,
        incomeTrendPct: trendPct(summary.combinedIncome, prevSummary.combinedIncome),
        paidFromSavings,
        saved,
        savedNote: saved === 0 ? "Nothing put in yet" : "Put into savings this month",
        spent: summary.totalExpenses,
        spentMeterRatio: summary.combinedIncome > 0 ? summary.totalExpenses / summary.combinedIncome : 0,
        spentPctOfIncome: percent(summary.totalExpenses, summary.combinedIncome),
        spentTrendPct: trendPct(summary.totalExpenses, prevSummary.totalExpenses),
        unallocated: summary.unallocated,
      }}
      members={members.map((m) => ({ id: m.id, name: m.user.name }))}
      month={month}
      monthNav={buildMonthNav({ basePath: "/dashboard", current: { month: currentMonth, year: currentYear }, dateFormat, selected: { month, year } })}
      owners={owners}
      pacing={pacing}
      payback={payback}
      prevMonthName={formatPeriodLabel(prev.year, prev.month, dateFormat).split(" ")[0]}
      recent={recent}
      recentPaybacks={recentPaybacks}
      savings={savings}
      spentMonthName={monthLabel.split(" ")[0]}
      year={year}
    />
  );
}
```

- [ ] **Step 2: Update the Home view**

In `src/modules/dashboard/components/HomeView.tsx`:

**(a)** Replace:

```tsx
export type HomeGoal = { id: string; name: string; pct: null | number; saved: number; targetAmount: null | number };
```

with:

```tsx
export type HomeSavingsPot = { balance: number; id: string; name: string; next: null | string; reserveFull: boolean };
```

**(b)** Replace:

```tsx
  daysLeft: number;
  goals: HomeGoal[];
  incomes: Record<string, number>;
```

with:

```tsx
  daysLeft: number;
  incomes: Record<string, number>;
```

**(c)** Replace:

```tsx
    incomeTrendPct: null | number;
    saved: number;
```

with:

```tsx
    incomeTrendPct: null | number;
    paidFromSavings: number;
    saved: number;
```

**(d)** Replace:

```tsx
  recentPaybacks: HomePaybackRow[];
  savingsBudgetAmount: null | number;
  spentMonthName: string;
```

with:

```tsx
  recentPaybacks: HomePaybackRow[];
  savings: HomeSavingsPot[];
  spentMonthName: string;
```

**(e)** Replace:

```tsx
              {spentTrend && <span>{spentTrend}</span>}
            </>
```

with:

```tsx
              {spentTrend && <span>{spentTrend}</span>}
              {ledger.paidFromSavings > 0 && <span>{formatMoney(ledger.paidFromSavings)} paid from savings</span>}
            </>
```

**(f)** Find the `<section className="min-w-0">` whose first child is `<SectionHeading aside={<ArrowLink href="/savings-goals">All goals</ArrowLink>}>Savings goals</SectionHeading>`. Replace **that whole section**, from its opening `<section className="min-w-0">` down to its own closing `</section>`, with:

```tsx
        <section className="min-w-0">
          <SectionHeading aside={<ArrowLink href="/savings">All savings</ArrowLink>}>Savings</SectionHeading>
          {props.savings.length === 0 ? (
            <EmptyState
              action={
                <Button asChild variant="outline">
                  <Link href="/savings">
                    <Plus />
                    Set up savings
                  </Link>
                </Button>
              }
              body="Set up a pot for your savings account and list what you're saving for. Piko shows when each one becomes affordable."
              title="No savings set up yet"
            />
          ) : (
            <div className="flex flex-col">
              {props.savings.map((pot) => (
                <div className="flex flex-col gap-1 border-b border-n-300 py-4" key={pot.id}>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-[15px] font-semibold">{pot.name}</span>
                    <span className="text-[15px] font-semibold">
                      <Money value={pot.balance} />
                    </span>
                  </div>
                  <span className="text-[13px] text-n-600">
                    {pot.reserveFull ? "Reserve full" : "Filling the reserve first"}
                    {pot.next ? ` · ${pot.next}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
```

Leave the "Recent expenses" section next to it untouched.

- [ ] **Step 3: Replace the Reports page server component**

Replace the whole of `src/modules/reports/pages/ReportsPage.tsx` with:

```tsx
import { formatShortDate } from "@/lib/date-format";
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { buildMonthNav, parseMonthParam, previousMonth } from "@/lib/month-nav";
import {
  currentPeriodYearMonth,
  dayNumberInPeriod,
  daysElapsedInPeriod,
  formatPeriodLabel,
  MAX_NAVIGABLE_YEAR,
  MIN_NAVIGABLE_YEAR,
  resolvePeriod,
} from "@/lib/month-period";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { getBudgetItemsForMonth, getIncomesForMonth, listAllIncomes } from "@/modules/budget/api/budget.actions";
import { listCategories } from "@/modules/categories/api/categories";
import { pctOfIncome } from "@/modules/dashboard/lib/format";
import { listExpensesForMonth, listExpensesForRange } from "@/modules/expenses/api/expenses.actions";
import { roleForOwner } from "@/modules/expenses/lib/member-tone";
import { ReportsView } from "@/modules/reports/components/ReportsView";
import {
  budgetVsActual,
  categoryBreakdown,
  categoryChanges,
  dailySpendingPace,
  monthlyIncomeExpenseTrend,
  topExpenses,
  trendPct,
} from "@/modules/reports/lib/reports-stats";
import { expenseLead } from "@/modules/reports/lib/reports-view";
import { listSavingsDeposits, listSavingsExpenses, listSavingsPots } from "@/modules/savings/api/savings.actions";
import { potBalance, putInBetween } from "@/modules/savings/lib/savings-math";

type Props = { searchParams: Promise<{ month?: string; year?: string }> };

export async function ReportsPage({ searchParams }: Props) {
  const { householdId, memberId } = await getCurrentMember();
  const dateFormat = await getDateFormatPref(householdId);
  const params = await searchParams;
  const { year: currentYear, month: currentMonth } = currentPeriodYearMonth(dateFormat);
  const year = parseMonthParam(params.year, currentYear, MAX_NAVIGABLE_YEAR[dateFormat], MIN_NAVIGABLE_YEAR[dateFormat]);
  const month = parseMonthParam(params.month, currentMonth, 12);
  const prev = previousMonth(year, month);
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
    rangeExpenseRows,
    potRows,
    depositRows,
    savingsSpendRows,
  ] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    getIncomesForMonth(year, month),
    getIncomesForMonth(prev.year, prev.month),
    listAllIncomes(),
    getBudgetItemsForMonth(year, month),
    listExpensesForMonth(year, month, dateFormat),
    listExpensesForMonth(prev.year, prev.month, dateFormat),
    listExpensesForRange(rangeStart, period.endDate),
    listSavingsPots(householdId),
    listSavingsDeposits(householdId),
    listSavingsExpenses(householdId),
  ]);

  // Spending from pay only, the same Spent as Home and Budget. Expenses paid
  // from savings are listed on the Savings tab instead.
  const payExpenseRows = expenseRows.filter((e) => e.savingsPotId === null);
  const payPrevExpenseRows = prevExpenseRows.filter((e) => e.savingsPotId === null);
  const payRangeExpenseRows = rangeExpenseRows.filter((e) => e.savingsPotId === null);

  const memberById = new Map(members.map((m) => [m.id, m]));
  const category = (id: string) => categories.find((c) => c.id === id);
  const categoryName = (id: string) => category(id)?.name ?? "Unknown";

  const expenses = payExpenseRows.map((e) => ({ amount: Number(e.amount), categoryId: e.categoryId, ownerMemberId: e.ownerMemberId }));
  const combinedIncome = incomeRows.reduce((s, i) => s + Number(i.amount), 0);
  const prevIncome = prevIncomeRows.reduce((s, i) => s + Number(i.amount), 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const prevTotalExpenses = payPrevExpenseRows.reduce((s, e) => s + Number(e.amount), 0);

  const budgetLines = budgetVsActual(
    budgetItemRows.map((b) => ({ categoryId: b.categoryId, plannedAmount: Number(b.plannedAmount) })),
    expenses,
    categories,
  );
  const changes = categoryChanges(
    expenses,
    payPrevExpenseRows.map((e) => ({ amount: Number(e.amount), categoryId: e.categoryId })),
    categories,
  );
  const slices = categoryBreakdown(expenses, categories);
  const largest = topExpenses(
    payExpenseRows.map((e) => ({
      amount: Number(e.amount),
      categoryName: categoryName(e.categoryId),
      date: e.date,
      groupName: category(e.categoryId)?.groupName ?? "Other",
      id: e.id,
      note: e.note,
    })),
  ).map((row) => ({
    amount: row.amount,
    categoryName: row.categoryName,
    dateLabel: formatShortDate(row.date, dateFormat),
    id: row.id,
    name: row.note ?? row.categoryName,
  }));

  const ownerSlice = (ownerId: null | string) =>
    expenses.filter((e) => e.ownerMemberId === ownerId).reduce((s, e) => s + e.amount, 0);
  const partner = members.find((m) => m.id !== memberId) ?? null;
  const ownerSlices = [
    { amount: ownerSlice(memberId), key: "me" as const, label: "Me" },
    ...(partner ? [{ amount: ownerSlice(partner.id), key: "partner" as const, label: partner.user.name }] : []),
    { amount: ownerSlice(null), key: "shared" as const, label: "Shared" },
  ].map((slice) => ({ ...slice, pct: totalExpenses > 0 ? Math.round((slice.amount / totalExpenses) * 100) : 0 }));

  const totalPlanned = budgetItemRows.reduce((s, b) => s + Number(b.plannedAmount), 0);
  const pacePoints = dailySpendingPace(
    payExpenseRows.map((e) => ({ amount: Number(e.amount), date: e.date })),
    year,
    month,
    totalPlanned,
    dateFormat,
  );
  const daily = new Array<number>(period.daysInPeriod).fill(0);
  const topCategoryByDay = new Array<null | string>(period.daysInPeriod).fill(null);
  const topCountByDay = new Array<number>(period.daysInPeriod).fill(0);
  for (const e of payExpenseRows) {
    const day = dayNumberInPeriod(e.date, year, month, dateFormat);
    if (day === null) continue;
    daily[day - 1] += Number(e.amount);
    topCategoryByDay[day - 1] = categoryName(e.categoryId);
    topCountByDay[day - 1] += 1;
  }
  const biggestDay = daily.reduce((best, amount, i) => (amount > daily[best] ? i : best), 0);
  const annotation =
    daily[biggestDay] > 0
      ? {
          amount: daily[biggestDay],
          day: biggestDay + 1,
          label: `${topCategoryByDay[biggestDay] ?? "Spending"}${topCountByDay[biggestDay] > 1 ? ` × ${topCountByDay[biggestDay]}` : ""}`,
        }
      : null;

  const unbudgetedLines = budgetLines.filter((l) => l.planned === 0 && l.spent > 0);
  const unbudgeted = unbudgetedLines.length > 0 ? { count: unbudgetedLines.length, names: unbudgetedLines.slice(0, 4).map((l) => l.name) } : null;

  const prevMonthName = formatPeriodLabel(prev.year, prev.month, dateFormat).split(" ")[0];
  const lead = expenseLead({ budgetLines, changes, current: totalExpenses, prevMonthName, previous: prevTotalExpenses });

  const trendPoints = monthlyIncomeExpenseTrend(
    allIncomeRows.map((i) => ({ amount: Number(i.amount), month: i.month, year: i.year })),
    payRangeExpenseRows.map((e) => ({ amount: Number(e.amount), date: e.date })),
    { month, year },
    6,
    dateFormat,
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
  const spends = savingsSpendRows.flatMap((e) => (e.savingsPotId ? [{ amount: Number(e.amount), savingsPotId: e.savingsPotId }] : []));
  const potName = (id: null | string) => potRows.find((p) => p.id === id)?.name ?? "Savings";
  const monthDeposits = deposits.filter((d) => d.kind === "deposit" && d.date >= period.startDate && d.date <= period.endDate);
  const putInBy = (id: string) => monthDeposits.filter((d) => d.memberId === id).reduce((s, d) => s + d.amount, 0);

  const monthLabel = formatPeriodLabel(year, month, dateFormat);
  const exportRows = expenseRows.map((e) => ({
    amount: Number(e.amount),
    category: categoryName(e.categoryId),
    date: e.date,
    name: e.note ?? categoryName(e.categoryId),
    owner: e.ownerMemberId ? roleForOwner(e.ownerMemberId, memberId) : "shared",
  }));

  return (
    <ReportsView
      budgetHref={`/budget?year=${year}&month=${month}`}
      expenses={{
        budgetLines,
        changes,
        largest,
        lead,
        ownerSlices,
        pace: {
          annotation,
          daily,
          daysInPeriod: period.daysInPeriod,
          points: pacePoints,
          todayDay: isCurrent ? daysElapsedInPeriod(period) : period.daysInPeriod,
          totalPlanned,
        },
        slices,
        spent: totalExpenses,
        spentPctOfIncome: pctOfIncome(totalExpenses, combinedIncome),
        spentTrendPct: trendPct(totalExpenses, prevTotalExpenses),
        unbudgeted,
      }}
      exportRows={exportRows}
      income={{
        months: trendPoints.map((p) => ({ income: p.income, label: p.label, left: p.income - p.expenses, spent: p.expenses })),
        members: incomeMembers,
        overspend: Math.max(0, totalExpenses - combinedIncome),
        spentPct: pctOfIncome(totalExpenses, combinedIncome),
        total: combinedIncome,
        trendPct: trendPct(combinedIncome, prevIncome),
      }}
      monthLabel={monthLabel}
      monthNav={buildMonthNav({ basePath: "/reports", current: { month: currentMonth, year: currentYear }, dateFormat, selected: { month, year } })}
      prevMonthName={prevMonthName}
      savings={{
        deposits: monthDeposits.map((d) => ({
          amount: d.amount,
          byLabel: memberById.get(d.memberId ?? "")?.user.name ?? "Former member",
          dateLabel: formatShortDate(d.date, dateFormat),
          id: d.id,
          potName: potName(d.potId),
        })),
        paidFromSavings: expenseRows
          .filter((e) => e.savingsPotId !== null)
          .map((e) => ({
            amount: Number(e.amount),
            categoryName: categoryName(e.categoryId),
            dateLabel: formatShortDate(e.date, dateFormat),
            id: e.id,
            name: e.note ?? categoryName(e.categoryId),
            potName: potName(e.savingsPotId),
          })),
        pots: potRows.map((pot) => ({
          balance: potBalance(pot.id, deposits, spends),
          id: pot.id,
          name: pot.name,
          putIn: putInBetween(pot.id, deposits, period.startDate, period.endDate),
        })),
        putIn: monthDeposits.reduce((s, d) => s + d.amount, 0),
        putInByPerson: [
          { amount: putInBy(memberId), label: "Me" },
          ...(partner ? [{ amount: putInBy(partner.id), label: partner.user.name }] : []),
        ],
      }}
    />
  );
}
```

- [ ] **Step 4: Update the Reports view's Savings tab**

In `src/modules/reports/components/ReportsView.tsx`:

**(a)** Replace:

```tsx
type GoalRow = { id: string; name: string; pct: number; saved: number; target: null | number };
type ContributionRow = { amount: number; dateLabel: string; goalName: string; id: string };
```

with:

```tsx
type DepositRow = { amount: number; byLabel: string; dateLabel: string; id: string; potName: string };
type SavingsPaidRow = { amount: number; categoryName: string; dateLabel: string; id: string; name: string; potName: string };
type PotRow = { balance: number; id: string; name: string; putIn: number };
```

**(b)** Replace:

```tsx
  savings: {
    averageProgress: number;
    contributions: ContributionRow[];
    goalCount: number;
    goals: GoalRow[];
    monthlyContribution: number;
    totalSaved: number;
  };
```

with:

```tsx
  savings: {
    deposits: DepositRow[];
    paidFromSavings: SavingsPaidRow[];
    pots: PotRow[];
    putIn: number;
    putInByPerson: { amount: number; label: string }[];
  };
```

**(c)** `SavingsReport` is the last function in the file. Replace everything from the line `function SavingsReport({ averageProgress, contributions, goalCount, goals, monthlyContribution, totalSaved }: Props["savings"]) {` down to the end of the file with:

```tsx
function SavingsReport({ deposits, paidFromSavings, pots, putIn, putInByPerson }: Props["savings"]) {
  if (pots.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 border-t-2 border-ink pt-6">
        <h2 className="text-[28px] leading-[1.1] font-extrabold tracking-[-0.02em]">No savings set up yet.</h2>
        <p className="max-w-[52ch] text-[15px] leading-[1.55] text-n-800 text-pretty">
          Once you set up a savings pot, this report shows how much you put in each month and what you paid for from savings.
        </p>
        <Button asChild className="mt-1.5 h-9.5" variant="outline">
          <Link href="/savings">Go to Savings</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <Ledger>
        <LedgerCell label="Put in this month" lead note={putInByPerson.map((p) => `${p.label} ${formatMoney(p.amount)}`).join(" · ")}>
          <Money size="lead" value={putIn} />
        </LedgerCell>
        {pots.slice(0, 3).map((pot) => (
          <LedgerCell key={pot.id} label={pot.name} note={`${formatMoney(pot.putIn)} put in this month`}>
            <Money size="cell" value={pot.balance} />
          </LedgerCell>
        ))}
      </Ledger>

      <div className="mt-13 grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-x-14 gap-y-13">
        <section className="min-w-0">
          <SectionHeading>Money in this month</SectionHeading>
          {deposits.length === 0 ? (
            <p className="py-3 text-sm text-n-700">Nothing put in yet this month.</p>
          ) : (
            deposits.map((deposit) => (
              <div className="grid grid-cols-[90px_minmax(0,1fr)_auto] items-baseline gap-4 border-b border-n-300 py-2.75" key={deposit.id}>
                <span className="text-[13px] text-n-600">{deposit.dateLabel}</span>
                <span className="truncate text-[15px]">
                  {deposit.byLabel} · {deposit.potName}
                </span>
                <span className="text-[15px] font-semibold tabular-nums">+{Math.round(deposit.amount).toLocaleString("en-US")}</span>
              </div>
            ))
          )}
        </section>
        <section className="min-w-0">
          <SectionHeading>Paid from savings</SectionHeading>
          {paidFromSavings.length === 0 ? (
            <p className="py-3 text-sm text-n-700">Nothing paid from savings this month.</p>
          ) : (
            paidFromSavings.map((row) => (
              <div className="grid grid-cols-[90px_minmax(0,1fr)_auto] items-baseline gap-4 border-b border-n-300 py-2.75" key={row.id}>
                <span className="text-[13px] text-n-600">{row.dateLabel}</span>
                <span className="truncate text-[15px]">
                  {row.name} · {row.categoryName} · {row.potName}
                </span>
                <span className="text-[15px] font-semibold tabular-nums">
                  <Money value={row.amount} />
                </span>
              </div>
            ))
          )}
        </section>
      </div>
    </>
  );
}
```

- [ ] **Step 5: Replace the Budget page server component**

Replace the whole of `src/modules/budget/pages/BudgetPage.tsx` with:

```tsx
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { formatMoney } from "@/lib/money";
import { buildMonthNav, parseMonthParam, previousMonth } from "@/lib/month-nav";
import { currentPeriodYearMonth, formatPeriodLabel, MAX_NAVIGABLE_YEAR, MIN_NAVIGABLE_YEAR, resolvePeriod } from "@/lib/month-period";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { getBudgetItemsForMonth, getIncomesForMonth } from "@/modules/budget/api/budget.actions";
import { BudgetView } from "@/modules/budget/components/BudgetView";
import { buildBudgetGroups, buildBudgetLead, overBudgetRows } from "@/modules/budget/lib/budget-view";
import { listCategories } from "@/modules/categories/api/categories";
import { listExpensesForMonth } from "@/modules/expenses/api/expenses.actions";
import { checkBudgetReminder } from "@/modules/notifications/api/notifications.actions";
import { listSavingsDeposits, listSavingsPotPlans, listSavingsPots } from "@/modules/savings/api/savings.actions";
import { putInBetween } from "@/modules/savings/lib/savings-math";

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
  const prev = previousMonth(year, month);
  const isCurrentMonth = year === currentYear && month === currentMonth;
  const period = resolvePeriod(year, month, dateFormat);

  const [members, categories, incomes, budgetItems, expenseRows, prevBudgetItems, potRows, planRows, depositRows] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    getIncomesForMonth(year, month),
    getBudgetItemsForMonth(year, month),
    listExpensesForMonth(year, month, dateFormat),
    getBudgetItemsForMonth(prev.year, prev.month),
    listSavingsPots(householdId),
    listSavingsPotPlans(householdId),
    listSavingsDeposits(householdId),
  ]);

  if (isCurrentMonth) {
    await checkBudgetReminder(householdId, year, month, budgetItems.length);
  }

  // Expenses paid from savings were saved for in earlier months, so they don't
  // count against this month's budget.
  const payExpenseRows = expenseRows.filter((e) => e.savingsPotId === null);

  const memberList = members.map((m) => ({ id: m.id, name: m.user.name }));
  const partner = members.find((m) => m.id !== memberId) ?? null;
  const categoryList = categories.map((c) => ({ budgetType: c.budgetType, groupName: c.groupName, id: c.id, name: c.name }));

  const groups = buildBudgetGroups({
    budgetItems: budgetItems.map((b) => ({ categoryId: b.categoryId, ownerMemberId: b.ownerMemberId, plannedAmount: Number(b.plannedAmount) })),
    categories: categoryList,
    expenses: payExpenseRows.map((e) => ({ amount: Number(e.amount), categoryId: e.categoryId, ownerMemberId: e.ownerMemberId })),
    meId: memberId,
    partnerId: partner?.id ?? null,
    partnerName: partner?.user.name ?? null,
  });

  const income = incomes.reduce((sum, i) => sum + Number(i.amount), 0);
  const budgeted = groups.reduce((sum, g) => sum + g.budgeted, 0);
  const spentIn = groups.reduce((sum, g) => sum + g.spent, 0);
  const allSpent = payExpenseRows.reduce((sum, e) => sum + Number(e.amount), 0);
  const outside = allSpent - spentIn;

  const lead = buildBudgetLead({ allSpent, budgeted, income, outside, overBudget: overBudgetRows(groups) });

  const spentByKey: Record<string, number> = {};
  for (const e of payExpenseRows) {
    const ownerKey = e.ownerMemberId === null ? "shared" : e.ownerMemberId === memberId ? "me" : "partner";
    const key = `${e.categoryId}::${ownerKey}`;
    spentByKey[key] = (spentByKey[key] ?? 0) + Number(e.amount);
  }

  // Savings comes from the pots' monthly plans now, not from a budget category.
  const deposits = depositRows.map((d) => ({ amount: Number(d.amount), date: d.date, kind: d.kind, memberId: d.memberId, potId: d.potId }));
  const savingsPots = potRows.map((pot) => ({
    id: pot.id,
    name: pot.name,
    planned: planRows.filter((p) => p.potId === pot.id).reduce((sum, p) => sum + Number(p.monthlyAmount), 0),
    putIn: putInBetween(pot.id, deposits, period.startDate, period.endDate),
  }));
  const plannedSavings = savingsPots.reduce((sum, pot) => sum + pot.planned, 0);
  const unplanned = income - budgeted - plannedSavings;

  return (
    <BudgetView
      canCopy={prevBudgetItems.length > 0}
      categories={categoryList}
      currentMemberId={memberId}
      groups={groups}
      income={income}
      incomes={Object.fromEntries(incomes.map((i) => [i.memberId, Number(i.amount)]))}
      lead={lead}
      ledger={{
        budgeted,
        budgetedRatio: income > 0 ? budgeted / income : 0,
        budgetedSub: `${percent(budgeted, income)}% of Rs ${formatMoney(income, { currency: false })} income`,
        outside,
        outsideSub: `${percent(outside, allSpent)}% of all spending`,
        spentIn,
        spentInSub: budgeted > 0 ? `${percent(spentIn, budgeted)}% of what's budgeted` : "Nothing budgeted yet",
        unplanned,
        unplannedSub:
          plannedSavings > 0
            ? `${percent(unplanned, income)}% of income, after ${formatMoney(plannedSavings)} planned savings`
            : `${percent(unplanned, income)}% of income`,
      }}
      members={memberList}
      month={month}
      monthNav={buildMonthNav({
        allowFuture: true,
        basePath: "/budget",
        current: { month: currentMonth, year: currentYear },
        dateFormat,
        selected: { month, year },
      })}
      prevMonthName={formatPeriodLabel(prev.year, prev.month, dateFormat).split(" ")[0]}
      savings={{ planned: plannedSavings, pots: savingsPots, putIn: savingsPots.reduce((sum, pot) => sum + pot.putIn, 0) }}
      spentByKey={spentByKey}
      year={year}
    />
  );
}
```

- [ ] **Step 6: Show the Savings line on the Budget view**

In `src/modules/budget/components/BudgetView.tsx`:

**(a)** In `type Props`, replace:

```tsx
  prevMonthName: string;
  spentByKey: Record<string, number>;
```

with:

```tsx
  prevMonthName: string;
  savings: { planned: number; pots: { id: string; name: string; planned: number; putIn: number }[]; putIn: number };
  spentByKey: Record<string, number>;
```

**(b)** Replace:

```tsx
          </Fragment>
        );
      })}

      <BudgetDialog
```

with:

```tsx
          </Fragment>
        );
      })}

      {tab === "all" && props.savings.pots.length > 0 && (
        <>
          <RowGroupHead columns={COLUMNS}>
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="text-[15px] font-semibold whitespace-nowrap">Savings</span>
              <span className="truncate text-[13px] text-n-600">Planned against put in this month</span>
            </div>
            <div className="text-right text-[15px] font-semibold">
              <Money value={props.savings.planned} />
            </div>
            <div className="text-right text-[15px] font-semibold">
              <Money value={props.savings.putIn} />
            </div>
            <div className="text-right text-[15px] font-semibold">
              <Money value={Math.max(0, props.savings.planned - props.savings.putIn)} />
            </div>
            <div className="flex min-w-0 items-center gap-2.5">
              <Meter className="flex-1" ratio={props.savings.planned > 0 ? Math.min(1, props.savings.putIn / props.savings.planned) : 0} />
              <span className="w-10.5 text-right text-[13px] font-semibold text-ink">
                {pct(props.savings.planned > 0 ? props.savings.putIn / props.savings.planned : 0)}
              </span>
            </div>
          </RowGroupHead>
          {props.savings.pots.map((pot) => (
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

      <BudgetDialog
```

- [ ] **Step 7: Update the two e2e specs that named savings goals**

In `e2e/dashboard.spec.ts`, replace:

```ts
    await expect(page.getByRole("heading", { name: "Savings goals" })).toBeVisible();
```

with:

```ts
    await expect(page.getByRole("heading", { name: "Savings", exact: true })).toBeVisible();
```

In `e2e/reports.spec.ts`, replace:

```ts
    await expect(page.getByText("Goal progress")).toBeVisible();
```

with:

```ts
    await expect(page.getByText("Money in this month")).toBeVisible();
```

- [ ] **Step 8: Check types, lint and tests**

Run: `npx tsc --noEmit`. Expected: no output.
- If it complains that `HomeGoal`, `goals` or `savingsBudgetAmount` no longer exist, look for a leftover use in `HomeView.tsx` and remove it.

Run: `npm run lint -- --fix`, then `npm run lint`. Expected: 0 errors.
Run: `npm test`. Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add src/modules/dashboard src/modules/reports src/modules/budget e2e/dashboard.spec.ts e2e/reports.spec.ts
git commit -m "feat(savings): Home, Reports and Budget use pots"
```

---

### Task 4.7: Retire savings goals

**Files:**
- Modify: `src/components/nav/nav-items.ts`
- Delete: `src/app/(app)/savings-goals/` and `src/modules/savings-goals/`
- Modify: `src/modules/activity/lib/revert/entities.ts`
- Modify: `src/modules/activity/api/revert-store.ts`
- Modify: `src/modules/activity/lib/revert/plan.test.ts`
- Modify: `scripts/seed-e2e.ts`
- Delete: `e2e/savings-goals.spec.ts`
- Create: `e2e/savings.spec.ts`
- Modify: `e2e/navigation.spec.ts`
- Modify: `src/modules/categories/lib/default-categories.ts`
- Delete: `src/db/schema/savingsGoals.ts`
- Modify: `src/db/schema/index.ts`
- Modify: `docs/architecture.md`
- Create (generated, then edited): the next `drizzle/00NN_*.sql` (migration B) and snapshot

**Interfaces:** nothing new. This task removes code only.

- [ ] **Step 1: Point the menu at the new page**

In `src/components/nav/nav-items.ts`, replace:

```ts
const SAVINGS: NavItem = { href: "/savings-goals", icon: PiggyBank, label: "Savings Goals" };
```

with:

```ts
const SAVINGS: NavItem = { href: "/savings", icon: PiggyBank, label: "Savings" };
```

- [ ] **Step 2: Delete the old route and module**

Run: `git rm -r "src/app/(app)/savings-goals" src/modules/savings-goals`
Expected: git lists the removed files.

- [ ] **Step 3: Remove goals from undo**

In `src/modules/activity/lib/revert/entities.ts`:
- Delete the whole import line that starts with `import { contributionFields, goalFields, goalSummary, type SavingsGoalSnapshot }`.
- Inside `ENTITY_REVERT`, delete the whole `savings_contribution: { … },` entry and the whole `savings_goal: { … },` entry. They are the last two entries, right before the closing `};`.

In `src/modules/activity/api/revert-store.ts`:
- In the `import { … } from "@/db/schema";` list, delete the two lines `  savingsContributions,` and `  savingsGoals,`.
- Delete the line that starts with `const goalIdsOf = (householdId: string) =>`.
- Delete the whole `const goalStore = tableStore({ … });` block and the whole `const contributionStore = tableStore({ … });` block. They sit between `budgetItemStore` and `loanStore`.
- In `REVERT_STORES`, delete the two lines `  savings_contribution: contributionStore,` and `  savings_goal: goalStore,`.

In `src/modules/activity/lib/revert/plan.test.ts`, delete this whole test, because savings goals can't be undone any more:

```ts
  it("shows a line for a swapped photo even though both format the same", () => {
    const goal = { description: null, id: "g-1", image: "data:a", name: "Trip", ownerMemberId: null, targetAmount: null, targetDate: null };
    const plan = planRevert(entry({ action: "updated", after: { ...goal, image: "data:b" }, before: goal, entityType: "savings_goal" }), context({ ...goal, image: "data:b" }), "undo", f);
    expect(plan.kind === "apply" && plan.changes).toEqual([{ field: "Photo", from: "Current version", to: "Earlier version" }]);
  });
```

Old activity entries for goals stay in the log. They just can't be undone any more, which happens automatically.

- [ ] **Step 4: Seed a pot instead of a goal for e2e**

In `scripts/seed-e2e.ts`, replace:

```ts
  savingsContributions,
  savingsGoals,
  users,
} from "../src/db/schema";
```

with:

```ts
  savingsDeposits,
  savingsItems,
  savingsPotPlans,
  savingsPots,
  users,
} from "../src/db/schema";
```

and replace:

```ts
  // One savings goal with contributions, so the dashboard/savings pages show
  // goals and recent contributions rather than the empty state.
  const [goal] = await db
    .insert(savingsGoals)
    .values({
      description: null,
      householdId: household.id,
      image: null,
      name: "Emergency fund",
      ownerMemberId: null,
      targetAmount: "300000",
      targetDate: dateFor(current.year + 1, current.month, 1),
    })
    .returning();
  await db.insert(savingsContributions).values([
    { amount: "20000", date: dateFor(current.year, current.month, 2), goalId: goal.id, memberId: m1.id },
    { amount: "10000", date: dateFor(current.year, current.month, 7), goalId: goal.id, memberId: m2.id },
  ]);
```

with:

```ts
  // A shared savings pot with a plan, money in and two list items, so the
  // savings pages show balances and a forecast rather than the empty state.
  const [pot] = await db
    .insert(savingsPots)
    .values({ heldByMemberId: m1.id, householdId: household.id, name: "Shared savings", ownerMemberId: null, reserveMinimum: "50000" })
    .returning();
  await db.insert(savingsPotPlans).values([
    { memberId: m1.id, monthlyAmount: "10000", potId: pot.id },
    { memberId: m2.id, monthlyAmount: "5000", potId: pot.id },
  ]);
  await db.insert(savingsDeposits).values([
    { amount: "40000", date: dateFor(current.year, current.month, 1), kind: "opening", memberId: null, potId: pot.id },
    { amount: "10000", date: dateFor(current.year, current.month, 2), kind: "deposit", memberId: m1.id, potId: pot.id },
    { amount: "5000", date: dateFor(current.year, current.month, 7), kind: "deposit", memberId: m2.id, potId: pot.id },
  ]);
  await db.insert(savingsItems).values([
    { cost: "300000", name: "Surgery", position: 1, potId: pot.id },
    { cost: "60000", name: "Vacation", position: 2, potId: pot.id },
  ]);
```

- [ ] **Step 5: Replace the e2e spec**

Run: `git rm e2e/savings-goals.spec.ts`

Create `e2e/savings.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

import { gotoRoute } from "./support/nav";

test.describe("savings", () => {
  test.beforeEach(async ({ page }) => {
    await gotoRoute(page, "/savings");
  });

  test("shows the shared pot and its priority list", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Savings", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Shared savings" })).toBeVisible();
    await expect(page.getByText("Emergency reserve").first()).toBeVisible();
    await expect(page.getByText("Surgery")).toBeVisible();
  });

  test("opens the add-money dialog", async ({ page }) => {
    await page.getByRole("button", { name: "Add money" }).first().click();

    await expect(page.getByRole("dialog").getByRole("heading", { name: "Add money" })).toBeVisible();
  });
});
```

In `e2e/navigation.spec.ts`, replace:

```ts
  { label: "Savings Goals", path: "/savings-goals", title: "Savings Goals · Piko" },
```

with:

```ts
  { label: "Savings", path: "/savings", title: "Savings · Piko" },
```

- [ ] **Step 6: Take Savings out of the default categories**

In `src/modules/categories/lib/default-categories.ts`, delete this line:

```ts
  { budgetType: "flexible", group: "Financial", name: "Savings" },
```

This only affects new households. The owner archives their own Savings category by hand.

- [ ] **Step 7: Remove the goals tables from the schema**

Run: `git rm src/db/schema/savingsGoals.ts`

In `src/db/schema/index.ts`, delete the line `export * from "./savingsGoals";`.

In `docs/architecture.md`, replace:

```md
- **Goals & obligations** — `savings_goals` + `savings_contributions`,
```

with:

```md
- **Goals & obligations** — `savings_pots` (shared or per member, with an
  emergency reserve) + `savings_pot_plans` + `savings_items` (the priority list) +
  `savings_deposits`; an expense can be paid from a pot (`expenses.savingsPotId`),
```

- [ ] **Step 8: Make sure nothing still uses goals**

Run: `git grep -n -E "savingsGoals|savingsContributions|savings-goals|SavingsGoal" -- src scripts e2e`
Expected: **no output.** If anything matches, remove that use.

Two kinds of match are fine and should stay:
- the enum values `"savings_goal"` and `"savings_contribution"` (with an underscore) in `activityLogs.ts`, `sections.ts` and `activity-format.ts`, because old log entries still use them;
- old migration SQL in `drizzle/`.

- [ ] **Step 9: Generate migration B and add the safety guard**

Run: `npm run db:generate`
Expected: one new SQL file containing `DROP TABLE "savings_contributions"` and `DROP TABLE "savings_goals"`, and **no** `CREATE TABLE`. It must not ask any question. If it asks, stop and report.

Open that new `.sql` file and add this **at the very top**, above everything drizzle wrote:

```sql
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "savings_contributions") OR EXISTS (SELECT 1 FROM "savings_goals") THEN
    RAISE EXCEPTION 'savings_goals or savings_contributions still has rows. Move or delete them before running this migration.';
  END IF;
END $$;
--> statement-breakpoint
```

Leave `drizzle/meta/*` exactly as generated.

- [ ] **Step 10: Check types, lint and tests**

Run: `npx tsc --noEmit`. Expected: no output.
Run: `npm run lint -- --fix`, then `npm run lint`. Expected: 0 errors.
Run: `npm test`. Expected: all pass.

- [ ] **Step 11: Commit**

```bash
git add src/components/nav/nav-items.ts src/modules/activity scripts/seed-e2e.ts e2e src/modules/categories/lib/default-categories.ts src/db/schema docs/architecture.md drizzle
git commit -m "refactor(savings): retire savings goals"
```

`git rm` already staged the deleted files. Check `git status` afterwards: only `src/app/globals.css` and `src/components/nav/SidebarNav.tsx` may still show as modified.

---

### Phase 4 checkpoint: STOP

- [ ] **Step 1: Run the full checks**

Run, in order:
1. `npm test`. Expected: all pass.
2. `npm run lint`. Expected: 0 errors.
3. `npx tsc --noEmit`. Expected: no output.
4. `npm run test:e2e`. This one matters for this phase. If the e2e database can't be reached, say so in the report.

- [ ] **Step 2: Report to the owner, then STOP**

Tell the owner, in plain language:
- **What changed:** the commits made, one line each.
- **Test results:** unit test totals, and the e2e result.
- **Migrations.** There are two:
  - **A** adds the savings tables.
  - **B** drops the old goals tables. It refuses to run if those tables hold any data.
  - The owner should back up the database first, then run `npm run db:migrate`, which applies both in order.
- **What to do in the app:**
  1. Open **Savings** and set up the shared pot: its name, whose account holds it, what's in the account today, the minimum emergency reserve, and each person's monthly plan.
  2. Add list items in priority order, for example Mum's surgery, then Vacation.
  3. Check each item shows when it becomes affordable.
  4. Use **Add money** after each month's contributions.
  5. Use **Pay for this** when buying something on the list.
  6. Archive the old **Savings** category in Categories.
- **Where to look:**
  - Home shows the pot and the next item.
  - Budget shows a Savings line.
  - Reports has a Savings tab.

Then **wait for the owner to say go on** before starting Phase 5.

---

## Phase 5: Balances

**What this phase delivers:**
- Home's "Saved" cell becomes **"Moved this month"**: savings deposits, dhuku payments and repayments on loans you took.
- **Unallocated = income − Spent − Moved.**
- A new **Balances** section on Home: each pot, each active dhuku's position, loans either way, and the pay-back balance.

Design rules 20–21 apply. No database change.

### Task 5.1: "Moved this month" maths

**Files:**
- Create: `src/modules/dashboard/lib/moved.ts`
- Create: `src/modules/dashboard/lib/moved.test.ts`

**Interfaces:**
- Produces `type MovedThisMonth = { dhuku: number; loans: number; savings: number; total: number }`.
- Produces `movedThisMonth(input: { deposits: { amount: number; date: string; kind: string }[]; dhukuEntries: { amount: number; date: string; type: string }[]; endDate: string; loanPayments: { amount: number; date: string; direction: "given" | "taken" }[]; startDate: string }): MovedThisMonth`.

- [ ] **Step 1: Write the failing test**

Create `src/modules/dashboard/lib/moved.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { movedThisMonth } from "./moved";

const OCTOBER = { endDate: "2026-10-31", startDate: "2026-10-01" };

describe("movedThisMonth", () => {
  it("adds up savings deposits, dhuku payments and repayments on loans taken", () => {
    const moved = movedThisMonth({
      ...OCTOBER,
      deposits: [
        { amount: 10000, date: "2026-10-02", kind: "deposit" },
        { amount: 40000, date: "2026-10-01", kind: "opening" },
        { amount: 250, date: "2026-10-31", kind: "interest" },
      ],
      dhukuEntries: [
        { amount: 3300, date: "2026-10-04", type: "contribution" },
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
    const moved = movedThisMonth({
      ...OCTOBER,
      deposits: [{ amount: 10000, date: "2026-09-30", kind: "deposit" }],
      dhukuEntries: [{ amount: 3000, date: "2026-11-01", type: "contribution" }],
      loanPayments: [{ amount: 5000, date: "2026-09-15", direction: "taken" }],
    });

    expect(moved).toEqual({ dhuku: 0, loans: 0, savings: 0, total: 0 });
  });
});
```

Run: `npx vitest run src/modules/dashboard/lib/moved.test.ts`
Expected: FAIL, because `./moved` can't be found.

- [ ] **Step 2: Write the code**

Create `src/modules/dashboard/lib/moved.ts`:

```ts
export type MovedThisMonth = { dhuku: number; loans: number; savings: number; total: number };

// Money that left this month's pay for your own piles rather than being
// spent: savings deposits, dhuku payments, and repayments on loans you took.
// Dhuku payments count in full here because their cost part (food, interest,
// fines) isn't in Spent; the Dhuku page shows that cost. Money coming back (a
// payout, a loan repaid to you) isn't subtracted.
export function movedThisMonth(input: {
  deposits: { amount: number; date: string; kind: string }[];
  dhukuEntries: { amount: number; date: string; type: string }[];
  endDate: string;
  loanPayments: { amount: number; date: string; direction: "given" | "taken" }[];
  startDate: string;
}): MovedThisMonth {
  const inMonth = (date: string) => date >= input.startDate && date <= input.endDate;
  const sum = (values: number[]) => Math.round(values.reduce((total, value) => total + value, 0) * 100) / 100;
  const savings = sum(input.deposits.filter((d) => d.kind === "deposit" && inMonth(d.date)).map((d) => d.amount));
  const dhuku = sum(input.dhukuEntries.filter((e) => e.type !== "payout" && inMonth(e.date)).map((e) => e.amount));
  const loans = sum(input.loanPayments.filter((p) => p.direction === "taken" && inMonth(p.date)).map((p) => p.amount));
  return { dhuku, loans, savings, total: sum([savings, dhuku, loans]) };
}
```

Run: `npx vitest run src/modules/dashboard/lib/moved.test.ts`
Expected: both tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/modules/dashboard/lib/moved.ts src/modules/dashboard/lib/moved.test.ts
git commit -m "feat(home): moved-this-month maths"
```

---

### Task 5.2: Home shows Moved this month and Balances

**Files:**
- Modify: `src/modules/dashboard/pages/DashboardPage.tsx`
- Modify: `src/modules/dashboard/components/HomeView.tsx`

**Interfaces:**
- Consumes:
  - `movedThisMonth` (Task 5.1) and `dhukuPosition` (Task 3.2).
  - `buildLoanCards` and `loanOverviewStats` from `@/modules/loans/lib/loan-stats`.
  - `listLoans` and `listLoanPayments` from `@/modules/loans/api/loans.actions`.
  - `listDhukus` and `listDhukuEntries` from `@/modules/dhuku/api/dhuku.actions`.
- Produces:
  - HomeView prop `balances: HomeBalanceRow[]`, where `HomeBalanceRow = { amount: number; id: string; label: string; sub: string }`.
  - `ledger.moved: MovedThisMonth` replaces `ledger.saved` and `ledger.savedNote`.

- [ ] **Step 1: Load and compute on the Home page**

In `src/modules/dashboard/pages/DashboardPage.tsx`:

**(a)** Replace:

```tsx
import {
  type HomeOwnerRow,
  type HomePacing,
  type HomeRecentGroup,
  type HomeSavingsPot,
  HomeView,
} from "@/modules/dashboard/components/HomeView";
import { allowanceSpentByDay, daysLeftInMonth } from "@/modules/dashboard/lib/cash-flow";
import { toExpenseInputs, toIncomeInputs } from "@/modules/dashboard/lib/map-rows";
```

with:

```tsx
import {
  type HomeBalanceRow,
  type HomeOwnerRow,
  type HomePacing,
  type HomeRecentGroup,
  type HomeSavingsPot,
  HomeView,
} from "@/modules/dashboard/components/HomeView";
import { allowanceSpentByDay, daysLeftInMonth } from "@/modules/dashboard/lib/cash-flow";
import { toExpenseInputs, toIncomeInputs } from "@/modules/dashboard/lib/map-rows";
import { movedThisMonth } from "@/modules/dashboard/lib/moved";
```

**(b)** Replace:

```tsx
import { walletSpentByMember } from "@/modules/dashboard/lib/wallet";
import { listExpensesForMonth, listRecentExpenses } from "@/modules/expenses/api/expenses.actions";
import { groupByDay } from "@/modules/expenses/lib/expense-view";
```

with:

```tsx
import { walletSpentByMember } from "@/modules/dashboard/lib/wallet";
import { listDhukuEntries, listDhukus } from "@/modules/dhuku/api/dhuku.actions";
import { dhukuPosition } from "@/modules/dhuku/lib/dhuku-money";
import { listExpensesForMonth, listRecentExpenses } from "@/modules/expenses/api/expenses.actions";
import { groupByDay } from "@/modules/expenses/lib/expense-view";
import { listLoanPayments, listLoans } from "@/modules/loans/api/loans.actions";
import { buildLoanCards, loanOverviewStats } from "@/modules/loans/lib/loan-stats";
```

**(c)** Replace:

```tsx
import { potBalance, putInBetween } from "@/modules/savings/lib/savings-math";
```

with:

```tsx
import { potBalance } from "@/modules/savings/lib/savings-math";
```

**(d)** In the `Promise.all` destructuring, replace:

```tsx
    depositRows,
    savingsSpendRows,
  ] = await Promise.all([
```

with:

```tsx
    depositRows,
    savingsSpendRows,
    dhukuRows,
    dhukuEntryRows,
    loanRows,
    loanPaymentRows,
  ] = await Promise.all([
```

and replace:

```tsx
    listSavingsDeposits(householdId),
    listSavingsExpenses(householdId),
  ]);
```

with:

```tsx
    listSavingsDeposits(householdId),
    listSavingsExpenses(householdId),
    listDhukus(householdId),
    listDhukuEntries(householdId),
    listLoans(householdId),
    listLoanPayments(householdId),
  ]);
```

**(e)** Replace:

```tsx
  const saved = potRows.reduce((s, pot) => s + putInBetween(pot.id, deposits, period.startDate, period.endDate), 0);
```

with:

```tsx
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
    if (dhuku.completedAt !== null || contributions >= dhuku.totalMembers) return [];
    const position = dhukuPosition(
      {
        monthlyContribution: Number(dhuku.monthlyContribution),
        potDeduction: dhuku.potDeduction === null ? null : Number(dhuku.potDeduction),
        totalMembers: dhuku.totalMembers,
      },
      entries,
    );
    return [{ amount: position, id: `dhuku:${dhuku.id}`, label: dhuku.name, sub: position >= 0 ? "Dhuku · the group owes you" : "Dhuku · you owe the group" }];
  });
  const balances: HomeBalanceRow[] = [
    ...savings.map((pot) => ({ amount: pot.balance, id: `pot:${pot.id}`, label: pot.name, sub: "Savings" })),
    ...dhukuBalances,
    ...(loanStats.outstandingToReceive > 0
      ? [{ amount: loanStats.outstandingToReceive, id: "loans:owed", label: "Loans owed to you", sub: "Still to be paid back" }]
      : []),
    ...(loanStats.outstandingToPay > 0 ? [{ amount: -loanStats.outstandingToPay, id: "loans:owe", label: "Loans you owe", sub: "Still to pay" }] : []),
    ...(payback
      ? [
          payback.debtorId === memberId
            ? { amount: -payback.amount, id: "payback", label: `You owe ${memberName(payback.creditorId)}`, sub: "Pay back later" }
            : { amount: payback.amount, id: "payback", label: `${memberName(payback.debtorId)} owes you`, sub: "Pay back later" },
        ]
      : []),
  ];
```

**(f)** In the `ledger={{ … }}` prop, replace:

```tsx
        paidFromSavings,
        saved,
        savedNote: saved === 0 ? "Nothing put in yet" : "Put into savings this month",
```

with:

```tsx
        moved,
        paidFromSavings,
```

and replace:

```tsx
        unallocated: summary.unallocated,
```

with:

```tsx
        unallocated,
```

**(g)** Replace:

```tsx
    <HomeView
      currentMemberId={memberId}
```

with:

```tsx
    <HomeView
      balances={balances}
      currentMemberId={memberId}
```

- [ ] **Step 2: Show it on the Home view**

In `src/modules/dashboard/components/HomeView.tsx`:

**(a)** Replace:

```tsx
export type HomeSavingsPot = { balance: number; id: string; name: string; next: null | string; reserveFull: boolean };
```

with:

```tsx
export type HomeSavingsPot = { balance: number; id: string; name: string; next: null | string; reserveFull: boolean };

export type HomeBalanceRow = { amount: number; id: string; label: string; sub: string };
```

**(b)** Replace:

```tsx
type Props = {
  currentMemberId: string;
```

with:

```tsx
type Props = {
  balances: HomeBalanceRow[];
  currentMemberId: string;
```

**(c)** Replace:

```tsx
    incomeTrendPct: null | number;
    paidFromSavings: number;
    saved: number;
    savedNote: string;
```

with:

```tsx
    incomeTrendPct: null | number;
    moved: { dhuku: number; loans: number; savings: number; total: number };
    paidFromSavings: number;
```

**(d)** Replace:

```tsx
        <LedgerCell label="Saved" note={ledger.savedNote}>
          <Money size="cell" value={ledger.saved} />
        </LedgerCell>
        <LedgerCell label="Unallocated" note={ledger.unallocated < 0 ? "Spending is above income" : "Ready to assign"}>
```

with:

```tsx
        <LedgerCell
          label="Moved this month"
          note={
            ledger.moved.total > 0
              ? `Savings ${formatMoney(ledger.moved.savings)} · Dhuku ${formatMoney(ledger.moved.dhuku)} · Loans ${formatMoney(ledger.moved.loans)}`
              : "Nothing moved yet"
          }
        >
          <Money size="cell" value={ledger.moved.total} />
        </LedgerCell>
        <LedgerCell label="Unallocated" note={ledger.unallocated < 0 ? "Spent and moved more than income" : "Ready to assign"}>
```

**(e)** Replace:

```tsx
      <div className="mt-13 grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-12">
```

with:

```tsx
      {props.balances.length > 0 && (
        <section className="mt-13 max-w-160">
          <SectionHeading sub="Where your money stands, apart from this month's spending">Balances</SectionHeading>
          {props.balances.map((row) => (
            <div className="flex items-baseline justify-between gap-4 border-b border-n-300 py-3" key={row.id}>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[15px]">{row.label}</span>
                <span className="text-[13px] text-n-600">{row.sub}</span>
              </span>
              <span className={cn("text-[15px] font-semibold", row.amount < 0 && "text-signal-ink")}>
                <Money tone={row.amount < 0 ? "negative" : "default"} value={row.amount} />
              </span>
            </div>
          ))}
        </section>
      )}

      <div className="mt-13 grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-12">
```

- [ ] **Step 3: Check types, lint and tests**

Run: `npx tsc --noEmit`. Expected: no output.
- If `buildLoanCards` complains about the row type, the loans table rows already have every field `LoanRow` needs. Check that you passed `loanRows` straight from `listLoans`.

Run: `npm run lint -- --fix`, then `npm run lint`. Expected: 0 errors.
Run: `npm test`. Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/modules/dashboard/pages/DashboardPage.tsx src/modules/dashboard/components/HomeView.tsx
git commit -m "feat(home): moved this month and balances"
```

---

### Phase 5 checkpoint: STOP

- [ ] **Step 1: Run the full checks**

Run `npm test`, `npm run lint`, `npx tsc --noEmit`, and optionally `npm run test:e2e`. Expected: all clean.

- [ ] **Step 2: Report to the owner, then STOP**

Tell the owner, in plain language:
- **What changed:** the commits made, one line each.
- **Test results:** unit test totals, and whether e2e ran.
- **Migrations:** this phase has no database change.
- **What to look at on Home:**
  - "Moved this month" (savings, dhuku, loans), and Unallocated now subtracting it.
  - The Balances list: each pot, each active dhuku (+ means the group owes you, − means you owe the group), loans either way, and the pay-back balance.

Then **wait for the owner to say go on** before starting Phase 6.

---

## Phase 6: Savings extras

**What this phase delivers:**
- List items can have a **needed by** date, with a warning when they won't be affordable in time and how much more a month would close the gap.
- A **"what if this came first"** hint on every item below the top one.
- **Bank interest** entries.

Design rule 18 applies. No database change: the `needed_by` column and the `interest` kind already exist from Phase 4.

### Task 6.1: Needed-by and what-if maths

**Files:**
- Modify: `src/modules/savings/lib/savings-forecast.ts`
- Modify: `src/modules/savings/lib/savings-forecast.test.ts`

**Interfaces:**
- Produces:
  - `periodOfDate(dateStr: string, dateFormat: DateFormat): { month: number; year: number }`
  - `monthsBetween(from: { month: number; year: number }, to: { month: number; year: number }): number`
  - `type WhatIfFirst = { delays: { id: string; months: number }[]; monthsFromNow: null | number }`
  - `whatIfFirst(input: ForecastInput, itemId: string): null | WhatIfFirst`
  - `type NeededByCheck = { extraPerMonth: number; monthsLate: null | number }`
  - `neededByCheck(input: { balance: number; cumulativeCost: number; monthlyInflow: number; monthsFromNow: null | number; monthsUntilNeeded: number; reserveMinimum: number }): null | NeededByCheck`

- [ ] **Step 1: Write the failing tests**

In `src/modules/savings/lib/savings-forecast.test.ts`, replace:

```ts
import { forecastPot, monthAfter } from "./savings-forecast";
```

with:

```ts
import { resolvePeriod } from "@/lib/month-period";

import { forecastPot, monthAfter, monthsBetween, neededByCheck, periodOfDate, whatIfFirst } from "./savings-forecast";

// The owner's example: reserve already full, Rs 15,000 a month going in,
// surgery first and a vacation second.
const SURGERY_THEN_VACATION = {
  balance: 100000,
  items: [
    { cost: 300000, id: "surgery" },
    { cost: 60000, id: "vacation" },
  ],
  monthlyInflow: 15000,
  reserveMinimum: 100000,
};
```

Then append at the end of the file:

```ts

describe("whatIfFirst", () => {
  it("says when an item would be affordable if it went first, and how far it pushes the others", () => {
    expect(whatIfFirst(SURGERY_THEN_VACATION, "vacation")).toEqual({ delays: [{ id: "surgery", months: 4 }], monthsFromNow: 4 });
  });

  it("has nothing to say for the item already at the top", () => {
    expect(whatIfFirst(SURGERY_THEN_VACATION, "surgery")).toBeNull();
  });
});

describe("neededByCheck", () => {
  it("is quiet when the item will be affordable in time", () => {
    expect(
      neededByCheck({ balance: 100000, cumulativeCost: 300000, monthlyInflow: 15000, monthsFromNow: 20, monthsUntilNeeded: 24, reserveMinimum: 100000 }),
    ).toBeNull();
  });

  it("says how late it is, and how much more a month would make it", () => {
    // Needed in 18 months, affordable in 20: Rs 300,000 short over 18 months
    // is Rs 16,667 a month, Rs 1,667 more than the Rs 15,000 planned.
    expect(
      neededByCheck({ balance: 100000, cumulativeCost: 300000, monthlyInflow: 15000, monthsFromNow: 20, monthsUntilNeeded: 18, reserveMinimum: 100000 }),
    ).toEqual({ extraPerMonth: 1667, monthsLate: 2 });
  });

  it("asks for the whole shortfall when it's needed this month", () => {
    expect(
      neededByCheck({ balance: 100000, cumulativeCost: 50000, monthlyInflow: 15000, monthsFromNow: 4, monthsUntilNeeded: 0, reserveMinimum: 100000 }),
    ).toEqual({ extraPerMonth: 50000, monthsLate: 4 });
  });
});

describe("periodOfDate and monthsBetween", () => {
  it("finds the month a date falls in, in either calendar", () => {
    expect(periodOfDate("2026-10-15", "english")).toEqual({ month: 10, year: 2026 });
    const asoj = resolvePeriod(2083, 6, "nepali");
    expect(periodOfDate(asoj.startDate, "nepali")).toEqual({ month: 6, year: 2083 });
    expect(periodOfDate(asoj.endDate, "nepali")).toEqual({ month: 6, year: 2083 });
  });

  it("counts whole months between two months", () => {
    expect(monthsBetween({ month: 6, year: 2083 }, { month: 2, year: 2084 })).toBe(8);
    expect(monthsBetween({ month: 6, year: 2083 }, { month: 6, year: 2083 })).toBe(0);
  });
});
```

Run: `npx vitest run src/modules/savings/lib/savings-forecast.test.ts`
Expected: FAIL. The new functions aren't exported yet.

- [ ] **Step 2: Write the code**

In `src/modules/savings/lib/savings-forecast.ts`, replace:

```ts
import { nextMonth } from "@/lib/month-nav";
```

with:

```ts
import type { DateFormat } from "@/lib/date-format-cookie";
import { nextMonth } from "@/lib/month-nav";
import { adToBs } from "@/lib/nepali-date";
```

Then append at the end of the file:

```ts

// The household-calendar (year, month) an AD date falls in.
export function periodOfDate(dateStr: string, dateFormat: DateFormat): { month: number; year: number } {
  if (dateFormat === "english") {
    const [year, month] = dateStr.split("-").map(Number);
    return { month, year };
  }
  const { month, year } = adToBs(dateStr);
  return { month, year };
}

export function monthsBetween(from: { month: number; year: number }, to: { month: number; year: number }): number {
  return (to.year - from.year) * 12 + (to.month - from.month);
}

export type WhatIfFirst = { delays: { id: string; months: number }[]; monthsFromNow: null | number };

// What would happen if this item went to the top of the list: when it would
// be affordable, and how many months later each item above it would then be.
// null for the item already at the top.
export function whatIfFirst(input: ForecastInput, itemId: string): null | WhatIfFirst {
  const index = input.items.findIndex((item) => item.id === itemId);
  if (index <= 0) return null;
  const before = forecastPot(input);
  const after = forecastPot({ ...input, items: [input.items[index], ...input.items.filter((item) => item.id !== itemId)] });
  const delays = input.items.slice(0, index).flatMap((item) => {
    const was = before.items.find((f) => f.id === item.id)?.monthsFromNow ?? null;
    const now = after.items.find((f) => f.id === item.id)?.monthsFromNow ?? null;
    return was !== null && now !== null && now > was ? [{ id: item.id, months: now - was }] : [];
  });
  return { delays, monthsFromNow: after.items[0].monthsFromNow };
}

export type NeededByCheck = { extraPerMonth: number; monthsLate: null | number };

// For an item with a "needed by" month: null when it will be affordable in
// time. Otherwise, how many months late it is on the current plan (null when
// nothing is planned), and how much more a month would make it in time.
export function neededByCheck(input: {
  balance: number;
  cumulativeCost: number;
  monthlyInflow: number;
  monthsFromNow: null | number;
  monthsUntilNeeded: number;
  reserveMinimum: number;
}): null | NeededByCheck {
  if (input.monthsFromNow !== null && input.monthsFromNow <= input.monthsUntilNeeded) return null;
  const short = input.reserveMinimum + input.cumulativeCost - input.balance;
  const extraPerMonth = input.monthsUntilNeeded > 0 ? Math.ceil(short / input.monthsUntilNeeded - input.monthlyInflow) : Math.ceil(short);
  return {
    extraPerMonth: Math.max(0, extraPerMonth),
    monthsLate: input.monthsFromNow === null ? null : input.monthsFromNow - input.monthsUntilNeeded,
  };
}
```

Run: `npx vitest run src/modules/savings/lib/savings-forecast.test.ts`
Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add src/modules/savings/lib/savings-forecast.ts src/modules/savings/lib/savings-forecast.test.ts
git commit -m "feat(savings): needed-by and what-if-first maths"
```

---

### Task 6.2: Deadlines, warnings, hints and bank interest on the Savings page

**Files:**
- Modify (replace the whole file): `src/modules/savings/pages/SavingsPage.tsx`
- Modify: `src/modules/savings/components/SavingsView.tsx`
- Modify (replace the whole file): `src/modules/savings/components/ItemDialog.tsx`
- Modify (replace the whole file): `src/modules/savings/components/DepositDialog.tsx`

**Interfaces:**
- Consumes: Task 6.1's functions.
- Produces: `SavingsItemModel` gains `hint: null | string` and `warning: null | string`.

- [ ] **Step 1: Replace the Savings page server component**

Replace the whole of `src/modules/savings/pages/SavingsPage.tsx` with:

```tsx
import { formatShortDate } from "@/lib/date-format";
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { formatMoney } from "@/lib/money";
import { currentPeriodYearMonth, formatPeriodLabel, resolvePeriod } from "@/lib/month-period";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { listCategories } from "@/modules/categories/api/categories";
import {
  listSavingsDeposits,
  listSavingsExpenses,
  listSavingsItems,
  listSavingsPotPlans,
  listSavingsPots,
} from "@/modules/savings/api/savings.actions";
import { type PotOwnerKey, type SavingsPotModel, SavingsView } from "@/modules/savings/components/SavingsView";
import {
  forecastPot,
  monthAfter,
  monthsBetween,
  type NeededByCheck,
  neededByCheck,
  periodOfDate,
  type WhatIfFirst,
  whatIfFirst,
} from "@/modules/savings/lib/savings-forecast";
import { potBalance, putInBetween } from "@/modules/savings/lib/savings-math";

const DEPOSITS_SHOWN = 5;
// Shared pot first, then mine, then my partner's.
const POT_ORDER: Record<PotOwnerKey, number> = { me: 1, partner: 2, shared: 0 };

export async function SavingsPage() {
  const { householdId, memberId } = await getCurrentMember();
  const dateFormat = await getDateFormatPref(householdId);
  const current = currentPeriodYearMonth(dateFormat);
  const period = resolvePeriod(current.year, current.month, dateFormat);

  const [members, categories, potRows, planRows, itemRows, depositRows, spendRows] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    listSavingsPots(householdId),
    listSavingsPotPlans(householdId),
    listSavingsItems(householdId),
    listSavingsDeposits(householdId),
    listSavingsExpenses(householdId),
  ]);

  const partner = members.find((m) => m.id !== memberId) ?? null;
  const nameOf = (id: null | string) => members.find((m) => m.id === id)?.user.name ?? null;
  const ownerKeyOf = (ownerMemberId: null | string): PotOwnerKey =>
    ownerMemberId === null ? "shared" : ownerMemberId === memberId ? "me" : "partner";
  const monthLabel = (months: number) => {
    const when = monthAfter(current.year, current.month, months);
    return formatPeriodLabel(when.year, when.month, dateFormat);
  };
  const affordableText = (months: null | number) =>
    months === null ? "Not on the current plan" : months === 0 ? "Affordable now" : `In ${monthLabel(months)}`;

  const deposits = depositRows.map((d) => ({ amount: Number(d.amount), date: d.date, id: d.id, kind: d.kind, memberId: d.memberId, potId: d.potId }));
  const spends = spendRows.flatMap((e) =>
    e.savingsPotId ? [{ amount: Number(e.amount), savingsItemId: e.savingsItemId, savingsPotId: e.savingsPotId }] : [],
  );
  const paidByItem = new Map<string, number>();
  for (const spend of spends) {
    if (spend.savingsItemId) paidByItem.set(spend.savingsItemId, (paidByItem.get(spend.savingsItemId) ?? 0) + spend.amount);
  }

  const pots: SavingsPotModel[] = potRows
    .map((pot) => {
      const balance = potBalance(pot.id, deposits, spends);
      const reserveMinimum = Number(pot.reserveMinimum);
      const plans = planRows.filter((p) => p.potId === pot.id).map((p) => ({ memberId: p.memberId, monthlyAmount: Number(p.monthlyAmount) }));
      const planned = plans.reduce((sum, p) => sum + p.monthlyAmount, 0);
      const potItems = itemRows.filter((i) => i.potId === pot.id);
      const open = potItems.filter((i) => !paidByItem.has(i.id));
      const forecastInput = {
        balance,
        items: open.map((i) => ({ cost: Number(i.cost), id: i.id })),
        monthlyInflow: planned,
        reserveMinimum,
      };
      const forecast = forecastPot(forecastInput);
      const itemName = (id: string) => open.find((i) => i.id === id)?.name ?? "an item";

      // "If you did this first: affordable in Baisakh 2084, pushing Surgery back 4 months."
      const whatIfText = (ifFirst: WhatIfFirst): null | string => {
        if (ifFirst.monthsFromNow === null) return null;
        const when = ifFirst.monthsFromNow === 0 ? "now" : `in ${monthLabel(ifFirst.monthsFromNow)}`;
        const pushes = ifFirst.delays.map((d) => `${itemName(d.id)} back ${d.months} ${d.months === 1 ? "month" : "months"}`).join(", ");
        return `If you did this first: affordable ${when}${pushes ? `, pushing ${pushes}` : ""}.`;
      };
      // "Needed by Chaitra 2083: 2 months late. Add Rs 1,667 a month to make it, or move it up the list."
      const lateText = (check: NeededByCheck, needed: { month: number; year: number }) => {
        const how = check.monthsLate === null ? "not on the current plan" : `${check.monthsLate} ${check.monthsLate === 1 ? "month" : "months"} late`;
        return `Needed by ${formatPeriodLabel(needed.year, needed.month, dateFormat)}: ${how}. Add ${formatMoney(check.extraPerMonth)} a month to make it, or move it up the list.`;
      };

      const toGo = reserveMinimum - balance;
      const reserveNote =
        reserveMinimum <= 0
          ? "No reserve set"
          : toGo <= 0
            ? "Full"
            : forecast.reserveFullInMonths === null
              ? `${formatMoney(toGo)} to go`
              : `${formatMoney(toGo)} to go, full ${forecast.reserveFullInMonths === 0 ? "now" : `in ${monthLabel(forecast.reserveFullInMonths)}`}`;
      return {
        balance,
        deposits: deposits
          .filter((d) => d.potId === pot.id)
          .slice(0, DEPOSITS_SHOWN)
          .map((d) => ({
            amount: d.amount,
            byLabel: d.kind === "opening" ? "Opening balance" : d.kind === "interest" ? "Bank interest" : (nameOf(d.memberId) ?? "Former member"),
            dateLabel: formatShortDate(d.date, dateFormat),
            id: d.id,
          })),
        done: potItems.filter((i) => paidByItem.has(i.id)).map((i) => ({ id: i.id, name: i.name, paid: paidByItem.get(i.id) ?? 0 })),
        heldByMemberId: pot.heldByMemberId,
        id: pot.id,
        items: open.map((i, index) => {
          const itemForecast = forecast.items[index];
          const neededPeriod = i.neededBy ? periodOfDate(i.neededBy, dateFormat) : null;
          const late = neededPeriod
            ? neededByCheck({
                balance,
                cumulativeCost: itemForecast.cumulativeCost,
                monthlyInflow: planned,
                monthsFromNow: itemForecast.monthsFromNow,
                monthsUntilNeeded: monthsBetween(current, neededPeriod),
                reserveMinimum,
              })
            : null;
          const ifFirst = whatIfFirst(forecastInput, i.id);
          return {
            affordable: affordableText(itemForecast.monthsFromNow),
            cost: Number(i.cost),
            hint: ifFirst ? whatIfText(ifFirst) : null,
            id: i.id,
            name: i.name,
            neededBy: i.neededBy,
            note: i.note,
            warning: late && neededPeriod ? lateText(late, neededPeriod) : null,
          };
        }),
        name: pot.name,
        ownerKey: ownerKeyOf(pot.ownerMemberId),
        ownerMemberId: pot.ownerMemberId,
        planned,
        plans,
        putIn: putInBetween(pot.id, deposits, period.startDate, period.endDate),
        reserveMinimum,
        reserveNote,
      };
    })
    .sort((a, b) => POT_ORDER[a.ownerKey] - POT_ORDER[b.ownerKey]);

  const existing = new Set(pots.map((pot) => pot.ownerKey));
  const possible: PotOwnerKey[] = partner ? ["shared", "me", "partner"] : ["shared", "me"];

  return (
    <SavingsView
      categories={categories.map((c) => ({ groupName: c.groupName, id: c.id, name: c.name }))}
      currentMemberId={memberId}
      members={members.map((m) => ({ id: m.id, name: m.user.name }))}
      missing={possible.filter((key) => !existing.has(key))}
      pots={pots}
    />
  );
}
```

- [ ] **Step 2: Show warnings and hints in the list**

In `src/modules/savings/components/SavingsView.tsx`, replace:

```tsx
export type SavingsItemModel = { affordable: string; cost: number; id: string; name: string; neededBy: null | string; note: null | string };
```

with:

```tsx
export type SavingsItemModel = {
  affordable: string;
  cost: number;
  hint: null | string;
  id: string;
  name: string;
  neededBy: null | string;
  note: null | string;
  warning: null | string;
};
```

and replace:

```tsx
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[15px]">{item.name}</span>
                    {item.note && <span className="truncate text-[13px] text-n-600">{item.note}</span>}
                  </div>
```

with:

```tsx
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[15px]">{item.name}</span>
                    {item.note && <span className="truncate text-[13px] text-n-600">{item.note}</span>}
                    {item.warning && <span className="text-[13px] text-signal-ink">{item.warning}</span>}
                    {item.hint && <span className="text-[13px] text-n-600">{item.hint}</span>}
                  </div>
```

- [ ] **Step 3: Replace the list-item dialog (adds the deadline)**

Replace the whole of `src/modules/savings/components/ItemDialog.tsx` with:

```tsx
"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AmountInput } from "@/components/AmountInput";
import { Modal } from "@/components/Modal";
import { MoreDetails } from "@/components/MoreDetails";
import { NepaliDateField } from "@/components/NepaliDateField";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/today";
import { createSavingsItemAction, updateSavingsItemAction } from "@/modules/savings/api/savings.actions";
import type { SavingsItemModel } from "@/modules/savings/components/SavingsView";

type Props = {
  editing: null | SavingsItemModel;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  potId: null | string;
};

const FORM_ID = "savings-item-form";
const NAME_ERROR = "Say what you're saving for";
const COST_ERROR = "Enter what it should cost";

export function ItemDialog({ editing, onOpenChange, open, potId }: Props) {
  const [pending, setPending] = useState(false);

  return (
    <Modal
      className="sm:max-w-110"
      footer={
        <Button className="min-w-30 justify-start" disabled={pending} form={FORM_ID} type="submit">
          {pending ? "Saving..." : editing ? "Save changes" : "Add"}
        </Button>
      }
      hint="Enter to save · Esc to close"
      onOpenChange={onOpenChange}
      open={open}
      title={editing ? "Edit list item" : "Add to the list"}
    >
      {(editing !== null || potId !== null) && (
        <ItemFields editing={editing} onDone={() => onOpenChange(false)} onPendingChange={setPending} potId={potId} />
      )}
    </Modal>
  );
}

type FieldsProps = { editing: null | SavingsItemModel; onDone: () => void; onPendingChange: (pending: boolean) => void; potId: null | string };

function ItemFields({ editing, onDone, onPendingChange, potId }: FieldsProps) {
  const router = useRouter();
  const [name, setName] = useState(editing?.name ?? "");
  const [cost, setCost] = useState(editing ? String(editing.cost) : "");
  const [note, setNote] = useState(editing?.note ?? "");
  const [hasDeadline, setHasDeadline] = useState(editing?.neededBy != null);
  const [neededBy, setNeededBy] = useState(editing?.neededBy ?? todayISO());
  const [error, setError] = useState<string | undefined>();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError(NAME_ERROR);
      return;
    }
    if (!(Number(cost) > 0)) {
      setError(COST_ERROR);
      return;
    }
    const payload = { cost: Number(cost), name: name.trim(), neededBy: hasDeadline ? neededBy : null, note: note.trim() || undefined };
    onPendingChange(true);
    try {
      if (editing) await updateSavingsItemAction(editing.id, payload);
      else if (potId) await createSavingsItemAction(potId, payload);
      toast.success(editing ? "Item updated" : "Added to the list");
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
      <TextField
        data-autofocus
        error={error === NAME_ERROR ? error : undefined}
        label="What you're saving for"
        onChange={(event) => {
          setName(event.target.value);
          setError(undefined);
        }}
        placeholder="e.g. Mum's surgery"
        value={name}
      />
      <AmountInput
        error={error === COST_ERROR ? error : undefined}
        label="Estimated cost"
        onChange={(event) => {
          setCost(event.target.value);
          setError(undefined);
        }}
        size="xl"
        value={cost}
      />
      <label className="flex items-center gap-2 text-sm text-n-800">
        <input checked={hasDeadline} onChange={(event) => setHasDeadline(event.target.checked)} type="checkbox" />
        It&apos;s needed by a certain date
      </label>
      {hasDeadline && <NepaliDateField label="Needed by" onChange={setNeededBy} value={neededBy} />}
      <MoreDetails>
        <TextField label="Note" onChange={(event) => setNote(event.target.value)} placeholder="Optional" value={note} />
      </MoreDetails>
    </form>
  );
}
```

- [ ] **Step 4: Replace the money-in dialog (adds bank interest)**

Replace the whole of `src/modules/savings/components/DepositDialog.tsx` with:

```tsx
"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AmountInput } from "@/components/AmountInput";
import { Modal } from "@/components/Modal";
import { MoreDetails } from "@/components/MoreDetails";
import { NepaliDateField } from "@/components/NepaliDateField";
import { Segmented } from "@/components/Segmented";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/today";
import { addSavingsDepositAction } from "@/modules/savings/api/savings.actions";
import type { SavingsPotModel } from "@/modules/savings/components/SavingsView";

type Member = { id: string; name: string };
type Kind = "deposit" | "interest";

type Props = {
  currentMemberId: string;
  members: Member[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pot: null | SavingsPotModel;
};

const FORM_ID = "savings-deposit-form";

export function DepositDialog({ currentMemberId, members, onOpenChange, open, pot }: Props) {
  const [pending, setPending] = useState(false);

  return (
    <Modal
      className="sm:max-w-105"
      footer={
        <Button className="min-w-30 justify-start" disabled={pending} form={FORM_ID} type="submit">
          {pending ? "Adding..." : "Add"}
        </Button>
      }
      hint="Enter to add · Esc to close"
      onOpenChange={onOpenChange}
      open={open}
      subtitle={pot?.name}
      title="Add money"
    >
      {pot && (
        <DepositFields currentMemberId={currentMemberId} members={members} onDone={() => onOpenChange(false)} onPendingChange={setPending} pot={pot} />
      )}
    </Modal>
  );
}

type FieldsProps = {
  currentMemberId: string;
  members: Member[];
  onDone: () => void;
  onPendingChange: (pending: boolean) => void;
  pot: SavingsPotModel;
};

function DepositFields({ currentMemberId, members, onDone, onPendingChange, pot }: FieldsProps) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("deposit");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [memberId, setMemberId] = useState(pot.ownerMemberId ?? currentMemberId);
  const [error, setError] = useState<string | undefined>();
  const label = (m: Member) => (m.id === currentMemberId ? "Me" : m.name);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!(Number(amount) > 0)) {
      setError("Enter an amount");
      return;
    }
    onPendingChange(true);
    try {
      // Bank interest has no member; the bank put it in.
      await addSavingsDepositAction(pot.id, { amount: Number(amount), date, kind, memberId: kind === "deposit" ? memberId : null });
      toast.success(kind === "deposit" ? "Money added" : "Interest added");
      onDone();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add");
    } finally {
      onPendingChange(false);
    }
  }

  return (
    <form className="flex flex-col gap-5.5" id={FORM_ID} noValidate onSubmit={onSubmit}>
      <Segmented
        label="What is it"
        onChange={setKind}
        options={[
          { label: "Money in", value: "deposit" },
          { label: "Bank interest", value: "interest" },
        ]}
        value={kind}
      />
      <AmountInput
        data-autofocus
        error={error}
        label="Amount"
        onChange={(event) => {
          setAmount(event.target.value);
          setError(undefined);
        }}
        size="xl"
        value={amount}
      />
      <MoreDetails>
        <NepaliDateField label="Date" onChange={setDate} value={date} />
        {kind === "deposit" && pot.ownerMemberId === null && (
          <Segmented label="Put in by" onChange={setMemberId} options={members.map((m) => ({ label: label(m), value: m.id }))} value={memberId} />
        )}
      </MoreDetails>
    </form>
  );
}
```

- [ ] **Step 5: Check types, lint and tests**

Run: `npx tsc --noEmit`. Expected: no output.
Run: `npm run lint -- --fix`, then `npm run lint`. Expected: 0 errors.
Run: `npm test`. Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/modules/savings
git commit -m "feat(savings): deadlines, what-if hints and bank interest"
```

---

### Phase 6 checkpoint: STOP

- [ ] **Step 1: Run the full checks**

Run `npm test`, `npm run lint`, `npx tsc --noEmit`, and optionally `npm run test:e2e`. Expected: all clean.

- [ ] **Step 2: Report to the owner, then STOP**

Tell the owner, in plain language:
- **What changed:** the commits made, one line each.
- **Test results:** unit test totals, and whether e2e ran.
- **Migrations:** this phase has no database change.
- **What to try on the Savings page:**
  - Edit Mum's surgery and tick "needed by a certain date". If it can't be afforded in time, a red line says how late it is and how much more a month would fix it.
  - Items below the first one show "If you did this first: …".
  - "Add money" can now record bank interest.

Then **wait for the owner to say go on** before starting Phase 7.

---

## Phase 7: Fill the budget from recurring bills

**What this phase delivers:** a **"Fill from recurring"** button on Budget. It adds a budget line for each category and owner with active recurring bills due that month: every monthly bill, plus quarterly or yearly ones whose next due date is in the month. Lines that already exist are left alone. Design rule 22 applies. No database change.

### Task 7.1: Which bills belong in a month's budget

**Files:**
- Create: `src/modules/budget/lib/recurring-budget.ts`
- Create: `src/modules/budget/lib/recurring-budget.test.ts`

**Interfaces:**
- Produces:
  - `type RecurringBill = { amount: number; categoryId: string; frequency: "monthly" | "quarterly" | "yearly"; nextDueDate: string; ownerMemberId: null | string; status: "active" | "completed" | "paused" }`
  - `type RecurringBudgetLine = { categoryId: string; ownerMemberId: null | string; plannedAmount: number }`
  - `recurringBudgetLines(bills: RecurringBill[], period: { endDate: string; startDate: string }): RecurringBudgetLine[]`

- [ ] **Step 1: Write the failing test**

Create `src/modules/budget/lib/recurring-budget.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { type RecurringBill, recurringBudgetLines } from "./recurring-budget";

const OCTOBER = { endDate: "2026-10-31", startDate: "2026-10-01" };

function bill(overrides: Partial<RecurringBill>): RecurringBill {
  return { amount: 1000, categoryId: "internet", frequency: "monthly", nextDueDate: "2026-10-10", ownerMemberId: null, status: "active", ...overrides };
}

describe("recurringBudgetLines", () => {
  it("includes every active monthly bill", () => {
    expect(recurringBudgetLines([bill({ amount: 3000 })], OCTOBER)).toEqual([{ categoryId: "internet", ownerMemberId: null, plannedAmount: 3000 }]);
  });

  it("includes a quarterly or yearly bill only in the month it's due", () => {
    const lines = recurringBudgetLines(
      [
        bill({ amount: 9000, categoryId: "insurance", frequency: "quarterly", nextDueDate: "2026-10-20" }),
        bill({ amount: 12000, categoryId: "tax", frequency: "yearly", nextDueDate: "2027-04-01" }),
      ],
      OCTOBER,
    );

    expect(lines).toEqual([{ categoryId: "insurance", ownerMemberId: null, plannedAmount: 9000 }]);
  });

  it("leaves out paused and completed bills", () => {
    expect(recurringBudgetLines([bill({ status: "paused" }), bill({ status: "completed" })], OCTOBER)).toEqual([]);
  });

  it("adds up bills that share a category and owner", () => {
    const lines = recurringBudgetLines(
      [bill({ amount: 1000, ownerMemberId: "me" }), bill({ amount: 500, ownerMemberId: "me" }), bill({ amount: 700, ownerMemberId: null })],
      OCTOBER,
    );

    expect(lines).toEqual([
      { categoryId: "internet", ownerMemberId: "me", plannedAmount: 1500 },
      { categoryId: "internet", ownerMemberId: null, plannedAmount: 700 },
    ]);
  });
});
```

Run: `npx vitest run src/modules/budget/lib/recurring-budget.test.ts`
Expected: FAIL, because `./recurring-budget` can't be found.

- [ ] **Step 2: Write the code**

Create `src/modules/budget/lib/recurring-budget.ts`:

```ts
export type RecurringBill = {
  amount: number;
  categoryId: string;
  frequency: "monthly" | "quarterly" | "yearly";
  nextDueDate: string;
  ownerMemberId: null | string;
  status: "active" | "completed" | "paused";
};

export type RecurringBudgetLine = { categoryId: string; ownerMemberId: null | string; plannedAmount: number };

// Budget lines for a month from the recurring bills due in it: every active
// monthly bill, plus quarterly or yearly ones whose next due date falls in the
// month. Bills that share a category and owner are added together.
export function recurringBudgetLines(bills: RecurringBill[], period: { endDate: string; startDate: string }): RecurringBudgetLine[] {
  const lines = new Map<string, RecurringBudgetLine>();
  for (const bill of bills) {
    if (bill.status !== "active") continue;
    const dueThisMonth = bill.frequency === "monthly" || (bill.nextDueDate >= period.startDate && bill.nextDueDate <= period.endDate);
    if (!dueThisMonth) continue;
    const key = `${bill.categoryId}::${bill.ownerMemberId ?? "shared"}`;
    const line = lines.get(key) ?? { categoryId: bill.categoryId, ownerMemberId: bill.ownerMemberId, plannedAmount: 0 };
    line.plannedAmount += bill.amount;
    lines.set(key, line);
  }
  return [...lines.values()];
}
```

Run: `npx vitest run src/modules/budget/lib/recurring-budget.test.ts`
Expected: all 4 PASS.

- [ ] **Step 3: Commit**

```bash
git add src/modules/budget/lib/recurring-budget.ts src/modules/budget/lib/recurring-budget.test.ts
git commit -m "feat(budget): work out budget lines from recurring bills"
```

---

### Task 7.2: The "Fill from recurring" button

**Files:**
- Modify: `src/modules/budget/api/budget.actions.ts`
- Modify: `src/modules/budget/components/BudgetView.tsx`

**Interfaces:**
- Consumes: `recurringBudgetLines` (Task 7.1).
- Produces: `fillBudgetFromRecurringAction(year: number, month: number): Promise<number>`, which returns how many budget lines it added.

- [ ] **Step 1: Write the action**

In `src/modules/budget/api/budget.actions.ts`:

**(a)** Replace:

```ts
import { budgetItems, incomes, monthlyBudgets } from "@/db/schema";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
```

with:

```ts
import { budgetItems, incomes, monthlyBudgets, recurringExpenses } from "@/db/schema";
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { resolvePeriod } from "@/lib/month-period";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
```

**(b)** Replace:

```ts
import { budgetItemChanges, budgetItemSummary, incomeChanges, incomeSummary } from "../lib/budget-activity";
```

with:

```ts
import { budgetItemChanges, budgetItemSummary, incomeChanges, incomeSummary } from "../lib/budget-activity";
import { recurringBudgetLines } from "../lib/recurring-budget";
```

**(c)** Add this new action directly **before** `export async function getIncomesForMonth(`:

```ts
// Adds a budget line for each category and owner with recurring bills due this
// month. Lines that already exist are left alone, the same as copying last
// month. Returns how many lines it added.
export async function fillBudgetFromRecurringAction(year: number, month: number): Promise<number> {
  const member = await getCurrentMember();
  const { householdId } = member;
  const dateFormat = await getDateFormatPref(householdId);
  const period = resolvePeriod(year, month, dateFormat);

  const bills = await db.select().from(recurringExpenses).where(eq(recurringExpenses.householdId, householdId));
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

  const budget = await getOrCreateMonthlyBudget(householdId, year, month);
  const existingItems = await db.select().from(budgetItems).where(eq(budgetItems.monthlyBudgetId, budget.id));
  const existingKeys = new Set(existingItems.map((i) => `${i.categoryId}::${i.ownerMemberId ?? "shared"}`));
  const toInsert = lines
    .filter((line) => !existingKeys.has(`${line.categoryId}::${line.ownerMemberId ?? "shared"}`))
    .map((line) => ({
      categoryId: line.categoryId,
      monthlyBudgetId: budget.id,
      ownerMemberId: line.ownerMemberId,
      plannedAmount: String(line.plannedAmount),
    }));

  if (toInsert.length > 0) {
    const inserted = await db.insert(budgetItems).values(toInsert).returning();
    const f = await loadActivityFormatters(householdId);
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
```

- [ ] **Step 2: Add the button**

In `src/modules/budget/components/BudgetView.tsx`:

**(a)** Replace:

```tsx
import { ChevronRight, Copy, Plus } from "lucide-react";
```

with:

```tsx
import { ChevronRight, Copy, Plus, Repeat } from "lucide-react";
```

and replace:

```tsx
import { copyPreviousMonthBudgetAction } from "@/modules/budget/api/budget.actions";
```

with:

```tsx
import { copyPreviousMonthBudgetAction, fillBudgetFromRecurringAction } from "@/modules/budget/api/budget.actions";
```

**(b)** Replace:

```tsx
  const [copyPending, setCopyPending] = useState(false);
```

with:

```tsx
  const [copyPending, setCopyPending] = useState(false);
  const [fillPending, setFillPending] = useState(false);
```

**(c)** Replace:

```tsx
  return (
    <div>
      <PageHeader
        actions={
          <>
            <Button disabled={!props.canCopy || copyPending} onClick={() => void copy()} variant="ghost">
```

with:

```tsx
  async function fillFromRecurring() {
    setFillPending(true);
    try {
      const added = await fillBudgetFromRecurringAction(props.year, props.month);
      toast.success(added > 0 ? `Added ${added} ${added === 1 ? "line" : "lines"} from recurring bills` : "Nothing new to add from recurring bills");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fill");
    } finally {
      setFillPending(false);
    }
  }

  return (
    <div>
      <PageHeader
        actions={
          <>
            <Button disabled={fillPending} onClick={() => void fillFromRecurring()} variant="ghost">
              <Repeat />
              Fill from recurring
            </Button>
            <Button disabled={!props.canCopy || copyPending} onClick={() => void copy()} variant="ghost">
```

- [ ] **Step 3: Check types, lint and tests**

Run: `npx tsc --noEmit`. Expected: no output.
Run: `npm run lint -- --fix`, then `npm run lint`. Expected: 0 errors.
Run: `npm test`. Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/modules/budget/api/budget.actions.ts src/modules/budget/components/BudgetView.tsx
git commit -m "feat(budget): fill a month's budget from recurring bills"
```

---

### Phase 7 checkpoint: STOP (final)

- [ ] **Step 1: Run every check**

Run, in order:
1. `npm test`. Expected: all pass.
2. `npm run lint`. Expected: 0 errors.
3. `npx tsc --noEmit`. Expected: no output.
4. `npm run test:e2e`. If the e2e database can't be reached, say so.
5. `graphify update .`

- [ ] **Step 2: Final hand-back to the owner**

Report, in plain language:
- **What changed:** every commit on `feat/money-model`, grouped by phase (`git log --oneline main..feat/money-model`, or `git log --oneline -40` if `main` is far behind).
- **Test results:** unit test totals, and the e2e result.
- **What to try:** on Budget, press "Fill from recurring" for next month and check your monthly bills appear as lines.
- **What's still open:** anything you skipped and why. Voice privacy remains out of scope, as agreed.
- **Your uncommitted files:** remind the owner that `src/app/globals.css` and `src/components/nav/SidebarNav.tsx` are still their uncommitted work and were not touched.
- **What happens next:** nothing has been pushed or merged. That's the owner's call.
