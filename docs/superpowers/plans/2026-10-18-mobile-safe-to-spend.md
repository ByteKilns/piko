# Safe to Spend on the Phone's Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. If you don't have those skills, do the tasks in order, one step at a time. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The phone's Home opens with **Safe to spend today**, the same figure, status and wording as the website's Home hero, for the signed-in person.

**Architecture:** Four tasks on one branch.
- **Task 1 (website, refactor):** the pacing block in the website's Home page moves into one pure function, `viewerPacing`. Its "person's spending" step moves out of `personMonthMoney` into `personSpending`. The website shows exactly what it showed before.
- **Task 2 (website):** `GET /api/mobile/pacing` runs that same function for the phone's signed-in member, through a loader whose queries all take the household from the sign-in.
- **Task 3 (app):** the `Pacing` model, `ApiClient.fetchPacing()` and `pacingProvider`.
- **Task 4 (app):** the `SafeToSpendHero` widget at the top of Home, the refreshes, docs and release `1.5.0+8`.

Each task is one commit that leaves everything building with every test passing.

**Tech Stack:** Next.js 16 route handlers, Drizzle ORM (PostgreSQL), Vitest; Flutter 3.44 / Dart 3.12, flutter_riverpod 2, http (`MockClient`), flutter_test; Husky pre-commit hook (`tsc` + `next build`).

**Spec:** `docs/superpowers/specs/2026-10-18-mobile-safe-to-spend-design.md` (approved by the owner on 2026-10-18). Read it before starting.

**Verified:** on 2026-10-18 this plan was built first, then written from that build:
- **Dry run:** built in a throwaway copy of the repo from `main` at `7b36d66`, with a real `npm ci`. Every commit went through the real pre-commit hook (`tsc` and a full `next build`).
- **Test counts:** web 484 → 490 (Task 1) → 495 (Task 2); app 195 → 201 (Task 3) → 209 (Task 4). `flutter analyze` was clean throughout. Each task's new tests failed first, as its "verify it fails" step shows, then passed.
- **End to end:** the built website ran on a throwaway PostgreSQL seeded by `scripts/seed-e2e.ts`, with two members who both have Can cut lines (never the real database).
  - Signed in through the phone's own `POST /api/mobile/login`, `GET /api/mobile/pacing` returned each member's own figure (Rs 245 and Rs 325), and refused a request without a token.
  - Signed in on the website as each member, the Home hero showed the same Rs 245 and Rs 325.
- **Release build:** `flutter build apk --release --split-per-abi` built (arm64 18.3 MB).
- **Not run:** the app on a real phone (how the hero looks and feels). That's the owner's check at the final STOP.

If a step doesn't match what you see, something has changed since then. Stop and report rather than improvise.

## Global Constraints

- **Golden rule** (`AGENTS.md`): every query is scoped by the household, and the phone's household and member come from `requireMobileAuth`, never from the request.
- **No household-taking query goes in a `"use server"` file.** Every export of `expenses.actions.ts` is a Server Action the browser can call, so the new household-scoped query lives in its own plain module (`expenses-by-month.ts`).
- **The website's numbers don't change.** Task 1 is a pure move; the tests pin today's figures.
- **Privacy rule:** nothing here goes to any AI.
- **No new packages**, in either app.
- **No database changes in this plan.** Never run `npm run db:migrate` and never point anything at the real database.
- **The phone's wording is the website's:**
  - "SAFE TO SPEND TODAY"; "On track" / "Over budget".
  - "Spend up to this today on things you can cut and the week stays on plan."
  - "This week's allowance is fully spent. A new weekly allowance of Rs 2,100 starts on Sunday." (with "the next week" when there's no weekday).
  - With no Can cut lines: "Mark budget lines as Can cut on the website's Budget page to see what's safe to spend each day."
- **Release:** app version `1.5.0+8`. The website deploys before the APK is published.
- **Style:**
  - Imports, object keys and JSX props stay in the order ESLint enforces (`npm run lint -- --fix` fixes it). `npm run lint` must report no errors; the two existing warnings (`NepaliDateField.tsx`, `ExpenseDialog.tsx`) aren't this plan's.
  - Dart files keep the existing style, and `flutter analyze` must report no issues.

## Review Focus

Behaviour the spec implies that no automated test in this plan can reach, because it only happens on a real phone. Each line names where it is checked instead.

1. **The hero's look on a phone:** the big figure, the status square, and the line wrapping on a narrow screen. Checked at the STOP on the owner's phone.
2. **Coming back to Piko refreshes the figure** (`onResume` invalidates `pacingProvider`). Checked at the STOP: add an expense on the website, switch back to the app, and the figure changes.
3. **Approving drafts on the Review screen refreshes it** (invalidated when the Review screen closes). Checked at the STOP with a real eSewa draft.
4. **Offline:** the last figure stays. A widget test covers this; also checked at the STOP with airplane mode.
5. **Someone with no Can cut lines** sees the quiet line. A widget test covers this; also checked at the STOP for the partner's account if they have none.

## How to use this plan

- Do the tasks **in order**, 1 → 4. There is one **STOP checkpoint**, at the end: stop, send the owner the report it describes, and wait for them.
- Code blocks are complete. Every code step is one of these kinds:
  - **"Create `path` with:"** — a new file; paste the whole block.
  - **"In `path`, find:" … "Replace it with:"** — find the exact old text (match by text, not line number) and replace it with the new text. Each old block occurs exactly once in the file at that point. When a file has several, they're numbered "(1 of 3)" and so on; do them in that order. A block's last line break isn't part of the text: some old blocks end in the middle of a line, and the rest of that line stays as it is.
- Before Task 1, check `git branch --show-current` says `main` and `git status --short` shows only `esewa_capture.zip`. Then create the branch: `git switch -c feat/safe-to-spend`. Every task commits to that branch.
- Web commands run from the repo root. Flutter commands must run inside `mobile/`; each is written as `cd mobile; <command>; cd ..` so you end up back at the repo root.
- `esewa_capture.zip` in the repo root is unrelated to this plan. **Don't commit it and don't delete it.**
- The pre-commit hook runs `npx tsc --noEmit` and `npm run build` (15–25 s). Never bypass it with `--no-verify`; if it fails, fix the cause.

---

### Task 1: One Safe to spend calculation

**Files:**
- Create: `src/modules/dashboard/lib/home-pacing.ts`
- Modify: `src/modules/dashboard/lib/month-money.ts`, `src/modules/dashboard/pages/DashboardPage.tsx`, `src/modules/dashboard/components/HomeView.tsx`
- Test: `src/modules/dashboard/lib/home-pacing.test.ts`, `src/modules/dashboard/lib/month-money.test.ts`

**Interfaces:**
- Produces:
  - `type HomePacing` (moved here from `HomeView.tsx`, unchanged).
  - `weekdayOf(startDate, dayOfPeriod): string`.
  - `viewerPacing({ dateFormat, dayOfPeriod, month, period, plan, spending, year }): HomePacing | null`, where `plan` is `buildPersonPlan(...)` for the person and `spending` is `personSpending(...)`.
  - In `month-money.ts`: `personSpending({ expenses, memberId, memberIds }): { amount, categoryId, date }[]`.

- [ ] **Step 1: Write the failing tests**

In `src/modules/dashboard/lib/month-money.test.ts`, find (1 of 2):

```ts
import { type MonthMoneyInput, personMonthMoney } from "./month-money";
```

Replace it with:

```ts
import { type MonthMoneyInput, personMonthMoney, personSpending } from "./month-money";
```

In `src/modules/dashboard/lib/month-money.test.ts`, find (2 of 2):

```ts
    expect(money.unallocated).toBe(62000 + 38000 - 40000 - 5000);
  });
});
```

Replace it with:

```ts
    expect(money.unallocated).toBe(62000 + 38000 - 40000 - 5000);
  });
});

describe("personSpending", () => {
  it("is the spending personMonthMoney counts: their pay share of each expense they paid, plus what's to be paid back to them", () => {
    const expenses = [
      expense({ amount: "1000.00" }),
      expense({ amount: "2000.00", categoryId: "dates", paidByMemberId: HER, payBackAmount: "500.00" }),
      expense({ amount: "14690.00", fundAmount: "12000.00" }),
      expense({ amount: "800.00", savingsPotId: "pot" }),
    ];

    const spending = personSpending({ expenses, memberId: ME, memberIds: [ME, HER] });

    expect(spending).toEqual(personMonthMoney({ ...EMPTY, expenses }).spending);
    expect(spending).toEqual([
      { amount: 1000, categoryId: "lunch", date: "2026-10-20" },
      { amount: 500, categoryId: "dates", date: "2026-10-20" },
      { amount: 2690, categoryId: "lunch", date: "2026-10-20" },
    ]);
  });
});
```

Create `src/modules/dashboard/lib/home-pacing.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

import { resolvePeriod } from "@/lib/month-period";
import { buildPersonPlan } from "@/modules/budget/lib/budget-view";

import { viewerPacing, weekdayOf } from "./home-pacing";

// April 2026 (AD): 30 days from Wednesday 1 April. Rs 3,000 of lunches is
// can-cut money (Rs 490 a week, with a buffer held back for the last week);
// Rs 10,000 rent is fixed.
const PERIOD = resolvePeriod(2026, 4, "english");
const CATEGORIES = [
  { budgetType: "flexible" as const, id: "lunch", name: "Lunch" },
  { budgetType: "fixed" as const, id: "rent", name: "Rent" },
];
const LINES = [
  { categoryId: "lunch", inherited: false, kind: "can_cut" as const, plannedAmount: 3000 },
  { categoryId: "rent", inherited: false, kind: "fixed" as const, plannedAmount: 10000 },
];

type Spend = { amount: number; categoryId: string; date: string };

// Day 3 (Friday 3 April) of the month.
function pacingOn(spending: Spend[], lines = LINES) {
  const plan = buildPersonPlan({ categories: CATEGORIES, lines, spending });
  return viewerPacing({ dateFormat: "english", dayOfPeriod: 3, month: 4, period: PERIOD, plan, spending, year: 2026 });
}

describe("viewerPacing", () => {
  it("spreads what's left of this week's can-cut allowance over the days left in it", () => {
    expect(pacingOn([{ amount: 100, categoryId: "lunch", date: "2026-04-02" }])).toEqual({
      carryIn: 0,
      nextWeekAllowance: 490,
      nextWeekday: "Wednesday",
      over: false,
      overrunNote: null,
      safeToday: 78,
      weekLeft: 390,
      weeklyAllowance: 490,
    });
  });

  it("is over once this week's allowance is spent, and says when the next one starts", () => {
    expect(pacingOn([{ amount: 3000, categoryId: "lunch", date: "2026-04-02" }])).toMatchObject({
      nextWeekAllowance: 490,
      nextWeekday: "Wednesday",
      over: true,
      safeToday: 0,
      weekLeft: 0,
    });
  });

  it("takes another line's overrun out of the can-cut money and says so", () => {
    expect(
      pacingOn([
        { amount: 100, categoryId: "lunch", date: "2026-04-02" },
        { amount: 10500, categoryId: "rent", date: "2026-04-01" },
      ]),
    ).toMatchObject({
      overrunNote: "Rent went Rs 500.00 over, taken from your spending money.",
      safeToday: 62,
      weeklyAllowance: 408,
    });
  });

  it("is null without can-cut lines", () => {
    expect(pacingOn([], [LINES[1]])).toBeNull();
  });
});

describe("weekdayOf", () => {
  it("names the weekday of a day in the period", () => {
    expect(weekdayOf("2026-04-01", 1)).toBe("Wednesday");
    expect(weekdayOf("2026-04-01", 8)).toBe("Wednesday");
    expect(weekdayOf("2026-04-01", 5)).toBe("Sunday");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/modules/dashboard/lib`
Expected: FAIL. `home-pacing.test.ts` with `Error: Cannot find module './home-pacing' …`, and the new `personSpending` test with `TypeError: personSpending is not a function`: `Tests  1 failed | 36 passed (37)`.

- [ ] **Step 3: Implement it**

Create `src/modules/dashboard/lib/home-pacing.ts` with:

```ts
import type { DateFormat } from "@/lib/date-format-cookie";
import { overrunFromPlan, overrunNote, type PersonPlan } from "@/modules/budget/lib/budget-view";

import { spentByDayIn } from "./cash-flow";
import { buildPacingSchedule, currentWeekPacing, weekIndexOf, withOverrun } from "./pacing";

// Home's "Safe to spend today": the website's hero and the phone's both come
// from viewerPacing, so the two always agree.
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
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function weekdayOf(startDate: string, dayOfPeriod: number): string {
  const [year, month, day] = startDate.split("-").map(Number);
  return WEEKDAYS[new Date(year, month - 1, day + dayOfPeriod - 1).getDay()];
}

// Weekly pacing over one person's can-cut lines. Only can-cut spending counts
// against it day by day, and whatever went over elsewhere comes out of what's
// left, from this week on. Null when they have no can-cut lines.
export function viewerPacing(input: {
  dateFormat: DateFormat;
  // Today's day of the month's period (the last day for a month that's over).
  dayOfPeriod: number;
  month: number;
  period: { daysInPeriod: number; startDate: string };
  plan: PersonPlan;
  // What left their own wallet this month (personSpending).
  spending: { amount: number; categoryId: string; date: string }[];
  year: number;
}): HomePacing | null {
  const { dayOfPeriod, period, plan } = input;
  const canCut = plan.groups.find((g) => g.kind === "can_cut");
  if (!canCut) return null;

  const canCutIds = new Set(canCut.rows.map((r) => r.categoryId));
  const overrun = overrunFromPlan(plan);
  const baseSchedule = buildPacingSchedule({ daysInPeriod: period.daysInPeriod, flexibleTotal: canCut.planned });
  const schedule = withOverrun(baseSchedule, weekIndexOf(baseSchedule, dayOfPeriod), overrun.total);
  const spentByDay = spentByDayIn(input.spending, canCutIds, input.year, input.month, input.dateFormat);
  const week = currentWeekPacing(schedule, dayOfPeriod, spentByDay);

  return {
    carryIn: week.carryIn,
    nextWeekAllowance: schedule.weeks[week.index + 1]?.allowance ?? week.allowance,
    nextWeekday: weekdayOf(period.startDate, week.nextWeekStartDay),
    over: week.remaining <= 0,
    overrunNote: overrunNote(overrun),
    safeToday: week.safeToday,
    weekLeft: week.remaining,
    weeklyAllowance: week.allowance,
  };
}
```

In `src/modules/dashboard/lib/month-money.ts`, find (1 of 2):

```ts
const round2 = (value: number) => Math.round(value * 100) / 100;
```

Replace it with:

```ts
const round2 = (value: number) => Math.round(value * 100) / 100;

// What left one person's own wallet from pay, expense by expense: the part
// of each expense paid from pay (not a savings pot or fund), counted by who
// paid, with any "to be paid back" part moved onto the other person. Home's
// month figures and its Safe to spend both start from this.
export function personSpending(input: {
  expenses: ExpenseRow[];
  memberId: string;
  memberIds: string[];
}): { amount: number; categoryId: string; date: string }[] {
  return payRows(input.expenses).flatMap((e) =>
    walletShares(
      { amount: Number(e.amount), paidByMemberId: e.paidByMemberId, payBackAmount: e.payBackAmount === null ? null : Number(e.payBackAmount) },
      input.memberIds,
    ).flatMap((share) => (share.memberId === input.memberId ? [{ amount: share.amount, categoryId: e.categoryId, date: e.date }] : [])),
  );
}
```

In `src/modules/dashboard/lib/month-money.ts`, find (2 of 2):

```ts
  const spending = payRows(input.expenses).flatMap((e) =>
    walletShares(
      { amount: Number(e.amount), paidByMemberId: e.paidByMemberId, payBackAmount: e.payBackAmount === null ? null : Number(e.payBackAmount) },
      input.memberIds,
    ).flatMap((share) => (share.memberId === memberId ? [{ amount: share.amount, categoryId: e.categoryId, date: e.date }] : [])),
  );
```

Replace it with:

```ts
  const spending = personSpending(input);
```

In `src/modules/dashboard/pages/DashboardPage.tsx`, find (1 of 7):

```
import { buildPersonPlan, overrunFromPlan, overrunNote } from "@/modules/budget/lib/budget-view";
```

Replace it with:

```
import { buildPersonPlan } from "@/modules/budget/lib/budget-view";
```

In `src/modules/dashboard/pages/DashboardPage.tsx`, find (2 of 7):

```
  type HomeOwnerRow,
  type HomePacing,
```

Replace it with:

```
  type HomeOwnerRow,
```

In `src/modules/dashboard/pages/DashboardPage.tsx`, find (3 of 7):

```
import { daysLeftInMonth, spentByDayIn } from "@/modules/dashboard/lib/cash-flow";
```

Replace it with:

```
import { daysLeftInMonth } from "@/modules/dashboard/lib/cash-flow";
import { viewerPacing } from "@/modules/dashboard/lib/home-pacing";
```

In `src/modules/dashboard/pages/DashboardPage.tsx`, find (4 of 7):

```
import { personMonthMoney } from "@/modules/dashboard/lib/month-money";
import { buildPacingSchedule, currentWeekPacing, weekIndexOf, withOverrun } from "@/modules/dashboard/lib/pacing";
```

Replace it with:

```
import { personMonthMoney } from "@/modules/dashboard/lib/month-money";
```

In `src/modules/dashboard/pages/DashboardPage.tsx`, find (5 of 7):

```
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PAYBACKS_SHOWN = 3;
```

Replace it with:

```
const PAYBACKS_SHOWN = 3;
```

In `src/modules/dashboard/pages/DashboardPage.tsx`, find (6 of 7):

```
function weekdayOf(startDate: string, dayOfPeriod: number): string {
  const [year, month, day] = startDate.split("-").map(Number);
  return WEEKDAYS[new Date(year, month - 1, day + dayOfPeriod - 1).getDay()];
}

type Props =
```

Replace it with:

```
type Props =
```

In `src/modules/dashboard/pages/DashboardPage.tsx`, find (7 of 7):

```
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
```

Replace it with:

```
  // Weekly pacing over the can-cut lines: the hero's safe-to-spend figure,
  // worked out the same way for the phone's Home.
  const dayOfPeriod = isCurrentMonth ? daysElapsedInPeriod(period) : period.daysInPeriod;
  const pacing = viewerPacing({ dateFormat, dayOfPeriod, month, period, plan: viewerPlan, spending: viewerSpending, year });
```

In `src/modules/dashboard/components/HomeView.tsx`, find (1 of 2):

```
import { SettleCard, type SettleOptions } from "@/modules/cushion/components/SettleCard";
```

Replace it with:

```
import { SettleCard, type SettleOptions } from "@/modules/cushion/components/SettleCard";
import type { HomePacing } from "@/modules/dashboard/lib/home-pacing";
```

In `src/modules/dashboard/components/HomeView.tsx`, find (2 of 2):

```
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
};

export type HomePaybackRow
```

Replace it with:

```
export type HomePaybackRow
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx tsc --noEmit` then `npx vitest run src/modules/dashboard`
Expected: no type errors; `Tests  42 passed (42)`.

If `tsc` reports `Cannot find name 'LayoutProps'`, run `npx next typegen` once and try again.

- [ ] **Step 5: Commit**

```bash
npx eslint --fix src/modules/dashboard
git add src/modules/dashboard
git commit -m "refactor(dashboard): one Safe to spend calculation (viewerPacing) and one person's-spending step"
```

Expected: the hook passes. `npx vitest run` → `Tests  490 passed (490)`.

---

### Task 2: `GET /api/mobile/pacing`

**Files:**
- Create: `src/modules/expenses/api/expenses-by-month.ts`, `src/modules/dashboard/api/home-pacing.ts`, `src/app/api/mobile/pacing/route.ts`
- Modify: `src/modules/expenses/api/expenses.actions.ts` (`listExpensesForMonth` delegates to the new query)
- Test: `src/modules/dashboard/api/home-pacing.test.ts`, `src/app/api/mobile/pacing/route.test.ts`

**Interfaces:**
- Consumes: `viewerPacing`, `personSpending` (Task 1); existing `getDateFormatPref`, `getHouseholdMembers`, `listCategories`, `listPlanLines`, `requireMobileAuth`.
- Produces:
  - `listHouseholdExpensesForMonth(householdId, year, month, dateFormat)`.
  - `loadViewerPacing(householdId, memberId): Promise<HomePacing | null>`, for the current month in the household's calendar.
  - `GET /api/mobile/pacing` → 200 `{ pacing: HomePacing | null }`, or 401.

- [ ] **Step 1: Write the failing tests**

Create `src/modules/dashboard/api/home-pacing.test.ts` with:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getDateFormatPref } from "@/lib/date-format-cookie";
import { getHouseholdMembers } from "@/lib/session";
import { listPlanLines } from "@/modules/budget/api/budget";
import { listCategories } from "@/modules/categories/api/categories";
import { listHouseholdExpensesForMonth } from "@/modules/expenses/api/expenses-by-month";

import { loadViewerPacing } from "./home-pacing";

vi.mock("@/lib/date-format-cookie", () => ({ getDateFormatPref: vi.fn() }));
vi.mock("@/lib/session", () => ({ getHouseholdMembers: vi.fn() }));
vi.mock("@/modules/budget/api/budget", () => ({ listPlanLines: vi.fn() }));
vi.mock("@/modules/categories/api/categories", () => ({ listCategories: vi.fn() }));
vi.mock("@/modules/expenses/api/expenses-by-month", () => ({ listHouseholdExpensesForMonth: vi.fn() }));

const line = (ownerMemberId: string, categoryId: string, kind: "can_cut" | "fixed", plannedAmount: number) =>
  ({ categoryId, inherited: false, kind, ownerMemberId, plannedAmount }) as never;
const expense = (paidByMemberId: string, categoryId: string, amount: string, date: string) =>
  ({ amount, categoryId, date, fundAmount: null, paidByMemberId, payBackAmount: null, savingsPotId: null }) as never;

describe("loadViewerPacing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Friday 3 April 2026, Nepal time: day 3 of April in AD.
    vi.useFakeTimers({ now: new Date("2026-04-03T06:00:00Z"), toFake: ["Date"] });
    vi.mocked(getDateFormatPref).mockResolvedValue("english");
    vi.mocked(getHouseholdMembers).mockResolvedValue([{ id: "me" }, { id: "her" }] as never);
    vi.mocked(listCategories).mockResolvedValue([
      { budgetType: "flexible", id: "lunch", name: "Lunch" },
      { budgetType: "fixed", id: "rent", name: "Rent" },
    ] as never);
    vi.mocked(listPlanLines).mockResolvedValue([
      line("me", "lunch", "can_cut", 3000),
      line("me", "rent", "fixed", 10000),
      // Her lines and spending are hers: they don't change my figure.
      line("her", "lunch", "can_cut", 9000),
    ]);
    vi.mocked(listHouseholdExpensesForMonth).mockResolvedValue([
      expense("me", "lunch", "100.00", "2026-04-02"),
      expense("her", "lunch", "5000.00", "2026-04-02"),
    ]);
  });
  afterEach(() => vi.useRealTimers());

  it("works out the signed-in person's Safe to spend for this month, from their household only", async () => {
    await expect(loadViewerPacing("h1", "me")).resolves.toMatchObject({ over: false, safeToday: 78, weeklyAllowance: 490 });

    expect(getDateFormatPref).toHaveBeenCalledWith("h1");
    expect(getHouseholdMembers).toHaveBeenCalledWith("h1");
    expect(listCategories).toHaveBeenCalledWith("h1");
    expect(listPlanLines).toHaveBeenCalledWith("h1", 2026, 4);
    expect(listHouseholdExpensesForMonth).toHaveBeenCalledWith("h1", 2026, 4, "english");
  });

  it("is null for someone without can-cut lines", async () => {
    await expect(loadViewerPacing("h1", "nobody")).resolves.toBeNull();
  });
});
```

Create `src/app/api/mobile/pacing/route.test.ts` with:

```ts
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireMobileAuth } from "@/lib/mobile-request";
import { loadViewerPacing } from "@/modules/dashboard/api/home-pacing";

import { GET } from "./route";

vi.mock("@/lib/mobile-request", () => ({ requireMobileAuth: vi.fn() }));
vi.mock("@/modules/dashboard/api/home-pacing", () => ({ loadViewerPacing: vi.fn() }));

const pacing = {
  carryIn: 0,
  nextWeekAllowance: 490,
  nextWeekday: "Wednesday",
  over: false,
  overrunNote: null,
  safeToday: 78,
  weekLeft: 390,
  weeklyAllowance: 490,
};

function get() {
  return GET(new NextRequest("https://piko.test/api/mobile/pacing", { headers: { authorization: "Bearer jwt" } }));
}

describe("GET /api/mobile/pacing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireMobileAuth).mockResolvedValue({ householdId: "h1", memberId: "m1" } as never);
  });

  it("returns the signed-in member's Safe to spend", async () => {
    vi.mocked(loadViewerPacing).mockResolvedValue(pacing);

    const res = await get();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pacing });
    expect(loadViewerPacing).toHaveBeenCalledWith("h1", "m1");
  });

  it("returns null pacing without can-cut lines", async () => {
    vi.mocked(loadViewerPacing).mockResolvedValue(null);

    expect(await (await get()).json()).toEqual({ pacing: null });
  });

  it("refuses without a valid sign-in", async () => {
    vi.mocked(requireMobileAuth).mockResolvedValue(NextResponse.json({ error: { message: "Missing bearer token" } }, { status: 401 }));

    expect((await get()).status).toBe(401);
    expect(loadViewerPacing).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/modules/dashboard/api src/app/api/mobile/pacing`
Expected: FAIL with `Error: Cannot find package '@/modules/expenses/api/expenses-by-month' …` and `Error: Cannot find package '@/modules/dashboard/api/home-pacing' …`, and `Tests  no tests`.

- [ ] **Step 3: Implement it**

Create `src/modules/expenses/api/expenses-by-month.ts` with:

```ts
import { and, desc, eq, gte, lte } from "drizzle-orm";

import { db } from "@/db/client";
import { expenses } from "@/db/schema";
import type { DateFormat } from "@/lib/date-format-cookie";
import { resolvePeriod } from "@/lib/month-period";

// One household's expenses in a month's period, newest first. The caller
// passes the household from its own sign-in (the website's session or the
// phone's token). It lives outside expenses.actions.ts on purpose: every
// export there is a Server Action the browser could call with any id.
export async function listHouseholdExpensesForMonth(householdId: string, year: number, month: number, dateFormat: DateFormat) {
  const period = resolvePeriod(year, month, dateFormat);

  return db
    .select()
    .from(expenses)
    .where(and(eq(expenses.householdId, householdId), gte(expenses.date, period.startDate), lte(expenses.date, period.endDate)))
    .orderBy(desc(expenses.date), desc(expenses.createdAt));
}
```

In `src/modules/expenses/api/expenses.actions.ts`, find (1 of 3):

```ts
import { currentPeriodYearMonth, resolvePeriod } from "@/lib/month-period";
```

Replace it with:

```ts
import { currentPeriodYearMonth } from "@/lib/month-period";
```

In `src/modules/expenses/api/expenses.actions.ts`, find (2 of 3):

```ts
import { ExpenseValidationError } from "./expense-errors";
```

Replace it with:

```ts
import { ExpenseValidationError } from "./expense-errors";
import { listHouseholdExpensesForMonth } from "./expenses-by-month";
```

In `src/modules/expenses/api/expenses.actions.ts`, find (3 of 3):

```ts
  const { householdId } = await getCurrentMember();
  const period = resolvePeriod(year, month, dateFormat);

  return db
    .select()
    .from(expenses)
    .where(
      and(eq(expenses.householdId, householdId), gte(expenses.date, period.startDate), lte(expenses.date, period.endDate)),
    )
    .orderBy(desc(expenses.date), desc(expenses.createdAt));
```

Replace it with:

```ts
  const { householdId } = await getCurrentMember();
  return listHouseholdExpensesForMonth(householdId, year, month, dateFormat);
```

Create `src/modules/dashboard/api/home-pacing.ts` with:

```ts
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { currentPeriodYearMonth, daysElapsedInPeriod, resolvePeriod } from "@/lib/month-period";
import { getHouseholdMembers } from "@/lib/session";
import { listPlanLines } from "@/modules/budget/api/budget";
import { buildPersonPlan } from "@/modules/budget/lib/budget-view";
import { listCategories } from "@/modules/categories/api/categories";
import { listHouseholdExpensesForMonth } from "@/modules/expenses/api/expenses-by-month";

import { type HomePacing, viewerPacing } from "../lib/home-pacing";
import { personSpending } from "../lib/month-money";

// One person's Safe to spend today, for the phone's Home: this month in the
// household's calendar, worked out exactly as the website's Home does.
export async function loadViewerPacing(householdId: string, memberId: string): Promise<HomePacing | null> {
  const dateFormat = await getDateFormatPref(householdId);
  const { month, year } = currentPeriodYearMonth(dateFormat);
  const period = resolvePeriod(year, month, dateFormat);
  const [members, categories, planLines, expenses] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    listPlanLines(householdId, year, month),
    listHouseholdExpensesForMonth(householdId, year, month, dateFormat),
  ]);

  const spending = personSpending({ expenses, memberId, memberIds: members.map((m) => m.id) });
  const plan = buildPersonPlan({
    categories: categories.map((c) => ({ budgetType: c.budgetType, id: c.id, name: c.name })),
    lines: planLines.filter((l) => l.ownerMemberId === memberId),
    spending,
  });
  return viewerPacing({ dateFormat, dayOfPeriod: daysElapsedInPeriod(period), month, period, plan, spending, year });
}
```

Create `src/app/api/mobile/pacing/route.ts` with:

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requireMobileAuth } from "@/lib/mobile-request";
import { loadViewerPacing } from "@/modules/dashboard/api/home-pacing";

// The phone's "Safe to spend today": the signed-in member's figure, the same
// one the website's Home shows. Null without can-cut budget lines.
export async function GET(request: NextRequest) {
  const auth = await requireMobileAuth(request);
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({ pacing: await loadViewerPacing(auth.householdId, auth.memberId) });
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx tsc --noEmit` then `npx vitest run src/modules/dashboard src/app/api/mobile/pacing src/modules/expenses`
Expected: no type errors; every test passes (`Tests  88 passed (88)`).

- [ ] **Step 5: Commit**

```bash
npx eslint --fix src/modules/expenses/api src/modules/dashboard/api src/app/api/mobile/pacing
git add src/modules/expenses/api src/modules/dashboard/api src/app/api/mobile/pacing
git commit -m "feat(mobile-api): GET /api/mobile/pacing, the signed-in member's Safe to spend"
```

Expected: the hook passes, and the build's route list includes `ƒ /api/mobile/pacing`. `npx vitest run` → `Tests  495 passed (495)`.

---

### Task 3: The app fetches Safe to spend

**Files:**
- Create: `mobile/lib/models/pacing.dart`, `mobile/lib/providers/pacing_provider.dart`
- Modify: `mobile/lib/services/money.dart` (`formatRupees`), `mobile/lib/esewa/esewa_service.dart` (`DrainResult.draftLine` uses it), `mobile/lib/services/api_client.dart` (`fetchPacing`)
- Test: `mobile/test/models/pacing_test.dart`, `mobile/test/services/money_test.dart`, `mobile/test/services/api_client_test.dart`

**Interfaces:**
- Consumes: `GET /api/mobile/pacing` (Task 2).
- Produces:
  - `class Pacing { nextWeekAllowance, nextWeekday?, over, overrunNote?, safeToday }`, with `Pacing.fromJson`.
  - `ApiClient.fetchPacing(): Future<Pacing?>`.
  - `pacingProvider` (`FutureProvider.autoDispose<Pacing?>`).
  - `formatRupees(double): String` (e.g. "Rs 2,100", "Rs 1,250.50").

- [ ] **Step 1: Write the failing tests**

In `mobile/test/services/money_test.dart`, find:

```dart
  group('sanitizeAmountInput', () {
```

Replace it with:

```dart
  group('formatRupees', () {
    test('drops whole-rupee paisa, as in "Rs 2,100"', () {
      expect(formatRupees(2100), 'Rs 2,100');
      expect(formatRupees(0), 'Rs 0');
    });

    test('keeps paisa when there are some', () {
      expect(formatRupees(1250.5), 'Rs 1,250.50');
    });
  });

  group('sanitizeAmountInput', () {
```

In `mobile/test/services/api_client_test.dart`, find:

```dart
    test('createExpense posts the draft and returns the created expense', () async {
```

Replace it with:

```dart
    test('fetchPacing sends the bearer token and reads Safe to spend', () async {
      final mockClient = MockClient((request) async {
        expect(request.method, 'GET');
        expect(request.url.toString(), 'https://example.com/api/mobile/pacing');
        expect(request.headers['Authorization'], 'Bearer jwt-123');
        return http.Response(
          jsonEncode({
            'pacing': {
              'carryIn': 0,
              'nextWeekAllowance': 490,
              'nextWeekday': 'Wednesday',
              'over': false,
              'overrunNote': null,
              'safeToday': 78,
              'weekLeft': 390,
              'weeklyAllowance': 490,
            },
          }),
          200,
        );
      });
      final client = ApiClient(
        getBaseUrl: () => 'https://example.com',
        getToken: () => 'jwt-123',
        onUnauthorized: () {},
        client: mockClient,
      );

      final pacing = await client.fetchPacing();

      expect(pacing!.safeToday, 78);
      expect(pacing.over, isFalse);
      expect(pacing.nextWeekday, 'Wednesday');
    });

    test('fetchPacing is null without can-cut lines, and throws when the server fails', () async {
      var fail = false;
      final mockClient = MockClient((request) async => fail
          ? http.Response(jsonEncode({'error': {'message': 'Boom'}}), 500)
          : http.Response(jsonEncode({'pacing': null}), 200));
      final client = ApiClient(
        getBaseUrl: () => 'https://example.com',
        getToken: () => 'jwt-123',
        onUnauthorized: () {},
        client: mockClient,
      );

      expect(await client.fetchPacing(), isNull);
      fail = true;
      await expectLater(client.fetchPacing(), throwsA(isA<ApiException>()));
    });

    test('createExpense posts the draft and returns the created expense', () async {
```

Create `mobile/test/models/pacing_test.dart` with:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/models/pacing.dart';

void main() {
  test('Pacing.fromJson reads Safe to spend', () {
    final pacing = Pacing.fromJson({
      'carryIn': 980,
      'nextWeekAllowance': 2100.5,
      'nextWeekday': 'Sunday',
      'over': true,
      'overrunNote': 'Rent went Rs 500.00 over, taken from your spending money.',
      'safeToday': 0,
      'weekLeft': 0,
      'weeklyAllowance': 2100,
    });

    expect(pacing.safeToday, 0);
    expect(pacing.over, isTrue);
    expect(pacing.nextWeekAllowance, 2100.5);
    expect(pacing.nextWeekday, 'Sunday');
    expect(pacing.overrunNote, 'Rent went Rs 500.00 over, taken from your spending money.');
  });

  test('Pacing.fromJson allows no next weekday and no overrun note', () {
    final pacing = Pacing.fromJson({
      'nextWeekAllowance': 490,
      'nextWeekday': null,
      'over': false,
      'overrunNote': null,
      'safeToday': 78,
    });

    expect(pacing.nextWeekday, isNull);
    expect(pacing.overrunNote, isNull);
  });
}
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd mobile; flutter test test/models/pacing_test.dart test/services/money_test.dart test/services/api_client_test.dart; cd ..`
Expected: FAIL to compile with `Error: Error when reading 'lib/models/pacing.dart': The system cannot find the file specified`, and `formatRupees` / `fetchPacing` not found.

- [ ] **Step 3: Implement it**

In `mobile/lib/services/money.dart`, find:

```dart
String _group(String digits) =>
```

Replace it with:

```dart
// An amount in a sentence, e.g. "Rs 2,100" or "Rs 1,250.50": paisa only
// when there are some.
String formatRupees(double value) {
  final parts = splitAmount(value);
  return 'Rs ${parts.negative ? '−' : ''}${parts.integer}${parts.decimals == '.00' ? '' : parts.decimals}';
}

String _group(String digits) =>
```

In `mobile/lib/esewa/esewa_service.dart`, find:

```dart
  static String draftLine(Txn t) {
    final amount = splitAmount(t.amount);
    final rupees = 'Rs ${amount.integer}${amount.decimals == '.00' ? '' : amount.decimals}';
    final payee = t.counterparty;
```

Replace it with:

```dart
  static String draftLine(Txn t) {
    final rupees = formatRupees(t.amount);
    final payee = t.counterparty;
```

In `mobile/lib/services/api_client.dart`, find (1 of 2):

```dart
  Future<AppRelease?> fetchLatestRelease() async {
```

Replace it with:

```dart
  /// The signed-in person's Safe to spend today; null without can-cut lines.
  Future<Pacing?> fetchPacing() async {
    final body = await _authorizedGet('/api/mobile/pacing');
    final pacing = body['pacing'];
    return pacing == null ? null : Pacing.fromJson(pacing as Map<String, dynamic>);
  }

  Future<AppRelease?> fetchLatestRelease() async {
```

In `mobile/lib/services/api_client.dart`, find (2 of 2):

```dart
import '../models/expense_draft.dart';
```

Replace it with:

```dart
import '../models/expense_draft.dart';
import '../models/pacing.dart';
```

Create `mobile/lib/models/pacing.dart` with:

```dart
// The person's "Safe to spend today" from /api/mobile/pacing: the website's
// Home hero figure (weekly pacing over their can-cut budget lines).
class Pacing {
  const Pacing({
    required this.nextWeekAllowance,
    required this.nextWeekday,
    required this.over,
    required this.overrunNote,
    required this.safeToday,
  });

  // The weekly allowance that starts next, and on which weekday.
  final double nextWeekAllowance;
  final String? nextWeekday;

  // This week's allowance is spent.
  final bool over;

  // Set when another line went over and was taken from the can-cut money.
  final String? overrunNote;

  final double safeToday;

  factory Pacing.fromJson(Map<String, dynamic> json) => Pacing(
        nextWeekAllowance: (json['nextWeekAllowance'] as num).toDouble(),
        nextWeekday: json['nextWeekday'] as String?,
        over: json['over'] as bool,
        overrunNote: json['overrunNote'] as String?,
        safeToday: (json['safeToday'] as num).toDouble(),
      );
}
```

Create `mobile/lib/providers/pacing_provider.dart` with:

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/pacing.dart';
import 'api_client_provider.dart';

// Home's Safe to spend today. Home refreshes it when the app comes back,
// on pull to refresh, after saving an expense and after the Review screen.
final pacingProvider = FutureProvider.autoDispose<Pacing?>((ref) => ref.watch(apiClientProvider).fetchPacing());
```

- [ ] **Step 4: Run them to verify they pass**

Run: `cd mobile; flutter analyze; flutter test; cd ..`
Expected: `No issues found!`; `All tests passed!` with 201 tests. The eSewa tests still pass with `draftLine` now using `formatRupees`.

- [ ] **Step 5: Commit**

```bash
git add mobile/lib mobile/test
git commit -m "feat(mobile): fetch Safe to spend (Pacing model, fetchPacing, pacingProvider)"
```

Expected: the hook passes.

---

### Task 4: Safe to spend at the top of Home

**Files:**
- Create: `mobile/lib/widgets/safe_to_spend_hero.dart`
- Modify: `mobile/lib/screens/home_screen.dart`, `mobile/pubspec.yaml`, `docs/architecture.md`, `mobile/README.md`
- Test: `mobile/test/widgets/safe_to_spend_hero_test.dart`, `mobile/test/screens/home_screen_test.dart`

**Interfaces:**
- Consumes: `Pacing`, `pacingProvider`, `formatRupees` (Task 3); existing `StepSquares`, `MoneyText`.
- Produces: `SafeToSpendHero({required AsyncValue<Pacing?> pacing})`, the first item in Home's list. Home invalidates `pacingProvider` on resume, on pull to refresh, after saving an expense and after the Review screen closes.

- [ ] **Step 1: Write the failing tests**

Create `mobile/test/widgets/safe_to_spend_hero_test.dart` with:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/models/pacing.dart';
import 'package:piko/theme/app_theme.dart';
import 'package:piko/widgets/safe_to_spend_hero.dart';
import 'package:piko/widgets/step_squares.dart';

const _onTrack = Pacing(nextWeekAllowance: 490, nextWeekday: 'Wednesday', over: false, overrunNote: null, safeToday: 78);
const _over = Pacing(nextWeekAllowance: 2100, nextWeekday: 'Sunday', over: true, overrunNote: null, safeToday: 0);

void main() {
  Future<void> pump(WidgetTester tester, AsyncValue<Pacing?> pacing) => tester.pumpWidget(
        MaterialApp(theme: AppTheme.light, home: Scaffold(body: SafeToSpendHero(pacing: pacing))),
      );

  testWidgets('on track: the figure, the status and what it means', (tester) async {
    await pump(tester, const AsyncValue.data(_onTrack));

    expect(find.text('SAFE TO SPEND TODAY'), findsOneWidget);
    expect(find.text('On track'), findsOneWidget);
    expect(find.textContaining('78', findRichText: true), findsOneWidget);
    expect(find.text('Spend up to this today on things you can cut and the week stays on plan.'), findsOneWidget);
  });

  testWidgets('over: says the allowance is spent and when the next one starts', (tester) async {
    await pump(tester, const AsyncValue.data(_over));

    expect(find.text('Over budget'), findsOneWidget);
    expect(
      find.text("This week's allowance is fully spent. A new weekly allowance of Rs 2,100 starts on Sunday."),
      findsOneWidget,
    );

    await pump(
      tester,
      const AsyncValue.data(Pacing(nextWeekAllowance: 2100, nextWeekday: null, over: true, overrunNote: null, safeToday: 0)),
    );
    expect(find.textContaining('starts on the next week.'), findsOneWidget);
  });

  testWidgets("shows why another line's overrun came out of it", (tester) async {
    await pump(
      tester,
      const AsyncValue.data(Pacing(
        nextWeekAllowance: 408,
        nextWeekday: 'Wednesday',
        over: false,
        overrunNote: 'Rent went Rs 500.00 over, taken from your spending money.',
        safeToday: 62,
      )),
    );

    expect(find.text('Rent went Rs 500.00 over, taken from your spending money.'), findsOneWidget);
  });

  testWidgets('without can-cut lines, says where to set them up', (tester) async {
    await pump(tester, const AsyncValue.data(null));

    expect(find.text('SAFE TO SPEND TODAY'), findsNothing);
    expect(
      find.text("Mark budget lines as Can cut on the website's Budget page to see what's safe to spend each day."),
      findsOneWidget,
    );
  });

  testWidgets('the stepping squares while it first loads; nothing if that fails', (tester) async {
    await pump(tester, const AsyncValue.loading());
    expect(find.byType(StepSquares), findsOneWidget);

    await pump(tester, AsyncValue.error(Exception('offline'), StackTrace.empty));
    expect(find.byType(StepSquares), findsNothing);
    expect(find.text('SAFE TO SPEND TODAY'), findsNothing);
  });

  testWidgets('keeps the last figure while refreshing and when a refresh fails', (tester) async {
    var calls = 0;
    final pacing = FutureProvider.autoDispose<Pacing?>((ref) async {
      calls++;
      if (calls == 1) return _onTrack;
      throw Exception('offline');
    });
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light,
          home: Scaffold(body: Consumer(builder: (context, ref, _) => SafeToSpendHero(pacing: ref.watch(pacing)))),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('78', findRichText: true), findsOneWidget);

    ProviderScope.containerOf(tester.element(find.byType(SafeToSpendHero))).invalidate(pacing);
    await tester.pump();
    expect(find.byType(StepSquares), findsNothing);
    expect(find.textContaining('78', findRichText: true), findsOneWidget);

    await tester.pumpAndSettle();
    expect(calls, 2);
    expect(find.textContaining('78', findRichText: true), findsOneWidget);
  });
}
```

In `mobile/test/screens/home_screen_test.dart`, find (1 of 7):

```dart
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
```

Replace it with:

```dart
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
```

In `mobile/test/screens/home_screen_test.dart`, find (2 of 7):

```dart
import 'package:piko/models/member_option.dart';
```

Replace it with:

```dart
import 'package:piko/models/member_option.dart';
import 'package:piko/models/pacing.dart';
import 'package:piko/providers/api_client_provider.dart';
```

In `mobile/test/screens/home_screen_test.dart`, find (3 of 7):

```dart
import 'package:piko/providers/expenses_provider.dart';
```

Replace it with:

```dart
import 'package:piko/providers/expenses_provider.dart';
import 'package:piko/providers/pacing_provider.dart';
```

In `mobile/test/screens/home_screen_test.dart`, find (4 of 7):

```dart
import 'package:piko/screens/voice_capture_screen.dart';
import 'package:piko/services/bs_calendar.dart';
```

Replace it with:

```dart
import 'package:piko/screens/voice_capture_screen.dart';
import 'package:piko/services/api_client.dart';
import 'package:piko/services/bs_calendar.dart';
```

In `mobile/test/screens/home_screen_test.dart`, find (5 of 7):

```dart
  Future<void> pumpHome(WidgetTester tester, {AlertTarget? openedFrom}) async {
```

Replace it with:

```dart
  // How many times Home asked for Safe to spend.
  late int pacingLoads;

  Future<void> pumpHome(WidgetTester tester, {AlertTarget? openedFrom}) async {
    pacingLoads = 0;
    // Saving an expense posts it; the server echoes it back.
    final api = ApiClient(
      getBaseUrl: () => 'https://piko.test',
      getToken: () => 'jwt',
      onUnauthorized: () {},
      client: MockClient((request) async {
        final draft = jsonDecode(request.body) as Map<String, dynamic>;
        return http.Response(jsonEncode({'expense': {...draft, 'id': 'exp-1'}}), 201);
      }),
    );
```

In `mobile/test/screens/home_screen_test.dart`, find (6 of 7):

```dart
          esewaAlertsProvider.overrideWithValue(_Alerts(openedFrom)),
```

Replace it with:

```dart
          apiClientProvider.overrideWithValue(api),
          pacingProvider.overrideWith((ref) async {
            pacingLoads++;
            return const Pacing(nextWeekAllowance: 490, nextWeekday: 'Wednesday', over: false, overrunNote: null, safeToday: 78);
          }),
          esewaAlertsProvider.overrideWithValue(_Alerts(openedFrom)),
```

In `mobile/test/screens/home_screen_test.dart`, find (7 of 7):

```dart
    expect(find.byType(ExpenseConfirmSheet), findsOneWidget);
  });
}
```

Replace it with:

```dart
    expect(find.byType(ExpenseConfirmSheet), findsOneWidget);
  });

  testWidgets('Safe to spend sits at the top of Home', (tester) async {
    await pumpHome(tester);

    expect(find.text('SAFE TO SPEND TODAY'), findsOneWidget);
    expect(
      tester.getTopLeft(find.text('SAFE TO SPEND TODAY')).dy,
      lessThan(tester.getTopLeft(find.text('Recent expenses')).dy),
    );
  });

  testWidgets('saving an expense refreshes Safe to spend', (tester) async {
    await pumpHome(tester);
    expect(pacingLoads, 1);

    await tester.tap(find.text('Add expense'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('amount-field')), '500');
    await tester.pump();
    await tester.tap(find.byKey(const Key('save-button')));
    await tester.pumpAndSettle();

    expect(find.byType(ExpenseConfirmSheet), findsNothing);
    expect(pacingLoads, 2);
  });
}
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd mobile; flutter test test/widgets/safe_to_spend_hero_test.dart test/screens/home_screen_test.dart; cd ..`
Expected: FAIL. The hero test doesn't compile (`Error when reading 'lib/widgets/safe_to_spend_hero.dart'`). In the Home tests, "Safe to spend sits at the top of Home" finds no `SAFE TO SPEND TODAY`, and "saving an expense refreshes Safe to spend" expects `pacingLoads` 1 but gets 0.

- [ ] **Step 3: Implement it**

Create `mobile/lib/widgets/safe_to_spend_hero.dart` with:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/pacing.dart';
import '../services/money.dart';
import '../theme/app_theme.dart';
import 'money_text.dart';
import 'step_squares.dart';

// The top of Home: "Safe to spend today", the website's Home hero. The
// stepping squares while it first loads; afterwards a refresh keeps the last
// figure and cross-fades the new one in. Hidden if it never loaded.
class SafeToSpendHero extends StatelessWidget {
  const SafeToSpendHero({super.key, required this.pacing});

  final AsyncValue<Pacing?> pacing;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;

    if (!pacing.hasValue) {
      if (pacing.hasError) return const SizedBox.shrink();
      return const Padding(
        padding: EdgeInsets.only(bottom: 20),
        child: Align(alignment: Alignment.centerLeft, child: StepSquares()),
      );
    }

    final value = pacing.value;
    if (value == null) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 20),
        child: Text(
          "Mark budget lines as Can cut on the website's Budget page to see what's safe to spend each day.",
          style: text.bodySmall,
        ),
      );
    }
    return Padding(padding: const EdgeInsets.only(bottom: 24), child: _Figure(pacing: value));
  }
}

class _Figure extends StatelessWidget {
  const _Figure({required this.pacing});

  final Pacing pacing;

  @override
  Widget build(BuildContext context) {
    final c = context.piko;
    final text = Theme.of(context).textTheme;
    final still = MediaQuery.disableAnimationsOf(context);
    final statusColor = pacing.over ? c.signalInk : c.ink;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text('SAFE TO SPEND TODAY', style: text.labelSmall),
            const SizedBox(width: 14),
            Container(width: 6, height: 6, color: pacing.over ? c.signal : c.ink),
            const SizedBox(width: 6),
            Text(
              pacing.over ? 'Over budget' : 'On track',
              style: text.bodySmall!.copyWith(color: statusColor, fontWeight: FontWeight.w600),
            ),
          ],
        ),
        const SizedBox(height: 10),
        // A new figure cross-fades in rather than flipping.
        AnimatedSwitcher(
          duration: still ? Duration.zero : const Duration(milliseconds: 200),
          layoutBuilder: (current, previous) => Stack(alignment: Alignment.centerLeft, children: [...previous, ?current]),
          child: Row(
            key: ValueKey(pacing.safeToday),
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text('Rs ', style: text.headlineLarge),
              MoneyText(pacing.safeToday, style: text.displaySmall),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Text(
          pacing.over
              ? "This week's allowance is fully spent. A new weekly allowance of ${formatRupees(pacing.nextWeekAllowance)} "
                  'starts on ${pacing.nextWeekday ?? 'the next week'}.'
              : 'Spend up to this today on things you can cut and the week stays on plan.',
          style: text.bodyMedium,
        ),
        if (pacing.overrunNote case final note?) ...[
          const SizedBox(height: 6),
          Text(note, style: text.bodySmall!.copyWith(color: c.signalInk)),
        ],
      ],
    );
  }
}
```

In `mobile/lib/screens/home_screen.dart`, find (1 of 7):

```dart
import '../providers/expenses_provider.dart';
```

Replace it with:

```dart
import '../providers/expenses_provider.dart';
import '../providers/pacing_provider.dart';
```

In `mobile/lib/screens/home_screen.dart`, find (2 of 7):

```dart
import '../widgets/money_text.dart';
```

Replace it with:

```dart
import '../widgets/money_text.dart';
import '../widgets/safe_to_spend_hero.dart';
```

In `mobile/lib/screens/home_screen.dart`, find (3 of 7):

```dart
        ref.invalidate(availableUpdateProvider);
        ref.invalidate(esewaAccessProvider);
```

Replace it with:

```dart
        ref.invalidate(availableUpdateProvider);
        ref.invalidate(esewaAccessProvider);
        ref.invalidate(pacingProvider);
```

In `mobile/lib/screens/home_screen.dart`, find (4 of 7):

```dart
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const EsewaReviewScreen()));
    ref.invalidate(esewaDraftCountProvider);
    ref.invalidate(recentExpensesProvider);
```

Replace it with:

```dart
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const EsewaReviewScreen()));
    ref.invalidate(esewaDraftCountProvider);
    ref.invalidate(recentExpensesProvider);
    // Approved drafts are spending now.
    ref.invalidate(pacingProvider);
```

In `mobile/lib/screens/home_screen.dart`, find (5 of 7):

```dart
              await client.createExpense(finalDraft);
              ref.invalidate(recentExpensesProvider);
```

Replace it with:

```dart
              await client.createExpense(finalDraft);
              ref.invalidate(recentExpensesProvider);
              ref.invalidate(pacingProvider);
```

In `mobile/lib/screens/home_screen.dart`, find (6 of 7):

```dart
    final draftCount = ref.watch(esewaDraftCountProvider);
```

Replace it with:

```dart
    final pacing = ref.watch(pacingProvider);
    final draftCount = ref.watch(esewaDraftCountProvider);
```

In `mobile/lib/screens/home_screen.dart`, find (7 of 7):

```dart
        onRefresh: () async {
          ref.invalidate(recentExpensesProvider);
          await _checkEsewa();
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          children: [
```

Replace it with:

```dart
        onRefresh: () async {
          ref.invalidate(recentExpensesProvider);
          ref.invalidate(pacingProvider);
          await _checkEsewa();
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          children: [
            SafeToSpendHero(pacing: pacing),
```

In `mobile/pubspec.yaml`, find:

```yaml
version: 1.4.1+7
```

Replace it with:

```yaml
version: 1.5.0+8
```

In `docs/architecture.md`, find:

```markdown
  from pay counts against it day by day (`spentByDayIn` in `dashboard/lib/cash-flow.ts`);
  overruns elsewhere shrink the weeks left instead.
```

Replace it with:

```markdown
  from pay counts against it day by day (`spentByDayIn` in `dashboard/lib/cash-flow.ts`);
  overruns elsewhere shrink the weeks left instead. The hero's figure comes from
  `viewerPacing` (`dashboard/lib/home-pacing.ts`), which the website's Home and the
  phone's (`GET /api/mobile/pacing` → `loadViewerPacing` in `dashboard/api/home-pacing.ts`)
  both call, so the two always agree. The phone always shows the signed-in member.
```

In `mobile/README.md`, find:

```markdown
eSewa payments arrive as drafts to review (Home → "N eSewa payments to review"); only
```

Replace it with:

```markdown
Home opens with **Safe to spend today**, the website's Home figure for the signed-in
person (`GET /api/mobile/pacing`): it needs Can cut budget lines, set on the website.

eSewa payments arrive as drafts to review (Home → "N eSewa payments to review"); only
```

- [ ] **Step 4: Run them to verify they pass**

Run: `cd mobile; flutter analyze; flutter test; cd ..`
Expected: `No issues found!`; `All tests passed!` with 209 tests.

Then: `cd mobile; flutter build apk --release --split-per-abi; cd ..`
Expected: `√ Built build\app\outputs\flutter-apk\app-arm64-v8a-release.apk`.

- [ ] **Step 5: Commit**

```bash
git add mobile/lib mobile/test mobile/pubspec.yaml docs/architecture.md mobile/README.md
git commit -m "feat(mobile): Safe to spend today at the top of Home; release 1.5.0+8"
```

Expected: the hook passes. `npx vitest run` → `Tests  495 passed (495)`; `npm run lint` → `✖ 2 problems (0 errors, 2 warnings)` (the existing two).

---

## STOP: hand over to the owner

Don't merge, push or publish anything. Send the owner this report, then wait:

1. **What was built:** the four commits on `feat/safe-to-spend` (`git log --oneline main..`), the test counts (web 495, app 209), the lint and analyze results, and that the arm64 APK built.
2. **What the owner does next:**
   1. Merge into `main` and push. Vercel deploys the website with the new endpoint.
   2. Publish 1.5.0+8, with the release button once it's set up, or by hand from Settings → App updates.
   3. On the phone, check:
      - the hero at the top of Home, with the same figure as the website's Home;
      - add an expense from the phone, and the figure updates;
      - add one on the website, come back to the app, and it updates;
      - approve an eSewa draft, and it updates after the Review screen;
      - in airplane mode, the last figure stays.
3. **What wasn't run:** the app on a real phone. That's step 3 above.
