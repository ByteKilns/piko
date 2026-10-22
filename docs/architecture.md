# Piko — Architecture

Orientation doc for working in this repo without reading everything. Pair it with
`graphify query "<question>"` (see `AGENTS.md`) for exact cross-file relationships.

## What Piko is

A household expense tracker for a small two-person household:

- **Web app** (`src/`) — Next.js 16 (App Router, Turbopack), React 19, TypeScript,
  Tailwind v4, shadcn/radix UI. Dashboard, expenses, budgets, income, loans, savings
  pots, paybacks, dhukus, recurring bills, reports, notifications.
- **Mobile app** (`mobile/`) — Flutter companion: eSewa payments arrive as drafts to review, and expenses are added by typing or by voice.
  Talks to the same Next.js backend over a small JSON API. Its look follows the
  web's modernist design (palette in `mobile/lib/theme/piko_colors.dart`). See
  `mobile/README.md`.

Domain conventions that shape everything:

- **Shared vs per-member.** A row with `ownerMemberId === null` is *shared*; otherwise
  it belongs to one member. Getting this wrong changes dashboard math and privacy.
- **Household scoping.** Every domain table carries `householdId`. All reads and writes
  are scoped by it, and writes derive it from the session — never from client input.
- **Nepali (BS) calendar.** "Months" can be Bikram Sambat or Gregorian per household
  (`households.dateFormat`), resolved through `resolvePeriod` (`src/lib/month-period.ts`).
- **Spending vs transfers.** Only money that's gone counts as *Spent*. Money moved into
  savings, dhuku or loan repayments, and paybacks between members, are transfers. See
  [Money model](#money-model).

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16 App Router + Turbopack (`next dev` / `next build`) |
| UI | React 19, Tailwind v4, shadcn (`src/components/ui/*`), `lucide-react` |
| DB | PostgreSQL via `postgres` driver + Drizzle ORM (`src/db/`) |
| Validation | Zod v4 (`*.schema.ts`), shared by server actions and API routes |
| Auth | next-auth v5 beta, JWT sessions, credentials (`src/auth.ts`) |
| Voice | `@google/genai` (Gemini) parses spoken text into an expense draft |
| Storage | `@vercel/blob` for published APKs |
| Dates | Own BS↔AD converter (`src/lib/nepali-date.ts`) driven by `src/lib/bs-calendar-data.json`; same table served to the app via `/api/mobile/calendar` (bundled copy in `mobile/assets/bs_calendar.json`). Update yearly when the official calendar is published. |
| Tests | Vitest, colocated `*.test.ts` (`npm test`) |

## Top-level layout

```
src/
  app/            # routes only — thin files that re-export a module page
    (app)/        # authed route group; layout.tsx gates auth + renders nav
    api/          # route handlers: web (auth, app-releases), release-bot/* (release workflow) + mobile/*
    login/
    demo/         # public: starts a private demo household (see Public demo)
  modules/        # feature slices (see below)
  components/     # shared UI: nav/, ui/ (shadcn), TextField, ErrorState, ...
  db/
    schema/       # one Drizzle table file per domain; barrel-exported in index.ts
    connection.ts # postgres client (pool timeouts here); client.ts = "server-only" re-export
  lib/            # cross-cutting helpers: session, mobile-auth, cookies, dates, gemini
drizzle/          # generated SQL migrations + meta snapshots (never hand-edit the meta)
mobile/           # Flutter app (own README)
e2e/              # Playwright browser tests (own runner; see Commands)
docs/             # this file
graphify-out/     # knowledge graph (gitignored)
```

## Module anatomy

Each feature is a slice under `src/modules/<feature>/`:

```
<feature>/
  index.tsx                 # public surface: `export { XPage } from "./pages/XPage"`
  pages/XPage.tsx           # server component page (async, calls queries)
  components/               # PascalCase components, client components where interactive
  api/
    <feature>.actions.ts    # "use server": only `…Action` functions, household from the session
    <feature>.ts            # Drizzle queries and helpers taking a householdId (no "use server")
  schemas/<feature>.schema.ts  # Zod schemas
  lib/                      # pure helpers, usually with a colocated .test.ts
  hooks/                    # client hooks (e.g. table columns)
```

A route file is a thin adapter that re-exports the page, e.g.
`src/app/(app)/expenses/page.tsx` → `export { ExpensesPage as default } from "@/modules/expenses";`.
It also carries the Next-only bits a module can't: `export const metadata` (page titles)
and, when needed, route segment config (`dynamic`, `revalidate`, `runtime`, …).
Route handlers in `src/app/api/**` are the exception — they hold real logic.

**Redesigned pages** follow a two-part split: the `pages/<X>Page.tsx` server component
fetches data and shapes a plain model, then renders a client `components/<X>View.tsx`
that owns local UI state (tabs, filters, dialogs) and calls server actions. Each page
renders a single root element (the layout no longer adds vertical spacing). The visual
language lives in the shared composites under `src/components/` (`PageHeader`, `Ledger`,
`Rows`, `Modal`, `Money`, `Meter`, `LineTabs`, `Segmented`, …) and the tokens in
`src/app/globals.css`; read `docs/superpowers/specs/2026-10-07-modernist-redesign-design.md`
before adding UI. Layout responds to the page's `@container`, not the viewport
(`@min-[780px]:` etc.). Every table (`Rows`) needs a real phone layout in its `sm` band
(below 560px), not the desktop columns squeezed: keep the name, the key figure and the
⋯ menu, hide the other cells with `@max-[559px]:hidden`, say what they held in a line
under the name (`@min-[560px]:hidden`), and move row buttons into the menu — Budget and
Expenses are the models. Below 1024px the sidebar is its icon rail (`NARROW_SIDEBAR_QUERY`).
`e2e/responsive.spec.ts` opens every page at phone, tablet and small-laptop widths and
fails on sideways scrolling or a table cell spilling into the next. Pages a backend can't yet fill use one clearly named `MOCK_*`
constant — never a fake write.

**Worked example:** `expenses`. `api/expenses.actions.ts` holds `createExpenseAction`
(session-based), which calls `createExpenseForHousehold(input, actor)` in `api/expenses.ts` —
the shared core that both the web action and the mobile route call. Reuse that pattern:
put the tenancy-agnostic logic in a `...ForHousehold` function so web and mobile share it.

**Never export a helper from a `"use server"` file.** Every export there is a Server
Action a browser can POST to with arguments of its choosing, so one that takes a
`householdId` would let any signed-in user reach another household. Those files export
only `…Action` functions (plus types); helpers live in the plain `<feature>.ts` beside
them. `src/lib/use-server-exports.test.ts` fails the build's tests otherwise.

## Request & data flow

### Web (browser session)

1. `src/auth.ts` — NextAuth credentials provider; `authorize` → `verifyCredentials`.
   Session strategy is JWT; `session.user.id` is the user id.
2. `getCurrentMember()` (`src/lib/session.ts`) → `auth()` → looks up the user's
   `householdMembers` row → returns `{ householdId, memberId, userId, name }`.
   Throws `"User does not belong to a household"` if there's no membership.
3. `getEffectiveMember()` adds **presentation-only** "viewing as" support (a cookie):
   it can only ever resolve to a member of the *caller's own* household. Never use it
   to derive `householdId` for a write — server actions call `getCurrentMember()` directly
   so a forged cookie can't cross households.
4. Pages/layout call module queries and actions. `src/app/(app)/layout.tsx` fetches the
   member, members, categories and unread count once, then renders sidebar/bottom nav.
5. Server actions re-derive the member themselves (`getCurrentMember()`), scope by
   `householdId`, then `revalidatePath(...)`.

### Mobile (bearer token)

1. `POST /api/mobile/login` → `signMobileToken(userId)` (`src/lib/mobile-auth.ts`): an
   HS256 JWT signed with `AUTH_SECRET`, TTL 90 days. The app stores it in
   `flutter_secure_storage`.
2. Every request carries `Authorization: Bearer <token>`.
3. `requireMobileAuth(request)` (`src/lib/mobile-request.ts`) verifies it and resolves a
   `CurrentMember`, or returns a 401 `NextResponse` — check with
   `if (auth instanceof NextResponse) return auth;`.
4. Handlers reuse the same `...ForHousehold` core the web actions use.

## Domain model

`src/db/schema/` (all tables re-exported from `index.ts`):

- **Identity** — `users`, `households`, `household_members` (join of user↔household;
  the source of `householdId`/`memberId` for a session).
- **Money in/out** — `categories` (per household, `budgetType` fixed/flexible, optional
  `icon` key, archivable), `expenses` (`paidByMemberId` required, `ownerMemberId` null=shared,
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
  done once an expense links to it) + `savings_deposits` (`kind` deposit/opening/interest);
  `loans` + `loan_payments` (`direction` given/taken), `dhukus` + `dhuku_entries`
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
  shown on `/activity`), `app_releases` (global, not per-household; published APK builds).
- **eSewa captures** — `captured_payments` (each transaction a member's phone read from an
  eSewa notification: `status` draft / approved / rejected / skipped, `expenseId` once
  approved, `eventId` the notification it came from, unique per member), `capture_events` (every notification as captured, OTP digits masked; unique
  `(memberId, key, postedAt)`), `capture_rules` (payee → category, per member). Scoped by
  household **and** member. See [eSewa capture](#esewa-capture).

Conventions to keep when adding columns/tables:

- `householdId` FK with `onDelete: "cascade"` on every domain table.
- Money is `numeric(12,2)`; Drizzle returns it as a **string** — pass `String(x)` in,
  `Number(x)` out (see the mobile expenses route).
- `ownerMemberId` nullable means *shared*.
- Notifications are deduped by `dedupeKey` so generating code can re-run safely.

## Money model

How Piko counts money. The agreed design and its reasons are in the "Design (agreed)"
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
- **Savings pots** (`savings/lib/`) — `potBalance` = opening + deposits + interest −
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

## eSewa capture

The app turns eSewa's Android notifications into drafts that only become expenses once
approved. The agreed design is in the "Design (agreed)" section of
`docs/superpowers/plans/2026-10-14-esewa-capture.md`.

- **On the phone** (`mobile/android/app/src/main/kotlin/com/nirjal/piko/esewa/`,
  `mobile/lib/esewa/`) — a `NotificationListenerService` queues every eSewa notification
  (`PendingStore`) until Dart acks it, so nothing is lost offline or while the app is
  closed. All parsing is in Dart: `EsewaService` → `EsewaParser` → `Deduplicator` →
  `Categorizer`, stored through `PikoTxnRepository`. Tune `ParserRules` from real
  notification texts (Settings → Captured notifications), adding each as a case in
  `mobile/test/esewa_parser_test.dart`.
- **With Piko closed** (design: `docs/superpowers/specs/2026-10-17-esewa-draft-alerts-design.md`)
  — the listener hands each queued notification to the app's Dart if a Piko screen's
  engine is listening, otherwise `EsewaBackgroundRunner` starts a headless engine running
  `esewaBackgroundMain` (`mobile/lib/main.dart` → `lib/esewa/background.dart`), which
  drains the queue the same way and stops. One draft per notification is enforced by the
  server (`captured_payments.event_id`), so two drains at once can't double it.
- **Draft alerts** — each drain returns a `DrainResult` (new drafts, notifications it
  couldn't read) and hands it to `DraftNotifier`, which shows "Draft: Rs 500 to Daraz" /
  "N eSewa drafts to review" and "Piko couldn't read an eSewa notification" on the
  "eSewa drafts" channel, unless a Piko screen is in front. Tapping opens the review
  screen or Captured notifications (`EsewaAlerts.takeOpenTarget`). Android 13+ asks for
  the permission once; Settings → eSewa → Draft alerts shows and changes it.
- **Listener reconnects** — Android can keep notification access on but stop delivering;
  `MainActivity.onResume` asks it to rebind, and on connecting the listener re-reads
  eSewa notifications still in the shade.
- **Drafts never count.** They live in `captured_payments`, never in `expenses`, so no
  total, budget or alert sees them. Approving (`approveCaptureForMember`,
  `captures/api/captures.ts`) claims the draft, then calls `createExpenseForHousehold`, so
  an approved payment is an ordinary expense added from mobile: validated, notified,
  activity-logged and revertible.
- **Money coming in** (cashback, refunds, transfers received) is stored as `skipped`: the
  duplicate check sees it, but it's never offered for review.
- **Categories** — the categorizer's tables use the household's own category names; a
  name the household doesn't have means no guess. A category changed while approving is
  learned for that payee (`capture_rules`, add-or-update only).
- **Note suggestions** — `GET /api/mobile/categories` also sends `noteWords` (word →
  category from past notes, `expenses/lib/note-words.ts`), and the app's Add expense sheet
  suggests a category from the note until one is picked by hand. None of this goes to an AI.

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
  `drizzle-kit migrate`). Never hand-edit `drizzle/meta/*`.
- **Cookies** (all in `src/lib/*-cookie.ts`): `date-format`,
  `sidebar-collapsed`, `notification-preferences`, `viewing-as`.
- **Error logging**: `src/instrumentation.ts` (`onRequestError`) unwraps `error.cause`
  chains so the real Postgres error is visible server-side — the client error boundary
  (`src/components/ErrorState.tsx`) only sees a stripped message.
- **Safe-to-spend pacing** (`src/modules/dashboard/lib/pacing.ts`): splits the
  viewer's can-cut lines into a weekly release with a last-week buffer, carries
  unspent allowance forward between weeks, and surfaces `safeToday` (remaining ÷
  days left in the week) on the dashboard hero. Only the viewer's can-cut spending
  from pay counts against it day by day (`spentByDayIn` in `dashboard/lib/cash-flow.ts`);
  overruns elsewhere shrink the weeks left instead. The hero's figure comes from
  `viewerPacing` (`dashboard/lib/home-pacing.ts`), which the website's Home and the
  phone's (`GET /api/mobile/pacing` → `loadViewerPacing` in `dashboard/api/home-pacing.ts`)
  both call, so the two always agree. The phone always shows the signed-in member.
- **App releases**: publishing is gated by `APP_RELEASE_ADMIN_EMAILS`
  (`src/lib/release-admin.ts`); APKs are uploaded to Vercel Blob via a client-token
  flow (`src/app/api/app-releases/upload/route.ts`). `handleUpload` requires
  `BLOB_READ_WRITE_TOKEN` (OIDC alone is not enough). The store is **private**:
  `/api/mobile/app-version` hands the app a 24h signed link to the latest APK
  only, and publishing deletes superseded APK files. Both ways to publish share
  `publishRelease` (`modules/app-releases/api/app-releases.ts`): the Settings form
  (a release admin's session) and the **Release mobile app** GitHub workflow
  (`.github/workflows/release-mobile.yml`), which signs its requests with
  `APP_RELEASE_TOKEN` (`src/lib/release-token.ts`) to `/api/release-bot/{status,upload,publish}`.
  Those routes skip the sign-in redirect in `src/proxy.ts`. `/status` reports the
  deployment's commit (`VERCEL_GIT_COMMIT_SHA`) and whether the database is missing a
  migration (`release-status.ts`), so the workflow refuses to publish an APK ahead of the
  website it needs. Full procedure in `mobile/README.md`.
- **Activity log** (`src/modules/activity/`): every household data mutation calls
  `logActivity(activityActor(member), entry)` after its write succeeds. Each module
  owns a pure `lib/<x>-activity.ts` (summary + `diffFields` specs) so field knowledge
  stays next to the fields. Values are formatted at write time (names, `formatNPR`,
  BS/AD dates) — never raw IDs or image data. An edit with no real change
  (`changes: []`) is skipped. Times/day filters use Asia/Kathmandu.
  Entries also store raw `before`/`after` snapshots (and cascaded `related` rows on
  deletes); `src/modules/activity/lib/revert/` plans a revert (pure, per-entity
  registry in `entities.ts`) and `api/revert.actions.ts` applies it — household-scoped,
  re-planned at apply time, and logged with `revertOfId`. Paybacks, the savings
  entities (`savings_pot`, `savings_item`, `savings_deposit`), funds (`fund`,
  `fund_top_up`), `cushion` and `month_settlement` are logged but not revertible,
  because they aren't in `ENTITY_REVERT`. `savings_goal` and `savings_contribution` are
  still in the enum, though their tables were dropped.

## Task playbooks

**Add a DB column**
1. Edit the table in `src/db/schema/<domain>.ts`.
2. `npm run db:generate` → new `drizzle/NNNN_*.sql` + snapshot.
3. `npm run db:migrate`.
4. Thread it through the Zod schema, `...ForHousehold` core, and the form/page.

**Add a feature module**
1. Create `src/modules/<x>/` with `index.tsx`, `pages/`, `components/`, `api/`, `schemas/`.
2. Add a thin route: `src/app/(app)/<x>/page.tsx` re-exporting the page.
3. Add the nav entry in `src/components/nav/` (`SidebarNav` / `BottomNav`).
4. Queries/actions must scope by `householdId` via `getCurrentMember()`.
5. Log every mutation: add `lib/<x>-activity.ts` (summary + diff specs) and call
   `logActivity` after each write (pass `before`/`after`, and `related` for cascading
   deletes); add the entity to `ENTITY_REVERT` + `REVERT_STORES`; add the entity type to `activityEntityTypeEnum`
   and to a section in `src/modules/activity/lib/sections.ts`.

**Add a mobile endpoint**
1. `src/app/api/mobile/<x>/route.ts` using `requireMobileAuth`.
2. Put the real logic in a `...ForHousehold` function in the owning module so the web
   and mobile paths stay in sync; validate with the module's Zod schema.
3. Pass `activityActor(auth, "mobile")` into the shared `...ForHousehold` core so the
   activity log records the change as coming from mobile.

**Publish an app release** → follow `mobile/README.md`.

## Commands

```sh
npm run dev                 # Next dev server (also rewrites the AGENTS.md nextjs block)
npm run lint                # ESLint (perfectionist ordering) — add -- --fix
npm run test                # Vitest (unit/integration)
npm run test:e2e            # Playwright tests: reset+seed e2e DB, build, serve prod on :3100
npm run e2e:serve           # seed-e2e + build + start :3100 — what Playwright starts
npm run build               # production build (runs tsc too; part of the pre-commit hook)
npm run db:generate         # generate a migration from schema changes
npm run db:migrate          # apply migrations to .env.local's DATABASE_URL
npm run db:seed             # seed household + 2 users + default categories
npx tsx scripts/backfill-activity.ts [--apply]  # one-off: log pre-existing rows as "imported" (dry run without --apply; re-runnable)

# mobile (from mobile/)
flutter build apk --release --split-per-abi
```

`DATABASE_URL` comes from `.env.local` (local dev) or Vercel env (deployed). `npm run
db:migrate` / `db:seed` use whatever `.env.local` points at, so confirm the target before
running them.
