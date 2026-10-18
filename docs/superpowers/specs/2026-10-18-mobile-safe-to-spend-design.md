# Safe to spend on the phone's Home — design

Approved in conversation with the owner on 2026-10-18 (sections 1–3 below, each confirmed).

## Why

The phone's Home shows recent expenses and eSewa drafts, but nothing answers "can I afford this?" at the moment the phone is in hand. The website's Home already answers it with **Safe to spend today**, worked out from the person's **Can cut** budget lines (lunches out, shopping, dates…):
1. Those lines are split into weekly allowances.
2. Whatever another line went over comes out of them.
3. What's left of this week is spread over the days remaining in it.

The owner mostly pays with eSewa, so drafts arrive on their own. The figure is what's missing.

## What the owner decided

- **The website's own figure**, not a simpler "left this month". The phone and the website must never disagree.
- **A hero at the top of the phone's Home**, above the eSewa banner and Recent expenses, like the website's Home.

## 1. What the phone shows

- **The hero, at the top of Home above the eSewa banner:**
  - the label "SAFE TO SPEND TODAY";
  - beside it a status: **■ On track** (ink square) or **■ Over budget** (red square, red text);
  - the figure in large type (`MoneyText`), e.g. Rs 640;
  - one line under it, worded as on the website:
    - on track: "Spend up to this today on things you can cut and the week stays on plan."
    - over: "This week's allowance is fully spent. A new weekly allowance of Rs 2,100 starts on Sunday." When there's no next weekday: "…starts on the next week".
  - When another line went over and was taken from the can-cut money, the website's overrun note follows in small red text.
- **No Can cut lines:** one quiet line in the hero's place, "Mark budget lines as Can cut on the website's Budget page to see what's safe to spend each day." No button.
- **Loading:**
  - The first time, the stepping squares (`StepSquares`) take the hero's place.
  - On a refresh the old figure stays until the new one arrives, then cross-fades (`AnimatedSwitcher`, like the drafts banner's count). Nothing jumps.
  - Android's "Remove animations" setting is respected.
- **Offline or the server fails:** the last figure stays if there is one; otherwise the hero is hidden. Home stays usable.
- **Refreshes:** when Piko opens; when it comes back to the front; on pull to refresh; after an expense is saved from Add expense or voice; after returning from the Review screen (approved drafts count as spending).

## 2. The server

- **One shared calculation.** The pacing block in `src/modules/dashboard/pages/DashboardPage.tsx` moves into a pure function in `src/modules/dashboard/lib/` (`viewerPacing`):
  - It covers can-cut lines, overrun, schedule, week pacing and the `HomePacing` fields, and returns `HomePacing | null` (null without Can cut lines).
  - `weekdayOf` moves with it.
  - The website's Home calls it and shows the same values as today.
- **The person's spending.** The step in `personMonthMoney` that builds their spending (`payRows` → `walletShares` for that member) becomes its own exported function. `personMonthMoney` and the phone's endpoint both use it, so Home's month figures and the pacing can't drift apart.
- **`GET /api/mobile/pacing`:**
  - It uses `requireMobileAuth`; the household and member come from the sign-in, never from the request (golden rule).
  - It loads only what `viewerPacing` needs for the current month in the household's calendar (`getDateFormatPref`, `currentPeriodYearMonth`): categories, the person's plan lines, the month's expenses, and the household's members.
  - Queries take the household id explicitly. `listExpensesForMonth` reads the website session itself, so the endpoint uses (or adds) a household-scoped equivalent, as the other `/api/mobile` routes do.
  - It returns 200 `{ pacing: HomePacing | null }`, or 401 without a valid token.
  - It always shows the signed-in person: the website's "view as partner" doesn't apply on the phone.
  - Nothing goes to any AI (privacy rule).
- **Tests (Vitest):**
  - `viewerPacing`: on track; over budget, with the next allowance and weekday; no Can cut lines → null; another line's overrun reduces the figure and sets the note. Each runs on the same inputs as the existing pacing tests.
  - The extracted spending function gives the same result `personMonthMoney` gave.
  - The endpoint: 401 without a sign-in; the signed-in member's figure (queries scoped to their household and member); `{ pacing: null }` without Can cut lines.

## 3. The app

- **Model:** `Pacing` (`lib/models/pacing.dart`), read from the endpoint's `pacing`.
- **API:** `ApiClient.fetchPacing()` returns `Future<Pacing?>`. It throws `ApiException` on failure, like the other calls.
- **Provider:** `pacingProvider`, a `FutureProvider.autoDispose<Pacing?>`. Home invalidates it on resume, on pull to refresh, after saving an expense, and after the Review screen closes.
- **Widget:** `SafeToSpendHero` (`lib/widgets/`), built from the provider's state, with the states in section 1.
- **Home:** the hero is the first item in Home's list, above the update banner and the eSewa strip.
- **Tests (flutter_test):**
  - the model parses the reply, including `null`;
  - `fetchPacing` sends the right request (MockClient), and a server error throws;
  - the hero: on track, over (next allowance and weekday), the overrun note, no Can cut lines, the squares while loading, hidden on a first-load error, and the last figure kept on a later error;
  - Home: the hero sits above the eSewa strip; saving an expense refreshes it.
- **Release:** app version `1.5.0+8`. The website (new endpoint) deploys first, then the APK. With the release button in place, its readiness check enforces that.

## Out of scope

- The website's `/demo` phone.
- Changing how Safe to spend is calculated, or showing a "left this month" figure.
- Showing a partner's figure on the phone.
