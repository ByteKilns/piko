# Public Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. If you don't have those skills, do the tasks in order, one step at a time. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public `/demo` link where anyone can try Piko on their own, in a private copy of a made-up household, with guided tours and an on-screen phone that shows what the mobile app does — without ever seeing the owner's real data.

**Architecture:** Twelve tasks on one branch, each one commit that leaves the app building with every test passing. Tasks 1–5 build the sandbox: a marker on households (`demo_expires_at`), demo-only accounts on a reserved email domain, a fixture builder for "Aarav & Sita", the `/demo` page that creates a visitor's private copy and signs them in, cleanup with two guards, and a banner. Tasks 6–9 build the on-screen phone from pieces the website already has. Tasks 10–11 add the driver.js tours, and Task 12 documents it. Everything lives in `src/modules/demo/`; the rest of the app only gains small hooks (a flag on the signed-in member, a few `data-tour` labels).

**Tech Stack:** Next.js 16.3 (App Router, Turbopack), React 19, TypeScript, Tailwind v4, Drizzle ORM on PostgreSQL, next-auth v5 beta (credentials, JWT), Vitest, Playwright, driver.js 1.9 (MIT, new).

**Spec:** `docs/superpowers/specs/2026-10-15-public-demo-design.md` (approved by the owner on 2026-10-15). Read it before starting. Task 12 updates it in the few places where building it showed a better way; the "Design (agreed)" section below lists those.

**Verified:** on 2026-10-15 this whole plan was dry-run end to end in a throwaway copy of the repo, starting from commit `0663df3`:
- The code was built task by task and looked at in the running app: `/demo`, Home, Budget and Settings in a demo, the phone on a laptop and full screen at phone size, the Add expense dialog (unchanged, still two columns), and the tours.
- This file was then replayed in a fresh copy of the repo. Every step applied cleanly, in order, exactly as written; each of the twelve commits went through the real pre-commit hook (`tsc` + `next build`) and matched the dry run file for file (the generated migration matched by content).
- Each task's new unit tests failed first with the error shown in its Step 2. The unit suite grows from 420 to 453 tests.
- The 17 browser tests in `e2e/demo.spec.ts` passed against the final code (with `--retries=1`; the only retries were network resets from the remote e2e database). The full browser suite passed too, except three existing specs (activity add/edit/delete, activity revert, expenses "repeat") that time out on the remote database under full-suite load and pass when run alone; they were already known to flake this way before this work.
- The eSewa capture work was merged into `main` (as `afae8ad`) while this plan was being written. The whole plan was also applied on top of it: every step applied, the migration came out as `0027_demo_expires_at.sql`, and `tsc`, all 474 unit tests, lint and `next build` passed.

If a step doesn't match what you see, something has changed since then. Stop and report rather than improvise.

## How to use this plan

- Do the tasks **in order**, 1 → 12. There are two **STOP checkpoints**: after Task 5 and at the end. When you reach one, stop and send the owner the report it describes.
- Code blocks are complete. Every code step is one of these kinds:
  - **"Create `path` with:"** — a new file; paste the whole block.
  - **"Replace the whole of `path` with:"** — overwrite the file with the whole block.
  - **"In `path`, find:" … "Replace it with:"** — find the exact old text (match by text, not line number) and replace it with the new text. Each old block occurs exactly once in the file at that point.
- Before Task 1, create the branch once: `git switch -c feat/public-demo`. Every task commits to that branch.
- Run every command from the repo root, `C:\Users\nirja\OneDrive\Documents\piko`.

## Design (agreed)

The full design is the spec. In short:

| Topic | Decision |
| --- | --- |
| Who it's for | People who might use Piko themselves. Tours teach how to use it. |
| Where | The same deployment and **the same database**. One public route, `/demo`. |
| Sandbox | **A private copy per visitor**, deleted after 24 hours; at most 100 live at once. |
| Way in | `/demo` with a **Start the demo** button. A GET never writes, so link previews can't create households. Sign-in uses the existing credentials provider with a random password nobody sees. |
| What marks a demo | `households.demo_expires_at` (null = real) and accounts on `demo.piko.invalid` (`.invalid` can never be a real address). |
| Cleanup | Runs when someone starts a demo. **Two guards**: only households with `demo_expires_at`, and only accounts that belonged to them **and** are on the demo domain. |
| Turned off in a demo | Change password, profile photo, voice entry (Gemini) and mobile sign-in, refused on the server. |
| The phone | A CSS phone frame around web screens that mirror the Flutter app (Home, voice, expense sheet). Voice uses five ready-made phrases; nothing goes to Gemini. |
| Tours | driver.js. A Home tour on arrival; three-step tours the first time Budget, Savings or Dhuku opens. **Skip all tours** on every step; **Tour this page** in the banner replays. |
| Left out | A "See as Sita" switch, a "Try the demo" link on the login page, the app's Settings screen, a real microphone. |

Found while building it (the spec is updated in Task 12):

1. A demo session is recognised by the email the session already carries (`isDemoEmail(session.user.email)`), so no new JWT field is needed.
2. The web voice button, in a demo, says "Not available in the demo. Try voice on the phone instead." and offers **Open phone**.
3. The Savings tour ends on **Add money**, and the Dhuku tour on a group's months and **Log entry**: the Dhuku page has no plus/minus position (Home's Balances step covers that).
4. A tour counts as seen when it starts, and waits up to 5 s for the page (which streams in after the layout) before measuring.
5. Aarav's plan includes a small Public Transport line, so Home doesn't open on "went outside a budget".

## Global Constraints

- **Branch and commits:** one commit per task, on `feat/public-demo`, with the message the task gives.
- **Staging:** stage files only by exact path, as each task's commit step lists them. Never use `git add -A`, `git add .`, `git commit -a`, `git stash`, `git checkout -- <file>` or `git reset --hard`.
- **Shell:** this is a Windows machine. Commands work in both PowerShell and Git Bash unless a step says otherwise.
- **Line endings:** files are checked out with Windows line endings (CRLF), while the code blocks in this plan use LF. If your edit tool matches text byte for byte, compare line by line and ignore `\r`. Don't convert whole files' line endings.
- **Pre-commit hook:** it runs `npx tsc --noEmit` then `npm run build` on every commit and takes 1–2 minutes. That's expected. **Never use `--no-verify`.** If the hook fails, read the error, fix the code, `git add` the same files again, and commit again. If `tsc` complains that `LayoutProps` or `PageProps` can't be found, run `npx next typegen` once and commit again.
- **Ordering is enforced by ESLint** (perfectionist): imports, named imports, object keys and JSX props are alphabetical. The code here already is. If `npm run lint` complains about order after your edits, run `npm run lint -- --fix`.
- **Test counts:** the counts below were taken on `0663df3`. `main` now also has the eSewa capture work (21 more unit tests), so on `main` every **whole-suite** count is 21 higher: Task 1 ends at 446 and Task 12 at 474. Each task's own test count, the browser test counts and everything else are the same. The migration in Task 1 comes out as `0027_demo_expires_at.sql`.
- **Database:** `.env.local`'s `DATABASE_URL` is the **production** database. **Don't run `npm run db:migrate`**; the owner does that at the first STOP. Browser tests use their own database, which `npm run e2e:serve` resets and migrates by itself.
- **Next.js 16** differs from older versions. The code here is written for it; if you need to change anything beyond this plan, read the guide in `node_modules/next/dist/docs/` first.
- **Demo constants** (spec): email domain `demo.piko.invalid`; a demo lives 24 hours; at most 100 live at once.
- **Cleanup guards** (spec): delete only households with `demo_expires_at` set, and only accounts that belonged to them **and** are on the demo domain. Never loosen either guard.
- **Privacy** (spec): nothing a demo visitor does reaches Gemini. The demo's voice screen uses `VOICE_PHRASES` only.
- **Tour library:** driver.js **1.9.0**, pinned exactly (MIT). Versions 1.10.0 and 1.10.1 came out on 2026-10-15, after this plan was verified with 1.9.0; don't upgrade it as part of this work. Don't add Shepherd or intro.js; they're AGPL.
- **Copy:** use the UI text exactly as written here; it was agreed with the owner.
- **Browser tests:** `npx playwright test e2e/demo.spec.ts --retries=1` builds and serves the app first, so it takes 3–6 minutes. The e2e database is remote; a test that fails with `ECONNRESET`, `CONNECTION_CLOSED` or a timeout while "Saving..." is the network, and `--retries=1` covers it. A test that fails twice is a real failure.

## Review Focus

The inputs and situations most likely to bite a real visitor that the spec implies but doesn't spell out. Each has a test, in the task that owns the code:

1. **A link preview** (WhatsApp, Messenger) opens `/demo` with a GET: it must not create a household. Pinned in Task 4: "opening /demo, as a link preview does, creates nothing".
2. **Pressing Start again** while a demo is running must go back to it, not make a second household. Pinned in Task 4: "starting again while a demo is running goes back to it".
3. **100 live demos**: the next visitor sees "The demo is busy, try again later." instead of a new household or an error. Pinned in Task 4: "past 100 live demos, visitors are asked to come back later".
4. **A phone-sized screen**: the Home tour must find the floating Add button and the bottom bar instead of the hidden sidebar, so all eight steps run. Pinned in Task 11: "on a phone-sized screen the Home tour finds all eight of its sections".
5. **A demo account on the mobile API**: `POST /api/mobile/login` with a demo email must be refused, so no token can reach the Gemini-backed voice route. The guard is Task 2's; it's pinned by Task 4's browser test "a demo account can't sign in to the mobile app".

Worth a reviewer's eye in the running app (no test can judge these): the phone frame on a laptop and full screen on a phone; the tour popups' look in light and dark; that Home's first screen looks like a real household.

---

### Task 1: Mark demo households and demo accounts

Everything later rests on two markers. A household is a demo when `demo_expires_at` is set (real households have none), and an account is a demo one when its email is on a reserved `.invalid` domain, which no real address can use. This task adds both, and a guard that refuses an action for a demo member.

**Files:**
- Modify: `src/db/schema/households.ts`
- Test: `src/lib/demo-account.test.ts`
- Create: `src/lib/demo-account.ts`
- Generate: `drizzle/00NN_demo_expires_at.sql`, `drizzle/meta/_journal.json`, `drizzle/meta/00NN_snapshot.json`

**Interfaces:**
- Produces: column `households.demoExpiresAt` (`timestamp`, nullable).
- Produces (`src/lib/demo-account.ts`): `DEMO_EMAIL_DOMAIN = "demo.piko.invalid"`, `DEMO_LOCKED_MESSAGE = "Not available in the demo"`, `isDemoEmail(email: null | string | undefined): boolean`, `assertNotDemo(member: { isDemo: boolean }): void` (throws `Error(DEMO_LOCKED_MESSAGE)`).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/demo-account.test.ts` with:

````ts
import { describe, expect, it } from "vitest";

import { assertNotDemo, DEMO_LOCKED_MESSAGE, isDemoEmail } from "./demo-account";

describe("isDemoEmail", () => {
  it("is true for an address on the demo domain, in any case", () => {
    expect(isDemoEmail("aarav.0f3c@demo.piko.invalid")).toBe(true);
    expect(isDemoEmail("Sita.0f3c@DEMO.PIKO.INVALID")).toBe(true);
  });

  it("is false for real addresses and look-alikes", () => {
    expect(isDemoEmail("someone@gmail.com")).toBe(false);
    expect(isDemoEmail("demo.piko.invalid@gmail.com")).toBe(false);
    expect(isDemoEmail("x@notdemo.piko.invalid")).toBe(false);
    expect(isDemoEmail("x@demo.piko.invalid.example.com")).toBe(false);
  });

  it("is false when there is no email", () => {
    expect(isDemoEmail(null)).toBe(false);
    expect(isDemoEmail(undefined)).toBe(false);
    expect(isDemoEmail("")).toBe(false);
  });
});

describe("assertNotDemo", () => {
  it("lets a real member through", () => {
    expect(() => assertNotDemo({ isDemo: false })).not.toThrow();
  });

  it("refuses a demo member with the demo message", () => {
    expect(() => assertNotDemo({ isDemo: true })).toThrow(DEMO_LOCKED_MESSAGE);
  });
});
````

- [ ] **Step 2: Run them to see them fail**

Run:

```bash
npx vitest run src/lib/demo-account.test.ts
```

Expected: FAIL. `Error: Cannot find module './demo-account'`

- [ ] **Step 3: Make them pass**

Replace the whole of `src/db/schema/households.ts` with:

````ts
import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const dateFormatEnum = pgEnum("date_format", ["nepali", "english"]);

export const households = pgTable("households", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  // Shared across the whole household — not a per-user cookie — because
  // once a "month" is calendar-dependent (BS vs AD), household members
  // must agree on it or they'd compute different period boundaries for
  // the same shared budget/income data.
  dateFormat: dateFormatEnum("date_format").notNull().default("nepali"),
  // Set only on a public demo's sandbox household (src/modules/demo): when it
  // gets deleted. Null means a real household, and cleanup never touches a
  // household without it.
  demoExpiresAt: timestamp("demo_expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
````

Create `src/lib/demo-account.ts` with:

````ts
// Demo visitors (src/modules/demo) get throwaway accounts on a reserved
// domain: `.invalid` can never be a real address, so a real person's
// account can never be mistaken for a demo one.
export const DEMO_EMAIL_DOMAIN = "demo.piko.invalid";

// What a demo visitor sees when they reach something the demo turns off.
export const DEMO_LOCKED_MESSAGE = "Not available in the demo";

export function isDemoEmail(email: null | string | undefined): boolean {
  return typeof email === "string" && email.toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}

// Server-side guard for the actions the demo turns off. The UI only explains;
// this is what actually stops them.
export function assertNotDemo(member: { isDemo: boolean }): void {
  if (member.isDemo) throw new Error(DEMO_LOCKED_MESSAGE);
}
````

Generate the migration (this only writes files; it doesn't touch any database):

```bash
npx drizzle-kit generate --name demo_expires_at
```

Expected: a new `drizzle/00NN_demo_expires_at.sql` (NN is the next free number: `0027` on today's `main`, after the eSewa capture's `0026`) containing exactly:

```sql
ALTER TABLE "households" ADD COLUMN "demo_expires_at" timestamp;
```

plus a changed `drizzle/meta/_journal.json` and a new `drizzle/meta/00NN_snapshot.json`. Don't edit any of them, and **don't run `npm run db:migrate`**.

- [ ] **Step 4: Run the checks**

Run:

```bash
npx vitest run src/lib/demo-account.test.ts
npx vitest run
npx tsc --noEmit
npm run lint
```

Expected: the task's tests: `Tests  5 passed (5)`; the whole suite: `Tests  425 passed (425)`; `tsc` prints nothing; lint ends with `✖ 2 problems (0 errors, 2 warnings)` (both warnings were there before this plan: `jsx-a11y/role-supports-aria-props` in `NepaliDateField.tsx` and `react-hooks/incompatible-library` in `ExpenseDialog.tsx`).

- [ ] **Step 5: Commit**

```bash
git add "src/db/schema/households.ts" "src/lib/demo-account.test.ts" "src/lib/demo-account.ts" "drizzle/"
git commit -m "feat(demo): mark demo households and demo accounts" -m "households.demo_expires_at (null = real household) and the demo email domain helpers that every later safety check builds on."
```

(`git add drizzle/` stages only this task's three generated files; nothing else in `drizzle/` changes.)

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.

### Task 2: Know a demo member, and block what the demo turns off

The signed-in member learns whether it's in a demo (`isDemo`, from the household). A demo whose household was deleted (it expired) sends its visitor back to `/demo?expired=1` instead of an error page; doing it in `getCurrentMember` covers the layout, pages and actions, which render in parallel. The four things a demo turns off are refused on the server.

**Files:**
- Modify: `src/app/api/mobile/login/route.ts`
- Modify: `src/lib/session.ts`
- Modify: `src/modules/settings/api/settings.actions.ts`
- Modify: `src/modules/voice-entry/api/voice-entry.actions.ts`

**Interfaces:**
- Consumes: `isDemoEmail`, `assertNotDemo` (Task 1).
- Produces: `CurrentMember` gains `isDemo: boolean`. `getCurrentMember()` redirects demo sessions without a household to `/demo?expired=1`.

- [ ] **Step 1: Make the change**

Replace the whole of `src/app/api/mobile/login/route.ts` with:

````ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isDemoEmail } from "@/lib/demo-account";
import { signMobileToken } from "@/lib/mobile-auth";
import { verifyCredentials } from "@/lib/verify-credentials";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : undefined;
  const password = typeof body?.password === "string" ? body.password : undefined;

  if (!email || !password) {
    return NextResponse.json({ error: { message: "Email and password are required" } }, { status: 400 });
  }
  // Demo accounts stay on the website: no token means no mobile routes,
  // including the Gemini-backed voice one.
  if (isDemoEmail(email)) {
    return NextResponse.json({ error: { message: "Demo accounts can't sign in to the app" } }, { status: 403 });
  }

  const user = await verifyCredentials(email, password);
  if (!user) {
    return NextResponse.json({ error: { message: "Invalid email or password" } }, { status: 401 });
  }

  const token = await signMobileToken(user.id);
  return NextResponse.json({ token });
}
````

In `src/lib/session.ts`, find:

````ts
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

import { auth } from "@/auth";
import { db } from "@/db/client";
import { householdMembers } from "@/db/schema";
import { verifyMobileToken } from "@/lib/mobile-auth";
import { VIEWING_AS_COOKIE_NAME } from "@/lib/viewing-as-cookie";

export type CurrentMember = {
  householdId: string;
  memberId: string;
  name: string;
  userId: string;
};

async function getMemberForUser(userId: string): Promise<CurrentMember> {
  const member = await db.query.householdMembers.findFirst({
    where: eq(householdMembers.userId, userId),
    with: { household: true, user: true },
  });

  if (!member) {
    throw new Error("User does not belong to a household");
  }

  return {
    memberId: member.id,
    householdId: member.householdId,
    userId: member.userId,
    name: member.user.name,
  };
}

export async function getCurrentMember(): Promise<CurrentMember> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  return getMemberForUser(session.user.id);
}

export async function getCurrentMemberFromToken(token: string): Promise<CurrentMember | null> {
````

Replace it with:

````ts
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/db/client";
import { householdMembers } from "@/db/schema";
import { isDemoEmail } from "@/lib/demo-account";
import { verifyMobileToken } from "@/lib/mobile-auth";
import { VIEWING_AS_COOKIE_NAME } from "@/lib/viewing-as-cookie";

export type CurrentMember = {
  householdId: string;
  // A public demo's sandbox household (src/modules/demo).
  isDemo: boolean;
  memberId: string;
  name: string;
  userId: string;
};

async function findMemberForUser(userId: string): Promise<CurrentMember | null> {
  const member = await db.query.householdMembers.findFirst({
    where: eq(householdMembers.userId, userId),
    with: { household: true, user: true },
  });
  if (!member) return null;

  return {
    memberId: member.id,
    householdId: member.householdId,
    isDemo: member.household.demoExpiresAt !== null,
    userId: member.userId,
    name: member.user.name,
  };
}

async function getMemberForUser(userId: string): Promise<CurrentMember> {
  const member = await findMemberForUser(userId);
  if (!member) {
    throw new Error("User does not belong to a household");
  }
  return member;
}

export async function getCurrentMember(): Promise<CurrentMember> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const member = await findMemberForUser(session.user.id);
  if (member) return member;
  // A demo household is deleted after a day, taking its accounts with it. Its
  // visitor goes back to the demo page instead of an error page. The session
  // still carries the account's email, which is all this needs.
  if (isDemoEmail(session.user.email)) redirect("/demo?expired=1");
  throw new Error("User does not belong to a household");
}

export async function getCurrentMemberFromToken(token: string): Promise<CurrentMember | null> {
````

In `src/lib/session.ts`, find:

````ts
  return {
    memberId: target.id,
    householdId: resolvedCurrent.householdId,
    userId: target.userId,
    name: target.user.name,
  };
````

Replace it with:

````ts
  return {
    memberId: target.id,
    householdId: resolvedCurrent.householdId,
    isDemo: resolvedCurrent.isDemo,
    userId: target.userId,
    name: target.user.name,
  };
````

In `src/modules/settings/api/settings.actions.ts`, find:

````ts
import { db } from "@/db/client";
import { households, users } from "@/db/schema";
import { isDateFormat } from "@/lib/date-format-cookie";
import { getCurrentMember } from "@/lib/session";
import { activityActor, logActivity } from "@/modules/activity/api/activity";

````

Replace it with:

````ts
import { db } from "@/db/client";
import { households, users } from "@/db/schema";
import { isDateFormat } from "@/lib/date-format-cookie";
import { assertNotDemo } from "@/lib/demo-account";
import { getCurrentMember } from "@/lib/session";
import { activityActor, logActivity } from "@/modules/activity/api/activity";

````

In `src/modules/settings/api/settings.actions.ts`, find:

````ts

export async function changePasswordAction(input: ChangePasswordInput) {
  const member = await getCurrentMember();
  const { userId } = member;
  const parsed = changePasswordSchema.parse(input);

````

Replace it with:

````ts

export async function changePasswordAction(input: ChangePasswordInput) {
  const member = await getCurrentMember();
  assertNotDemo(member);
  const { userId } = member;
  const parsed = changePasswordSchema.parse(input);

````

In `src/modules/settings/api/settings.actions.ts`, find:

````ts

export async function updateProfileImageAction(imageDataUrl: null | string) {
  const member = await getCurrentMember();
  const { userId } = member;
  const parsed = profileImageSchema.parse(imageDataUrl);

````

Replace it with:

````ts

export async function updateProfileImageAction(imageDataUrl: null | string) {
  const member = await getCurrentMember();
  assertNotDemo(member);
  const { userId } = member;
  const parsed = profileImageSchema.parse(imageDataUrl);

````

Replace the whole of `src/modules/voice-entry/api/voice-entry.actions.ts` with:

````ts
"use server";

import { assertNotDemo } from "@/lib/demo-account";
import { parseExpenseTranscript } from "@/lib/gemini";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { todayISO } from "@/lib/today";
import { listCategories } from "@/modules/categories/api/categories";
import { sanitizeVoiceExpense, type VoiceParseResult } from "@/modules/voice-entry/lib/sanitize-voice-expense";

export async function parseVoiceEntry(
  transcript: string,
  { householdId, memberId }: { householdId: string; memberId: string },
): Promise<VoiceParseResult> {
  const [categories, members] = await Promise.all([listCategories(householdId), getHouseholdMembers(householdId)]);

  if (categories.length === 0 || members.length === 0) {
    return { ok: false, reason: "not_understood" };
  }

  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name }));
  const memberOptions = members.map((m) => ({ id: m.id, name: m.user.name }));

  try {
    const raw = await parseExpenseTranscript(transcript, {
      categories: categoryOptions,
      members: memberOptions,
      today: todayISO(),
    });
    return sanitizeVoiceExpense(raw, {
      categories: categoryOptions,
      currentMemberId: memberId,
      members: memberOptions,
    });
  } catch {
    return { ok: false, reason: "not_understood" };
  }
}

export async function parseVoiceEntryAction(transcript: string): Promise<VoiceParseResult> {
  const member = await getCurrentMember();
  // Strangers' words must never reach Gemini, or spend its quota.
  assertNotDemo(member);
  return parseVoiceEntry(transcript, { householdId: member.householdId, memberId: member.memberId });
}
````

- [ ] **Step 2: Run the checks**

Run:

```bash
npx vitest run
npx tsc --noEmit
npm run lint
```

Expected: the whole suite: `Tests  425 passed (425)`; `tsc` prints nothing; lint ends with `✖ 2 problems (0 errors, 2 warnings)` (both warnings were there before this plan: `jsx-a11y/role-supports-aria-props` in `NepaliDateField.tsx` and `react-hooks/incompatible-library` in `ExpenseDialog.tsx`).

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/mobile/login/route.ts" "src/lib/session.ts" "src/modules/settings/api/settings.actions.ts" "src/modules/voice-entry/api/voice-entry.actions.ts"
git commit -m "feat(demo): know a demo member, and block what the demo turns off" -m "CurrentMember.isDemo; an expired demo session goes to /demo?expired=1 instead of an error; password, profile photo and voice entry refuse demo members on the server; demo accounts can't sign in to the mobile app."
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.

### Task 3: Aarav & Sita's household for the demo

The made-up household, as a pure function so it's testable without a database: Aarav (the visitor) and Sita, about six months of spending in BS months up to today, pay, two months of budgets, bills, a savings pot, a dhuku, a loan and a fund. It is built relative to `today`, so the demo always looks current; the tests also try the first day of a BS month, when "this month" is nearly empty. It's separate from `scripts/seed-e2e.ts`, whose exact numbers the e2e tests rely on.

**Files:**
- Test: `src/modules/demo/lib/demo-fixture.test.ts`
- Create: `src/modules/demo/lib/demo-fixture.ts`

**Interfaces:**
- Produces (`src/modules/demo/lib/demo-fixture.ts`): `buildDemoFixture({ aaravId, householdId, newId, sitaId, today }): DemoFixture`, where `DemoFixture` has one array of insert rows per table (`categories`, `expenses`, `incomes`, `monthlyBudgets`, `budgetItems`, `recurringExpenses`, `savingsPots`, `savingsPotPlans`, `savingsItems`, `savingsDeposits`, `dhukus`, `dhukuEntries`, `loans`, `loanPayments`, `funds`, `fundPlans`, `fundTopUps`, `paybacks`).

- [ ] **Step 1: Write the failing tests**

Create `src/modules/demo/lib/demo-fixture.test.ts` with:

````ts
import { describe, expect, it } from "vitest";

import { adToBs, bsToAd } from "@/lib/nepali-date";

import { buildDemoFixture, type DemoFixture } from "./demo-fixture";

const AARAV = "member-aarav";
const SITA = "member-sita";
const HOUSEHOLD = "household-demo";
const TODAY = "2026-10-15";

function build(today = TODAY): DemoFixture {
  let next = 0;
  return buildDemoFixture({ aaravId: AARAV, householdId: HOUSEHOLD, newId: () => `id-${++next}`, sitaId: SITA, today });
}

function monthKey(date: string): string {
  const { month, year } = adToBs(date);
  return `${year}-${month}`;
}

// The first day of the BS month `today` falls in: the emptiest "this month".
function firstOfThisMonth(today: string): string {
  const { month, year } = adToBs(today);
  return bsToAd(year, month, 1);
}

describe("buildDemoFixture", () => {
  it("covers six BS months of spending, none of it after today", () => {
    const fixture = build();
    const months = new Set(fixture.expenses.map((e) => monthKey(e.date)));
    expect(months.size).toBe(6);
    expect(months.has(monthKey(TODAY))).toBe(true);
    expect(fixture.expenses.every((e) => e.date <= TODAY)).toBe(true);
    expect(fixture.expenses.length).toBeGreaterThan(100);
  });

  it("keeps every row in the demo household, between its two people", () => {
    const fixture = build();
    const people = [AARAV, SITA];
    const categoryIds = new Set(fixture.categories.map((c) => c.id));
    for (const rows of [fixture.categories, fixture.expenses, fixture.incomes, fixture.loans, fixture.dhukus, fixture.funds]) {
      expect(rows.every((row) => row.householdId === HOUSEHOLD)).toBe(true);
    }
    for (const e of fixture.expenses) {
      expect(people).toContain(e.paidByMemberId);
      expect([...people, null]).toContain(e.ownerMemberId);
      expect(categoryIds.has(e.categoryId)).toBe(true);
    }
  });

  it("pays both people every month, plus one extra", () => {
    const fixture = build();
    expect(fixture.incomes.filter((i) => i.kind === "pay" && i.memberId === AARAV)).toHaveLength(6);
    expect(fixture.incomes.filter((i) => i.kind === "pay" && i.memberId === SITA)).toHaveLength(6);
    expect(fixture.incomes.filter((i) => i.kind === "extra")).toHaveLength(1);
  });

  it.each([TODAY, firstOfThisMonth(TODAY)])("plans this month for both, with Aarav's dining nearly used (today %s)", (today) => {
    const fixture = build(today);
    const { month, year } = adToBs(today);
    const budget = fixture.monthlyBudgets.find((b) => b.year === year && b.month === month);
    expect(budget).toBeDefined();
    const lines = fixture.budgetItems.filter((line) => line.monthlyBudgetId === budget?.id);
    expect(lines.some((line) => line.ownerMemberId === AARAV)).toBe(true);
    expect(lines.some((line) => line.ownerMemberId === SITA)).toBe(true);

    const diningId = fixture.categories.find((c) => c.name === "Dining Out")?.id;
    const cap = lines.find((line) => line.ownerMemberId === AARAV && line.categoryId === diningId);
    expect(cap?.kind).toBe("can_cut");
    const spent = fixture.expenses
      .filter((e) => e.categoryId === diningId && e.paidByMemberId === AARAV && monthKey(e.date) === `${year}-${month}`)
      .reduce((sum, e) => sum + Number(e.amount), 0);
    expect(spent / Number(cap?.plannedAmount)).toBeGreaterThanOrEqual(0.8);
    expect(spent / Number(cap?.plannedAmount)).toBeLessThan(1);
  });

  it("has a pay-back-later still owed, one already paid back, and one expense paid from savings", () => {
    const fixture = build();
    expect(fixture.expenses.filter((e) => e.payBackAmount)).toHaveLength(2);
    expect(fixture.paybacks).toHaveLength(1);
    expect(fixture.paybacks[0]).toMatchObject({ fromMemberId: SITA, toMemberId: AARAV });
    const fromSavings = fixture.expenses.filter((e) => e.savingsPotId);
    expect(fromSavings).toHaveLength(1);
    expect(fromSavings[0].savingsPotId).toBe(fixture.savingsPots[0].id);
  });

  it("sets up the savings pot, dhuku, loan and fund", () => {
    const fixture = build();
    expect(fixture.savingsPots).toHaveLength(1);
    expect(fixture.savingsPots[0]).toMatchObject({ name: "Home fund", ownerMemberId: null });
    expect(fixture.savingsItems.map((item) => item.name)).toEqual(["New laptop", "Pokhara trip"]);
    expect(fixture.savingsPotPlans).toHaveLength(2);

    expect(fixture.dhukus).toHaveLength(1);
    expect(fixture.dhukus[0]).toMatchObject({ monthlyContribution: "5000", totalMembers: 10 });
    expect(fixture.dhukuEntries.every((entry) => entry.type === "contribution")).toBe(true);

    expect(fixture.loans).toHaveLength(1);
    expect(fixture.loans[0]).toMatchObject({ counterpartyName: "Bikash", direction: "given", principalAmount: "20000" });
    const repaid = fixture.loanPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    expect(repaid).toBeGreaterThan(0);
    expect(repaid).toBeLessThan(20000);

    expect(fixture.funds).toHaveLength(1);
    expect(fixture.funds[0]).toMatchObject({ name: "Dashain shopping", ownerMemberId: SITA });
    expect(fixture.fundPlans).toHaveLength(1);
    expect(fixture.recurringExpenses.map((bill) => bill.name)).toEqual(["Rent", "Internet", "Insurance"]);
  });

  it("keeps Aarav's spending in each full month under his pay", () => {
    const fixture = build();
    const current = monthKey(TODAY);
    const byMonth = new Map<string, number>();
    for (const e of fixture.expenses) {
      if (e.paidByMemberId !== AARAV || monthKey(e.date) === current) continue;
      byMonth.set(monthKey(e.date), (byMonth.get(monthKey(e.date)) ?? 0) + Number(e.amount));
    }
    expect(byMonth.size).toBe(5);
    for (const total of byMonth.values()) expect(total).toBeLessThan(85000);
  });

  it("gives every row its own id and contains no email address", () => {
    const fixture = build();
    const ids = Object.values(fixture)
      .flat()
      .map((row) => (row as { id?: string }).id)
      .filter((id) => id !== undefined);
    expect(new Set(ids).size).toBe(ids.length);
    expect(JSON.stringify(fixture)).not.toContain("@");
  });
});
````

- [ ] **Step 2: Run them to see them fail**

Run:

```bash
npx vitest run src/modules/demo/lib/demo-fixture.test.ts
```

Expected: FAIL. `Error: Cannot find module './demo-fixture'`

- [ ] **Step 3: Make them pass**

Create `src/modules/demo/lib/demo-fixture.ts` with:

````ts
import type {
  budgetItems,
  categories,
  dhukuEntries,
  dhukus,
  expenses,
  fundPlans,
  funds,
  fundTopUps,
  incomes,
  loanPayments,
  loans,
  monthlyBudgets,
  paybacks,
  recurringExpenses,
  savingsDeposits,
  savingsItems,
  savingsPotPlans,
  savingsPots,
} from "@/db/schema";
import { nextMonth, previousMonth } from "@/lib/month-nav";
import { adToBs, bsToAd } from "@/lib/nepali-date";
import { DEFAULT_CATEGORIES } from "@/modules/categories/lib/default-categories";

// The made-up household every demo visitor gets a private copy of: Aarav (the
// visitor) and Sita, who keep their money separate but plan together. It is
// built relative to `today` so it always looks current, in BS months (the
// household's calendar). Nothing here comes from a real household.

export type DemoFixture = {
  budgetItems: (typeof budgetItems.$inferInsert)[];
  categories: (typeof categories.$inferInsert & { id: string })[];
  dhukuEntries: (typeof dhukuEntries.$inferInsert)[];
  dhukus: (typeof dhukus.$inferInsert)[];
  expenses: (typeof expenses.$inferInsert)[];
  fundPlans: (typeof fundPlans.$inferInsert)[];
  funds: (typeof funds.$inferInsert)[];
  fundTopUps: (typeof fundTopUps.$inferInsert)[];
  incomes: (typeof incomes.$inferInsert)[];
  loanPayments: (typeof loanPayments.$inferInsert)[];
  loans: (typeof loans.$inferInsert)[];
  monthlyBudgets: (typeof monthlyBudgets.$inferInsert & { id: string })[];
  paybacks: (typeof paybacks.$inferInsert)[];
  recurringExpenses: (typeof recurringExpenses.$inferInsert)[];
  savingsDeposits: (typeof savingsDeposits.$inferInsert)[];
  savingsItems: (typeof savingsItems.$inferInsert)[];
  savingsPotPlans: (typeof savingsPotPlans.$inferInsert)[];
  savingsPots: (typeof savingsPots.$inferInsert & { id: string })[];
};

export type DemoFixtureInput = {
  aaravId: string;
  householdId: string;
  newId: () => string;
  sitaId: string;
  // "YYYY-MM-DD" (AD), the day the demo starts.
  today: string;
};

type Who = "aarav" | "sita";
type Month = { month: number; year: number };
type Spend = {
  amount: number;
  category: string;
  day: number;
  note: null | string;
  // null = shared.
  owner: null | Who;
  paidBy: Who;
  recurring?: "internet" | "rent";
  // Everyday spending wobbles a little from month to month; bills don't.
  vary?: boolean;
};

const AARAV_PAY = 85000;
const SITA_PAY = 60000;
const HISTORY_MONTHS = 5;
// One per full month, oldest first, so Reports shows a trend.
const MONTH_WOBBLE = [0.96, 1.04, 0.92, 1.08, 1];
// The share of Aarav's can-cut dining line already spent this month, so
// "Safe to spend" has something to show.
const DINING_USED = 0.85;

const MONTHLY_SPENDING: Spend[] = [
  { amount: 18000, category: "Bills", day: 1, note: "Rent", owner: null, paidBy: "aarav", recurring: "rent" },
  { amount: 1500, category: "Internet", day: 2, note: "WiFi", owner: "sita", paidBy: "sita", recurring: "internet" },
  { amount: 3200, category: "Groceries", day: 3, note: "Weekly groceries", owner: null, paidBy: "aarav", vary: true },
  { amount: 1500, category: "Petrol", day: 5, note: "Bike petrol", owner: "aarav", paidBy: "aarav", vary: true },
  { amount: 1200, category: "Dining Out", day: 6, note: "Momo with friends", owner: "aarav", paidBy: "aarav", vary: true },
  { amount: 650, category: "Public Transport", day: 8, note: "Bus and rides", owner: "sita", paidBy: "sita", vary: true },
  { amount: 6000, category: "Family Support", day: 9, note: "Sent home", owner: "sita", paidBy: "sita" },
  { amount: 2600, category: "Groceries", day: 10, note: "Vegetables and milk", owner: null, paidBy: "sita", vary: true },
  { amount: 500, category: "Personal", day: 11, note: "Phone recharge", owner: "aarav", paidBy: "aarav" },
  { amount: 8000, category: "Parents", day: 12, note: "For Ama and Buwa", owner: "aarav", paidBy: "aarav" },
  { amount: 1800, category: "Dates", day: 13, note: "Dinner out", owner: null, paidBy: "aarav", vary: true },
  { amount: 2500, category: "Shopping", day: 14, note: "New kurta", owner: "sita", paidBy: "sita", vary: true },
  { amount: 1500, category: "Petrol", day: 15, note: null, owner: "aarav", paidBy: "aarav", vary: true },
  { amount: 1200, category: "Health/Wellness", day: 16, note: "Pharmacy", owner: "sita", paidBy: "sita", vary: true },
  { amount: 3000, category: "Groceries", day: 18, note: "Weekly groceries", owner: null, paidBy: "aarav", vary: true },
  { amount: 900, category: "Dining Out", day: 19, note: "Lunch with colleagues", owner: "sita", paidBy: "sita", vary: true },
  { amount: 1100, category: "Utilities", day: 20, note: "Electricity", owner: null, paidBy: "sita", vary: true },
  { amount: 800, category: "Entertainment", day: 22, note: "Movie", owner: "aarav", paidBy: "aarav", vary: true },
  { amount: 500, category: "Personal", day: 24, note: "Phone recharge", owner: "sita", paidBy: "sita" },
  { amount: 2700, category: "Groceries", day: 25, note: null, owner: null, paidBy: "sita", vary: true },
  { amount: 1400, category: "Dining Out", day: 27, note: "Pizza night", owner: null, paidBy: "sita", vary: true },
  { amount: 400, category: "Public Transport", day: 28, note: "Ride home", owner: "aarav", paidBy: "aarav", vary: true },
];

const PLAN: { amount: number; category: string; kind: "can_cut" | "essential" | "fixed"; who: Who }[] = [
  { amount: 18000, category: "Bills", kind: "fixed", who: "aarav" },
  { amount: 8000, category: "Parents", kind: "fixed", who: "aarav" },
  { amount: 7000, category: "Groceries", kind: "essential", who: "aarav" },
  { amount: 3500, category: "Petrol", kind: "essential", who: "aarav" },
  { amount: 600, category: "Personal", kind: "essential", who: "aarav" },
  { amount: 500, category: "Public Transport", kind: "essential", who: "aarav" },
  { amount: 3000, category: "Dining Out", kind: "can_cut", who: "aarav" },
  { amount: 2500, category: "Dates", kind: "can_cut", who: "aarav" },
  { amount: 1500, category: "Entertainment", kind: "can_cut", who: "aarav" },
  { amount: 1500, category: "Internet", kind: "fixed", who: "sita" },
  { amount: 6000, category: "Family Support", kind: "fixed", who: "sita" },
  { amount: 1200, category: "Utilities", kind: "fixed", who: "sita" },
  { amount: 6000, category: "Groceries", kind: "essential", who: "sita" },
  { amount: 1000, category: "Public Transport", kind: "essential", who: "sita" },
  { amount: 1500, category: "Health/Wellness", kind: "essential", who: "sita" },
  { amount: 3000, category: "Shopping", kind: "can_cut", who: "sita" },
  { amount: 2000, category: "Dining Out", kind: "can_cut", who: "sita" },
];

function roundTo10(amount: number): number {
  return Math.round(amount / 10) * 10;
}

function monthsBack(from: Month, count: number): Month {
  let month = from;
  for (let i = 0; i < count; i++) month = previousMonth(month.year, month.month);
  return month;
}

function monthsAhead(from: Month, count: number): Month {
  let month = from;
  for (let i = 0; i < count; i++) month = nextMonth(month.year, month.month);
  return month;
}

export function buildDemoFixture({ aaravId, householdId, newId, sitaId, today }: DemoFixtureInput): DemoFixture {
  const memberId = (who: Who) => (who === "aarav" ? aaravId : sitaId);
  const todayBs = adToBs(today);
  const current: Month = { month: todayBs.month, year: todayBs.year };
  // Oldest first; the last one is the month before this one.
  const history = Array.from({ length: HISTORY_MONTHS }, (_, i) => monthsBack(current, HISTORY_MONTHS - i));
  const allMonths = [...history, current];
  const lastMonth = history[HISTORY_MONTHS - 1];
  const twoMonthsAgo = history[HISTORY_MONTHS - 2];
  const threeMonthsAgo = history[HISTORY_MONTHS - 3];
  const on = (month: Month, day: number) => bsToAd(month.year, month.month, day);
  // This month only has what has happened up to today.
  const happened = (month: Month, day: number) => month !== current || day <= todayBs.day;

  const categoryRows = DEFAULT_CATEGORIES.map((c) => ({
    budgetType: c.budgetType,
    groupName: c.group,
    householdId,
    id: newId(),
    name: c.name,
  }));
  const categoryId = (name: string) => {
    const row = categoryRows.find((c) => c.name === name);
    if (!row) throw new Error(`Demo category not found: ${name}`);
    return row.id;
  };

  const rentId = newId();
  const internetId = newId();
  const recurringRows: DemoFixture["recurringExpenses"] = [
    {
      amount: "18000",
      categoryId: categoryId("Bills"),
      householdId,
      icon: "home",
      id: rentId,
      name: "Rent",
      nextDueDate: on(nextMonth(current.year, current.month), 1),
      ownerMemberId: null,
    },
    {
      amount: "1500",
      categoryId: categoryId("Internet"),
      householdId,
      icon: "wifi",
      id: internetId,
      name: "Internet",
      nextDueDate: on(nextMonth(current.year, current.month), 2),
      ownerMemberId: sitaId,
    },
    {
      amount: "12000",
      categoryId: categoryId("Insurance"),
      frequency: "yearly",
      householdId,
      icon: "shield",
      id: newId(),
      name: "Insurance",
      nextDueDate: on(monthsAhead(current, 3), 15),
      ownerMemberId: aaravId,
    },
  ];

  const potId = newId();
  const expenseRows: DemoFixture["expenses"] = [];
  for (const [index, month] of allMonths.entries()) {
    const wobble = MONTH_WOBBLE[index] ?? 1;
    for (const spend of MONTHLY_SPENDING) {
      if (!happened(month, spend.day)) continue;
      // Last month's date night is still owed; the month before's was paid back.
      const payBack = spend.category === "Dates" && (month === lastMonth || month === twoMonthsAgo) ? "900" : null;
      expenseRows.push({
        amount: String(spend.vary ? roundTo10(spend.amount * wobble) : spend.amount),
        categoryId: categoryId(spend.category),
        date: on(month, spend.day),
        householdId,
        id: newId(),
        note: spend.note,
        ownerMemberId: spend.owner ? memberId(spend.owner) : null,
        paidByMemberId: memberId(spend.paidBy),
        payBackAmount: payBack,
        recurringExpenseId: spend.recurring === "rent" ? rentId : spend.recurring === "internet" ? internetId : null,
      });
    }
  }
  expenseRows.push({
    amount: "6500",
    categoryId: categoryId("Health/Wellness"),
    date: on(threeMonthsAgo, 21),
    householdId,
    id: newId(),
    note: "Dental work",
    ownerMemberId: aaravId,
    paidByMemberId: aaravId,
    savingsPotId: potId,
  });
  // Tops Aarav's dining up to DINING_USED of its cap, whatever day it is.
  const diningCap = PLAN.find((line) => line.who === "aarav" && line.category === "Dining Out")?.amount ?? 0;
  const diningSoFar = expenseRows
    .filter((e) => e.categoryId === categoryId("Dining Out") && e.paidByMemberId === aaravId && e.date >= on(current, 1))
    .reduce((sum, e) => sum + Number(e.amount), 0);
  expenseRows.push({
    amount: String(roundTo10(diningCap * DINING_USED - diningSoFar)),
    categoryId: categoryId("Dining Out"),
    date: today,
    householdId,
    id: newId(),
    note: "Birthday dinner",
    ownerMemberId: aaravId,
    paidByMemberId: aaravId,
  });

  const incomeRows: DemoFixture["incomes"] = allMonths.flatMap((month) => [
    { amount: String(AARAV_PAY), householdId, kind: "pay" as const, memberId: aaravId, month: month.month, year: month.year },
    { amount: String(SITA_PAY), householdId, kind: "pay" as const, memberId: sitaId, month: month.month, year: month.year },
  ]);
  incomeRows.push({
    amount: "40000",
    householdId,
    kind: "extra",
    memberId: aaravId,
    month: threeMonthsAgo.month,
    note: "Festival bonus",
    year: threeMonthsAgo.year,
  });

  // Last month's and this month's plans, so Budget has a month to compare with.
  const budgetRows = [lastMonth, current].map((month) => ({ householdId, id: newId(), month: month.month, year: month.year }));
  const budgetItemRows: DemoFixture["budgetItems"] = budgetRows.flatMap((budget) =>
    PLAN.map((line) => ({
      categoryId: categoryId(line.category),
      kind: line.kind,
      monthlyBudgetId: budget.id,
      ownerMemberId: memberId(line.who),
      plannedAmount: String(line.amount),
    })),
  );

  const depositRows: DemoFixture["savingsDeposits"] = [
    { amount: "60000", date: on(history[0], 1), kind: "opening", memberId: null, potId },
    { amount: "600", date: on(threeMonthsAgo, 28), kind: "interest", memberId: null, potId },
    { amount: "650", date: on(lastMonth, 28), kind: "interest", memberId: null, potId },
  ];
  for (const month of allMonths) {
    if (!happened(month, 2)) continue;
    depositRows.push(
      { amount: "10000", date: on(month, 2), kind: "deposit", memberId: aaravId, potId },
      { amount: "6000", date: on(month, 2), kind: "deposit", memberId: sitaId, potId },
    );
  }

  const dhukuId = newId();
  const dhukuMonths = allMonths.slice(1);
  const fundId = newId();
  const loanId = newId();

  return {
    budgetItems: budgetItemRows,
    categories: categoryRows,
    dhukuEntries: dhukuMonths.map((month) => ({ amount: "5000", date: on(month, 1), dhukuId, type: "contribution" as const })),
    dhukus: [
      {
        householdId,
        id: dhukuId,
        interestPerMonth: "200",
        monthlyContribution: "5000",
        name: "Office dhuku",
        note: "Food at each meeting comes from the pot",
        ownerMemberId: aaravId,
        potDeduction: "500",
        startDate: on(dhukuMonths[0], 1),
        totalMembers: 10,
      },
    ],
    expenses: expenseRows,
    fundPlans: [{ fromMonth: threeMonthsAgo.month, fromYear: threeMonthsAgo.year, fundId, monthlyAmount: "3000" }],
    funds: [
      {
        dueMonth: monthsAhead(current, 3).month,
        dueYear: monthsAhead(current, 3).year,
        householdId,
        id: fundId,
        name: "Dashain shopping",
        ownerMemberId: sitaId,
        startMonth: threeMonthsAgo.month,
        startYear: threeMonthsAgo.year,
        target: "25000",
      },
    ],
    fundTopUps: [{ amount: "2000", fundId, month: lastMonth.month, note: "Leftover from last month", year: lastMonth.year }],
    incomes: incomeRows,
    loanPayments: [{ amount: "5000", date: on(twoMonthsAgo, 15), loanId, memberId: aaravId }],
    loans: [
      {
        counterpartyName: "Bikash",
        date: on(history[1], 10),
        direction: "given",
        householdId,
        id: loanId,
        note: "For his bike repair",
        ownerMemberId: aaravId,
        principalAmount: "20000",
      },
    ],
    monthlyBudgets: budgetRows,
    paybacks: [{ amount: "900", date: on(twoMonthsAgo, 20), fromMemberId: sitaId, householdId, note: "For date night", toMemberId: aaravId }],
    recurringExpenses: recurringRows,
    savingsDeposits: depositRows,
    savingsItems: [
      { cost: "120000", name: "New laptop", position: 1, potId },
      { cost: "45000", name: "Pokhara trip", position: 2, potId },
    ],
    savingsPotPlans: [
      { memberId: aaravId, monthlyAmount: "10000", potId },
      { memberId: sitaId, monthlyAmount: "6000", potId },
    ],
    savingsPots: [{ heldByMemberId: aaravId, householdId, id: potId, name: "Home fund", ownerMemberId: null, reserveMinimum: "50000" }],
  };
}
````

- [ ] **Step 4: Run the checks**

Run:

```bash
npx vitest run src/modules/demo/lib/demo-fixture.test.ts
npx vitest run
npx tsc --noEmit
npm run lint
```

Expected: the task's tests: `Tests  9 passed (9)`; the whole suite: `Tests  434 passed (434)`; `tsc` prints nothing; lint ends with `✖ 2 problems (0 errors, 2 warnings)` (both warnings were there before this plan: `jsx-a11y/role-supports-aria-props` in `NepaliDateField.tsx` and `react-hooks/incompatible-library` in `ExpenseDialog.tsx`).

- [ ] **Step 5: Commit**

```bash
git add "src/modules/demo/lib/demo-fixture.test.ts" "src/modules/demo/lib/demo-fixture.ts"
git commit -m "feat(demo): build Aarav & Sita's household for the demo" -m "A pure builder, relative to today in BS months: six months of spending, pay, budgets, bills, a savings pot, a dhuku, a loan and a fund."
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.

### Task 4: /demo starts a private demo household; expired ones are cleaned up

The public way in. `/demo` shows what the demo is and a **Start the demo** button; the button's server action deletes expired demos, refuses past 100 live ones, creates the visitor's copy in one transaction and signs them in as Aarav. The cleanup's two guards live in `deleteDemos`. The proxy lets `/demo` through without a session. The login page's brand panel becomes a shared `BrandSplit` so both pages use it. The first browser tests arrive here, including the safety test that a real household survives cleanup, and four of the Review Focus tests.

**Files:**
- Test: `e2e/demo.spec.ts`
- Create: `e2e/support/db.ts`
- Create: `e2e/support/demo.ts`
- Modify: `playwright.config.ts`
- Create: `src/app/demo/page.tsx`
- Modify: `src/app/login/page.tsx`
- Create: `src/components/BrandSplit.tsx`
- Create: `src/modules/demo/api/demo.actions.ts`
- Create: `src/modules/demo/api/demo.ts`
- Create: `src/modules/demo/components/DemoStart.tsx`
- Create: `src/modules/demo/index.tsx`
- Test: `src/modules/demo/lib/demo-constants.test.ts`
- Create: `src/modules/demo/lib/demo-constants.ts`
- Create: `src/modules/demo/pages/DemoPage.tsx`
- Modify: `src/proxy.ts`

**Interfaces:**
- Consumes: `buildDemoFixture` (Task 3); `DEMO_EMAIL_DOMAIN`, `isDemoEmail` (Task 1); `CurrentMember.isDemo` (Task 2).
- Produces (`src/modules/demo/api/demo.ts`): `createDemoHousehold(now: Date): Promise<{ email: string; password: string }>`, `countLiveDemos(now: Date): Promise<number>`, `hasHousehold(userId: string): Promise<boolean>`, `deleteExpiredDemos(now: Date): Promise<void>`, `deleteDemoHousehold(householdId: string): Promise<void>`.
- Produces (`src/modules/demo/api/demo.actions.ts`): `startDemoAction(): Promise<DemoStartState>` (`DemoStartState = undefined | { busy: boolean }`), `exitDemoAction()`.
- Produces (`src/modules/demo/lib/demo-constants.ts`): `DEMO_LIFETIME_HOURS = 24`, `MAX_LIVE_DEMOS = 100`, `demoExpiry(now: Date): Date`.
- Produces (e2e): `e2e/support/db.ts` `e2eDatabaseUrl`, `queryE2e(run)`; `e2e/support/demo.ts` `SIGNED_OUT`, `startDemo(page)`, `newestDemoHouseholdId()`, `liveDemoCount()`.

- [ ] **Step 1: Write the failing tests**

Create `src/modules/demo/lib/demo-constants.test.ts` with:

````ts
import { describe, expect, it } from "vitest";

import { DEMO_LIFETIME_HOURS, demoExpiry } from "./demo-constants";

describe("demoExpiry", () => {
  it("is a day after the demo starts", () => {
    const now = new Date("2026-10-15T06:00:00Z");
    expect(DEMO_LIFETIME_HOURS).toBe(24);
    expect(demoExpiry(now).toISOString()).toBe("2026-10-16T06:00:00.000Z");
  });
});
````

- [ ] **Step 2: Run them to see them fail**

Run:

```bash
npx vitest run src/modules/demo/lib/demo-constants.test.ts
```

Expected: FAIL. `Error: Cannot find module './demo-constants'`

- [ ] **Step 3: Make them pass**

Create `e2e/demo.spec.ts` with:

````ts
import { expect, test } from "@playwright/test";

import { queryE2e } from "./support/db";
import { liveDemoCount, newestDemoHouseholdId, SIGNED_OUT, startDemo } from "./support/demo";
import { expectNoErrorBoundary, gotoRoute } from "./support/nav";

// One demo at a time, so "the newest demo household" is always this file's.
// Each test creates a household on the (remote) e2e database, so allow more
// than the default 30s.
test.describe.configure({ mode: "serial", timeout: 90_000 });

test.describe("public demo", () => {
  test.use({ storageState: SIGNED_OUT });

  test("opens signed out and starts on Aarav & Sita's Home", async ({ page }) => {
    await page.goto("/demo");
    await expect(page.getByRole("heading", { name: "Try Piko" })).toBeVisible();

    await startDemo(page);
    await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible();
    await expect(page.getByText("Birthday dinner").first()).toBeVisible();
    await expectNoErrorBoundary(page);
  });

  test("every page opens on the demo data", async ({ page }) => {
    await startDemo(page);
    for (const path of ["/expenses", "/budget", "/recurring", "/savings", "/loans", "/dhuku", "/reports", "/categories", "/activity", "/settings"]) {
      await gotoRoute(page, path);
    }
    await gotoRoute(page, "/savings");
    await expect(page.getByText("Home fund").first()).toBeVisible();
    await gotoRoute(page, "/dhuku");
    await expect(page.getByText("Office dhuku").first()).toBeVisible();
  });

  test("opening /demo, as a link preview does, creates nothing", async ({ page }) => {
    const before = await liveDemoCount();
    await page.goto("/demo");
    await page.reload();
    expect(await liveDemoCount()).toBe(before);
  });

  test("starting again while a demo is running goes back to it", async ({ page }) => {
    await startDemo(page);
    const householdId = await newestDemoHouseholdId();
    await page.goto("/demo");
    await page.getByRole("button", { name: "Start the demo" }).click();
    await page.waitForURL("**/dashboard", { timeout: 60_000 });
    expect(await newestDemoHouseholdId()).toBe(householdId);
  });

  test("past 100 live demos, visitors are asked to come back later", async ({ page }) => {
    const fillers = Math.max(0, 100 - (await liveDemoCount()));
    await queryE2e((sql) => sql`insert into households (name, demo_expires_at) select 'Busy filler', now() + interval '1 hour' from generate_series(1, ${fillers})`);
    try {
      await page.goto("/demo");
      await page.getByRole("button", { name: "Start the demo" }).click();
      await expect(page.getByText("The demo is busy, try again later.")).toBeVisible({ timeout: 30_000 });
    } finally {
      await queryE2e((sql) => sql`delete from households where name = 'Busy filler' and demo_expires_at is not null`);
    }
  });

  test("a demo account can't sign in to the mobile app", async ({ request }) => {
    const response = await request.post("/api/mobile/login", { data: { email: "aarav.test@demo.piko.invalid", password: "anything" } });
    expect(response.status()).toBe(403);
  });

  test("cleanup deletes an expired demo and leaves the real household alone", async ({ browser }) => {
    const first = await browser.newPage();
    await startDemo(first);
    const { householdId, userIds } = await queryE2e(async (sql) => {
      const [household] = await sql`select id from households where demo_expires_at is not null order by created_at desc limit 1`;
      const members = await sql`select user_id from household_members where household_id = ${household.id}`;
      await sql`update households set demo_expires_at = now() - interval '1 minute' where id = ${household.id}`;
      return { householdId: household.id as string, userIds: members.map((m) => m.user_id as string) };
    });

    // Starting another demo runs the cleanup.
    const second = await browser.newPage();
    await startDemo(second);

    const left = await queryE2e(async (sql) => {
      const [demo] = await sql`select count(*)::int as n from households where id = ${householdId}`;
      const [demoUsers] = await sql`select count(*)::int as n from users where id in ${sql(userIds)}`;
      const [real] = await sql`
        select count(distinct m.user_id)::int as n
        from households h join household_members m on m.household_id = h.id join users u on u.id = m.user_id
        where h.name = 'E2E Household' and h.demo_expires_at is null`;
      return { demo: demo.n, demoUsers: demoUsers.n, realUsers: real.n };
    });
    expect(left).toEqual({ demo: 0, demoUsers: 0, realUsers: 2 });

    // The first visitor's session outlived its household: back to /demo, not an error.
    await first.goto("/dashboard");
    await expect(first).toHaveURL(/\/demo\?expired=1/);
    await expect(first.getByText("Your demo expired. Start a new one.")).toBeVisible();
  });
});

test("a signed-in owner can open /demo and is told it signs them out", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "Try Piko" })).toBeVisible();
  await expect(page.getByText("Starting the demo signs you out of your own household.")).toBeVisible();
});
````

Create `e2e/support/db.ts` with:

````ts
import { config as loadEnv } from "dotenv";
import postgres from "postgres";

loadEnv({ path: ".env.local" });

function withDatabaseName(url: string | undefined, name: string): string | undefined {
  if (!url) return undefined;
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

// e2e runs against its own database (reset + seeded by scripts/seed-e2e.ts),
// so tests can write freely without touching the dev DB. Defaults to the
// .env.local DATABASE_URL with the database name swapped for "piko_e2e".
export const e2eDatabaseUrl = process.env.E2E_DATABASE_URL ?? withDatabaseName(process.env.DATABASE_URL, "piko_e2e");

// For the few checks a browser can't see (e.g. that a deleted row is gone).
export async function queryE2e<T>(run: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  if (!e2eDatabaseUrl) throw new Error("Set DATABASE_URL (or E2E_DATABASE_URL) in .env.local");
  const sql = postgres(e2eDatabaseUrl, { max: 1, prepare: false });
  try {
    return await run(sql);
  } finally {
    await sql.end();
  }
}
````

Create `e2e/support/demo.ts` with:

````ts
import type { Page } from "@playwright/test";

import { queryE2e } from "./db";

// A browser with no session, for the public demo.
export const SIGNED_OUT = { cookies: [], origins: [] };

// Starts a demo from /demo and waits for its Home. Creating the household
// takes a few round trips to the database, hence the longer wait.
export async function startDemo(page: Page): Promise<void> {
  await page.goto("/demo");
  await page.getByRole("button", { name: "Start the demo" }).click();
  await page.waitForURL("**/dashboard", { timeout: 60_000 });
}

// demo.spec.ts runs serially, so the newest demo household is the one the
// test just started.
export async function newestDemoHouseholdId(): Promise<string> {
  return queryE2e(async (sql) => {
    const [household] = await sql`select id from households where demo_expires_at is not null order by created_at desc limit 1`;
    return household.id as string;
  });
}

export async function liveDemoCount(): Promise<number> {
  return queryE2e(async (sql) => {
    const [row] = await sql`select count(*)::int as n from households where demo_expires_at > now()`;
    return row.n as number;
  });
}
````

Replace the whole of `playwright.config.ts` with:

````ts
import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

import { e2eDatabaseUrl } from "./e2e/support/db";

// e2e credentials (SEED_USER*) come from .env.local.
loadEnv({ path: ".env.local" });

// A dedicated port so e2e never reuses (or fights over) a manually-run dev
// server on 3000 — reusing one would silently miss the env below.
const port = process.env.PLAYWRIGHT_PORT ?? "3100";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  projects: [
    // Signs in once and saves the session cookie, so specs don't each log in.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      dependencies: ["setup"],
      name: "chromium",
      testIgnore: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/user.json" },
    },
  ],
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  retries: process.env.CI ? 2 : 0,
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  webServer: {
    // Production server, not `next dev`: Next 16 refuses a second dev server
    // for the same directory, so `next dev` here would fail whenever a manual
    // dev server is running. This also exercises the real build.
    command: "npm run e2e:serve",
    // AUTH_TRUST_HOST: next-auth v5 rejects a non-Vercel host unless trusted;
    // e2e runs a local `next start`, so it needs this. Test-only.
    // DATABASE_URL points the server (and the seeder) at the e2e database.
    env: {
      AUTH_TRUST_HOST: "true",
      ...(e2eDatabaseUrl ? { DATABASE_URL: e2eDatabaseUrl } : {}),
    },
    reuseExistingServer: !process.env.CI,
    stderr: "pipe",
    stdout: "pipe",
    timeout: 180_000,
    url: baseURL,
  },
});
````

Create `src/app/demo/page.tsx` with:

````tsx
import type { Metadata } from "next";

export { DemoPage as default } from "@/modules/demo";

export const metadata: Metadata = { title: "Try Piko" };
````

Replace the whole of `src/app/login/page.tsx` with:

````tsx
"use client";

import { useActionState } from "react";

import { BrandSplit } from "@/components/BrandSplit";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { loginAction } from "@/lib/actions/auth";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <BrandSplit>
      <form action={formAction} className="flex w-full max-w-sm flex-col gap-5.5">
        <h1 className="text-[42px] leading-none font-extrabold tracking-[-0.02em]">Sign in</h1>
        <TextField autoComplete="email" id="email" label="Email" name="email" required type="email" />
        <TextField autoComplete="current-password" id="password" label="Password" name="password" required type="password" />
        {state?.error && (
          <p className="text-sm text-signal-ink" role="alert">
            {state.error}
          </p>
        )}
        <Button className="h-10 w-full" disabled={pending} type="submit">
          {pending ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </BrandSplit>
  );
}
````

Create `src/components/BrandSplit.tsx` with:

````tsx
import type { ReactNode } from "react";

// The split screen the signed-out pages share (Sign in, Try Piko): the brand
// on one side, the page's own content on the other.
export function BrandSplit({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-paper text-ink lg:grid-cols-2">
      <div className="flex flex-col justify-between gap-10 border-b-2 border-rule px-6 py-6 lg:border-r-2 lg:border-b-0 lg:p-12">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="grid size-8 place-items-center bg-ink text-base font-extrabold text-paper">
            P
          </span>
          <span className="text-[17px] font-extrabold">Piko</span>
        </div>
        <div className="hidden lg:block">
          <p className="text-[76px] leading-[0.95] font-extrabold tracking-[-0.035em]">Piko</p>
          <p className="mt-5 max-w-[26ch] border-t-2 border-ink pt-4 text-xl leading-snug text-n-800">Plan together, grow together.</p>
        </div>
      </div>

      <div className="flex items-start px-6 py-10 lg:items-center lg:p-12">{children}</div>
    </div>
  );
}
````

Create `src/modules/demo/api/demo.actions.ts` with:

````ts
"use server";

import { redirect } from "next/navigation";

import { auth, signIn, signOut } from "@/auth";
import { isDemoEmail } from "@/lib/demo-account";
import { getCurrentMember } from "@/lib/session";

import { MAX_LIVE_DEMOS } from "../lib/demo-constants";
import { countLiveDemos, createDemoHousehold, deleteDemoHousehold, deleteExpiredDemos, hasHousehold } from "./demo";

export type DemoStartState = undefined | { busy: boolean };

// "Start the demo" on /demo. A GET never gets here, so link previews (which
// only fetch the page) can't create households.
export async function startDemoAction(): Promise<DemoStartState> {
  const session = await auth();
  const userId = session?.user?.id;
  // A visitor whose demo is still running goes back to it.
  if (userId && isDemoEmail(session.user?.email) && (await hasHousehold(userId))) redirect("/dashboard");

  const now = new Date();
  await deleteExpiredDemos(now);
  if ((await countLiveDemos(now)) >= MAX_LIVE_DEMOS) return { busy: true };

  const { email, password } = await createDemoHousehold(now);
  // Replaces any session already in this browser, including a real account's.
  await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  return undefined;
}

export async function exitDemoAction() {
  const member = await getCurrentMember();
  if (!member.isDemo) throw new Error("Only a demo can be exited");
  await deleteDemoHousehold(member.householdId);
  await signOut({ redirectTo: "/demo?bye=1" });
}
````

Create `src/modules/demo/api/demo.ts` with:

````ts
import { randomBytes, randomUUID } from "node:crypto";

import bcrypt from "bcryptjs";
import { and, count, eq, gt, inArray, isNotNull, like, lt, type SQL } from "drizzle-orm";

import { db } from "@/db/client";
import {
  budgetItems,
  categories,
  dhukuEntries,
  dhukus,
  expenses,
  fundPlans,
  funds,
  fundTopUps,
  householdMembers,
  households,
  incomes,
  loanPayments,
  loans,
  monthlyBudgets,
  paybacks,
  recurringExpenses,
  savingsDeposits,
  savingsItems,
  savingsPotPlans,
  savingsPots,
  users,
} from "@/db/schema";
import { DEMO_EMAIL_DOMAIN } from "@/lib/demo-account";
import { todayISO } from "@/lib/today";

import { demoExpiry } from "../lib/demo-constants";
import { buildDemoFixture } from "../lib/demo-fixture";

function secret(): string {
  return randomBytes(24).toString("base64url");
}

// Creates a visitor's private copy of Aarav & Sita's household, all or
// nothing, and returns Aarav's sign-in. The password exists only in memory
// for the sign-in that follows; Sita's is random and never used.
export async function createDemoHousehold(now: Date): Promise<{ email: string; password: string }> {
  const householdId = randomUUID();
  const aarav = { memberId: randomUUID(), userId: randomUUID() };
  const sita = { memberId: randomUUID(), userId: randomUUID() };
  const email = `aarav.${householdId}@${DEMO_EMAIL_DOMAIN}`;
  const password = secret();
  const [aaravHash, sitaHash] = await Promise.all([bcrypt.hash(password, 10), bcrypt.hash(secret(), 10)]);
  const fixture = buildDemoFixture({
    aaravId: aarav.memberId,
    householdId,
    newId: randomUUID,
    sitaId: sita.memberId,
    today: todayISO(now),
  });

  await db.transaction(async (tx) => {
    await tx.insert(households).values({ dateFormat: "nepali", demoExpiresAt: demoExpiry(now), id: householdId, name: "Aarav & Sita" });
    await tx.insert(users).values([
      { email, id: aarav.userId, name: "Aarav", passwordHash: aaravHash },
      { email: `sita.${householdId}@${DEMO_EMAIL_DOMAIN}`, id: sita.userId, name: "Sita", passwordHash: sitaHash },
    ]);
    await tx.insert(householdMembers).values([
      { householdId, id: aarav.memberId, userId: aarav.userId },
      { householdId, id: sita.memberId, userId: sita.userId },
    ]);
    // Parents before the rows that point at them.
    await tx.insert(categories).values(fixture.categories);
    await tx.insert(recurringExpenses).values(fixture.recurringExpenses);
    await tx.insert(savingsPots).values(fixture.savingsPots);
    await tx.insert(savingsPotPlans).values(fixture.savingsPotPlans);
    await tx.insert(savingsItems).values(fixture.savingsItems);
    await tx.insert(savingsDeposits).values(fixture.savingsDeposits);
    await tx.insert(expenses).values(fixture.expenses);
    await tx.insert(incomes).values(fixture.incomes);
    await tx.insert(monthlyBudgets).values(fixture.monthlyBudgets);
    await tx.insert(budgetItems).values(fixture.budgetItems);
    await tx.insert(dhukus).values(fixture.dhukus);
    await tx.insert(dhukuEntries).values(fixture.dhukuEntries);
    await tx.insert(loans).values(fixture.loans);
    await tx.insert(loanPayments).values(fixture.loanPayments);
    await tx.insert(funds).values(fixture.funds);
    await tx.insert(fundPlans).values(fixture.fundPlans);
    await tx.insert(fundTopUps).values(fixture.fundTopUps);
    await tx.insert(paybacks).values(fixture.paybacks);
  });

  return { email, password };
}

export async function countLiveDemos(now: Date): Promise<number> {
  const [row] = await db.select({ live: count() }).from(households).where(gt(households.demoExpiresAt, now));
  return row?.live ?? 0;
}

export async function hasHousehold(userId: string): Promise<boolean> {
  const member = await db.query.householdMembers.findFirst({ where: eq(householdMembers.userId, userId) });
  return member !== undefined;
}

// Deletes demo households and their accounts. Two guards must both hold, so a
// mistake here can never reach a real household:
//   1. only households with demo_expires_at set (real ones have none), and
//   2. only accounts that belonged to them AND are on the demo email domain.
// Deleting a household deletes all of its data (every table cascades from it).
async function deleteDemos(which: SQL | undefined): Promise<void> {
  await db.transaction(async (tx) => {
    const doomed = await tx
      .select({ id: households.id })
      .from(households)
      .where(and(isNotNull(households.demoExpiresAt), which));
    if (doomed.length === 0) return;
    const householdIds = doomed.map((h) => h.id);
    const members = await tx
      .select({ userId: householdMembers.userId })
      .from(householdMembers)
      .where(inArray(householdMembers.householdId, householdIds));

    await tx.delete(households).where(and(isNotNull(households.demoExpiresAt), inArray(households.id, householdIds)));
    if (members.length > 0) {
      await tx.delete(users).where(
        and(
          inArray(
            users.id,
            members.map((m) => m.userId),
          ),
          like(users.email, `%@${DEMO_EMAIL_DOMAIN}`),
        ),
      );
    }
  });
}

export async function deleteExpiredDemos(now: Date): Promise<void> {
  await deleteDemos(lt(households.demoExpiresAt, now));
}

export async function deleteDemoHousehold(householdId: string): Promise<void> {
  await deleteDemos(eq(households.id, householdId));
}
````

Create `src/modules/demo/components/DemoStart.tsx` with:

````tsx
"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";

import { startDemoAction } from "../api/demo.actions";

export function DemoStart({ signedInAsSelf }: { signedInAsSelf: boolean }) {
  const [state, formAction, pending] = useActionState(startDemoAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {signedInAsSelf && <p className="text-sm text-n-700">Starting the demo signs you out of your own household.</p>}
      {state?.busy && (
        <p className="text-sm text-signal-ink" role="alert">
          The demo is busy, try again later.
        </p>
      )}
      <Button className="h-10 w-full" disabled={pending} type="submit">
        {pending ? "Setting up your demo…" : "Start the demo"}
      </Button>
    </form>
  );
}
````

Create `src/modules/demo/index.tsx` with:

````tsx
export { DemoPage } from "./pages/DemoPage";
````

Create `src/modules/demo/lib/demo-constants.ts` with:

````ts
// How long a visitor's private demo household lives before cleanup deletes it.
export const DEMO_LIFETIME_HOURS = 24;

// At most this many demos live at once; past it, visitors are asked to come
// back later. Caps what bots can create without storing anyone's IP address.
export const MAX_LIVE_DEMOS = 100;

export function demoExpiry(now: Date): Date {
  return new Date(now.getTime() + DEMO_LIFETIME_HOURS * 60 * 60 * 1000);
}
````

Create `src/modules/demo/pages/DemoPage.tsx` with:

````tsx
import { auth } from "@/auth";
import { BrandSplit } from "@/components/BrandSplit";
import { isDemoEmail } from "@/lib/demo-account";

import { DemoStart } from "../components/DemoStart";

type Props = { searchParams: Promise<{ bye?: string; expired?: string }> };

const POINTS = [
  "Add an expense and watch your month update.",
  "See how a budget, savings pot and dhuku fit together.",
  "See both people's money, and what's shared.",
];

// The public way in: anyone with the link can start a private demo.
export async function DemoPage({ searchParams }: Props) {
  const [params, session] = await Promise.all([searchParams, auth()]);
  // A demo session whose household was deleted still counts as signed out here.
  const signedInAsSelf = Boolean(session?.user?.id) && !isDemoEmail(session?.user?.email);
  const notice = params.expired ? "Your demo expired. Start a new one." : params.bye ? "Thanks for trying Piko." : null;

  return (
    <BrandSplit>
      <div className="flex w-full max-w-sm flex-col gap-5.5">
        <h1 className="text-[42px] leading-none font-extrabold tracking-[-0.02em]">Try Piko</h1>
        {notice && (
          <p className="border-l-2 border-signal pl-3 text-[15px] text-ink" role="status">
            {notice}
          </p>
        )}
        <ul className="flex flex-col gap-2.5">
          {POINTS.map((point) => (
            <li className="flex items-baseline gap-2.5 text-[15px] text-n-800" key={point}>
              <span aria-hidden className="size-1.5 shrink-0 translate-y-[-2px] bg-signal" />
              {point}
            </li>
          ))}
        </ul>
        <p className="border-t border-n-300 pt-4 text-sm text-n-700">
          You get a private copy made just for you. Nobody else sees what you enter, and it&apos;s deleted after 24 hours.
        </p>
        <DemoStart signedInAsSelf={signedInAsSelf} />
      </div>
    </BrandSplit>
  );
}
````

Replace the whole of `src/proxy.ts` with:

````ts
import { NextResponse } from "next/server";

import { auth } from "@/auth";

// Open without a session. /demo stays open to signed-in people too, so the
// owner can try their own demo link.
const PUBLIC_PATHS = ["/login", "/demo"];

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  if (!isLoggedIn && !PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if (isLoggedIn && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api/auth|api/mobile|_next/static|_next/image|favicon.ico).*)"],
};
````

- [ ] **Step 4: Run the checks**

Run:

```bash
npx vitest run src/modules/demo/lib/demo-constants.test.ts
npx vitest run
npx tsc --noEmit
npm run lint
```

Expected: the task's tests: `Tests  1 passed (1)`; the whole suite: `Tests  435 passed (435)`; `tsc` prints nothing; lint ends with `✖ 2 problems (0 errors, 2 warnings)` (both warnings were there before this plan: `jsx-a11y/role-supports-aria-props` in `NepaliDateField.tsx` and `react-hooks/incompatible-library` in `ExpenseDialog.tsx`).

- [ ] **Step 5: Run the browser tests**

Run:

```bash
npx playwright test e2e/demo.spec.ts --retries=1
```

Expected: `9 passed` (the sign-in setup plus 8 demo tests), possibly with a line saying some were `flaky` (passed on the retry). It builds and serves the app first, so allow 3–6 minutes.

- [ ] **Step 6: Commit**

```bash
git add "e2e/demo.spec.ts" "e2e/support/db.ts" "e2e/support/demo.ts" "playwright.config.ts" "src/app/demo/page.tsx" "src/app/login/page.tsx" "src/components/BrandSplit.tsx" "src/modules/demo/api/demo.actions.ts" "src/modules/demo/api/demo.ts" "src/modules/demo/components/DemoStart.tsx" "src/modules/demo/index.tsx" "src/modules/demo/lib/demo-constants.test.ts" "src/modules/demo/lib/demo-constants.ts" "src/modules/demo/pages/DemoPage.tsx" "src/proxy.ts"
git commit -m "feat(demo): /demo starts a private demo household; expired ones are cleaned up" -m "A public landing page whose button creates a visitor's own copy of Aarav & Sita's household and signs them in. Starting a demo first deletes expired ones (only households with demo_expires_at, only demo-domain accounts), and at most 100 live at once. The login page's brand panel is shared."
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.

### Task 5: Banner with time left and Exit demo; locked settings explain themselves

A thin bar on every page of a demo: how long until it's deleted, and **Exit demo** (which deletes the copy now and signs out to `/demo?bye=1`). Real accounts render nothing; the layout only asks for the expiry when the member is a demo. Settings greys out password and profile photo with "Not available in the demo.", and the web voice button explains instead of calling Gemini. The browser tests check the banner, the locked settings (and that the server still refuses when the form is forced open), Exit, and that a real account sees none of it.

**Files:**
- Test: `e2e/demo.spec.ts`
- Modify: `e2e/support/demo.ts`
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/modules/demo/api/demo.ts`
- Create: `src/modules/demo/components/DemoBanner.tsx`
- Create: `src/modules/demo/components/DemoLocked.tsx`
- Create: `src/modules/demo/components/DemoProvider.tsx`
- Test: `src/modules/demo/lib/demo-constants.test.ts`
- Modify: `src/modules/demo/lib/demo-constants.ts`
- Modify: `src/modules/settings/pages/SettingsPage.tsx`
- Modify: `src/modules/voice-entry/components/VoiceEntryButton.tsx`

**Interfaces:**
- Consumes: `exitDemoAction` (Task 4), `CurrentMember.isDemo` (Task 2), `DEMO_LOCKED_MESSAGE` (Task 1).
- Produces: `getDemoExpiry(householdId): Promise<Date | null>` (`api/demo.ts`); `demoTimeLeft(expiresAt: Date, now: Date): string` ("17 h" / "under an hour"); `DemoProvider({ demo: DemoState | null })` and `useDemo()` with `DemoState = { timeLeft: string }`; `DemoBanner`; `DemoLocked({ locked })`. `e2e/support/demo.ts` gains `householdExists(id)`.

- [ ] **Step 1: Write the failing tests**

Replace the whole of `src/modules/demo/lib/demo-constants.test.ts` with:

````ts
import { describe, expect, it } from "vitest";

import { DEMO_LIFETIME_HOURS, demoExpiry, demoTimeLeft } from "./demo-constants";

describe("demoExpiry", () => {
  it("is a day after the demo starts", () => {
    const now = new Date("2026-10-15T06:00:00Z");
    expect(DEMO_LIFETIME_HOURS).toBe(24);
    expect(demoExpiry(now).toISOString()).toBe("2026-10-16T06:00:00.000Z");
  });
});

describe("demoTimeLeft", () => {
  const expiresAt = new Date("2026-10-16T06:00:00Z");

  it("counts whole hours left", () => {
    expect(demoTimeLeft(expiresAt, new Date("2026-10-15T06:00:00Z"))).toBe("24 h");
    expect(demoTimeLeft(expiresAt, new Date("2026-10-15T12:59:00Z"))).toBe("17 h");
  });

  it("says under an hour for the last hour, and after it has passed", () => {
    expect(demoTimeLeft(expiresAt, new Date("2026-10-16T05:30:00Z"))).toBe("under an hour");
    expect(demoTimeLeft(expiresAt, new Date("2026-10-16T07:00:00Z"))).toBe("under an hour");
  });
});
````

- [ ] **Step 2: Run them to see them fail**

Run:

```bash
npx vitest run src/modules/demo/lib/demo-constants.test.ts
```

Expected: FAIL. `TypeError: demoTimeLeft is not a function`

- [ ] **Step 3: Make them pass**

In `e2e/demo.spec.ts`, find:

````ts
import { expect, test } from "@playwright/test";

import { queryE2e } from "./support/db";
import { liveDemoCount, newestDemoHouseholdId, SIGNED_OUT, startDemo } from "./support/demo";
import { expectNoErrorBoundary, gotoRoute } from "./support/nav";

// One demo at a time, so "the newest demo household" is always this file's.
````

Replace it with:

````ts
import { expect, test } from "@playwright/test";

import { queryE2e } from "./support/db";
import { householdExists, liveDemoCount, newestDemoHouseholdId, SIGNED_OUT, startDemo } from "./support/demo";
import { expectNoErrorBoundary, gotoRoute } from "./support/nav";

// One demo at a time, so "the newest demo household" is always this file's.
````

In `e2e/demo.spec.ts`, find:

````ts
    await startDemo(page);
    await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible();
    await expect(page.getByText("Birthday dinner").first()).toBeVisible();
    await expectNoErrorBoundary(page);
  });

````

Replace it with:

````ts
    await startDemo(page);
    await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible();
    await expect(page.getByText("Birthday dinner").first()).toBeVisible();
    await expect(page.getByText(/^Deleted in /)).toBeVisible();
    await expectNoErrorBoundary(page);
  });

````

In `e2e/demo.spec.ts`, find:

````ts
    expect(response.status()).toBe(403);
  });

  test("cleanup deletes an expired demo and leaves the real household alone", async ({ browser }) => {
    const first = await browser.newPage();
    await startDemo(first);
    const { householdId, userIds } = await queryE2e(async (sql) => {
      const [household] = await sql`select id from households where demo_expires_at is not null order by created_at desc limit 1`;
      const members = await sql`select user_id from household_members where household_id = ${household.id}`;
      await sql`update households set demo_expires_at = now() - interval '1 minute' where id = ${household.id}`;
      return { householdId: household.id as string, userIds: members.map((m) => m.user_id as string) };
    });

    // Starting another demo runs the cleanup.
````

Replace it with:

````ts
    expect(response.status()).toBe(403);
  });

  test("locks the password, and the server refuses it even when forced", async ({ page }) => {
    await startDemo(page);
    await gotoRoute(page, "/settings");
    await expect(page.getByRole("button", { name: "Change Password" })).toBeDisabled();
    await expect(page.getByText("Not available in the demo.").first()).toBeVisible();

    await page.locator("fieldset[disabled]").evaluateAll((sets) => sets.forEach((set) => set.removeAttribute("disabled")));
    await page.getByLabel("Current password").fill("anything-at-all");
    await page.getByLabel("New password", { exact: true }).fill("new-password-123");
    await page.getByLabel("Confirm new password").fill("new-password-123");
    await page.getByRole("button", { name: "Change Password" }).click();
    await expect(page.locator("[data-sonner-toast][data-type='error']")).toBeVisible();
    await expect(page.getByText("Password changed")).toHaveCount(0);
  });

  test("Exit demo deletes the copy and returns to /demo", async ({ page }) => {
    await startDemo(page);
    const householdId = await newestDemoHouseholdId();

    await page.getByRole("button", { name: "Exit demo" }).click();
    await page.waitForURL(/\/demo\?bye=1/);
    await expect(page.getByText("Thanks for trying Piko.")).toBeVisible();
    expect(await householdExists(householdId)).toBe(false);
  });

  test("cleanup deletes an expired demo and leaves the real household alone", async ({ browser }) => {
    const first = await browser.newPage();
    await startDemo(first);
    const householdId = await newestDemoHouseholdId();
    const userIds = await queryE2e(async (sql) => {
      const members = await sql`select user_id from household_members where household_id = ${householdId}`;
      await sql`update households set demo_expires_at = now() - interval '1 minute' where id = ${householdId}`;
      return members.map((m) => m.user_id as string);
    });

    // Starting another demo runs the cleanup.
````

In `e2e/demo.spec.ts`, find:

````ts
    await startDemo(second);

    const left = await queryE2e(async (sql) => {
      const [demo] = await sql`select count(*)::int as n from households where id = ${householdId}`;
      const [demoUsers] = await sql`select count(*)::int as n from users where id in ${sql(userIds)}`;
      const [real] = await sql`
        select count(distinct m.user_id)::int as n
        from households h join household_members m on m.household_id = h.id join users u on u.id = m.user_id
        where h.name = 'E2E Household' and h.demo_expires_at is null`;
      return { demo: demo.n, demoUsers: demoUsers.n, realUsers: real.n };
    });
    expect(left).toEqual({ demo: 0, demoUsers: 0, realUsers: 2 });

    // The first visitor's session outlived its household: back to /demo, not an error.
    await first.goto("/dashboard");
````

Replace it with:

````ts
    await startDemo(second);

    const left = await queryE2e(async (sql) => {
      const [demoUsers] = await sql`select count(*)::int as n from users where id in ${sql(userIds)}`;
      const [real] = await sql`
        select count(distinct m.user_id)::int as n
        from households h join household_members m on m.household_id = h.id join users u on u.id = m.user_id
        where h.name = 'E2E Household' and h.demo_expires_at is null`;
      return { demoUsers: demoUsers.n, realUsers: real.n };
    });
    expect(await householdExists(householdId)).toBe(false);
    expect(left).toEqual({ demoUsers: 0, realUsers: 2 });

    // The first visitor's session outlived its household: back to /demo, not an error.
    await first.goto("/dashboard");
````

In `e2e/demo.spec.ts`, find:

````ts
  await expect(page.getByRole("heading", { name: "Try Piko" })).toBeVisible();
  await expect(page.getByText("Starting the demo signs you out of your own household.")).toBeVisible();
});
````

Replace it with:

````ts
  await expect(page.getByRole("heading", { name: "Try Piko" })).toBeVisible();
  await expect(page.getByText("Starting the demo signs you out of your own household.")).toBeVisible();
});

test("a real account sees no demo banner", async ({ page }) => {
  await gotoRoute(page, "/dashboard");
  await expect(page.getByRole("button", { name: "Exit demo" })).toHaveCount(0);
  await gotoRoute(page, "/settings");
  await expect(page.getByRole("button", { name: "Change Password" })).toBeEnabled();
});
````

Replace the whole of `e2e/support/demo.ts` with:

````ts
import type { Page } from "@playwright/test";

import { queryE2e } from "./db";

// A browser with no session, for the public demo.
export const SIGNED_OUT = { cookies: [], origins: [] };

// Starts a demo from /demo and waits for its Home. Creating the household
// takes a few round trips to the database, hence the longer wait.
export async function startDemo(page: Page): Promise<void> {
  await page.goto("/demo");
  await page.getByRole("button", { name: "Start the demo" }).click();
  await page.waitForURL("**/dashboard", { timeout: 60_000 });
}

// demo.spec.ts runs serially, so the newest demo household is the one the
// test just started.
export async function newestDemoHouseholdId(): Promise<string> {
  return queryE2e(async (sql) => {
    const [household] = await sql`select id from households where demo_expires_at is not null order by created_at desc limit 1`;
    return household.id as string;
  });
}

export async function householdExists(id: string): Promise<boolean> {
  return queryE2e(async (sql) => {
    const [row] = await sql`select count(*)::int as n from households where id = ${id}`;
    return row.n === 1;
  });
}

export async function liveDemoCount(): Promise<number> {
  return queryE2e(async (sql) => {
    const [row] = await sql`select count(*)::int as n from households where demo_expires_at > now()`;
    return row.n as number;
  });
}
````

Replace the whole of `src/app/(app)/layout.tsx` with:

````tsx
import { cookies } from "next/headers";

import { BottomNav } from "@/components/nav/BottomNav";
import { SidebarNav } from "@/components/nav/SidebarNav";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { SIDEBAR_COLLAPSED_COOKIE_NAME } from "@/lib/sidebar-cookie";
import { listCategories } from "@/modules/categories/api/categories";
import { getDemoExpiry } from "@/modules/demo/api/demo";
import { DemoBanner } from "@/modules/demo/components/DemoBanner";
import { DemoProvider } from "@/modules/demo/components/DemoProvider";
import { demoTimeLeft } from "@/modules/demo/lib/demo-constants";
import { listRecentExpensesForHousehold } from "@/modules/expenses/api/expenses.actions";
import { topCategoryIds } from "@/modules/expenses/lib/expense-view";
import { countUnreadNotifications } from "@/modules/notifications/api/notifications.actions";

// How many recent expenses decide the quick-pick categories in Add expense.
const QUICK_CATEGORY_SAMPLE = 60;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const current = await getCurrentMember();
  const [members, categories, unreadNotifications, recentExpenses, cookieStore, demoExpiresAt] = await Promise.all([
    getHouseholdMembers(current.householdId),
    listCategories(current.householdId),
    countUnreadNotifications(current.householdId),
    listRecentExpensesForHousehold(current.householdId, QUICK_CATEGORY_SAMPLE),
    cookies(),
    current.isDemo ? getDemoExpiry(current.householdId) : null,
  ]);

  const expenseCategories = categories.map((c) => ({ groupName: c.groupName, id: c.id, name: c.name }));
  const expenseMembers = members.map((m) => ({ id: m.id, name: m.user.name }));
  const initialCollapsed = cookieStore.get(SIDEBAR_COLLAPSED_COOKIE_NAME)?.value === "true";
  const quickCategoryIds = topCategoryIds(recentExpenses, 5);
  const demo = demoExpiresAt ? { timeLeft: demoTimeLeft(demoExpiresAt, new Date()) } : null;

  return (
    <DemoProvider demo={demo}>
      <div className="flex min-h-screen bg-paper text-ink">
        <SidebarNav
          categories={expenseCategories}
          currentMemberId={current.memberId}
          initialCollapsed={initialCollapsed}
          members={members.map((m) => ({ id: m.id, image: m.user.image, name: m.user.name }))}
          quickCategoryIds={quickCategoryIds}
          unreadNotifications={unreadNotifications}
        />
        <main className="min-w-0 flex-1 px-4 pt-5 pb-28 md:px-12 md:pt-9 md:pb-16">
          <DemoBanner />
          {/* @container: composites lay out against the content width, not the window. */}
          <div className="@container max-w-280">{children}</div>
        </main>
        <BottomNav
          categories={expenseCategories}
          currentMemberId={current.memberId}
          members={expenseMembers}
          quickCategoryIds={quickCategoryIds}
          unreadNotifications={unreadNotifications}
        />
      </div>
    </DemoProvider>
  );
}
````

In `src/modules/demo/api/demo.ts`, find:

````ts
export async function deleteDemoHousehold(householdId: string): Promise<void> {
  await deleteDemos(eq(households.id, householdId));
}
````

Replace it with:

````ts
export async function deleteDemoHousehold(householdId: string): Promise<void> {
  await deleteDemos(eq(households.id, householdId));
}

export async function getDemoExpiry(householdId: string): Promise<Date | null> {
  const [row] = await db.select({ expiresAt: households.demoExpiresAt }).from(households).where(eq(households.id, householdId));
  return row?.expiresAt ?? null;
}
````

Create `src/modules/demo/components/DemoBanner.tsx` with:

````tsx
"use client";

import { Button } from "@/components/ui/button";

import { exitDemoAction } from "../api/demo.actions";
import { useDemo } from "./DemoProvider";

// The thin bar on every page of a demo. Real accounts render nothing.
export function DemoBanner() {
  const demo = useDemo();
  if (!demo) return null;

  return (
    <div className="sticky top-0 z-20 -mx-4 -mt-5 mb-5 flex flex-wrap items-center gap-x-4 gap-y-1 border-b-2 border-ink bg-paper px-4 py-2 text-sm md:-mx-12 md:-mt-9 md:mb-9 md:px-12">
      <span className="font-semibold">Demo</span>
      <span className="text-n-700">Deleted in {demo.timeLeft}</span>
      <form action={exitDemoAction} className="ml-auto">
        <Button size="sm" type="submit" variant="ghost">
          Exit demo
        </Button>
      </form>
    </div>
  );
}
````

Create `src/modules/demo/components/DemoLocked.tsx` with:

````tsx
import type { ReactNode } from "react";

import { DEMO_LOCKED_MESSAGE } from "@/lib/demo-account";

// Greys out a settings section the demo turns off. The server refuses these
// actions anyway (assertNotDemo); this only explains why nothing happens.
export function DemoLocked({ children, locked }: { children: ReactNode; locked: boolean }) {
  if (!locked) return children;

  return (
    <div>
      <fieldset className="opacity-50" disabled>
        {children}
      </fieldset>
      <p className="mt-2 text-[13px] text-n-700">{DEMO_LOCKED_MESSAGE}.</p>
    </div>
  );
}
````

Create `src/modules/demo/components/DemoProvider.tsx` with:

````tsx
"use client";

import { createContext, type ReactNode, useContext } from "react";

// What the app shell knows about a demo visitor's household; null for real accounts.
export type DemoState = { timeLeft: string };

const DemoContext = createContext<DemoState | null>(null);

export function DemoProvider({ children, demo }: { children: ReactNode; demo: DemoState | null }) {
  return <DemoContext value={demo}>{children}</DemoContext>;
}

export function useDemo(): DemoState | null {
  return useContext(DemoContext);
}
````

Replace the whole of `src/modules/demo/lib/demo-constants.ts` with:

````ts
// How long a visitor's private demo household lives before cleanup deletes it.
export const DEMO_LIFETIME_HOURS = 24;

// At most this many demos live at once; past it, visitors are asked to come
// back later. Caps what bots can create without storing anyone's IP address.
export const MAX_LIVE_DEMOS = 100;

export function demoExpiry(now: Date): Date {
  return new Date(now.getTime() + DEMO_LIFETIME_HOURS * 60 * 60 * 1000);
}

// For the banner: "17 h", or "under an hour" once less than one is left.
export function demoTimeLeft(expiresAt: Date, now: Date): string {
  const hours = Math.floor((expiresAt.getTime() - now.getTime()) / (60 * 60 * 1000));
  return hours >= 1 ? `${hours} h` : "under an hour";
}
````

In `src/modules/settings/pages/SettingsPage.tsx`, find:

````tsx
import { getCurrentMember } from "@/lib/session";
import { listReleases } from "@/modules/app-releases/api/app-releases";
import { AppReleasesSection } from "@/modules/app-releases/components/AppReleasesSection";
import { AppearanceSection } from "@/modules/settings/components/AppearanceSection";
import { DateFormatSection } from "@/modules/settings/components/DateFormatSection";
import { PasswordSection } from "@/modules/settings/components/PasswordSection";
````

Replace it with:

````tsx
import { getCurrentMember } from "@/lib/session";
import { listReleases } from "@/modules/app-releases/api/app-releases";
import { AppReleasesSection } from "@/modules/app-releases/components/AppReleasesSection";
import { DemoLocked } from "@/modules/demo/components/DemoLocked";
import { AppearanceSection } from "@/modules/settings/components/AppearanceSection";
import { DateFormatSection } from "@/modules/settings/components/DateFormatSection";
import { PasswordSection } from "@/modules/settings/components/PasswordSection";
````

In `src/modules/settings/pages/SettingsPage.tsx`, find:

````tsx
import { SettingsRow } from "@/modules/settings/components/SettingsRow";

export async function SettingsPage() {
  const { householdId, userId } = await getCurrentMember();
  const [[user], dateFormat, canPublishReleases] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)),
    getDateFormatPref(householdId),
````

Replace it with:

````tsx
import { SettingsRow } from "@/modules/settings/components/SettingsRow";

export async function SettingsPage() {
  const { householdId, isDemo, userId } = await getCurrentMember();
  const [[user], dateFormat, canPublishReleases] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)),
    getDateFormatPref(householdId),
````

In `src/modules/settings/pages/SettingsPage.tsx`, find:

````tsx
      <div className="flex flex-col gap-9">
        <AppearanceSection />
        <DateFormatSection initialFormat={dateFormat} />
        <ProfilePictureSection initialImage={user?.image ?? null} name={user?.name ?? "?"} />
        <PasswordSection />
        {canPublishReleases && <AppReleasesSection releases={releases} />}

        <section>
````

Replace it with:

````tsx
      <div className="flex flex-col gap-9">
        <AppearanceSection />
        <DateFormatSection initialFormat={dateFormat} />
        <DemoLocked locked={isDemo}>
          <ProfilePictureSection initialImage={user?.image ?? null} name={user?.name ?? "?"} />
        </DemoLocked>
        <DemoLocked locked={isDemo}>
          <PasswordSection />
        </DemoLocked>
        {canPublishReleases && <AppReleasesSection releases={releases} />}

        <section>
````

In `src/modules/voice-entry/components/VoiceEntryButton.tsx`, find:

````tsx
import { useEffect, useState } from "react";

import { Mic } from "lucide-react";

import { isSpeechRecognitionSupported } from "@/lib/useSpeechRecognition";
import { cn } from "@/lib/utils";
import { ExpenseDialog } from "@/modules/expenses/components/ExpenseDialog";
import { VoiceEntryModal } from "@/modules/voice-entry/components/VoiceEntryModal";
import type { ExpenseDraft } from "@/modules/voice-entry/lib/sanitize-voice-expense";
````

Replace it with:

````tsx
import { useEffect, useState } from "react";

import { Mic } from "lucide-react";
import { toast } from "sonner";

import { DEMO_LOCKED_MESSAGE } from "@/lib/demo-account";
import { isSpeechRecognitionSupported } from "@/lib/useSpeechRecognition";
import { cn } from "@/lib/utils";
import { useDemo } from "@/modules/demo/components/DemoProvider";
import { ExpenseDialog } from "@/modules/expenses/components/ExpenseDialog";
import { VoiceEntryModal } from "@/modules/voice-entry/components/VoiceEntryModal";
import type { ExpenseDraft } from "@/modules/voice-entry/lib/sanitize-voice-expense";
````

In `src/modules/voice-entry/components/VoiceEntryButton.tsx`, find:

````tsx
  }, []);

  const resultModalOpen = draft !== null || manualAddOpen;

  function closeResultModal() {
    setDraft(null);
````

Replace it with:

````tsx
  }, []);

  const resultModalOpen = draft !== null || manualAddOpen;
  // A demo never sends speech to Gemini: the button only explains that.
  const demo = useDemo();
  const usable = supported || demo !== null;

  function closeResultModal() {
    setDraft(null);
````

In `src/modules/voice-entry/components/VoiceEntryButton.tsx`, find:

````tsx
    <>
      <button
        aria-label="Add expense by voice"
        className={cn(className, !supported && "cursor-not-allowed opacity-50")}
        disabled={!supported}
        onClick={() => setListening(true)}
        title={supported ? undefined : "Voice input isn't supported in this browser"}
        type="button"
      >
        <Mic className="h-5 w-5" />
````

Replace it with:

````tsx
    <>
      <button
        aria-label="Add expense by voice"
        className={cn(className, !usable && "cursor-not-allowed opacity-50")}
        disabled={!usable}
        onClick={() => (demo ? toast(`${DEMO_LOCKED_MESSAGE}.`) : setListening(true))}
        title={usable ? undefined : "Voice input isn't supported in this browser"}
        type="button"
      >
        <Mic className="h-5 w-5" />
````

- [ ] **Step 4: Run the checks**

Run:

```bash
npx vitest run src/modules/demo/lib/demo-constants.test.ts
npx vitest run
npx tsc --noEmit
npm run lint
```

Expected: the task's tests: `Tests  3 passed (3)`; the whole suite: `Tests  437 passed (437)`; `tsc` prints nothing; lint ends with `✖ 2 problems (0 errors, 2 warnings)` (both warnings were there before this plan: `jsx-a11y/role-supports-aria-props` in `NepaliDateField.tsx` and `react-hooks/incompatible-library` in `ExpenseDialog.tsx`).

- [ ] **Step 5: Run the browser tests**

Run:

```bash
npx playwright test e2e/demo.spec.ts --retries=1
```

Expected: `12 passed` (the sign-in setup plus 11 demo tests), possibly with a line saying some were `flaky` (passed on the retry). It builds and serves the app first, so allow 3–6 minutes.

- [ ] **Step 6: Commit**

```bash
git add "e2e/demo.spec.ts" "e2e/support/demo.ts" "src/app/(app)/layout.tsx" "src/modules/demo/api/demo.ts" "src/modules/demo/components/DemoBanner.tsx" "src/modules/demo/components/DemoLocked.tsx" "src/modules/demo/components/DemoProvider.tsx" "src/modules/demo/lib/demo-constants.test.ts" "src/modules/demo/lib/demo-constants.ts" "src/modules/settings/pages/SettingsPage.tsx" "src/modules/voice-entry/components/VoiceEntryButton.tsx"
git commit -m "feat(demo): banner with time left and Exit demo; locked settings explain themselves" -m "A demo gets a thin bar on every page; Exit demo deletes the copy and signs out to /demo. Password and profile photo are greyed out, and the web voice button says it isn't available, instead of calling Gemini."
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.

### Checkpoint: STOP (after Task 5)

Stop here and send the owner a report with:

- The five commit hashes and subjects (`git log --oneline main..HEAD`).
- The last `npx vitest run` line and the browser test result from Task 5.
- Every place where a "find" block didn't match exactly and how you resolved it, and anything else you did that this plan didn't say.

Then the owner:

1. Runs `npm run db:migrate` once. It points at production and adds one nullable column, `households.demo_expires_at`. The live site keeps working, because its code doesn't read the column yet.
2. Runs `npm run dev`, opens `http://localhost:3000/demo` in a private window, starts a demo and clicks around. Home should look like a real household, Settings should grey out password and photo, and **Exit demo** should return to `/demo` with "Thanks for trying Piko." Demos started this way are real rows in the production database, like any visitor's: Exit demo deletes them at once, and otherwise the next demo started after 24 hours does.
3. Tells you to continue with Task 6.


### Task 6: One "Recent expenses by day" list for Home and the demo phone

The on-screen phone's Home shows "Recent expenses" by day, exactly as the website's Home does. Rather than copy it, this task pulls that list out of `HomeView` and `DashboardPage` into one shared piece, unchanged. Home looks and behaves the same afterwards.

**Files:**
- Modify: `src/modules/dashboard/components/HomeView.tsx`
- Modify: `src/modules/dashboard/pages/DashboardPage.tsx`
- Create: `src/modules/expenses/components/RecentExpensesList.tsx`
- Test: `src/modules/expenses/lib/recent-groups.test.ts`
- Create: `src/modules/expenses/lib/recent-groups.ts`

**Interfaces:**
- Produces (`src/modules/expenses/lib/recent-groups.ts`): `RecentRow`, `RecentGroup`, `buildRecentGroups(rows, categories, { dateFormat, today }): RecentGroup[]`.
- Produces (`src/modules/expenses/components/RecentExpensesList.tsx`): `RecentExpensesList({ groups, rowHref? })`. `HomeRecentRow` / `HomeRecentGroup` are removed in favour of these.

- [ ] **Step 1: Write the failing tests**

Create `src/modules/expenses/lib/recent-groups.test.ts` with:

````ts
import { describe, expect, it } from "vitest";

import { buildRecentGroups } from "./recent-groups";

const categories = [
  { groupName: "Household", icon: null, id: "cat-groceries", name: "Groceries" },
  { groupName: "Lifestyle", icon: "utensils", id: "cat-dining", name: "Dining Out" },
];

function expense(id: string, date: string, amount: string, categoryId: string, note: null | string = null) {
  return { amount, categoryId, date, id, note, ownerMemberId: null, paidByMemberId: "member-1" };
}

describe("buildRecentGroups", () => {
  it("groups by day, newest first, with each row's category", () => {
    const groups = buildRecentGroups(
      [
        expense("e1", "2026-10-15", "450", "cat-dining", "Momo"),
        expense("e2", "2026-10-15", "1200.50", "cat-groceries"),
        expense("e3", "2026-10-14", "300", "cat-groceries"),
      ],
      categories,
      { dateFormat: "english", today: "2026-10-15" },
    );

    expect(groups.map((g) => [g.key, g.label, g.total])).toEqual([
      ["2026-10-15", "Today", 1650.5],
      ["2026-10-14", "Yesterday", 300],
    ]);
    expect(groups[0].rows[0]).toEqual({
      amount: 450,
      categoryGroupName: "Lifestyle",
      categoryIcon: "utensils",
      categoryName: "Dining Out",
      id: "e1",
      note: "Momo",
    });
  });

  it("names a missing category Unknown rather than failing", () => {
    const [group] = buildRecentGroups([expense("e1", "2026-10-15", "10", "cat-gone")], categories, {
      dateFormat: "english",
      today: "2026-10-15",
    });
    expect(group.rows[0]).toMatchObject({ categoryGroupName: "", categoryIcon: null, categoryName: "Unknown" });
  });
});
````

- [ ] **Step 2: Run them to see them fail**

Run:

```bash
npx vitest run src/modules/expenses/lib/recent-groups.test.ts
```

Expected: FAIL. `Error: Cannot find module './recent-groups'`

- [ ] **Step 3: Make them pass**

In `src/modules/dashboard/components/HomeView.tsx`, find:

````tsx
"use client";

import { Fragment, useState } from "react";

import { ArrowUpRight, ChevronDown, Plus } from "lucide-react";
import Link from "next/link";
````

Replace it with:

````tsx
"use client";

import { useState } from "react";

import { ArrowUpRight, ChevronDown, Plus } from "lucide-react";
import Link from "next/link";
````

In `src/modules/dashboard/components/HomeView.tsx`, find:

````tsx
import { cn } from "@/lib/utils";
import { PayDialog } from "@/modules/budget/components/PayDialog";
import type { ExtraIncome } from "@/modules/budget/lib/income";
import { CategoryIcon } from "@/modules/categories/components/CategoryIcon";
import { CushionDialog } from "@/modules/cushion/components/CushionDialog";
import { SettleCard, type SettleOptions } from "@/modules/cushion/components/SettleCard";
import { deletePaybackAction } from "@/modules/paybacks/api/paybacks.actions";
import { PaybackDialog } from "@/modules/paybacks/components/PaybackDialog";
import type { PaybackBalance } from "@/modules/paybacks/lib/payback-balance";
````

Replace it with:

````tsx
import { cn } from "@/lib/utils";
import { PayDialog } from "@/modules/budget/components/PayDialog";
import type { ExtraIncome } from "@/modules/budget/lib/income";
import { CushionDialog } from "@/modules/cushion/components/CushionDialog";
import { SettleCard, type SettleOptions } from "@/modules/cushion/components/SettleCard";
import { RecentExpensesList } from "@/modules/expenses/components/RecentExpensesList";
import type { RecentGroup } from "@/modules/expenses/lib/recent-groups";
import { deletePaybackAction } from "@/modules/paybacks/api/paybacks.actions";
import { PaybackDialog } from "@/modules/paybacks/components/PaybackDialog";
import type { PaybackBalance } from "@/modules/paybacks/lib/payback-balance";
````

In `src/modules/dashboard/components/HomeView.tsx`, find:

````tsx
  spent: number;
};

export type HomeRecentRow = {
  amount: number;
  categoryGroupName: string;
  categoryIcon: null | string;
  categoryName: string;
  id: string;
  note: null | string;
};

export type HomeRecentGroup = { key: string; label: string; rows: HomeRecentRow[]; sub: string; total: number };

export type HomeSavingsPot = { balance: number; id: string; name: string; next: null | string; reserveFull: boolean };

export type HomeBalanceRow = { amount: number; id: string; label: string; sub: string };
````

Replace it with:

````tsx
  spent: number;
};

export type HomeSavingsPot = { balance: number; id: string; name: string; next: null | string; reserveFull: boolean };

export type HomeBalanceRow = { amount: number; id: string; label: string; sub: string };
````

In `src/modules/dashboard/components/HomeView.tsx`, find:

````tsx
  pay: { amount: number; carriedFrom: null | string; extras: ExtraIncome[] };
  payback: null | PaybackBalance;
  prevMonthName: string;
  recent: HomeRecentGroup[];
  recentPaybacks: HomePaybackRow[];
  savings: HomeSavingsPot[];
  settle: HomeSettle | null;
````

Replace it with:

````tsx
  pay: { amount: number; carriedFrom: null | string; extras: ExtraIncome[] };
  payback: null | PaybackBalance;
  prevMonthName: string;
  recent: RecentGroup[];
  recentPaybacks: HomePaybackRow[];
  savings: HomeSavingsPot[];
  settle: HomeSettle | null;
````

In `src/modules/dashboard/components/HomeView.tsx`, find:

````tsx
          {props.recent.length === 0 ? (
            <EmptyState body="Expenses you record will show up here." title="No expenses yet" />
          ) : (
            props.recent.map((group) => (
              <Fragment key={group.key}>
                <div className="flex items-baseline justify-between border-b border-rule pt-3.5 pb-2">
                  <span className="flex items-baseline gap-2.5">
                    <span className="text-sm font-semibold">{group.label}</span>
                    <span className="text-[13px] text-n-600">{group.sub}</span>
                  </span>
                  <span className="text-sm font-semibold">
                    <Money value={group.total} />
                  </span>
                </div>
                {group.rows.map((row) => (
                  <Link
                    className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3.5 border-b border-n-300 py-2.5 text-ink no-underline hover:bg-ink/4"
                    href="/expenses"
                    key={row.id}
                  >
                    <CategoryIcon groupName={row.categoryGroupName} icon={row.categoryIcon} name={row.categoryName} />
                    <span className="flex min-w-0 items-baseline gap-2.5">
                      <span className="text-[15px]">{row.categoryName}</span>
                      {row.note && <span className="truncate text-[13px] text-n-600">{row.note}</span>}
                    </span>
                    <span className="text-[15px]">
                      <Money value={row.amount} />
                    </span>
                  </Link>
                ))}
              </Fragment>
            ))
          )}
        </section>

````

Replace it with:

````tsx
          {props.recent.length === 0 ? (
            <EmptyState body="Expenses you record will show up here." title="No expenses yet" />
          ) : (
            <RecentExpensesList groups={props.recent} rowHref="/expenses" />
          )}
        </section>

````

In `src/modules/dashboard/pages/DashboardPage.tsx`, find:

````tsx
  type HomeEssential,
  type HomeOwnerRow,
  type HomePacing,
  type HomeRecentGroup,
  type HomeSavingsPot,
  type HomeSettle,
  HomeView,
````

Replace it with:

````tsx
  type HomeEssential,
  type HomeOwnerRow,
  type HomePacing,
  type HomeSavingsPot,
  type HomeSettle,
  HomeView,
````

In `src/modules/dashboard/pages/DashboardPage.tsx`, find:

````tsx
import { listDhukuEntries, listDhukus } from "@/modules/dhuku/api/dhuku.actions";
import { dhukuPosition } from "@/modules/dhuku/lib/dhuku-money";
import { listExpensesForMonth, listRecentExpenses } from "@/modules/expenses/api/expenses.actions";
import { groupByDay } from "@/modules/expenses/lib/expense-view";
import { payRows } from "@/modules/expenses/lib/pay-amount";
import { listFundData } from "@/modules/funds/api/funds";
import { fundBalances } from "@/modules/funds/lib/fund-math";
import { listLoanPayments, listLoans } from "@/modules/loans/api/loans.actions";
````

Replace it with:

````tsx
import { listDhukuEntries, listDhukus } from "@/modules/dhuku/api/dhuku.actions";
import { dhukuPosition } from "@/modules/dhuku/lib/dhuku-money";
import { listExpensesForMonth, listRecentExpenses } from "@/modules/expenses/api/expenses.actions";
import { payRows } from "@/modules/expenses/lib/pay-amount";
import { buildRecentGroups } from "@/modules/expenses/lib/recent-groups";
import { listFundData } from "@/modules/funds/api/funds";
import { fundBalances } from "@/modules/funds/lib/fund-math";
import { listLoanPayments, listLoans } from "@/modules/loans/api/loans.actions";
````

In `src/modules/dashboard/pages/DashboardPage.tsx`, find:

````tsx
  const expenses = toExpenseInputs(payExpenseRows);
  const prevIncomes = members.map((m) => ({ amount: monthIncome(incomeRows, m.id, prev).total, memberId: m.id }));

  const category = (id: string) => categories.find((c) => c.id === id);
  const memberName = (id: string) => members.find((m) => m.id === id)?.user.name ?? "Member";

  // Each person's Spent is what left their own wallet: counted by who paid,
````

Replace it with:

````tsx
  const expenses = toExpenseInputs(payExpenseRows);
  const prevIncomes = members.map((m) => ({ amount: monthIncome(incomeRows, m.id, prev).total, memberId: m.id }));

  const memberName = (id: string) => members.find((m) => m.id === id)?.user.name ?? "Member";

  // Each person's Spent is what left their own wallet: counted by who paid,
````

In `src/modules/dashboard/pages/DashboardPage.tsx`, find:

````tsx
      : []),
  ];

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

````

Replace it with:

````tsx
      : []),
  ];

  const recent = buildRecentGroups(recentExpenseRows, categories, { dateFormat, today: todayISO() });

  const monthLabel = formatPeriodLabel(year, month, dateFormat);

````

Create `src/modules/expenses/components/RecentExpensesList.tsx` with:

````tsx
import { Fragment } from "react";

import Link from "next/link";

import { Money } from "@/components/Money";
import { CategoryIcon } from "@/modules/categories/components/CategoryIcon";
import type { RecentGroup, RecentRow } from "@/modules/expenses/lib/recent-groups";

const ROW = "grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3.5 border-b border-n-300 py-2.5 text-ink";

function RowContent({ row }: { row: RecentRow }) {
  return (
    <>
      <CategoryIcon groupName={row.categoryGroupName} icon={row.categoryIcon} name={row.categoryName} />
      <span className="flex min-w-0 items-baseline gap-2.5">
        <span className="text-[15px]">{row.categoryName}</span>
        {row.note && <span className="truncate text-[13px] text-n-600">{row.note}</span>}
      </span>
      <span className="text-[15px]">
        <Money value={row.amount} />
      </span>
    </>
  );
}

// Expenses grouped by day under a day heading with its total. Home and the
// demo's on-screen phone both show this list; rows link to `rowHref` if given.
export function RecentExpensesList({ groups, rowHref }: { groups: RecentGroup[]; rowHref?: string }) {
  return groups.map((group) => (
    <Fragment key={group.key}>
      <div className="flex items-baseline justify-between border-b border-rule pt-3.5 pb-2">
        <span className="flex items-baseline gap-2.5">
          <span className="text-sm font-semibold">{group.label}</span>
          <span className="text-[13px] text-n-600">{group.sub}</span>
        </span>
        <span className="text-sm font-semibold">
          <Money value={group.total} />
        </span>
      </div>
      {group.rows.map((row) =>
        rowHref ? (
          <Link className={`${ROW} no-underline hover:bg-ink/4`} href={rowHref} key={row.id}>
            <RowContent row={row} />
          </Link>
        ) : (
          <div className={ROW} key={row.id}>
            <RowContent row={row} />
          </div>
        ),
      )}
    </Fragment>
  ));
}
````

Create `src/modules/expenses/lib/recent-groups.ts` with:

````ts
import type { DateFormat } from "@/lib/date-format-cookie";

import { groupByDay } from "./expense-view";

export type RecentRow = {
  amount: number;
  categoryGroupName: string;
  categoryIcon: null | string;
  categoryName: string;
  id: string;
  note: null | string;
};

export type RecentGroup = { key: string; label: string; rows: RecentRow[]; sub: string; total: number };

type ExpenseRecord = {
  amount: string;
  categoryId: string;
  date: string;
  id: string;
  note: null | string;
  ownerMemberId: null | string;
  paidByMemberId: string;
};
type CategoryRecord = { groupName: string; icon: null | string; id: string; name: string };

// "Recent expenses" by day, as Home and the demo's phone both show them.
export function buildRecentGroups(
  rows: ExpenseRecord[],
  categories: CategoryRecord[],
  ctx: { dateFormat: DateFormat; today: string },
): RecentGroup[] {
  const category = (id: string) => categories.find((c) => c.id === id);
  return groupByDay(
    rows.map((e) => ({
      amount: Number(e.amount),
      categoryId: e.categoryId,
      categoryName: category(e.categoryId)?.name ?? "Unknown",
      date: e.date,
      id: e.id,
      note: e.note,
      ownerMemberId: e.ownerMemberId,
      paidByMemberId: e.paidByMemberId,
    })),
    ctx,
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
}
````

- [ ] **Step 4: Run the checks**

Run:

```bash
npx vitest run src/modules/expenses/lib/recent-groups.test.ts
npx vitest run
npx tsc --noEmit
npm run lint
```

Expected: the task's tests: `Tests  2 passed (2)`; the whole suite: `Tests  439 passed (439)`; `tsc` prints nothing; lint ends with `✖ 2 problems (0 errors, 2 warnings)` (both warnings were there before this plan: `jsx-a11y/role-supports-aria-props` in `NepaliDateField.tsx` and `react-hooks/incompatible-library` in `ExpenseDialog.tsx`).

- [ ] **Step 5: Commit**

```bash
git add "src/modules/dashboard/components/HomeView.tsx" "src/modules/dashboard/pages/DashboardPage.tsx" "src/modules/expenses/components/RecentExpensesList.tsx" "src/modules/expenses/lib/recent-groups.test.ts" "src/modules/expenses/lib/recent-groups.ts"
git commit -m "refactor(expenses): one 'Recent expenses by day' list for Home and the demo phone" -m "buildRecentGroups + RecentExpensesList, pulled out of DashboardPage and HomeView unchanged, so the demo's phone can show the same list."
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.

### Task 7: The Add expense form can stand on its own

The phone's expense sheet is the website's own Add expense form. This exports it (`ExpenseFields`), lets the caller give the form its own id (the dialog and the phone can both be on the page), and lays out its two side-by-side rows against the form's own width instead of the window's, so it drops to one column inside a narrow phone on a wide screen. The dialog itself is unchanged: it's 500px wide, so it keeps two columns.

**Files:**
- Modify: `src/modules/expenses/components/ExpenseDialog.tsx`

**Interfaces:**
- Produces: `export function ExpenseFields(props: ExpenseFieldsProps)` with `formId?: string` (default `"expense-form"`), `onDone`, `onPendingChange`, and the dialog's other props.

- [ ] **Step 1: Make the change**

In `src/modules/expenses/components/ExpenseDialog.tsx`, find:

````tsx
  );
}

type FieldsProps = Omit<Props, "onOpenChange" | "open"> & { onDone: () => void; onPendingChange: (pending: boolean) => void };

function ExpenseFields({
  categories,
  currentMemberId,
  expenseId,
  funds = [],
  initial,
  members,
````

Replace it with:

````tsx
  );
}

export type ExpenseFieldsProps = Omit<Props, "onOpenChange" | "open"> & {
  // Ties the form to a submit button outside it. Two forms on one page (the
  // dialog and the demo's phone) need different ids.
  formId?: string;
  onDone: () => void;
  onPendingChange: (pending: boolean) => void;
};

// The form inside the dialog, also used on its own (the demo's phone). It lays
// out against its own width, so it fits a narrow panel on a wide screen.
export function ExpenseFields({
  categories,
  currentMemberId,
  expenseId,
  formId = FORM_ID,
  funds = [],
  initial,
  members,
````

In `src/modules/expenses/components/ExpenseDialog.tsx`, find:

````tsx
  onPendingChange,
  quickCategoryIds = [],
  savingsPots = [],
}: FieldsProps) {
  const router = useRouter();
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [payBack, setPayBack] = useState(initial?.payBackAmount != null);
````

Replace it with:

````tsx
  onPendingChange,
  quickCategoryIds = [],
  savingsPots = [],
}: ExpenseFieldsProps) {
  const router = useRouter();
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [payBack, setPayBack] = useState(initial?.payBackAmount != null);
````

In `src/modules/expenses/components/ExpenseDialog.tsx`, find:

````tsx
  });

  return (
    <form className="flex flex-col gap-5.5" id={FORM_ID} noValidate onSubmit={onSubmit}>
      <AmountInput
        data-autofocus
        error={errors.amount ? "Enter an amount to continue" : undefined}
````

Replace it with:

````tsx
  });

  return (
    <form className="@container flex flex-col gap-5.5" id={formId} noValidate onSubmit={onSubmit}>
      <AmountInput
        data-autofocus
        error={errors.amount ? "Enter an amount to continue" : undefined}
````

In `src/modules/expenses/components/ExpenseDialog.tsx`, find:

````tsx
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Segmented
          label="For"
          onChange={chooseOwner}
````

Replace it with:

````tsx
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 @min-[420px]:grid-cols-2">
        <Segmented
          label="For"
          onChange={chooseOwner}
````

In `src/modules/expenses/components/ExpenseDialog.tsx`, find:

````tsx
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Controller
          control={control}
          name="date"
````

Replace it with:

````tsx
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 @min-[420px]:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Controller
          control={control}
          name="date"
````

- [ ] **Step 2: Run the checks**

Run:

```bash
npx vitest run
npx tsc --noEmit
npm run lint
```

Expected: the whole suite: `Tests  439 passed (439)`; `tsc` prints nothing; lint ends with `✖ 2 problems (0 errors, 2 warnings)` (both warnings were there before this plan: `jsx-a11y/role-supports-aria-props` in `NepaliDateField.tsx` and `react-hooks/incompatible-library` in `ExpenseDialog.tsx`).

- [ ] **Step 3: Commit**

```bash
git add "src/modules/expenses/components/ExpenseDialog.tsx"
git commit -m "refactor(expenses): the Add expense form can stand on its own" -m "Export ExpenseFields with a formId, and lay out its two-column rows against the form's own width instead of the window's, so it fits the demo's phone."
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.

### Task 8: Ready-made voice phrases with their answers written in advance

The phone's voice screen has no microphone. Visitors tap one of five phrases, and each has its answer written here, so nothing a visitor says ever reaches Gemini. The tests check that every phrase turns into an expense a real save would accept.

**Files:**
- Test: `src/modules/demo/lib/voice-phrases.test.ts`
- Create: `src/modules/demo/lib/voice-phrases.ts`

**Interfaces:**
- Produces (`src/modules/demo/lib/voice-phrases.ts`): `VoicePhrase`, `VOICE_PHRASES` (five), `draftForPhrase(phrase, { categories, currentMemberId, partnerId, today }): ExpenseDraft` (the voice-entry draft type).

- [ ] **Step 1: Write the failing tests**

Create `src/modules/demo/lib/voice-phrases.test.ts` with:

````ts
import { describe, expect, it } from "vitest";

import { DEFAULT_CATEGORIES } from "@/modules/categories/lib/default-categories";
import { expenseSchema } from "@/modules/expenses/schemas/expense.schema";

import { draftForPhrase, VOICE_PHRASES } from "./voice-phrases";

const ME = "11111111-1111-4111-8111-111111111111";
const PARTNER = "22222222-2222-4222-8222-222222222222";
const categories = DEFAULT_CATEGORIES.map((c, i) => ({ id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, name: c.name }));
const ctx = { categories, currentMemberId: ME, partnerId: PARTNER, today: "2026-10-15" };

function phrase(text: string) {
  const found = VOICE_PHRASES.find((p) => p.text === text);
  if (!found) throw new Error(`No phrase "${text}"`);
  return found;
}

describe("VOICE_PHRASES", () => {
  it("offers the five phrases from the design", () => {
    expect(VOICE_PHRASES.map((p) => p.text)).toEqual([
      "Momo with Sita, 450 rupees",
      "Petrol 1,500 yesterday",
      "Sita paid 800 for the taxi",
      "Groceries 3,200, shared",
      "Phone recharge 500",
    ]);
  });

  it.each(VOICE_PHRASES.map((p) => p.text))("turns %s into an expense a real save would accept", (text) => {
    const draft = draftForPhrase(phrase(text), ctx);
    expect(expenseSchema.safeParse({ ...draft, note: draft.note ?? undefined }).success).toBe(true);
  });
});

describe("draftForPhrase", () => {
  it("knows who paid, who it was for, and the day", () => {
    expect(draftForPhrase(phrase("Sita paid 800 for the taxi"), ctx)).toMatchObject({
      amount: 800,
      date: "2026-10-15",
      ownerMemberId: null,
      paidByMemberId: PARTNER,
    });
    expect(draftForPhrase(phrase("Petrol 1,500 yesterday"), ctx)).toMatchObject({
      amount: 1500,
      date: "2026-10-14",
      ownerMemberId: ME,
      paidByMemberId: ME,
    });
  });

  it("leaves the category empty when the household no longer has it", () => {
    expect(draftForPhrase(phrase("Phone recharge 500"), { ...ctx, categories: [] }).categoryId).toBe("");
  });
});
````

- [ ] **Step 2: Run them to see them fail**

Run:

```bash
npx vitest run src/modules/demo/lib/voice-phrases.test.ts
```

Expected: FAIL. `Error: Cannot find module './voice-phrases'`

- [ ] **Step 3: Make them pass**

Create `src/modules/demo/lib/voice-phrases.ts` with:

````ts
import { addDays } from "@/modules/expenses/lib/expense-view";
import type { ExpenseDraft } from "@/modules/voice-entry/lib/sanitize-voice-expense";

// The demo phone's voice screen: visitors tap one of these instead of
// speaking, and get the answer written here instead of asking Gemini. So no
// stranger's words ever leave the browser, and nothing spends the quota.
// "me" is the visitor (Aarav); "partner" is Sita.
export type VoicePhrase = {
  amount: number;
  category: string;
  daysAgo: 0 | 1;
  note: null | string;
  owner: "me" | "partner" | "shared";
  paidBy: "me" | "partner";
  text: string;
};

export const VOICE_PHRASES: VoicePhrase[] = [
  { amount: 450, category: "Dining Out", daysAgo: 0, note: "Momo with Sita", owner: "shared", paidBy: "me", text: "Momo with Sita, 450 rupees" },
  { amount: 1500, category: "Petrol", daysAgo: 1, note: null, owner: "me", paidBy: "me", text: "Petrol 1,500 yesterday" },
  { amount: 800, category: "Public Transport", daysAgo: 0, note: "Taxi", owner: "shared", paidBy: "partner", text: "Sita paid 800 for the taxi" },
  { amount: 3200, category: "Groceries", daysAgo: 0, note: null, owner: "shared", paidBy: "me", text: "Groceries 3,200, shared" },
  { amount: 500, category: "Personal", daysAgo: 0, note: "Phone recharge", owner: "me", paidBy: "me", text: "Phone recharge 500" },
];

type Context = {
  categories: { id: string; name: string }[];
  currentMemberId: string;
  partnerId: null | string;
  // "YYYY-MM-DD"
  today: string;
};

export function draftForPhrase(phrase: VoicePhrase, ctx: Context): ExpenseDraft {
  const person = (who: "me" | "partner") => (who === "partner" && ctx.partnerId ? ctx.partnerId : ctx.currentMemberId);
  return {
    amount: phrase.amount,
    // Empty when the visitor removed the category: the sheet then asks for one.
    categoryId: ctx.categories.find((c) => c.name === phrase.category)?.id ?? "",
    date: phrase.daysAgo === 1 ? addDays(ctx.today, -1) : ctx.today,
    note: phrase.note,
    ownerMemberId: phrase.owner === "shared" ? null : person(phrase.owner),
    paidByMemberId: person(phrase.paidBy),
  };
}
````

- [ ] **Step 4: Run the checks**

Run:

```bash
npx vitest run src/modules/demo/lib/voice-phrases.test.ts
npx vitest run
npx tsc --noEmit
npm run lint
```

Expected: the task's tests: `Tests  8 passed (8)`; the whole suite: `Tests  447 passed (447)`; `tsc` prints nothing; lint ends with `✖ 2 problems (0 errors, 2 warnings)` (both warnings were there before this plan: `jsx-a11y/role-supports-aria-props` in `NepaliDateField.tsx` and `react-hooks/incompatible-library` in `ExpenseDialog.tsx`).

- [ ] **Step 5: Commit**

```bash
git add "src/modules/demo/lib/voice-phrases.test.ts" "src/modules/demo/lib/voice-phrases.ts"
git commit -m "feat(demo): ready-made voice phrases with their answers written in advance" -m "The demo phone's voice screen offers five phrases; each turns into an expense draft without Gemini, so no visitor's words leave the browser."
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.

### Task 9: The mobile app on screen, beside the website

The phone itself: a phone drawn in CSS, docked on the right of the website from 1280px wide (the page narrows; it already lays out against its own width) and full screen below that, opened from a **Phone** button in the banner. Home lists the last 20 expenses, voice takes a phrase (with the mobile app's spreading rings and "Listening" dots), and the sheet is the website's form. Saving goes through the same action as the website and refreshes the page, so the expense appears on both sides. The web voice button in a demo now offers to open the phone.

**Files:**
- Test: `e2e/demo.spec.ts`
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/modules/demo/components/DemoBanner.tsx`
- Create: `src/modules/demo/components/DemoPhone.tsx`
- Modify: `src/modules/demo/components/DemoProvider.tsx`
- Create: `src/modules/demo/components/phone/PhoneFrame.tsx`
- Create: `src/modules/demo/components/phone/PhoneHome.tsx`
- Create: `src/modules/demo/components/phone/PhoneSheet.tsx`
- Create: `src/modules/demo/components/phone/PhoneVoice.tsx`
- Modify: `src/modules/voice-entry/components/VoiceEntryButton.tsx`

**Interfaces:**
- Consumes: `RecentExpensesList`, `buildRecentGroups` (Task 6); `ExpenseFields` (Task 7); `draftForPhrase`, `VOICE_PHRASES` (Task 8).
- Produces: `useDemo()` gains `phoneOpen: boolean` and `setPhoneOpen(open: boolean)`; `DemoPhone({ categories, currentMemberId, members, quickCategoryIds, recent })`; keyframes `phone-ring` and `phone-dot` in `globals.css`.

- [ ] **Step 1: Make the change**

In `e2e/demo.spec.ts`, find:

````ts
    expect(await householdExists(householdId)).toBe(false);
  });

  test("cleanup deletes an expired demo and leaves the real household alone", async ({ browser }) => {
    const first = await browser.newPage();
    await startDemo(first);
````

Replace it with:

````ts
    expect(await householdExists(householdId)).toBe(false);
  });

  test("the phone adds an expense by voice, and the website shows it too", async ({ page }) => {
    await startDemo(page);
    await page.getByRole("button", { name: "Phone" }).click();
    const phone = page.getByRole("region", { name: "Demo phone" });
    await expect(phone.getByRole("heading", { name: "Recent expenses" })).toBeVisible();

    await phone.getByRole("button", { name: "Add by voice" }).click();
    await phone.getByRole("button", { name: "Momo with Sita, 450 rupees" }).click();
    await expect(phone.getByRole("heading", { name: "Add expense" })).toBeVisible({ timeout: 10_000 });
    await expect(phone.getByLabel("Amount", { exact: true })).toHaveValue("450");
    await phone.getByRole("button", { name: "Save" }).click();

    // Saving goes through the real action and refreshes the page: allow for a slow database.
    await expect(phone.getByRole("heading", { name: "Recent expenses" })).toBeVisible({ timeout: 20_000 });
    await expect(phone.getByText("Momo with Sita")).toBeVisible();
    await expect(page.locator("main").getByText("Momo with Sita")).toBeVisible();
  });

  test("on a phone-sized screen the phone opens full screen and closes", async ({ page }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await startDemo(page);
    await page.getByRole("button", { name: "Phone" }).click();
    const phone = page.getByRole("region", { name: "Demo phone" });
    await expect(phone.getByRole("heading", { name: "Recent expenses" })).toBeVisible();

    await phone.getByRole("button", { exact: true, name: "Close" }).click();
    await expect(phone).toHaveCount(0);
  });

  test("cleanup deletes an expired demo and leaves the real household alone", async ({ browser }) => {
    const first = await browser.newPage();
    await startDemo(first);
````

In `src/app/(app)/layout.tsx`, find:

````tsx

import { BottomNav } from "@/components/nav/BottomNav";
import { SidebarNav } from "@/components/nav/SidebarNav";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { SIDEBAR_COLLAPSED_COOKIE_NAME } from "@/lib/sidebar-cookie";
import { listCategories } from "@/modules/categories/api/categories";
import { getDemoExpiry } from "@/modules/demo/api/demo";
import { DemoBanner } from "@/modules/demo/components/DemoBanner";
import { DemoProvider } from "@/modules/demo/components/DemoProvider";
import { demoTimeLeft } from "@/modules/demo/lib/demo-constants";
import { listRecentExpensesForHousehold } from "@/modules/expenses/api/expenses.actions";
import { topCategoryIds } from "@/modules/expenses/lib/expense-view";
import { countUnreadNotifications } from "@/modules/notifications/api/notifications.actions";

// How many recent expenses decide the quick-pick categories in Add expense.
const QUICK_CATEGORY_SAMPLE = 60;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const current = await getCurrentMember();
  const [members, categories, unreadNotifications, recentExpenses, cookieStore, demoExpiresAt] = await Promise.all([
    getHouseholdMembers(current.householdId),
    listCategories(current.householdId),
    countUnreadNotifications(current.householdId),
    listRecentExpensesForHousehold(current.householdId, QUICK_CATEGORY_SAMPLE),
    cookies(),
    current.isDemo ? getDemoExpiry(current.householdId) : null,
  ]);

  const expenseCategories = categories.map((c) => ({ groupName: c.groupName, id: c.id, name: c.name }));
````

Replace it with:

````tsx

import { BottomNav } from "@/components/nav/BottomNav";
import { SidebarNav } from "@/components/nav/SidebarNav";
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { SIDEBAR_COLLAPSED_COOKIE_NAME } from "@/lib/sidebar-cookie";
import { todayISO } from "@/lib/today";
import { listCategories } from "@/modules/categories/api/categories";
import { getDemoExpiry } from "@/modules/demo/api/demo";
import { DemoBanner } from "@/modules/demo/components/DemoBanner";
import { DemoPhone } from "@/modules/demo/components/DemoPhone";
import { DemoProvider } from "@/modules/demo/components/DemoProvider";
import { demoTimeLeft } from "@/modules/demo/lib/demo-constants";
import { listRecentExpensesForHousehold } from "@/modules/expenses/api/expenses.actions";
import { topCategoryIds } from "@/modules/expenses/lib/expense-view";
import { buildRecentGroups } from "@/modules/expenses/lib/recent-groups";
import { countUnreadNotifications } from "@/modules/notifications/api/notifications.actions";

// How many recent expenses decide the quick-pick categories in Add expense.
const QUICK_CATEGORY_SAMPLE = 60;
// How many the demo's phone lists, as many as the mobile app does.
const PHONE_RECENT = 20;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const current = await getCurrentMember();
  const [members, categories, unreadNotifications, recentExpenses, cookieStore, demoExpiresAt, dateFormat] = await Promise.all([
    getHouseholdMembers(current.householdId),
    listCategories(current.householdId),
    countUnreadNotifications(current.householdId),
    listRecentExpensesForHousehold(current.householdId, QUICK_CATEGORY_SAMPLE),
    cookies(),
    current.isDemo ? getDemoExpiry(current.householdId) : null,
    current.isDemo ? getDateFormatPref(current.householdId) : null,
  ]);

  const expenseCategories = categories.map((c) => ({ groupName: c.groupName, id: c.id, name: c.name }));
````

In `src/app/(app)/layout.tsx`, find:

````tsx
  const initialCollapsed = cookieStore.get(SIDEBAR_COLLAPSED_COOKIE_NAME)?.value === "true";
  const quickCategoryIds = topCategoryIds(recentExpenses, 5);
  const demo = demoExpiresAt ? { timeLeft: demoTimeLeft(demoExpiresAt, new Date()) } : null;

  return (
    <DemoProvider demo={demo}>
````

Replace it with:

````tsx
  const initialCollapsed = cookieStore.get(SIDEBAR_COLLAPSED_COOKIE_NAME)?.value === "true";
  const quickCategoryIds = topCategoryIds(recentExpenses, 5);
  const demo = demoExpiresAt ? { timeLeft: demoTimeLeft(demoExpiresAt, new Date()) } : null;
  const phoneRecent =
    demo && dateFormat ? buildRecentGroups(recentExpenses.slice(0, PHONE_RECENT), categories, { dateFormat, today: todayISO() }) : [];

  return (
    <DemoProvider demo={demo}>
````

In `src/app/(app)/layout.tsx`, find:

````tsx
          {/* @container: composites lay out against the content width, not the window. */}
          <div className="@container max-w-280">{children}</div>
        </main>
        <BottomNav
          categories={expenseCategories}
          currentMemberId={current.memberId}
````

Replace it with:

````tsx
          {/* @container: composites lay out against the content width, not the window. */}
          <div className="@container max-w-280">{children}</div>
        </main>
        {demo && (
          <DemoPhone
            categories={expenseCategories}
            currentMemberId={current.memberId}
            members={expenseMembers}
            quickCategoryIds={quickCategoryIds}
            recent={phoneRecent}
          />
        )}
        <BottomNav
          categories={expenseCategories}
          currentMemberId={current.memberId}
````

In `src/app/globals.css`, find:

````css
  animation: sidebar-enter 320ms cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
  animation-delay: calc(60ms + var(--enter-index, 0) * 22ms);
}
````

Replace it with:

````css
  animation: sidebar-enter 320ms cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
  animation-delay: calc(60ms + var(--enter-index, 0) * 22ms);
}

/* The demo phone's voice screen (src/modules/demo/components/phone): squares
   spreading out from the mic, and the bouncing "listening" dots, as in the
   mobile app. */
@keyframes phone-ring {
  from {
    opacity: 0.45;
    transform: scale(0.44);
  }
  to {
    opacity: 0;
    transform: scale(1);
  }
}

@keyframes phone-dot {
  0%,
  60%,
  100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-3px);
  }
}
````

Replace the whole of `src/modules/demo/components/DemoBanner.tsx` with:

````tsx
"use client";

import { Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";

import { exitDemoAction } from "../api/demo.actions";
import { useDemo } from "./DemoProvider";

// The thin bar on every page of a demo. Real accounts render nothing.
export function DemoBanner() {
  const demo = useDemo();
  if (!demo) return null;

  return (
    <div className="sticky top-0 z-20 -mx-4 -mt-5 mb-5 flex flex-wrap items-center gap-x-4 gap-y-1 border-b-2 border-ink bg-paper px-4 py-2 text-sm md:-mx-12 md:-mt-9 md:mb-9 md:px-12">
      <span className="font-semibold">Demo</span>
      <span className="text-n-700">Deleted in {demo.timeLeft}</span>
      <div className="ml-auto flex items-center gap-1">
        <Button aria-pressed={demo.phoneOpen} onClick={() => demo.setPhoneOpen(!demo.phoneOpen)} size="sm" type="button" variant="ghost">
          <Smartphone />
          Phone
        </Button>
        <form action={exitDemoAction}>
          <Button size="sm" type="submit" variant="ghost">
            Exit demo
          </Button>
        </form>
      </div>
    </div>
  );
}
````

Create `src/modules/demo/components/DemoPhone.tsx` with:

````tsx
"use client";

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/today";
import type { RecentGroup } from "@/modules/expenses/lib/recent-groups";
import type { ExpenseDraft } from "@/modules/voice-entry/lib/sanitize-voice-expense";

import { draftForPhrase, type VoicePhrase } from "../lib/voice-phrases";
import { useDemo } from "./DemoProvider";
import { PhoneFrame } from "./phone/PhoneFrame";
import { PhoneHome } from "./phone/PhoneHome";
import { PhoneSheet } from "./phone/PhoneSheet";
import { PhoneVoice } from "./phone/PhoneVoice";

type Props = {
  categories: { groupName: string; id: string; name: string }[];
  currentMemberId: string;
  members: { id: string; name: string }[];
  quickCategoryIds: string[];
  recent: RecentGroup[];
};

// The mobile app, on screen: docked beside the website on wide screens, full
// screen on a phone. Saving refreshes the page, so both sides show the new
// expense at once.
export function DemoPhone({ categories, currentMemberId, members, quickCategoryIds, recent }: Props) {
  const demo = useDemo();
  const [screen, setScreen] = useState<"home" | "sheet" | "voice">("home");
  const [draft, setDraft] = useState<ExpenseDraft | null>(null);
  const partnerId = members.find((m) => m.id !== currentMemberId)?.id ?? null;

  const openSheet = useCallback((next: ExpenseDraft | null) => {
    setDraft(next);
    setScreen("sheet");
  }, []);
  const onHeard = useCallback(
    (phrase: VoicePhrase) => openSheet(draftForPhrase(phrase, { categories, currentMemberId, partnerId, today: todayISO() })),
    [categories, currentMemberId, openSheet, partnerId],
  );

  if (!demo?.phoneOpen) return null;

  return (
    <section
      aria-label="Demo phone"
      className="fixed inset-0 z-50 flex flex-col bg-paper xl:sticky xl:top-0 xl:z-auto xl:h-screen xl:w-110 xl:shrink-0 xl:items-center xl:justify-center xl:gap-3 xl:border-l-2 xl:border-rule xl:bg-surface"
    >
      <div className="flex items-center justify-between border-b-2 border-ink px-4 py-2 xl:w-98 xl:border-0 xl:px-1 xl:py-0">
        <span className="text-sm font-semibold">The Piko phone app</span>
        <Button onClick={() => demo.setPhoneOpen(false)} size="sm" type="button" variant="ghost">
          Close
        </Button>
      </div>
      <PhoneFrame>
        {screen === "home" && <PhoneHome onType={() => openSheet(null)} onVoice={() => setScreen("voice")} recent={recent} />}
        {screen === "voice" && <PhoneVoice onCancel={() => setScreen("home")} onHeard={onHeard} onTypeInstead={() => openSheet(null)} />}
        {screen === "sheet" && (
          <PhoneSheet
            categories={categories}
            currentMemberId={currentMemberId}
            draft={draft}
            members={members}
            onClose={() => setScreen("home")}
            quickCategoryIds={quickCategoryIds}
          />
        )}
      </PhoneFrame>
    </section>
  );
}
````

Replace the whole of `src/modules/demo/components/DemoProvider.tsx` with:

````tsx
"use client";

import { createContext, type ReactNode, useContext, useState } from "react";

// What the app shell knows about a demo visitor's household; null for real accounts.
export type DemoState = { timeLeft: string };

type DemoContextValue = DemoState & { phoneOpen: boolean; setPhoneOpen: (open: boolean) => void };

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children, demo }: { children: ReactNode; demo: DemoState | null }) {
  const [phoneOpen, setPhoneOpen] = useState(false);
  return <DemoContext value={demo ? { ...demo, phoneOpen, setPhoneOpen } : null}>{children}</DemoContext>;
}

export function useDemo(): DemoContextValue | null {
  return useContext(DemoContext);
}
````

Create `src/modules/demo/components/phone/PhoneFrame.tsx` with:

````tsx
import type { ReactNode } from "react";

import { BatteryFull, Signal, Wifi } from "lucide-react";

// A phone drawn in CSS on wide screens. On a narrow screen (a real phone) the
// frame would be silly, so the screens simply fill it.
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-paper text-ink xl:h-[min(820px,calc(100vh-96px))] xl:w-98 xl:flex-none xl:rounded-[44px] xl:border-[10px] xl:border-ink xl:shadow-dialog">
      <div aria-hidden className="hidden h-8 shrink-0 items-center justify-between px-7 text-xs font-semibold xl:flex">
        <span>9:41</span>
        <span className="absolute top-0 left-1/2 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-ink" />
        <span className="flex items-center gap-1">
          <Signal className="size-3.5" />
          <Wifi className="size-3.5" />
          <BatteryFull className="size-4" />
        </span>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
````

Create `src/modules/demo/components/phone/PhoneHome.tsx` with:

````tsx
import { Mic, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RecentExpensesList } from "@/modules/expenses/components/RecentExpensesList";
import type { RecentGroup } from "@/modules/expenses/lib/recent-groups";

// The mobile app's Home: the household's latest expenses by day, and the two
// ways to add one pinned at the bottom.
export function PhoneHome({ onType, onVoice, recent }: { onType: () => void; onVoice: () => void; recent: RecentGroup[] }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 pt-3 pb-2">
        <span aria-hidden className="grid size-7 place-items-center bg-ink text-sm font-extrabold text-paper">
          P
        </span>
        <span className="text-base font-extrabold">Piko</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-2 pb-6">
        <h2 className="text-[28px] leading-tight font-extrabold tracking-[-0.02em]">Recent expenses</h2>
        <p className="mt-1 text-[13px] text-n-600">The latest across the household</p>
        {recent.length === 0 ? (
          <div className="py-8">
            <p className="text-lg font-semibold">No expenses yet.</p>
            <p className="mt-2 text-sm text-n-700">Tap Add by voice and say what you spent.</p>
          </div>
        ) : (
          <div className="mt-5 border-t-2 border-ink">
            <RecentExpensesList groups={recent} />
          </div>
        )}
      </div>

      <div className="flex gap-3 border-t-2 border-rule bg-paper px-5 py-3">
        <Button onClick={onType} type="button" variant="outline">
          <Pencil />
          Type it
        </Button>
        <Button className="flex-1" onClick={onVoice} type="button">
          <Mic />
          Add by voice
        </Button>
      </div>
    </div>
  );
}
````

Create `src/modules/demo/components/phone/PhoneSheet.tsx` with:

````tsx
"use client";

import { useState } from "react";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ExpenseFields } from "@/modules/expenses/components/ExpenseDialog";
import type { ExpenseDraft } from "@/modules/voice-entry/lib/sanitize-voice-expense";

// Its own id: the website's Add expense dialog can be open at the same time.
const FORM_ID = "phone-expense-form";

type Props = {
  categories: { groupName: string; id: string; name: string }[];
  currentMemberId: string;
  draft: ExpenseDraft | null;
  members: { id: string; name: string }[];
  onClose: () => void;
  quickCategoryIds: string[];
};

// The mobile app's expense sheet: the website's own Add expense form, at phone
// width. Saving goes through the same action as the website.
export function PhoneSheet({ draft, onClose, ...fields }: Props) {
  const [pending, setPending] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b-2 border-ink px-5 py-3">
        <h2 className="text-lg font-extrabold">Add expense</h2>
        <Button aria-label="Close" onClick={onClose} size="icon-sm" type="button" variant="ghost">
          <X />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <ExpenseFields {...fields} formId={FORM_ID} initial={draft ?? undefined} onDone={onClose} onPendingChange={setPending} />
      </div>
      <div className="border-t-2 border-rule px-5 py-3">
        <Button className="w-full" disabled={pending} form={FORM_ID} type="submit">
          {pending ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
````

Create `src/modules/demo/components/phone/PhoneVoice.tsx` with:

````tsx
"use client";

import { useEffect, useState } from "react";

import { Mic, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import { VOICE_PHRASES, type VoicePhrase } from "../../lib/voice-phrases";

// Each phrase "arrives" a letter at a time, as speech recognition shows it.
const LETTER_MS = 40;
const UNDERSTANDING_MS = 900;
const RINGS = 3;

type Props = { onCancel: () => void; onHeard: (phrase: VoicePhrase) => void; onTypeInstead: () => void };

// The mobile app's voice screen, without a microphone: the visitor taps what
// to "say" and the words appear as if heard.
export function PhoneVoice({ onCancel, onHeard, onTypeInstead }: Props) {
  const [phrase, setPhrase] = useState<null | VoicePhrase>(null);
  const [letters, setLetters] = useState(0);
  const heard = phrase ? phrase.text.slice(0, letters) : "";
  const understanding = phrase !== null && letters >= phrase.text.length;

  useEffect(() => {
    if (!phrase) return;
    const timer = understanding
      ? setTimeout(() => onHeard(phrase), UNDERSTANDING_MS)
      : setTimeout(() => setLetters((n) => n + 1), LETTER_MS);
    return () => clearTimeout(timer);
  }, [letters, onHeard, phrase, understanding]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex justify-end px-3 pt-2">
        <Button aria-label="Close" onClick={onCancel} size="icon-sm" type="button" variant="ghost">
          <X />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 overflow-y-auto px-6 pb-6 text-center">
        {understanding ? (
          <>
            <span className="micro-label text-n-600">Understanding</span>
            <span aria-hidden className="h-1 w-40 animate-pulse bg-ink motion-reduce:animate-none" />
            <p className="text-base text-n-700">&ldquo;{phrase.text}&rdquo;</p>
          </>
        ) : (
          <>
            <div aria-hidden className="relative grid size-50 place-items-center">
              {Array.from({ length: RINGS }, (_, i) => (
                <span
                  className="absolute inset-0 animate-[phone-ring_1.8s_ease-out_infinite] border-[1.5px] border-signal opacity-0 motion-reduce:animate-none"
                  key={i}
                  style={{ animationDelay: `${(i * 1.8) / RINGS}s` }}
                />
              ))}
              <span className="absolute size-30 bg-signal/16" />
              <span className="relative grid size-22 place-items-center bg-signal-fill text-white">
                <Mic className="size-10" />
              </span>
            </div>
            <span className="micro-label flex items-center gap-1.5 text-n-600">
              Listening
              <span aria-hidden className="flex gap-0.75">
                {[0, 1, 2].map((i) => (
                  <span
                    className="size-1 animate-[phone-dot_1s_ease-in-out_infinite] bg-n-600 motion-reduce:animate-none"
                    key={i}
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </span>
            </span>
            <p className={heard ? "text-2xl leading-tight font-extrabold tracking-[-0.01em]" : "text-base text-n-600"}>
              {heard || "Tap a phrase to say it."}
            </p>
            {!phrase && (
              <div className="flex flex-wrap justify-center gap-2">
                {VOICE_PHRASES.map((option) => (
                  <button
                    className="border border-n-300 px-3 py-1.5 text-[13px] text-n-800 hover:border-ink"
                    key={option.text}
                    onClick={() => setPhrase(option)}
                    type="button"
                  >
                    {option.text}
                  </button>
                ))}
              </div>
            )}
            <Button onClick={onTypeInstead} type="button" variant="ghost">
              Type it instead
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
````

In `src/modules/voice-entry/components/VoiceEntryButton.tsx`, find:

````tsx
  }, []);

  const resultModalOpen = draft !== null || manualAddOpen;
  // A demo never sends speech to Gemini: the button only explains that.
  const demo = useDemo();
  const usable = supported || demo !== null;

  function closeResultModal() {
    setDraft(null);
    setManualAddOpen(false);
````

Replace it with:

````tsx
  }, []);

  const resultModalOpen = draft !== null || manualAddOpen;
  // A demo never sends speech to Gemini: the button points to the demo's
  // phone, whose voice screen uses ready-made phrases instead.
  const demo = useDemo();
  const usable = supported || demo !== null;

  function sayDemoHasNoVoice() {
    toast(`${DEMO_LOCKED_MESSAGE}. Try voice on the phone instead.`, {
      action: { label: "Open phone", onClick: () => demo?.setPhoneOpen(true) },
    });
  }

  function closeResultModal() {
    setDraft(null);
    setManualAddOpen(false);
````

In `src/modules/voice-entry/components/VoiceEntryButton.tsx`, find:

````tsx
        aria-label="Add expense by voice"
        className={cn(className, !usable && "cursor-not-allowed opacity-50")}
        disabled={!usable}
        onClick={() => (demo ? toast(`${DEMO_LOCKED_MESSAGE}.`) : setListening(true))}
        title={usable ? undefined : "Voice input isn't supported in this browser"}
        type="button"
      >
````

Replace it with:

````tsx
        aria-label="Add expense by voice"
        className={cn(className, !usable && "cursor-not-allowed opacity-50")}
        disabled={!usable}
        onClick={() => (demo ? sayDemoHasNoVoice() : setListening(true))}
        title={usable ? undefined : "Voice input isn't supported in this browser"}
        type="button"
      >
````

- [ ] **Step 2: Run the checks**

Run:

```bash
npx vitest run
npx tsc --noEmit
npm run lint
```

Expected: the whole suite: `Tests  447 passed (447)`; `tsc` prints nothing; lint ends with `✖ 2 problems (0 errors, 2 warnings)` (both warnings were there before this plan: `jsx-a11y/role-supports-aria-props` in `NepaliDateField.tsx` and `react-hooks/incompatible-library` in `ExpenseDialog.tsx`).

- [ ] **Step 3: Run the browser tests**

Run:

```bash
npx playwright test e2e/demo.spec.ts --retries=1
```

Expected: `14 passed` (the sign-in setup plus 13 demo tests), possibly with a line saying some were `flaky` (passed on the retry). It builds and serves the app first, so allow 3–6 minutes.

- [ ] **Step 4: Commit**

```bash
git add "e2e/demo.spec.ts" "src/app/(app)/layout.tsx" "src/app/globals.css" "src/modules/demo/components/DemoBanner.tsx" "src/modules/demo/components/DemoPhone.tsx" "src/modules/demo/components/DemoProvider.tsx" "src/modules/demo/components/phone/PhoneFrame.tsx" "src/modules/demo/components/phone/PhoneHome.tsx" "src/modules/demo/components/phone/PhoneSheet.tsx" "src/modules/demo/components/phone/PhoneVoice.tsx" "src/modules/voice-entry/components/VoiceEntryButton.tsx"
git commit -m "feat(demo): the mobile app on screen, beside the website" -m "A CSS phone docked on the right on wide screens (full screen on a phone), opened from the banner: Home lists recent expenses, the voice screen takes a ready-made phrase, and the sheet is the website's own Add expense form. Saving refreshes the page, so the expense shows on both sides. The web voice button points demo visitors to the phone."
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.

### Task 10: Tour steps, and remembering which tours a visitor has seen

The tours as data, plus the two pieces of logic around them, all testable without a browser: which tour a page has, which of a step's sections is on screen (the sidebar's Add expense on a laptop, the floating one on a phone), and what the visitor has seen or skipped (kept in their browser's `localStorage`). It also installs driver.js, which Task 11 uses.

**Files:**
- Create: `src/modules/demo/tour/tour-memory.ts`
- Create: `src/modules/demo/tour/tour-steps.ts`
- Create: `src/modules/demo/tour/tour-targets.ts`
- Test: `src/modules/demo/tour/tour.test.ts`
- Modify (by `npm install`): `package.json`, `package-lock.json`

**Interfaces:**
- Produces (`src/modules/demo/tour/tour-steps.ts`): `TourId`, `TourStep = { body, targets, title }`, `TOURS`, `tourForPath(pathname): null | TourId`.
- Produces (`tour-memory.ts`): `TOUR_STORAGE_KEY = "piko-demo-tours"`, `TourMemory`, `readTourMemory(raw)`, `shouldAutoRun(memory, id)`, `markSeen(memory, id)`, `skipAll(memory)`.
- Produces (`tour-targets.ts`): `ResolvedStep<E>`, `resolveSteps(steps, findVisible): ResolvedStep<E>[]`.

- [ ] **Step 1: Write the failing tests**

Create `src/modules/demo/tour/tour.test.ts` with:

````ts
import { describe, expect, it } from "vitest";

import { markSeen, readTourMemory, shouldAutoRun, skipAll } from "./tour-memory";
import { tourForPath, TOURS } from "./tour-steps";
import { resolveSteps } from "./tour-targets";

describe("TOURS", () => {
  it("has the Home tour of eight steps and three-step page tours", () => {
    expect(TOURS.home).toHaveLength(8);
    expect(TOURS.budget).toHaveLength(3);
    expect(TOURS.savings).toHaveLength(3);
    expect(TOURS.dhuku).toHaveLength(3);
  });

  it("finds a page's tour from its path", () => {
    expect(tourForPath("/dashboard")).toBe("home");
    expect(tourForPath("/budget")).toBe("budget");
    expect(tourForPath("/expenses")).toBeNull();
  });
});

describe("tour memory", () => {
  it("starts fresh from nothing or from anything unreadable", () => {
    expect(readTourMemory(null)).toEqual({ seen: [], skippedAll: false });
    expect(readTourMemory("not json")).toEqual({ seen: [], skippedAll: false });
    expect(readTourMemory("42")).toEqual({ seen: [], skippedAll: false });
  });

  it("runs each tour by itself once", () => {
    const fresh = readTourMemory(null);
    expect(shouldAutoRun(fresh, "home")).toBe(true);
    const seen = markSeen(fresh, "home");
    expect(shouldAutoRun(seen, "home")).toBe(false);
    expect(shouldAutoRun(seen, "budget")).toBe(true);
    expect(markSeen(seen, "home")).toBe(seen);
  });

  it("runs none by itself once the visitor skips them all", () => {
    const skipped = skipAll(readTourMemory(null));
    expect(shouldAutoRun(skipped, "budget")).toBe(false);
    expect(readTourMemory(JSON.stringify(skipped))).toEqual(skipped);
  });
});

describe("resolveSteps", () => {
  const steps = [
    { body: "", targets: [], title: "Middle" },
    { body: "", targets: ["sidebar-button", "floating-button"], title: "Either" },
    { body: "", targets: ["not-here"], title: "Missing" },
  ];

  it("uses the first section on screen and drops steps with none", () => {
    const onScreen = new Set(["floating-button"]);
    const resolved = resolveSteps(steps, (target) => (onScreen.has(target) ? target : null));
    expect(resolved.map((r) => [r.step.title, r.element])).toEqual([
      ["Middle", null],
      ["Either", "floating-button"],
    ]);
  });
});
````

- [ ] **Step 2: Run them to see them fail**

Run:

```bash
npx vitest run src/modules/demo/tour/tour.test.ts
```

Expected: FAIL. `Error: Cannot find module './tour-memory'`

- [ ] **Step 3: Make them pass**

Run:

```bash
npm install --save-exact driver.js@1.9.0
```

Expected: `package.json` gains `"driver.js": "1.9.0"` (exact, no caret) under `dependencies`, and `package-lock.json` changes.

Create `src/modules/demo/tour/tour-memory.ts` with:

````ts
import type { TourId } from "./tour-steps";

// Kept in the visitor's browser (localStorage), so tours don't repeat and
// nothing needs storing on the server.
export const TOUR_STORAGE_KEY = "piko-demo-tours";

export type TourMemory = { seen: TourId[]; skippedAll: boolean };

const FRESH: TourMemory = { seen: [], skippedAll: false };

export function readTourMemory(raw: null | string): TourMemory {
  if (!raw) return FRESH;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return FRESH;
    const { seen, skippedAll } = parsed as Partial<TourMemory>;
    return { seen: Array.isArray(seen) ? seen : [], skippedAll: skippedAll === true };
  } catch {
    return FRESH;
  }
}

// A tour runs by itself once per page, unless the visitor skipped them all.
export function shouldAutoRun(memory: TourMemory, id: TourId): boolean {
  return !memory.skippedAll && !memory.seen.includes(id);
}

export function markSeen(memory: TourMemory, id: TourId): TourMemory {
  return memory.seen.includes(id) ? memory : { ...memory, seen: [...memory.seen, id] };
}

export function skipAll(memory: TourMemory): TourMemory {
  return { ...memory, skippedAll: true };
}
````

Create `src/modules/demo/tour/tour-steps.ts` with:

````ts
// The demo's guided tours: one on Home when a visitor arrives, and a short one
// the first time they open Budget, Savings or Dhuku.

export type TourId = "budget" | "dhuku" | "home" | "savings";

// A step points at sections marked `data-tour="<target>"`. The first of its
// targets that is on screen wins (the sidebar's button on a laptop, the
// floating one on a phone). A step with no targets sits in the middle.
export type TourStep = { body: string; targets: string[]; title: string };

export const TOURS: Record<TourId, TourStep[]> = {
  budget: [
    {
      body: "Each person plans their own pay. Switch between Aarav's plan and Sita's here.",
      targets: ["budget-whose"],
      title: "Whose plan",
    },
    {
      body: "Savings, dhuku, loan installments and funds come out of pay before anything else. Piko fills these in from what it already knows.",
      targets: ["budget-set-aside"],
      title: "Set aside first",
    },
    {
      body: "Pay, minus what's set aside and what's budgeted. Below it, each line is fixed, essential or can-cut; can-cut lines decide Safe to spend on Home.",
      targets: ["budget-ledger"],
      title: "Left to plan",
    },
  ],
  dhuku: [
    {
      body: "What's due this month, what you've put in so far, and what you've received when it was your turn.",
      targets: ["dhuku-ledger"],
      title: "Your dhukus",
    },
    {
      body: "Each group's months: dark is paid, red is the month you took the pot. Tap a group to see every month.",
      targets: ["dhuku-group"],
      title: "One group",
    },
    {
      body: "Log a month's payment, the pot when it's your turn, or a fine.",
      targets: ["dhuku-log"],
      title: "Log entry",
    },
  ],
  home: [
    {
      body: "You're Aarav. Aarav and Sita keep their money separate but plan together. Nothing here is real, so add, change or delete anything.",
      targets: [],
      title: "Welcome to Piko",
    },
    {
      body: "What you can still spend today on things you can cut, and stay on plan. What you don't use carries into tomorrow.",
      targets: ["home-safe"],
      title: "Safe to spend today",
    },
    {
      body: "Where this month's pay went: spent, moved into savings, dhuku and loans, and what's still unallocated.",
      targets: ["home-ledger"],
      title: "This month",
    },
    {
      body: "The savings pot, the dhuku (plus means the group owes you), loans, and who owes whom.",
      targets: ["home-balances"],
      title: "Balances",
    },
    {
      body: "The latest from both of you, day by day.",
      targets: ["home-recent"],
      title: "Recent expenses",
    },
    {
      body: "Record what you spent: the amount, a category, and who it was for.",
      targets: ["add-expense", "add-expense-mobile"],
      title: "Add expense",
    },
    {
      body: "Piko has a phone app for adding expenses by voice. Try it here.",
      targets: ["phone-button"],
      title: "The phone app",
    },
    {
      body: "Budget, Savings and Dhuku each have a short tour the first time you open them.",
      targets: ["nav-main", "nav-bottom"],
      title: "Keep exploring",
    },
  ],
  savings: [
    {
      body: "What's in the pot, the emergency reserve it fills first, and what each of you puts in a month.",
      targets: ["savings-ledger"],
      title: "The pot",
    },
    {
      body: "What you're saving for, in order. Piko works out when each one becomes affordable.",
      targets: ["savings-list"],
      title: "Saving for",
    },
    {
      body: "Record money going into the pot.",
      targets: ["savings-add"],
      title: "Add money",
    },
  ],
};

const TOUR_PATHS: Record<string, TourId> = {
  "/budget": "budget",
  "/dashboard": "home",
  "/dhuku": "dhuku",
  "/savings": "savings",
};

export function tourForPath(pathname: string): null | TourId {
  return TOUR_PATHS[pathname] ?? null;
}
````

Create `src/modules/demo/tour/tour-targets.ts` with:

````ts
import type { TourStep } from "./tour-steps";

export type ResolvedStep<E> = { element: E | null; step: TourStep };

// Pairs each step with the first of its sections that's on screen. A step
// with targets but none on screen is dropped; a step with no targets stays
// (it sits in the middle).
export function resolveSteps<E>(steps: TourStep[], findVisible: (target: string) => E | null): ResolvedStep<E>[] {
  return steps.flatMap((step): ResolvedStep<E>[] => {
    if (step.targets.length === 0) return [{ element: null, step }];
    for (const target of step.targets) {
      const element = findVisible(target);
      if (element !== null) return [{ element, step }];
    }
    return [];
  });
}
````

- [ ] **Step 4: Run the checks**

Run:

```bash
npx vitest run src/modules/demo/tour/tour.test.ts
npx vitest run
npx tsc --noEmit
npm run lint
```

Expected: the task's tests: `Tests  6 passed (6)`; the whole suite: `Tests  453 passed (453)`; `tsc` prints nothing; lint ends with `✖ 2 problems (0 errors, 2 warnings)` (both warnings were there before this plan: `jsx-a11y/role-supports-aria-props` in `NepaliDateField.tsx` and `react-hooks/incompatible-library` in `ExpenseDialog.tsx`).

- [ ] **Step 5: Commit**

```bash
git add "src/modules/demo/tour/tour-memory.ts" "src/modules/demo/tour/tour-steps.ts" "src/modules/demo/tour/tour-targets.ts" "src/modules/demo/tour/tour.test.ts" "package.json" "package-lock.json"
git commit -m "feat(demo): tour steps, and remembering which tours a visitor has seen" -m "The Home tour and the Budget, Savings and Dhuku tours as data; each step finds the first of its sections on screen. driver.js (MIT) will run them."
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.

### Task 11: Guided tours with a spotlight, skip-all, and Tour this page

The tours run. `DemoTour` is its own chunk, loaded only for demo visitors, and runs a page's tour the first time it opens (it counts as seen when it starts) and whenever **Tour this page** is pressed. Because the page streams in after the layout, it keeps looking for its sections for up to 5 s. Each popup has **Skip all tours**, and the look matches the app. The sections a step points at get `data-tour` labels; `Ledger` passes one through.

**Files:**
- Test: `e2e/demo.spec.ts`
- Modify: `e2e/support/demo.ts`
- Modify: `src/components/Ledger.tsx`
- Modify: `src/components/nav/BottomNav.tsx`
- Modify: `src/components/nav/SidebarNav.tsx`
- Modify: `src/modules/budget/components/BudgetView.tsx`
- Modify: `src/modules/dashboard/components/HomeView.tsx`
- Modify: `src/modules/demo/components/DemoBanner.tsx`
- Modify: `src/modules/demo/components/DemoProvider.tsx`
- Create: `src/modules/demo/tour/DemoTour.tsx`
- Create: `src/modules/demo/tour/tour.css`
- Modify: `src/modules/dhuku/components/DhukuView.tsx`
- Modify: `src/modules/savings/components/SavingsView.tsx`

**Interfaces:**
- Consumes: everything in Task 10; `useDemo()` (Tasks 5, 9).
- Produces: `useDemo()` gains `requestTour()`; `DemoTour({ request })`; `Ledger` accepts `data-tour`; `startDemo(page, { tours })` in e2e (tours off unless asked for).

- [ ] **Step 1: Make the change**

In `e2e/demo.spec.ts`, find:

````ts
    await expect(phone).toHaveCount(0);
  });

  test("cleanup deletes an expired demo and leaves the real household alone", async ({ browser }) => {
    const first = await browser.newPage();
    await startDemo(first);
````

Replace it with:

````ts
    await expect(phone).toHaveCount(0);
  });

  test("the Home tour runs once; Skip all tours stops the rest; Tour this page replays", async ({ page }) => {
    await startDemo(page, { tours: true });
    const popover = page.locator(".driver-popover");
    const title = popover.locator(".driver-popover-title");
    await expect(title).toHaveText("Welcome to Piko");
    await popover.getByRole("button", { name: "Next" }).click();
    await expect(title).toHaveText("Safe to spend today");
    await popover.getByRole("button", { name: "Skip all tours" }).click();
    await expect(popover).toHaveCount(0);

    await gotoRoute(page, "/budget");
    await expect(page.getByRole("button", { name: "Tour this page" })).toBeVisible();
    await page.waitForTimeout(1000);
    await expect(popover).toHaveCount(0);

    await page.getByRole("button", { name: "Tour this page" }).click();
    await expect(title).toHaveText("Whose plan");
  });

  test("a page's tour runs by itself the first time it's opened, then not again", async ({ page }) => {
    await startDemo(page, { tours: true });
    const popover = page.locator(".driver-popover");
    const title = popover.locator(".driver-popover-title");
    await expect(title).toHaveText("Welcome to Piko");
    await page.keyboard.press("Escape");
    await expect(popover).toHaveCount(0);

    await gotoRoute(page, "/savings");
    await expect(title).toHaveText("The pot");
    await popover.getByRole("button", { name: "Next" }).click();
    await popover.getByRole("button", { name: "Next" }).click();
    await expect(title).toHaveText("Add money");
    await popover.getByRole("button", { name: "Done" }).click();
    await expect(popover).toHaveCount(0);

    await gotoRoute(page, "/savings");
    await page.waitForTimeout(1000);
    await expect(popover).toHaveCount(0);
  });

  test("on a phone-sized screen the Home tour finds all eight of its sections", async ({ page }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await startDemo(page, { tours: true });
    const popover = page.locator(".driver-popover");
    await expect(popover.locator(".driver-popover-title")).toHaveText("Welcome to Piko");
    await expect(popover.locator(".driver-popover-progress-text")).toHaveText("1 of 8");
  });

  test("cleanup deletes an expired demo and leaves the real household alone", async ({ browser }) => {
    const first = await browser.newPage();
    await startDemo(first);
````

In `e2e/demo.spec.ts`, find:

````ts
  await expect(page.getByText("Starting the demo signs you out of your own household.")).toBeVisible();
});

test("a real account sees no demo banner", async ({ page }) => {
  await gotoRoute(page, "/dashboard");
  await expect(page.getByRole("button", { name: "Exit demo" })).toHaveCount(0);
  await gotoRoute(page, "/settings");
  await expect(page.getByRole("button", { name: "Change Password" })).toBeEnabled();
});
````

Replace it with:

````ts
  await expect(page.getByText("Starting the demo signs you out of your own household.")).toBeVisible();
});

test("a real account sees no demo banner and no tour", async ({ page }) => {
  await gotoRoute(page, "/dashboard");
  await expect(page.getByRole("button", { name: "Exit demo" })).toHaveCount(0);
  await page.waitForTimeout(1000);
  await expect(page.locator(".driver-popover")).toHaveCount(0);
  await gotoRoute(page, "/settings");
  await expect(page.getByRole("button", { name: "Change Password" })).toBeEnabled();
});
````

Replace the whole of `e2e/support/demo.ts` with:

````ts
import type { Page } from "@playwright/test";

import { TOUR_STORAGE_KEY } from "../../src/modules/demo/tour/tour-memory";
import { queryE2e } from "./db";

// A browser with no session, for the public demo.
export const SIGNED_OUT = { cookies: [], origins: [] };

// Starts a demo from /demo and waits for its Home. Creating the household
// takes a few round trips to the database, hence the longer wait. Tours are
// off unless asked for, so their overlay doesn't cover what a test clicks.
export async function startDemo(page: Page, { tours = false } = {}): Promise<void> {
  if (!tours) {
    await page.addInitScript((key) => window.localStorage.setItem(key, JSON.stringify({ seen: [], skippedAll: true })), TOUR_STORAGE_KEY);
  }
  await page.goto("/demo");
  await page.getByRole("button", { name: "Start the demo" }).click();
  await page.waitForURL("**/dashboard", { timeout: 60_000 });
}

// demo.spec.ts runs serially, so the newest demo household is the one the
// test just started.
export async function newestDemoHouseholdId(): Promise<string> {
  return queryE2e(async (sql) => {
    const [household] = await sql`select id from households where demo_expires_at is not null order by created_at desc limit 1`;
    return household.id as string;
  });
}

export async function householdExists(id: string): Promise<boolean> {
  return queryE2e(async (sql) => {
    const [row] = await sql`select count(*)::int as n from households where id = ${id}`;
    return row.n === 1;
  });
}

export async function liveDemoCount(): Promise<number> {
  return queryE2e(async (sql) => {
    const [row] = await sql`select count(*)::int as n from households where demo_expires_at > now()`;
    return row.n as number;
  });
}
````

In `src/components/Ledger.tsx`, find:

````tsx
// Headline-figure row at the top of most pages: one large lead figure and up
// to three smaller ones. Lays out against the page's @container (set in the
// (app) layout): side by side from 780px, lead on its own row below that.
export function Ledger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-3 border-t-2 border-b border-t-ink border-b-rule @min-[780px]:grid-cols-[minmax(0,1.55fr)_repeat(3,minmax(0,1fr))]",
        className,
      )}
    >
      {children}
    </div>
````

Replace it with:

````tsx
// Headline-figure row at the top of most pages: one large lead figure and up
// to three smaller ones. Lays out against the page's @container (set in the
// (app) layout): side by side from 780px, lead on its own row below that.
// `data-tour` marks it for the demo's guided tours (src/modules/demo/tour).
export function Ledger({ children, className, "data-tour": tour }: { children: ReactNode; className?: string; "data-tour"?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-3 border-t-2 border-b border-t-ink border-b-rule @min-[780px]:grid-cols-[minmax(0,1.55fr)_repeat(3,minmax(0,1fr))]",
        className,
      )}
      data-tour={tour}
    >
      {children}
    </div>
````

In `src/components/nav/BottomNav.tsx`, find:

````tsx
          "fixed right-4 bottom-20 z-10 grid size-12 place-items-center bg-signal-fill text-white shadow-dialog transition-[transform,opacity] duration-200 md:hidden",
          fabHiddenClass,
        )}
        onClick={() => setAddExpenseOpen(true)}
        type="button"
      >
````

Replace it with:

````tsx
          "fixed right-4 bottom-20 z-10 grid size-12 place-items-center bg-signal-fill text-white shadow-dialog transition-[transform,opacity] duration-200 md:hidden",
          fabHiddenClass,
        )}
        data-tour="add-expense-mobile"
        onClick={() => setAddExpenseOpen(true)}
        type="button"
      >
````

In `src/components/nav/BottomNav.tsx`, find:

````tsx
        quickCategoryIds={quickCategoryIds}
      />

      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-10 flex border-t-2 border-rule bg-paper pb-[env(safe-area-inset-bottom)] md:hidden">
        {BOTTOM_BAR.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);
````

Replace it with:

````tsx
        quickCategoryIds={quickCategoryIds}
      />

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-10 flex border-t-2 border-rule bg-paper pb-[env(safe-area-inset-bottom)] md:hidden"
        data-tour="nav-bottom"
      >
        {BOTTOM_BAR.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);
````

In `src/components/nav/SidebarNav.tsx`, find:

````tsx
      <div className="flex" data-enter="" style={enterStyle(addEnter)}>
        <Button
          className="h-10 min-w-0 flex-1 justify-start px-2.5"
          onClick={openAddExpense}
          title="Add expense (N)"
          type="button"
````

Replace it with:

````tsx
      <div className="flex" data-enter="" style={enterStyle(addEnter)}>
        <Button
          className="h-10 min-w-0 flex-1 justify-start px-2.5"
          data-tour="add-expense"
          onClick={openAddExpense}
          title="Add expense (N)"
          type="button"
````

In `src/components/nav/SidebarNav.tsx`, find:

````tsx
        </div>
      </div>

      <nav aria-label="Main" className="relative flex flex-1 flex-col gap-4.5" onMouseLeave={handleNavLeave}>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-9 bg-surface opacity-0"
````

Replace it with:

````tsx
        </div>
      </div>

      <nav aria-label="Main" className="relative flex flex-1 flex-col gap-4.5" data-tour="nav-main" onMouseLeave={handleNavLeave}>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-9 bg-surface opacity-0"
````

In `src/modules/budget/components/BudgetView.tsx`, find:

````tsx
            <strong className="text-ink">{person.lead.planned} of this month&apos;s income</strong>, yet{" "}
            <strong className="text-ink">{person.lead.outside} of spending</strong> happened outside a budget.{" "}
            <strong className="text-ink">{person.lead.strong}</strong>
            {person.lead.rest}
          </p>

          <Ledger>
            <LedgerCell
              bar={<Meter ratio={person.ledger.plannedRatio} />}
              label="Left to plan"
              lead
              note={<span className={cn(person.ledger.unplanned < 0 && "text-signal-ink")}>{person.ledger.unplannedSub}</span>}
            >
````

Replace it with:

````tsx
            <strong className="text-ink">{person.lead.planned} of this month&apos;s income</strong>, yet{" "}
            <strong className="text-ink">{person.lead.outside} of spending</strong> happened outside a budget.{" "}
            <strong className="text-ink">{person.lead.strong}</strong>
            {person.lead.rest}
          </p>

          <Ledger data-tour="budget-ledger">
            <LedgerCell
              bar={<Meter ratio={person.ledger.plannedRatio} />}
              label="Left to plan"
              lead
              note={<span className={cn(person.ledger.unplanned < 0 && "text-signal-ink")}>{person.ledger.unplannedSub}</span>}
            >
````

In `src/modules/budget/components/BudgetView.tsx`, find:

````tsx
              <Money size="cell" value={person.ledger.budgeted} />
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
````

Replace it with:

````tsx
              <Money size="cell" value={person.ledger.budgeted} />
            </LedgerCell>
          </Ledger>
        </>
      )}

      <div data-tour="budget-whose">
        <LineTabs
          aside={person ? "Click a row to change its budget" : undefined}
          className="mt-5.5 mb-6.5"
          label="Whose plan"
          onChange={(value) => setTab(value)}
          tabs={tabs}
          value={tab}
        />
      </div>

      {person?.carriedFrom && (
        <p className="mb-4 text-[13px] text-n-700">
          Carried over from {person.carriedFrom}. Changing a line makes this month&apos;s plan its own.
        </p>
      )}
````

In `src/modules/budget/components/BudgetView.tsx`, find:

````tsx
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
          <span className="truncate text-[13px] text-n-600">Filled in from savings, dhuku, loans and funds</span>
        </div>
        <div className="text-right text-[15px] font-semibold">
````

Replace it with:

````tsx
// "Set aside first": savings plans, dhukus, loan installments (and later
// funds), filled in from what Piko already knows. Done is what has actually
// gone in this month.
function SetAsideRows({ setAside }: { setAside: PersonView["setAside"] }) {
  const ratio = setAside.planned > 0 ? setAside.done / setAside.planned : 0;
  return (
    <div data-tour="budget-set-aside">
      <RowGroupHead columns={COLUMNS} first>
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="text-[15px] font-semibold whitespace-nowrap">Set aside first</span>
          <span className="truncate text-[13px] text-n-600">Filled in from savings, dhuku, loans and funds</span>
        </div>
        <div className="text-right text-[15px] font-semibold">
````

In `src/modules/budget/components/BudgetView.tsx`, find:

````tsx
              <Meter className="flex-1" ratio={Math.min(1, rowRatio)} />
              <span className="w-10.5 text-right text-[13px] text-n-700">{pct(rowRatio)}</span>
            </div>
          </Row>
        );
      })}
    </>
  );
}

type FundRowsProps = {
  // Funds are their owner's: only your own can be added to or changed.
  canEdit: boolean;
````

Replace it with:

````tsx
              <Meter className="flex-1" ratio={Math.min(1, rowRatio)} />
              <span className="w-10.5 text-right text-[13px] text-n-700">{pct(rowRatio)}</span>
            </div>
          </Row>
        );
      })}
    </div>
  );
}

type FundRowsProps = {
  // Funds are their owner's: only your own can be added to or changed.
  canEdit: boolean;
````

In `src/modules/dashboard/components/HomeView.tsx`, find:

````tsx

      {props.settle && <SettleCard {...props.settle} />}

      <section className="grid grid-cols-1 gap-x-14 gap-y-5 border-t-2 border-ink pt-5 pb-2 @min-[780px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-2.5">
          {pacing ? (
            <>
````

Replace it with:

````tsx

      {props.settle && <SettleCard {...props.settle} />}

      <section
        className="grid grid-cols-1 gap-x-14 gap-y-5 border-t-2 border-ink pt-5 pb-2 @min-[780px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]"
        data-tour="home-safe"
      >
        <div className="flex min-w-0 flex-col gap-2.5">
          {pacing ? (
            <>
````

In `src/modules/dashboard/components/HomeView.tsx`, find:

````tsx
        )}
      </section>

      <Ledger className="mt-9">
        <LedgerCell
          bar={<Meter label={`Spent ${ledger.spentPctOfPay ?? 0}% of pay`} ratio={ledger.spentMeterRatio} />}
          label={`Spent in ${props.spentMonthName}`}
````

Replace it with:

````tsx
        )}
      </section>

      <Ledger className="mt-9" data-tour="home-ledger">
        <LedgerCell
          bar={<Meter label={`Spent ${ledger.spentPctOfPay ?? 0}% of pay`} ratio={ledger.spentMeterRatio} />}
          label={`Spent in ${props.spentMonthName}`}
````

In `src/modules/dashboard/components/HomeView.tsx`, find:

````tsx
        })}
      </section>

      <section className="mt-13 max-w-160">
        <SectionHeading sub="Where your money stands, apart from this month's spending">Balances</SectionHeading>
        <div className="flex items-baseline justify-between gap-4 border-b border-n-300 py-3">
          <span className="flex min-w-0 flex-col gap-0.5">
````

Replace it with:

````tsx
        })}
      </section>

      <section className="mt-13 max-w-160" data-tour="home-balances">
        <SectionHeading sub="Where your money stands, apart from this month's spending">Balances</SectionHeading>
        <div className="flex items-baseline justify-between gap-4 border-b border-n-300 py-3">
          <span className="flex min-w-0 flex-col gap-0.5">
````

In `src/modules/dashboard/components/HomeView.tsx`, find:

````tsx
      </section>

      <div className="mt-13 grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-12">
        <section className="min-w-0">
          <SectionHeading aside={<ArrowLink href="/expenses">All expenses</ArrowLink>}>Recent expenses</SectionHeading>
          {props.recent.length === 0 ? (
            <EmptyState body="Expenses you record will show up here." title="No expenses yet" />
````

Replace it with:

````tsx
      </section>

      <div className="mt-13 grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-12">
        <section className="min-w-0" data-tour="home-recent">
          <SectionHeading aside={<ArrowLink href="/expenses">All expenses</ArrowLink>}>Recent expenses</SectionHeading>
          {props.recent.length === 0 ? (
            <EmptyState body="Expenses you record will show up here." title="No expenses yet" />
````

Replace the whole of `src/modules/demo/components/DemoBanner.tsx` with:

````tsx
"use client";

import { Smartphone } from "lucide-react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";

import { exitDemoAction } from "../api/demo.actions";
import { tourForPath } from "../tour/tour-steps";
import { useDemo } from "./DemoProvider";

// The thin bar on every page of a demo. Real accounts render nothing.
export function DemoBanner() {
  const demo = useDemo();
  const pathname = usePathname();
  if (!demo) return null;

  return (
    <div className="sticky top-0 z-20 -mx-4 -mt-5 mb-5 flex flex-wrap items-center gap-x-4 gap-y-1 border-b-2 border-ink bg-paper px-4 py-2 text-sm md:-mx-12 md:-mt-9 md:mb-9 md:px-12">
      <span className="font-semibold">Demo</span>
      <span className="text-n-700">Deleted in {demo.timeLeft}</span>
      <div className="ml-auto flex items-center gap-1">
        <Button
          aria-pressed={demo.phoneOpen}
          data-tour="phone-button"
          onClick={() => demo.setPhoneOpen(!demo.phoneOpen)}
          size="sm"
          type="button"
          variant="ghost"
        >
          <Smartphone />
          Phone
        </Button>
        {tourForPath(pathname) && (
          <Button onClick={demo.requestTour} size="sm" type="button" variant="ghost">
            Tour this page
          </Button>
        )}
        <form action={exitDemoAction}>
          <Button size="sm" type="submit" variant="ghost">
            Exit demo
          </Button>
        </form>
      </div>
    </div>
  );
}
````

Replace the whole of `src/modules/demo/components/DemoProvider.tsx` with:

````tsx
"use client";

import { createContext, type ReactNode, useContext, useState } from "react";

import dynamic from "next/dynamic";

// Its own chunk, so real accounts never download the tours (or driver.js).
const DemoTour = dynamic(() => import("../tour/DemoTour").then((m) => m.DemoTour), { ssr: false });

// What the app shell knows about a demo visitor's household; null for real accounts.
export type DemoState = { timeLeft: string };

type DemoContextValue = DemoState & {
  phoneOpen: boolean;
  // Runs this page's tour again ("Tour this page").
  requestTour: () => void;
  setPhoneOpen: (open: boolean) => void;
};

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children, demo }: { children: ReactNode; demo: DemoState | null }) {
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [tourRequest, setTourRequest] = useState(0);
  const value = demo ? { ...demo, phoneOpen, requestTour: () => setTourRequest((n) => n + 1), setPhoneOpen } : null;

  return (
    <DemoContext value={value}>
      {children}
      {demo && <DemoTour request={tourRequest} />}
    </DemoContext>
  );
}

export function useDemo(): DemoContextValue | null {
  return useContext(DemoContext);
}
````

Create `src/modules/demo/tour/DemoTour.tsx` with:

````tsx
"use client";

import { useEffect, useRef } from "react";

import { type Driver, driver } from "driver.js";
import { usePathname } from "next/navigation";
import "driver.js/dist/driver.css";

import "./tour.css";
import { markSeen, readTourMemory, shouldAutoRun, skipAll, TOUR_STORAGE_KEY, type TourMemory } from "./tour-memory";
import { tourForPath, type TourId, TOURS } from "./tour-steps";
import { type ResolvedStep, resolveSteps } from "./tour-targets";

// Lets the page paint (and the sidebar finish its entrance) before measuring.
const SETTLE_MS = 400;
// The page streams in after the layout (loading.tsx shows first), so the tour
// keeps looking for its sections for a while before starting without them.
const WAIT_FOR_PAGE_MS = 5000;
const LOOK_AGAIN_MS = 200;

function findVisible(target: string): Element | null {
  for (const element of document.querySelectorAll(`[data-tour="${target}"]`)) {
    const box = element.getBoundingClientRect();
    if (box.width > 0 && box.height > 0) return element;
  }
  return null;
}

function readMemory(): TourMemory {
  return readTourMemory(window.localStorage.getItem(TOUR_STORAGE_KEY));
}

function writeMemory(memory: TourMemory): void {
  window.localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(memory));
}

function runTour(id: TourId, steps: ResolvedStep<Element>[]): Driver | null {
  if (steps.length === 0) return null;
  // Seen as soon as it starts: leaving mid-tour shouldn't bring it back, and
  // driver.js only reports closing after its animation, which a quick
  // navigation can cut short.
  writeMemory(markSeen(readMemory(), id));

  const tour = driver({
    doneBtnText: "Done",
    nextBtnText: "Next",
    onPopoverRender: (popover) => {
      if (popover.footer.querySelector(".piko-tour-skip")) return;
      const skip = document.createElement("button");
      skip.className = "piko-tour-skip";
      skip.textContent = "Skip all tours";
      skip.type = "button";
      skip.addEventListener("click", () => {
        writeMemory(skipAll(readMemory()));
        tour.destroy();
      });
      popover.footer.prepend(skip);
    },
    overlayColor: "#201e1d",
    overlayOpacity: 0.55,
    popoverClass: "piko-tour",
    prevBtnText: "Back",
    progressText: "{{current}} of {{total}}",
    showProgress: true,
    stagePadding: 6,
    stageRadius: 0,
    steps: steps.map(({ element, step }) => ({ element: element ?? undefined, popover: { description: step.body, title: step.title } })),
  });
  tour.drive();
  return tour;
}

// Runs a page's tour by itself the first time the visitor opens it, and again
// whenever `request` changes ("Tour this page" in the banner), even after
// they skipped them all. Loaded only for demo visitors (see DemoProvider).
export function DemoTour({ request }: { request: number }) {
  const pathname = usePathname();
  const active = useRef<Driver | null>(null);
  const lastRequest = useRef(request);

  useEffect(() => {
    const id = tourForPath(pathname);
    if (!id || !shouldAutoRun(readMemory(), id)) return;
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    function look(tourId: TourId) {
      const steps = resolveSteps(TOURS[tourId], findVisible);
      if (steps.length < TOURS[tourId].length && Date.now() - startedAt < WAIT_FOR_PAGE_MS) {
        timer = setTimeout(() => look(tourId), LOOK_AGAIN_MS);
        return;
      }
      active.current = runTour(tourId, steps);
    }
    timer = setTimeout(() => look(id), SETTLE_MS);
    return () => {
      clearTimeout(timer);
      active.current?.destroy();
      active.current = null;
    };
  }, [pathname]);

  useEffect(() => {
    if (request === lastRequest.current) return;
    lastRequest.current = request;
    const id = tourForPath(pathname);
    if (!id) return;
    active.current?.destroy();
    active.current = runTour(id, resolveSteps(TOURS[id], findVisible));
  }, [pathname, request]);

  return null;
}
````

Create `src/modules/demo/tour/tour.css` with:

````css
/* driver.js's popover in Piko's look: paper and ink, square corners, the one
   red accent on the main button. Tokens from src/app/globals.css, so dark
   mode follows. */
.driver-popover.piko-tour {
  background: var(--paper);
  border: 2px solid var(--ink);
  border-radius: 0;
  box-shadow: var(--elevation-dialog);
  color: var(--ink);
  font-family: var(--font-sans);
  max-width: 320px;
  padding: 18px 20px 16px;
}

.piko-tour .driver-popover-arrow {
  display: none;
}

.piko-tour .driver-popover-title {
  font-family: var(--font-sans);
  font-size: 17px;
  font-weight: 800;
  letter-spacing: -0.01em;
  line-height: 1.25;
}

.piko-tour .driver-popover-description {
  color: var(--n-800);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.45;
  margin-top: 6px;
}

.piko-tour .driver-popover-close-btn {
  color: var(--n-600);
}

.piko-tour .driver-popover-footer {
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}

.piko-tour .driver-popover-progress-text {
  color: var(--n-600);
  font-size: 12px;
}

.piko-tour .driver-popover-navigation-btns {
  gap: 6px;
}

.piko-tour .driver-popover-footer button {
  background: var(--paper);
  border: 1px solid var(--ink);
  border-radius: 0;
  color: var(--ink);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 600;
  padding: 6px 12px;
  text-shadow: none;
}

.piko-tour .driver-popover-footer .driver-popover-next-btn {
  background: var(--signal-fill);
  border-color: var(--signal-fill);
  color: #fff;
}

.piko-tour .driver-popover-footer .piko-tour-skip {
  border: 0;
  color: var(--n-700);
  margin-right: auto;
  padding: 6px 0;
  text-decoration: underline;
  text-underline-offset: 3px;
}
````

In `src/modules/dhuku/components/DhukuView.tsx`, find:

````tsx
        title="Dhuku"
      />

      <Ledger>
        <LedgerCell label="Due this month" lead note={props.ledger.dueSub}>
          <Money size="lead" value={props.ledger.due} />
        </LedgerCell>
````

Replace it with:

````tsx
        title="Dhuku"
      />

      <Ledger data-tour="dhuku-ledger">
        <LedgerCell label="Due this month" lead note={props.ledger.dueSub}>
          <Money size="lead" value={props.ledger.due} />
        </LedgerCell>
````

In `src/modules/dhuku/components/DhukuView.tsx`, find:

````tsx
      {visible.map((row) => {
        const open = expanded[row.id] ?? false;
        return (
          <div key={row.id}>
            <Row columns={COLUMNS} onClick={() => setExpanded((prev) => ({ ...prev, [row.id]: !open }))}>
              <div className="flex min-w-0 flex-col gap-1">
                <span className={cn("truncate text-[15px] font-semibold", row.completed && "text-n-600")}>{row.name}</span>
````

Replace it with:

````tsx
      {visible.map((row) => {
        const open = expanded[row.id] ?? false;
        return (
          <div data-tour="dhuku-group" key={row.id}>
            <Row columns={COLUMNS} onClick={() => setExpanded((prev) => ({ ...prev, [row.id]: !open }))}>
              <div className="flex min-w-0 flex-col gap-1">
                <span className={cn("truncate text-[15px] font-semibold", row.completed && "text-n-600")}>{row.name}</span>
````

In `src/modules/dhuku/components/DhukuView.tsx`, find:

````tsx
                {row.active && (
                  <Button
                    className="h-auto px-2.5 py-1.25 text-[13px]"
                    onClick={() => setLogTarget({ id: row.id, monthly: row.nextAmount, name: row.name, pot: row.pot })}
                    type="button"
                    variant="outline"
````

Replace it with:

````tsx
                {row.active && (
                  <Button
                    className="h-auto px-2.5 py-1.25 text-[13px]"
                    data-tour="dhuku-log"
                    onClick={() => setLogTarget({ id: row.id, monthly: row.nextAmount, name: row.name, pot: row.pot })}
                    type="button"
                    variant="outline"
````

In `src/modules/savings/components/SavingsView.tsx`, find:

````tsx
            <SectionHeading
              aside={
                <span className="flex items-center gap-1">
                  <Button className="h-auto px-2.5 py-1.25 text-[13px]" onClick={() => setDepositPot(pot)} type="button" variant="outline">
                    Add money
                  </Button>
                  <RowMenu items={[{ label: "Pot settings", onSelect: () => setPotDialog({ editing: pot, open: true, ownerKey: pot.ownerKey }) }]} />
````

Replace it with:

````tsx
            <SectionHeading
              aside={
                <span className="flex items-center gap-1">
                  <Button
                    className="h-auto px-2.5 py-1.25 text-[13px]"
                    data-tour="savings-add"
                    onClick={() => setDepositPot(pot)}
                    type="button"
                    variant="outline"
                  >
                    Add money
                  </Button>
                  <RowMenu items={[{ label: "Pot settings", onSelect: () => setPotDialog({ editing: pot, open: true, ownerKey: pot.ownerKey }) }]} />
````

In `src/modules/savings/components/SavingsView.tsx`, find:

````tsx
              {pot.name}
            </SectionHeading>

            <Ledger>
              <LedgerCell label="Balance" lead note={`${pot.items.length} on the list`}>
                <Money size="lead" value={pot.balance} />
              </LedgerCell>
````

Replace it with:

````tsx
              {pot.name}
            </SectionHeading>

            <Ledger data-tour="savings-ledger">
              <LedgerCell label="Balance" lead note={`${pot.items.length} on the list`}>
                <Money size="lead" value={pot.balance} />
              </LedgerCell>
````

In `src/modules/savings/components/SavingsView.tsx`, find:

````tsx
              </LedgerCell>
            </Ledger>

            <div className="mt-8">
              <RowsHeader columns={COLUMNS}>
                <span>#</span>
                <span>Saving for</span>
````

Replace it with:

````tsx
              </LedgerCell>
            </Ledger>

            <div className="mt-8" data-tour="savings-list">
              <RowsHeader columns={COLUMNS}>
                <span>#</span>
                <span>Saving for</span>
````

- [ ] **Step 2: Run the checks**

Run:

```bash
npx vitest run
npx tsc --noEmit
npm run lint
```

Expected: the whole suite: `Tests  453 passed (453)`; `tsc` prints nothing; lint ends with `✖ 2 problems (0 errors, 2 warnings)` (both warnings were there before this plan: `jsx-a11y/role-supports-aria-props` in `NepaliDateField.tsx` and `react-hooks/incompatible-library` in `ExpenseDialog.tsx`).

- [ ] **Step 3: Run the browser tests**

Run:

```bash
npx playwright test e2e/demo.spec.ts --retries=1
```

Expected: `17 passed` (the sign-in setup plus 16 demo tests), possibly with a line saying some were `flaky` (passed on the retry). It builds and serves the app first, so allow 3–6 minutes.

- [ ] **Step 4: Commit**

```bash
git add "e2e/demo.spec.ts" "e2e/support/demo.ts" "src/components/Ledger.tsx" "src/components/nav/BottomNav.tsx" "src/components/nav/SidebarNav.tsx" "src/modules/budget/components/BudgetView.tsx" "src/modules/dashboard/components/HomeView.tsx" "src/modules/demo/components/DemoBanner.tsx" "src/modules/demo/components/DemoProvider.tsx" "src/modules/demo/tour/DemoTour.tsx" "src/modules/demo/tour/tour.css" "src/modules/dhuku/components/DhukuView.tsx" "src/modules/savings/components/SavingsView.tsx"
git commit -m "feat(demo): guided tours with a spotlight, skip-all, and Tour this page" -m "driver.js runs the Home tour on arrival and the Budget, Savings and Dhuku tours the first time each opens, styled in Piko's look. Skip all tours stops them; Tour this page in the banner replays the current one. Sections carry data-tour labels; the tour waits for the streamed page before measuring, and only demo visitors download it."
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.

### Task 12: The public demo in the docs

The architecture doc gains a "Public demo" section (what marks a demo, the cleanup guards, what's turned off, where the phone and tours live), and the spec is brought in line with the five findings in "Design (agreed)".

**Files:**
- Modify: `docs/architecture.md`
- Modify: `docs/superpowers/specs/2026-10-15-public-demo-design.md`

- [ ] **Step 1: Make the change**

In `docs/architecture.md`, find:

````markdown
  modules/        # feature slices (see below)
  components/     # shared UI: nav/, ui/ (shadcn), TextField, ErrorState, ...
  db/
````

Replace it with:

````markdown
    demo/         # public: starts a private demo household (see Public demo)
  modules/        # feature slices (see below)
  components/     # shared UI: nav/, ui/ (shadcn), TextField, ErrorState, ...
  db/
````

In `docs/architecture.md`, find:

````markdown
## Cross-cutting concerns

- **Migrations** live in `drizzle/` (generated by `drizzle-kit generate`, applied by
````

Replace it with:

````markdown
## Public demo

`/demo` lets anyone try Piko without seeing real data. The design is in
`docs/superpowers/specs/2026-10-15-public-demo-design.md`; the code is `src/modules/demo/`.

- **A private copy per visitor, in the same database.** "Start the demo" (a form, so link
  previews can't trigger it) runs `startDemoAction`: it deletes expired demos, refuses past
  `MAX_LIVE_DEMOS` live ones, then `createDemoHousehold` inserts Aarav & Sita's household
  (`lib/demo-fixture.ts`, built relative to today in BS months) in one transaction and
  signs the visitor in as Aarav through the normal credentials provider.
- **What marks a demo.** `households.demo_expires_at` (null = real) and accounts on
  `DEMO_EMAIL_DOMAIN` (`src/lib/demo-account.ts`, a reserved `.invalid` domain).
  `CurrentMember.isDemo` comes from the household. Every household-scoped rule applies
  unchanged, so a demo can only ever see itself.
- **Cleanup has two guards.** `deleteDemos` (`api/demo.ts`) only deletes households with
  `demo_expires_at` set, and only accounts that belonged to them **and** are on the demo
  domain. Never loosen either guard; the e2e test "cleanup deletes an expired demo and
  leaves the real household alone" pins them.
- **Expired sessions** go to `/demo?expired=1`: `getCurrentMember` redirects when the
  session's email is a demo one and its household is gone.
- **Turned off for demos (server-side, `assertNotDemo`)**: change password, profile photo,
  voice entry (Gemini), and mobile sign-in (`/api/mobile/login`). The UI greys them out
  (`DemoLocked`) or points to the demo phone instead.
- **The banner, phone and tours** live in the `(app)` layout only for demo households
  (`DemoProvider` is null otherwise). The phone (`components/DemoPhone.tsx`) is web
  screens in a CSS frame, reusing `RecentExpensesList` and `ExpenseFields`; its voice
  screen uses `lib/voice-phrases.ts`, never Gemini. Tours are driver.js
  (`tour/DemoTour.tsx`, loaded only for demos) over sections marked `data-tour="…"`; when
  you move or rename one of those sections, keep its `data-tour` so its step still finds
  it. `tour/tour-steps.ts` lists every target.

## Cross-cutting concerns

- **Migrations** live in `drizzle/` (generated by `drizzle-kit generate`, applied by
````

In `docs/superpowers/specs/2026-10-15-public-demo-design.md`, find:

````markdown

### 1.5 Expired sessions

The JWT carries `demo: true` (set in the `jwt` callback from the email domain). When
`getCurrentMember` finds no membership and the session is a demo, it calls
`redirect("/demo?expired=1")` instead of throwing. Doing it there (not only in the layout) covers
the layout, pages and server actions alike, which render in parallel. Real sessions keep today's
````

Replace it with:

````markdown

### 1.5 Expired sessions

The session already carries the account's email, so a demo session is one whose email is on
the demo domain (`isDemoEmail`); no extra JWT field is needed. When
`getCurrentMember` finds no membership and the session is a demo, it calls
`redirect("/demo?expired=1")` instead of throwing. Doing it there (not only in the layout) covers
the layout, pages and server actions alike, which render in parallel. Real sessions keep today's
````

In `docs/superpowers/specs/2026-10-15-public-demo-design.md`, find:

````markdown
| --- | --- | --- |
| Change password | `changePasswordAction` | refuse: "Not available in the demo" |
| Profile photo | `updateProfileImageAction` | refuse |
| Voice entry (Gemini) | `parseVoiceEntryAction` | refuse; the web voice button shows the message |
| Mobile app sign-in | `POST /api/mobile/login` | refuse demo emails (no token → no mobile voice route) |

App-release publishing is already limited to `APP_RELEASE_ADMIN_EMAILS`. Everything else works
````

Replace it with:

````markdown
| --- | --- | --- |
| Change password | `changePasswordAction` | refuse: "Not available in the demo" |
| Profile photo | `updateProfileImageAction` | refuse |
| Voice entry (Gemini) | `parseVoiceEntryAction` | refuse; the web voice button says so and offers to open the demo phone |
| Mobile app sign-in | `POST /api/mobile/login` | refuse demo emails (no token → no mobile voice route) |

App-release publishing is already limited to `APP_RELEASE_ADMIN_EMAILS`. Everything else works
````

In `docs/superpowers/specs/2026-10-15-public-demo-design.md`, find:

````markdown
  more targets; the first visible one is used (sidebar vs bottom bar); steps with no visible
  target are skipped.
- **Memory:** `localStorage` — which tours have been seen, and "skipped all". A tour auto-runs
  once per page; **Skip all tours** stops all of them; Esc closes the current one (marked seen);
  **Tour this page** always replays.
- **Home (8):** welcome (centred, no highlight) → Safe to spend today → Pay / Moved this month /
  Unallocated → Balances → Recent expenses → Add expense → Phone button → Budget/Savings/Dhuku in
  the nav ("each has a short tour the first time you open it").
- **Budget (3):** Whose plan → Set aside first → Left to plan.
- **Savings (3):** Balance + Emergency reserve → Saving for → Planned a month.
- **Dhuku (3):** Status (+ means the group owes you) → Contributed / Received → Next payment.
- Step copy: one or two plain sentences each.

## 6. Where the code lives
````

Replace it with:

````markdown
  more targets; the first visible one is used (sidebar vs bottom bar); steps with no visible
  target are skipped.
- **Memory:** `localStorage` — which tours have been seen, and "skipped all". A tour auto-runs
  once per page and counts as seen when it starts (leaving mid-tour doesn't bring it back);
  **Skip all tours** stops all of them; Esc closes the current one; **Tour this page** always
  replays.
- **Streaming:** the page streams in after the layout (`loading.tsx` first), so a tour keeps
  looking for its sections for up to 5 s before starting without the missing ones.
- **Home (8):** welcome (centred, no highlight) → Safe to spend today → Pay / Moved this month /
  Unallocated → Balances → Recent expenses → Add expense → Phone button → Budget/Savings/Dhuku in
  the nav ("each has a short tour the first time you open it").
- **Budget (3):** Whose plan → Set aside first → Left to plan.
- **Savings (3):** the pot's figures (balance, emergency reserve, planned a month) → Saving for →
  Add money.
- **Dhuku (3):** the page's figures (due this month, contributed, received) → one group's months →
  Log entry. (The Dhuku page has no plus/minus position; that's in Home's Balances step.)
- Step copy: one or two plain sentences each.

## 6. Where the code lives
````

In `docs/superpowers/specs/2026-10-15-public-demo-design.md`, find:

````markdown
- `api/demo.actions.ts` — `startDemoAction`, `exitDemoAction`.
- `api/demo.ts` — create sandbox, live-demo count, cleanup.
- `lib/demo-fixture.ts`, `lib/voice-phrases.ts`, `lib/demo-constants.ts` (email domain, 24 h, cap 100).
- `components/DemoBanner.tsx`, `components/phone/*` (frame, Home, Voice, sheet).
- `tour/` — step definitions, memory helpers, the driver.js runner.

Touched elsewhere: `households` schema + migration, `src/lib/session.ts` (`isDemo`),
`src/auth.ts` (JWT `demo` flag), `src/proxy.ts`, `src/app/(app)/layout.tsx` (banner, phone),
settings and voice-entry actions, `/api/mobile/login`, `HomeView` (extract the
list), `ExpenseDialog` (expose the fields), and `data-tour` attributes on Home, Budget, Savings,
Dhuku and the nav.

## 7. Testing

````

Replace it with:

````markdown
- `api/demo.actions.ts` — `startDemoAction`, `exitDemoAction`.
- `api/demo.ts` — create sandbox, live-demo count, cleanup.
- `lib/demo-fixture.ts`, `lib/voice-phrases.ts`, `lib/demo-constants.ts` (email domain, 24 h, cap 100).
- `components/DemoProvider.tsx`, `DemoBanner.tsx`, `DemoLocked.tsx`, `DemoPhone.tsx`,
  `components/phone/*` (frame, Home, Voice, sheet).
- `tour/` — step definitions, memory helpers, the driver.js runner and its CSS.

Touched elsewhere: `households` schema + migration, `src/lib/demo-account.ts` (demo email
domain, `assertNotDemo`), `src/lib/session.ts` (`isDemo`, expired redirect), `src/proxy.ts`,
`src/app/(app)/layout.tsx` (provider, banner, phone), `src/components/BrandSplit.tsx` (the login
page's brand panel, shared), settings and voice-entry actions, `/api/mobile/login`,
`RecentExpensesList` + `buildRecentGroups` (pulled out of Home), `ExpenseFields` (exported, with a
`formId`, laid out against its own width), `Ledger` (passes `data-tour`), and `data-tour`
attributes on Home, Budget, Savings, Dhuku and the nav.

## 7. Testing

````

In `docs/superpowers/specs/2026-10-15-public-demo-design.md`, find:

````markdown
5. Tours: shown on first Home visit; after Skip all tours, Budget shows none; Tour this page replays.
6. Exit demo deletes the copy and returns to `/demo`.
7. A real account sees no banner and no tour.

**By hand before sharing:** a real phone and a laptop; paste the link in WhatsApp and confirm the
preview doesn't create a household.
````

Replace it with:

````markdown
5. Tours: shown on first Home visit; after Skip all tours, Budget shows none; Tour this page replays.
6. Exit demo deletes the copy and returns to `/demo`.
7. A real account sees no banner and no tour.
8. Every page opens on the demo data; on a phone-sized screen the phone opens full screen.

**By hand before sharing:** a real phone and a laptop; paste the link in WhatsApp and confirm the
preview doesn't create a household.
````

- [ ] **Step 2: Run the checks**

Run:

```bash
npx vitest run
npx tsc --noEmit
npm run lint
```

Expected: the whole suite: `Tests  453 passed (453)`; `tsc` prints nothing; lint ends with `✖ 2 problems (0 errors, 2 warnings)` (both warnings were there before this plan: `jsx-a11y/role-supports-aria-props` in `NepaliDateField.tsx` and `react-hooks/incompatible-library` in `ExpenseDialog.tsx`).

- [ ] **Step 3: Commit**

```bash
git add "docs/architecture.md" "docs/superpowers/specs/2026-10-15-public-demo-design.md"
git commit -m "docs: the public demo in the architecture doc; the spec matches what was built"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.

### Final checkpoint: STOP

If the `graphify` command exists, run `graphify update .` from the repo root first. It only changes `graphify-out/`, which is ignored; don't commit anything from it. If the command isn't found, skip it and say so.

Then stop and send the owner a report with:

- The branch name (`feat/public-demo`) and the twelve commit hashes and subjects (`git log --oneline main..HEAD`).
- The last `npx vitest run` line, and the browser test result from Task 11.
- Every place where a "find" block didn't match exactly and how you resolved it, and anything else you did that this plan didn't say.

Then the owner:

1. Makes sure `npm run db:migrate` has run against production (the first STOP). The new code reads `households.demo_expires_at` on every page, so deploying without the column would break every page.
2. Reviews the branch and merges it to `main`; the push deploys on Vercel.
3. Opens the live `/demo` on a phone and on a laptop and goes through the "worth a reviewer's eye" list in Review Focus, then pastes the link into WhatsApp and checks that the preview didn't create a household (the count of live demos doesn't change).
4. Shares the link.
