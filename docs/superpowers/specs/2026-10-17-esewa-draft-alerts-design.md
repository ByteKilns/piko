# eSewa draft alerts — design

Date: 2026-10-17. Status: agreed in discussion, awaiting spec review.
Builds on eSewa auto-capture (`docs/superpowers/plans/2026-10-14-esewa-capture.md`,
"eSewa capture" in `docs/architecture.md`).

## Goal

When an eSewa payment becomes a draft, the phone shows a Piko notification saying
so — with the amount and payee — even when Piko isn't open. When Piko sees an eSewa
notification it can't read, it says that too, so a missed payment is never silent.

Success: with Piko fully closed, an eSewa payment produces
"Draft: Rs 500 to Daraz — tap to review" within seconds (network permitting), and
tapping it opens the review screen.

## Background: why this needs more than a notification

Today, with Piko closed, the Kotlin listener only queues the raw notification
(`PendingStore`). Parsing, the duplicate check and the upload run in Dart, and only
when the app opens (`EsewaService.drainPending`). So no draft exists to announce
until the app is opened. This design runs that same Dart drain in the background.

A notification that only said "a payment was captured" (no amount, no parsing) was
considered and rejected: it can't say what was recorded, and it would fire for
messages that never become drafts.

## Also shipping in this release

Found while debugging capture on the owner's phone (2026-10-17): Android kept
notification access switched on but had stopped delivering to the listener;
switching access off and on fixed it. Already written (uncommitted, in
`mobile/android/.../EsewaNotificationListener.kt` and `MainActivity.kt`):

- `onListenerConnected` re-reads eSewa notifications still in the shade
  (`activeNotifications`), so payments posted while disconnected are caught unless
  swiped away. Safe to repeat: `capture_events` ignores a known key + postedAt, and
  drafts are de-duplicated (see Server below).
- `MainActivity.onResume` calls `requestRebind` when the listener isn't connected.
  Wrapped so a refused rebind can't stop the app opening.

## Flow

1. eSewa posts a notification. The listener appends it to `PendingStore` (unchanged).
2. If a Flutter engine with the UI is running (the bridge's event sink is set), the
   listener wakes it, as today. Otherwise it starts the **background engine**; if
   the background engine is already running, it just wakes it again (never two).
3. Whichever engine is running drains the queue with the existing
   `EsewaService.drainPending`, which now returns a **drain result**: the drafts it
   created and how many notifications it couldn't read.
4. The engine passes the result to the native **notifier**, which shows alerts unless
   a Piko screen is in the foreground.
5. The background engine shuts itself down when the drain finishes.

One processing path (the existing, tested Dart code) for both foreground and
background; the new parts are "run it headless" and "show the result".

## Components

### Android (Kotlin)

- **`EsewaNotificationListener`** — after `PendingStore.append`, calls
  `EsewaBridge.emit` if the UI engine is listening, else
  `EsewaBackgroundRunner.wake(context)`.
- **`EsewaBackgroundRunner`** (new) — owns at most one headless `FlutterEngine`.
  `wake`: if no engine, create one (plugins auto-register), register the
  `finance/esewa` channels on it, run the Dart entry point `esewaBackgroundMain`;
  if an engine exists, emit a wake event to it. Destroys the engine when Dart calls
  `finished`, or after a 60-second limit, whichever comes first. Anything not acked
  stays queued.
- **`EsewaBridge`** — the method channel gains `notify` (drain result → notifier),
  `finished` (background only), `notificationsAllowed`, and
  `requestNotificationPermission`. It must be registerable on more than one engine
  (UI and background); events go to the engine whose sink is set.
- **`DraftNotifier`** (new) — posts alerts on a channel "eSewa drafts" (default
  importance; the owner can switch it off in Android settings without affecting
  capture). Does nothing while `MainActivity` is resumed (Home's banner covers it).
  - Drafts alert, one fixed notification id, updated rather than stacked. Keeps a
    count of unseen drafts (SharedPreferences): count 1 →
    "Draft: Rs 500 to Daraz" / "Tap to review"; count > 1 →
    "N eSewa drafts to review". Payee missing → "Draft: Rs 500 eSewa payment".
    Tap → opens the review screen. The count resets, and the alert is cleared, when
    the review screen opens.
  - Couldn't-read alert, a second fixed id: "Piko couldn't read an eSewa
    notification" / "Tap to see it". Tap → opens Captured notifications.
- **`MainActivity`** — reads the tapped alert's target from the launch intent (and
  `onNewIntent`) and hands it to Dart (method `initialTarget` / an event), so the app
  opens on the review screen or Captured notifications.
- **Manifest** — `POST_NOTIFICATIONS` permission.

### Dart

- **`EsewaService.drainPending`** — returns a `DrainResult` (drafts created, count of
  couldn't-read) instead of `void`. A notification counts as couldn't-read only when
  it is not matched by `ParserRules.ignore` and `parser.parse` returns null. Credits
  (stored as skipped) are not drafts and raise no alert. Drafts the server reports as
  already existing are not counted. To make that possible, the parsed `Txn` carries
  its `RawEvent`'s id (`key@postedAt`, the same id `PendingStore` uses), and
  `TxnRepository.insert` returns whether the server created the draft.
- **`esewaBackgroundMain`** (new, `@pragma('vm:entry-point')`) — reads the token
  (`SecureTokenStorage`) and server URL (`SettingsService`); signed out → calls
  `finished` and stops (events stay queued). Otherwise builds `ApiClient`,
  `PikoTxnRepository` and `EsewaService` exactly as the providers do, drains, calls
  `notify` with the result, then `finished`. Never throws.
- **UI path** — wherever the UI drains (`start`, live events, resume), it also calls
  `notify` with the result; the notifier decides whether to show anything.
- **Opening from an alert** — on launch and on a new intent, navigate to the review
  screen or Captured notifications. Opening the review screen resets the draft
  count.
- **Settings → eSewa** — new row "Draft alerts: On / Off". Tap → Android's permission
  prompt, or Piko's app notification settings if previously denied. On Android 12
  and older it shows On (no runtime permission).
- **First ask** — the first time the app opens with notification access on and the
  permission not yet asked, it asks once. Denied → capture still works, no alerts.

### Server

- `captured_payments` gains `event_id` (text, nullable): the `PendingStore` id
  (`key@postedAt`) of the notification it came from, with a unique constraint on
  (`member_id`, `event_id`). Migration via `npm run db:generate`; existing rows stay
  null.
- `POST /api/mobile/captures` accepts `eventId` (optional) and inserts with
  `onConflictDoNothing`; the response says whether the draft is new
  (`created: true | false`). A duplicate returns the existing row so the app still
  has its id.
- Why: the app's duplicate check reads the server first, so two engines draining
  at once (app opened mid-background-run), or a retry after a lost ack, could both
  pass it. The unique key makes one draft per notification regardless.

## Failures

| What goes wrong | Result |
|---|---|
| Offline, server error, signed out | Event stays queued, no alert. Retried on the next eSewa notification or when Piko opens; alert then. |
| Android kills the background run | Queue untouched (acks only after the server has it); next attempt retries; the server keeps one draft. |
| Background run hangs | 60-second limit destroys the engine; unfinished events stay queued. |
| App opened mid-background-run | Both may drain; unique `event_id` → one draft, one alert. |
| Notification permission denied | Capture and drafts work; no alerts. Settings shows Off. |
| OEM background network limits (e.g. Xiaomi) | Drafts wait for app open. Covered by the existing Unrestricted battery + Autostart setup; verify on device. |

## Testing

- Dart (automated): `drainPending` result for a new draft, a repeat, an OTP (not
  couldn't-read), an unrecognised message (couldn't-read), a credit (no draft), a
  server failure (stays queued); `esewaBackgroundMain` with no token does nothing and
  calls `finished`; the repository passes `eventId` and honours `created: false`.
- Server (automated): the same `eventId` twice → one row, second response
  `created: false` with the existing id; a missing `eventId` behaves as today.
- Android (manual, checklist added to `mobile/README.md`): Piko closed → pay → alert
  with amount and payee → tap opens review; two payments → one combined alert;
  offline → pay → no alert → online and open Piko → draft present; Piko on screen →
  no alert, banner updates; unreadable message → couldn't-read alert → tap opens
  Captured notifications; permission denied → no alerts, capture still works.

## Release

Website first (migration + endpoint change; the old app ignores `created`, and a
missing `eventId` behaves as today), then app 1.4.0+6 (arm64 split APK) via
Settings → App updates. Docs: the "eSewa capture" section of `docs/architecture.md`
and the eSewa section of `mobile/README.md`.

## Out of scope

- Reading eSewa's Gmail notifications (decided 2026-10-17: not now; duplicates and a
  separate parser).
- Retrying on its own when the network returns (WorkManager); retries happen on the
  next eSewa notification or app open.
- Alerts for money coming in.
