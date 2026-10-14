# Public demo — design spec

Date: 2026-10-15

## Goal

Let people who might use Piko themselves try it from a public link, on their own, without
seeing the owner's real data. They get a private sandbox household full of believable fake
data, short guided tours, and an on-screen phone that shows what the mobile app does.

## Decisions (agreed with the user)

| Topic | Decision |
| --- | --- |
| Audience | People who might use it themselves (friends, family, other couples). Tours teach how to use it. |
| Deployment | **Same deployment, same database.** One public entry route, `/demo`. No separate deployment or DB. |
| Sandbox | **A private copy per visitor**, deleted after 24 hours. |
| Entry | A `/demo` landing page with a **Start the demo** button (a GET never writes, so link-preview bots can't create households). Sign-in goes through the existing credentials provider. |
| Tours | **driver.js** (MIT). A Home tour on first arrival + 3-step tours on Budget, Savings, Dhuku the first time each is opened. **Skip all tours** on every step; **Tour this page** in the banner always replays. |
| Phone | A CSS phone frame around web screens that mirror the Flutter app (Home, voice, expense sheet), built mostly from existing web components. **Not** the real Flutter app. Fully interactive; voice uses ready-made phrases with canned answers (no Gemini). |
| Left out | "See as Sita" switch, a "Try the demo" link on `/login`, the app's Settings screen in the phone, real microphone, closed months / cushion history and activity history in the fixture. |

## 1. Sandbox lifecycle and safety

### 1.1 Marking a demo

- New nullable column `households.demo_expires_at` (timestamp). **Null = real household.** It is
  the only thing that makes a household a demo. Migration via `npm run db:generate`.
- Demo users get emails `<random>@demo.piko.invalid` (`.invalid` is a reserved TLD, so it can
  never be a real address). One constant, `DEMO_EMAIL_DOMAIN`.
- `CurrentMember` gains `isDemo: boolean` (from the household loaded in `getMemberForUser`), so
  server code can refuse demo-blocked actions without another query.

### 1.2 Starting a demo (`startDemoAction`)

1. If the session is already a demo user whose household is still live → redirect to `/dashboard`.
2. Run cleanup (1.4).
3. If 100 or more demo households are live → return "busy".
4. In **one transaction**: create the household (`dateFormat: "nepali"`,
   `demo_expires_at = now + 24h`, name "Aarav & Sita"), two users + members, default categories,
   and the fixture (section 2). Sita's password hash is random and unusable; Aarav's password is a
   random value kept only in memory for the next step.
5. `signIn("credentials", { email, password, redirectTo: "/dashboard" })` — the same path
   `loginAction` uses. If the visitor was signed in to a real account, this replaces that session.

### 1.3 Exiting (`exitDemoAction`)

Deletes the caller's own demo (same guards as 1.4, scoped to their household id), signs out, and
redirects to `/demo?bye=1`. Refuses when the caller isn't a demo user.

### 1.4 Cleanup — both guards must hold

- Households: `demo_expires_at IS NOT NULL AND demo_expires_at < now()`. Cascades delete every
  domain table and `household_members`.
- Users: only ids that were members of those households **and** whose email ends with
  `@demo.piko.invalid`. Member ids are read before the household delete, users deleted after,
  in the same transaction.
- Runs at the start of every `startDemoAction` (no cron). Exit uses the same function with
  "this household id" instead of "expired".

### 1.5 Expired sessions

The JWT carries `demo: true` (set in the `jwt` callback from the email domain). When
`getCurrentMember` finds no membership and the session is a demo, it calls
`redirect("/demo?expired=1")` instead of throwing. Doing it there (not only in the layout) covers
the layout, pages and server actions alike, which render in parallel. Real sessions keep today's
behaviour (the "User does not belong to a household" error).

### 1.6 Blocked for demo users (server-side; UI only explains)

| What | Where | Behaviour |
| --- | --- | --- |
| Change password | `changePasswordAction` | refuse: "Not available in the demo" |
| Profile photo | `updateProfileImageAction` | refuse |
| Voice entry (Gemini) | `parseVoiceEntryAction` | refuse; the web voice button shows the message |
| Mobile app sign-in | `POST /api/mobile/login` | refuse demo emails (no token → no mobile voice route) |

App-release publishing is already limited to `APP_RELEASE_ADMIN_EMAILS`. Everything else works
normally inside the visitor's own household, including switching the calendar.

## 2. Demo data (fixture)

A pure builder, `src/modules/demo/lib/demo-fixture.ts`, returns rows relative to a given
"today"; `api/demo.ts` inserts them. It is separate from `scripts/seed-e2e.ts`, whose exact
numbers the e2e tests depend on. Month keys (incomes, budgets) use the household calendar via
`currentPeriodYearMonth` / `resolvePeriod` (BS).

- **People:** Aarav (the visitor) and Sita, money kept separate.
- **Pay:** Aarav Rs 85,000, Sita Rs 60,000 a month; one extra income (Dashain bonus) in one month.
- **About 6 months of expenses** (a few hundred rows): groceries, momo, petrol, rides, phone
  recharge; some shared; one with a pay-back-later amount (Sita owes Aarav); one paid from the pot.
- **This month's budget** for each person with fixed, essential and can-cut lines; one can-cut
  line nearly used so "safe to spend" is interesting.
- **Recurring bills:** rent, internet, insurance.
- **Shared savings pot** "Home fund": reserve, monthly plans from both, deposits, items in order
  (new laptop, then Pokhara trip).
- **Dhuku:** 10 members, Rs 5,000 a month, several months paid, pot not yet taken.
- **Loan:** Rs 20,000 lent by Aarav to a friend, partly repaid.
- **Fund:** Sita's "Dashain shopping" with a target.

Numbers differ from the owner's real household (e.g. their dhuku is 12 × Rs 3,000). No closed
months, cushion entries or activity log rows are seeded.

## 3. `/demo` page and the in-app banner

### 3.1 `/demo` (public)

- Route `src/app/demo/page.tsx` → `DemoPage` in `src/modules/demo`. `src/proxy.ts` lets `/demo`
  through without a session (and doesn't bounce signed-in users away from it).
- Styled like the login page: brand on the left; "Try Piko" on the right with three lines —
  "Add an expense and watch your month update.", "See how a budget, savings pot and dhuku fit
  together.", "See both people's money, and what's shared." — then: "You get a private copy made
  just for you. Nobody else sees what you enter, and it's deleted after 24 hours."
- **Start the demo** (form + server action) → "Setting up your demo…" while pending.
- States: `?expired=1` "Your demo expired. Start a new one", busy "The demo is busy, try again
  later", `?bye=1` "Thanks for trying Piko", and for a signed-in real account "Starting the demo
  signs you out of your own household."

### 3.2 Banner (demo households only)

A thin bar at the top of the app layout:
`Demo · deleted in 17 h · Phone · Tour this page · Exit demo`.
"Tour this page" shows only on pages that have a tour. Real accounts render nothing.

### 3.3 Turned-off features explain themselves

Settings shows password and profile photo greyed out with "Not available in the demo"; the voice
button shows the same message when tapped.

## 4. The on-screen phone

### 4.1 Frame and placement

- A CSS phone (rounded body, notch, status bar with time and battery), about 390 × 800 px, scaled
  down to fit shorter windows. Starts closed.
- **Wide screens:** opens docked on the right; the main column narrows. Pages already lay out
  against their `@container`, so they adapt.
- **Narrow screens:** opens full-screen without the frame, with a Close button.

### 4.2 Screens

1. **Home** — "Recent expenses", grouped by day, with **Add by voice** and **Type it** at the
   bottom. The day-grouped list is extracted from `HomeView` into one shared component used by
   both the website's Home and the phone. Data comes from the expenses the app layout already
   loads (`listRecentExpensesForHousehold`).
2. **Voice** — a big mic and five phrase chips: "Momo with Sita, 450 rupees", "Petrol 1,500
   yesterday", "Sita paid 800 for the taxi", "Groceries 3,200, shared", "Phone recharge 500".
   Tapping one types the words out as if heard, shows
   "Understanding…" briefly, then opens the sheet filled in. Each phrase maps to a canned
   `ExpenseDraft` in `src/modules/demo/lib/voice-phrases.ts`; nothing goes to Gemini.
   "Type it instead" opens an empty sheet.
3. **Expense sheet** — the website's Add expense form (`ExpenseDialog`'s fields, exposed so they
   can render inside the phone instead of a modal), filled from the draft and editable. **Save**
   calls the same create action as the website; `router.refresh()` updates both the phone list and
   the page beside it.

## 5. Tours

- **Library:** driver.js, loaded with a dynamic import only for demo households. Popover styled
  with the app tokens (square corners, ink/paper, red accent); animated spotlight between steps.
- **Targets:** `data-tour="<id>"` attributes on the highlighted sections. Each step lists one or
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

`src/modules/demo/`:

- `pages/DemoPage.tsx`, `components/DemoStart.tsx` — the landing page.
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

**Vitest (pure):** the fixture builder (dates relative to today, correct BS months, totals, no
real names or emails); every voice phrase's draft passes the expense Zod schema; tour target
resolution (visible target chosen, missing skipped) and memory (seen / skip all / replay).

**Playwright (`e2e/demo.spec.ts`, against the e2e database):**

1. `/demo` opens signed out; Start lands on Home with the banner and Aarav & Sita's data.
2. **Safety:** expire a demo, start another; the expired one is gone, "E2E Household" and its two
   users are untouched.
3. Changing the password is refused by the server.
4. Phone: open, tap a phrase, save → the expense shows in the phone list and on the website's Home.
5. Tours: shown on first Home visit; after Skip all tours, Budget shows none; Tour this page replays.
6. Exit demo deletes the copy and returns to `/demo`.
7. A real account sees no banner and no tour.

**By hand before sharing:** a real phone and a laptop; paste the link in WhatsApp and confirm the
preview doesn't create a household.
