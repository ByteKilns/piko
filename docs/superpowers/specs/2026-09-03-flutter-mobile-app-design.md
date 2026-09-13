# Flutter Mobile App — Design

**Date:** 2026-09-03
**Status:** Approved for planning

## Problem

Build the Flutter client for the voice-quick-add expense app described in
[2026-09-03-mobile-voice-expense-app-design.md](2026-09-03-mobile-voice-expense-app-design.md),
consuming the REST API implemented on `main` at
[2026-09-03-mobile-api.md](../plans/2026-09-03-mobile-api.md) (`POST /api/mobile/login`,
`GET /api/mobile/categories`, `POST /api/mobile/voice/parse`, `GET`/`POST
/api/mobile/expenses`). Distributed as a shared APK to two people — no
Play Store, no App Store.

## Scope

Android only. Voice-first quick-add plus a short recent-expenses list, a
settings screen for the (editable, not hardcoded) server URL, login, and
logout. No dashboard, budgets, reports, or editing/deleting past expenses —
those stay web-only, matching the original design doc's scope.

## App identity

- Name: **Piko**
- Android package id: `com.nirjal.piko`
- Launcher icon: a penguin emoji (🐧) centered on a solid purple background,
  generated as a flat PNG and wired up via `flutter_launcher_icons`.

## Tech stack

- **Flutter** (already installed locally: 3.44.6, Dart 3.12.2) — Android
  target only (`flutter create --platforms=android`).
- **State management: Riverpod** (`flutter_riverpod`) — auth state, settings
  state, and the recent-expenses list are exactly the kind of small,
  provider-scoped state Riverpod fits well, and it's more testable than
  scattering `StatefulWidget`s.
- **HTTP: the `http` package** — four endpoints, one bearer header, no need
  for `dio`'s interceptor/retry machinery.
- **Speech-to-text: `speech_to_text`** — wraps the OS recognizer (Google's
  on Android), mirroring how the web app's `VoiceEntryModal` already relies
  on the browser's Web Speech API rather than a server-side STT call.
- **Secure storage: `flutter_secure_storage`** — the bearer token only.
- **Local prefs: `shared_preferences`** — the server URL only (not
  sensitive, unlike the token).
- **Icon generation: `flutter_launcher_icons`** (dev dependency).

## Screens & navigation

A single `Navigator` with named routes (no need for `go_router` at this
size):

1. **Splash/bootstrap** (`/`) — reads the stored token (secure storage) and
   server URL (shared prefs) on cold start.
   - No URL saved → **Settings** (first-run case).
   - URL saved, no/invalid token → **Login**.
   - Both present → **Home**.
2. **Settings** (`/settings`) — one text field, the server URL, prefilled
   with `https://piko-kn.vercel.app` the very first time the app
   runs (still editable/overwritable), saved to `shared_preferences` on
   submit. A **Log out** button (visible only when a token is currently
   stored) clears the token from secure storage and returns to Login.
   Reachable from Home via a gear icon in the app bar.
3. **Login** (`/login`) — email + password fields → `POST {url}/api/mobile/login`.
   On success, store the returned token, navigate to Home. On failure, show
   the server's `error.message` inline. This screen is also where the app
   lands whenever `ApiClient` sees a 401 from any authenticated call (token
   cleared first, see Data & state below).
4. **Home** (`/home`) — a large centered mic button (primary action), a "+"
   button for manual entry, a gear icon (→ Settings) in the app bar, and a
   scrollable "recent expenses" list below the mic (`GET
   /api/mobile/expenses?limit=20`, pull-to-refresh).
5. **Listening** (a full-screen state pushed on top of Home, not a separate
   route) — `speech_to_text` streams a live partial transcript; a Stop
   button; a pulse animation on the mic icon while `isListening`.
6. **Parsing** (same overlay, different state) — "Understanding..." while
   `POST /api/mobile/voice/parse` is in flight.
7. **Confirm/Edit sheet** (a modal bottom sheet, not a route) — prefilled
   from the parsed `draft` (amount, category dropdown, paid-by dropdown,
   owner/shared dropdown, date picker, note field), every field editable.
   The same sheet, opened empty, is what "+" (manual entry) shows. **Save**
   → `POST /api/mobile/expenses` → a brief checkmark animation → sheet
   dismisses → the new expense is prepended to Home's list (optimistic
   update using the response body, no extra refetch needed).
8. **Not understood** (same overlay as Listening/Parsing, error state) —
   mirrors the web app's fallback exactly: shows the raw transcript,
   **Try again** (restart listening), **Retry parsing** (resend the same
   transcript), **Add manually** (opens the Confirm/Edit sheet empty).

## Data & state (Riverpod)

- `settingsProvider` (`StateNotifierProvider` or `NotifierProvider`) — holds
  the server URL string, backed by `shared_preferences`. Exposes `setUrl`.
- `authProvider` — holds the current token (or null), backed by
  `flutter_secure_storage`. Exposes `login(email, password)`,
  `logout()`, and a derived `isAuthenticated` bool.
- `ApiClient` — a plain class (not itself a provider's state, but obtained
  via a provider that reads `settingsProvider`/`authProvider`) wrapping
  `http`, attaching `Authorization: Bearer <token>` to every call except
  login, and centrally handling a `401` response: on any 401, it clears the
  token via `authProvider.logout()` and the app's root navigator listens for
  `isAuthenticated` flipping to false to pop back to Login from wherever the
  user currently is. Every response body's error shape is the API's
  standardized `{ error: { message, fields? } }` — the client surfaces
  `error.message` directly to the UI.
- `recentExpensesProvider` (`FutureProvider`, refreshable via `ref.invalidate`)
  — backs Home's list; pull-to-refresh calls `ref.refresh`.
- `categoriesProvider` (`FutureProvider`) — backs the Confirm/Edit sheet's
  dropdowns; fetched once per app session (cached), refreshed only if the
  sheet is opened and the cached value is empty/stale-looking.

## Error handling

- **Mic permission denied** — inline message + a button that opens the OS
  app-settings page (`permission_handler` or `speech_to_text`'s own
  permission check) so the user can grant it without reinstalling.
- **No server URL set** — Splash routes to Settings before anything else is
  reachable; Settings won't let you leave with an empty field.
- **Network error** on any call — inline retry affordance; specifically for
  the Confirm/Edit sheet's Save, the sheet stays open with the filled-in
  values intact so nothing typed is lost.
- **401 from any call** — handled centrally in `ApiClient` as described
  above, not duplicated per-screen.
- **Speech recognition unavailable/unsupported on this device** — same
  message pattern as mic-denied, with a direct path to "Add manually."

## Testing

- **Widget test** for the Confirm/Edit sheet's validation (amount required
  and positive; category and paid-by required before Save is enabled) —
  Flutter's `flutter_test` + `WidgetTester`, analogous to how the web app
  unit-tests its pure validation logic (`sanitize-voice-expense.test.ts`)
  even though this is a widget test rather than a pure-function test, since
  Flutter's validation here is tied to form-field state.
- **Manual smoke test** on a real Android device for: voice capture → parse
  → confirm → save end-to-end against the real deployed API; the full
  settings → login → logout → login-again loop; and the "not understood"
  fallback path. STT quality and OS permission dialogs aren't meaningfully
  unit-testable.

## Out of scope (v1)

Same exclusions as the original design doc — dashboard, budgets, reports,
recurring, loans, savings goals, categories management, notifications,
editing/deleting past expenses from mobile, offline queueing, push
notifications. Additionally for this plan specifically: no iOS build, no
Play Store listing (APK shared directly), no app-icon variants beyond the
one generated penguin icon, no dark-mode-specific design pass (Flutter's
default Material theming is acceptable for v1).
