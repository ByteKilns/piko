# eSewa Draft Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. If you don't have those skills, do the tasks in order, one step at a time. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When an eSewa payment becomes a draft, the phone shows a Piko notification saying so, with the amount and payee, even when Piko isn't open; and when Piko sees an eSewa notification it can't read, it says that too.

**Architecture:** Six tasks on one branch. Task 1 is the website: each captured payment remembers which phone notification it came from (`captured_payments.event_id`, unique per member), so two drains at once can't make two drafts, and `POST /api/mobile/captures` says whether the draft is new. Tasks 2–3 are Dart: drafts carry their notification id, a drain returns a `DrainResult` (new drafts, unreadable notifications) and hands it to the native notifier, and a background entry point (`esewaBackgroundMain`) runs that same drain with no UI. Task 4 is Android: when no Piko screen is listening, the notification listener starts a headless Flutter engine running that entry point; a `DraftNotifier` shows the alerts; the listener also reconnects and catches up on notifications still in the shade. Task 5 is the app screens: open the review screen or Captured notifications from a tapped alert, a "Draft alerts" row in Settings, and a one-time permission prompt. Task 6 is docs and the release number. Each task is one commit that leaves everything building with every test passing.

**Tech Stack:** Next.js 16 route handlers, Drizzle ORM (PostgreSQL), Zod 4, Vitest; Flutter 3.44 / Dart 3.12, flutter_riverpod 2, http, flutter_test; Kotlin (Android `NotificationListenerService`, `FlutterEngine`, platform `Notification` APIs); Husky pre-commit hook (`tsc` + `next build`).

**Spec:** `docs/superpowers/specs/2026-10-17-esewa-draft-alerts-design.md` (approved by the owner on 2026-10-17). Read it before starting. The capture feature this builds on is described in the "eSewa capture" section of `docs/architecture.md` and in `docs/superpowers/plans/2026-10-14-esewa-capture.md`.

**Verified:** on 2026-10-17 this plan was built first, then written from that build:
- **Dry run:** built in a throwaway copy of the repo from `main` at `d175052`. Each of the six commits went through the real pre-commit hook (`tsc` and a full `next build`).
- **Replay:** this file was then followed step by step in a fresh copy of `main` at `d175052`. Every step applied cleanly in order; each task's new tests failed first with the errors its "verify it fails" step shows, then passed; and after each task the code matched the dry run file for file. Only the generated migration's file name and the `drizzle/meta` ids differ.
- **Test counts after each task:** web 474 → 478 (Task 1); app 154 → 170, 173, 173, 179, 179 (Tasks 2–6). `flutter analyze` clean throughout. Each task's new tests failed first, as its "verify it fails" step says, then passed.
- **The server change was exercised against a throwaway PostgreSQL** with every migration applied (never the real database): the same notification twice → one row, the second call `created: false` with the first row's id; two calls at once → one row, one `created: true`; the same notification id for a different member → its own row; captures without a notification id → a new row each time.
- `flutter build apk --release --split-per-abi` built all three APKs (arm64: 18.2 MB). The `POST_NOTIFICATIONS` permission is in the merged release manifest, and `esewaBackgroundMain` is present in the release build's compiled Dart (`libapp.so`), so the release build's tree shaking kept it.
- **Not run:** anything on a real phone: the background engine starting, the alerts appearing, tapping them, the permission prompt, the listener reconnecting. Those are the owner's checks at the final STOP, using the checklist Task 6 adds to `mobile/README.md`.

If a step doesn't match what you see, something has changed since then. Stop and report rather than improvise.

## Global Constraints

- No new packages, in either app. Alerts use Android's own `Notification` APIs from Kotlin; the background run uses Flutter's own `FlutterEngine`. Don't add `flutter_local_notifications`, `workmanager` or similar.
- Android `minSdk` is 24 (Flutter's default). Anything newer is guarded with `Build.VERSION.SDK_INT` checks, as in the code below.
- Alert text, exactly: `Draft: <line>` / `Tap to review` for one draft; `<N> eSewa drafts to review` / `Latest: <line>` for more; `Piko couldn't read an eSewa notification` / `Tap to see it`. `<line>` is `Rs 500 to Daraz`, `Rs 1,250.50 to Daraz`, or `Rs 500 eSewa payment` when there's no payee. Notification channel name: `eSewa drafts`.
- Every server query stays scoped by the signed-in member's household and member, taken from their sign-in (`requireMobileAuth`), never from the request (`AGENTS.md`, golden rule).
- Nothing from a notification goes to any AI (`AGENTS.md`, privacy rule). This plan adds none.
- Release: app version `1.4.0+6`. Build numbers stay below 1000. Publish the arm64 split APK.
- **Never run `npm run db:migrate`** and never point anything at the real database. The owner migrates at the final STOP.
- Imports, object keys and JSX props stay in the order ESLint enforces (`npm run lint -- --fix` fixes it). Dart files keep the existing style; `flutter analyze` must report no issues.

## Review Focus

Behaviour the spec implies that no automated test in this plan can reach, because it only happens on a real phone. Each line names where it is checked instead.

1. **Piko fully closed (swiped away) when a payment arrives** → the background engine starts, the draft is made and "Draft: Rs … to …" appears within seconds. Checked by step 1 of the phone checklist (Task 6).
2. **A second payment while the background run is finishing** → it isn't left waiting until Piko opens: the runner sees the wake-up count changed during the run and runs once more (`EsewaBackgroundRunner.finished`). Checked by step 2 of the phone checklist ("2 eSewa drafts to review").
3. **Piko on screen when a payment arrives** → no alert, and Home's banner updates: `DraftNotifier.appVisible` is set in `MainActivity.onResume`/`onPause`. Checked by step 4 of the phone checklist.
4. **Tapping an alert while Piko is already running on another screen** → `onNewIntent` stores the intent and Home's resume handler opens the target on top. Checked by steps 1 and 5 of the phone checklist (try once with Piko in recent apps).
5. **Notifications denied or switched off for Piko** → capture and drafts still work, only the alerts are missing; Settings shows Draft alerts Off. Checked by step 6 of the phone checklist.

The Dart side of each of these is covered by tests in Tasks 2, 3 and 5 (drain results, the background run signed in / signed out / server down, tapped-alert targets, clearing the drafts alert).

## How to use this plan

- Do the tasks **in order**, 1 → 6. There is one **STOP checkpoint**, at the end: stop, send the owner the report it describes, and wait for them.
- Code blocks are complete. Every code step is one of these kinds:
  - **"Create `path` with:"** — a new file; paste the whole block.
  - **"Replace the whole of `path` with:"** — overwrite the file with the whole block.
  - **"In `path`, find:" … "Replace it with:"** — find the exact old text (match by text, not line number) and replace it with the new text. Each old block occurs exactly once in the file at that point. When a file has several, they're numbered "(1 of 3)" and so on; do them in that order. A block's last line break isn't part of the text: some old blocks end in the middle of a line, and the rest of that line stays as it is.
- Before Task 1, create the branch once from `main`: `git switch -c feat/esewa-draft-alerts`. Every task commits to that branch.
- Flutter commands must run inside `mobile/`. Each one is written as `cd mobile; <command>; cd ..` so you end up back at the repo root, where every other command runs.
- `esewa_capture.zip` in the repo root is unrelated to this plan. **Don't commit it and don't delete it.**
- The pre-commit hook runs `npx tsc --noEmit` and `npm run build` (15–25 s). Never bypass it with `--no-verify`; if it fails, fix the cause.

---

### Task 1: One draft per phone notification (website)

The app can drain the phone's queue from two places at once (the open app and the background engine), and both can pass the app's duplicate check before either has stored the draft. The server becomes the one place that decides: each captured payment stores the id of the notification it came from, unique per member, and the endpoint says whether the draft is new so the app alerts only once.

**Files:**
- Modify: `src/db/schema/captures.ts` (the `captured_payments` table)
- Modify: `src/modules/captures/schemas/capture.schema.ts` (`captureSchema`)
- Modify: `src/modules/captures/api/captures.ts` (`insertCaptureForMember`)
- Modify: `src/app/api/mobile/captures/route.ts` (`POST`)
- Create: `drizzle/0028_<generated name>.sql` and `drizzle/meta/0028_snapshot.json` (generated), `drizzle/meta/_journal.json` (generated change)
- Test: `src/app/api/mobile/captures/route.test.ts` (new), `src/modules/captures/lib/captures.test.ts`

**Interfaces:**
- Produces: `captured_payments.event_id` (text, nullable), unique on (`member_id`, `event_id`). `captureSchema` accepts an optional `eventId` (non-empty string). `insertCaptureForMember(member, input)` returns `{ created: boolean; row }` (it returned `row`). `POST /api/mobile/captures` replies `{ capture, created }`, with status 201 when created and 200 when the notification was already stored. `captureJson` is unchanged (it does not send `eventId`).

- [ ] **Step 1: Write the failing tests**

In `src/modules/captures/lib/captures.test.ts`, find (1 of 2):

```ts
    direction: "debit" as const,
    expenseId: null,
```

Replace it with:

```ts
    direction: "debit" as const,
    eventId: "0|com.f1soft.esewa|7|null|10123@1792036530250",
    expenseId: null,
```

In `src/modules/captures/lib/captures.test.ts`, find (2 of 2):

```ts
  it("leaves out who captured it and which household it belongs to", () => {
    const json = captureJson(row);
    expect(json).not.toHaveProperty("householdId");
    expect(json).not.toHaveProperty("memberId");
  });
```

Replace it with:

```ts
  it("leaves out who captured it, which household it belongs to and the notification id", () => {
    const json = captureJson(row);
    expect(json).not.toHaveProperty("householdId");
    expect(json).not.toHaveProperty("memberId");
    expect(json).not.toHaveProperty("eventId");
  });
```

Create `src/app/api/mobile/captures/route.test.ts` with:

```ts
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { insertCaptureForMember } from "@/modules/captures/api/captures";

import { POST } from "./route";

vi.mock("@/lib/mobile-request", () => ({
  requireMobileAuth: vi.fn(async () => ({ householdId: "h1", memberId: "m1" })),
}));
vi.mock("@/modules/captures/api/captures", () => ({
  insertCaptureForMember: vi.fn(),
  listDraftCapturesForMember: vi.fn(),
}));

const row = {
  amount: "500.00",
  category: "Shopping",
  categoryConfidence: 0.8,
  counterparty: "Daraz",
  createdAt: new Date("2026-10-17T06:00:00.000Z"),
  direction: "debit" as const,
  eventId: "0|com.f1soft.esewa|7|null|10123@1792036530250",
  expenseId: null,
  householdId: "h1",
  id: "c1",
  kind: "payment",
  memberId: "m1",
  occurredAt: new Date("2026-10-17T05:55:30.250Z"),
  rawText: "You have paid Rs. 500 to Daraz",
  refId: null,
  source: "notification",
  status: "draft" as const,
  updatedAt: new Date("2026-10-17T06:00:00.000Z"),
};

const capture = {
  amount: 500,
  category: "Shopping",
  categoryConfidence: 0.8,
  counterparty: "Daraz",
  direction: "debit",
  eventId: row.eventId,
  kind: "payment",
  occurredAt: "2026-10-17T05:55:30.250Z",
  rawText: "You have paid Rs. 500 to Daraz",
  refId: null,
  source: "notification",
};

function post(body: unknown) {
  return POST(new NextRequest("https://piko.test/api/mobile/captures", { body: JSON.stringify(body), method: "POST" }));
}

describe("POST /api/mobile/captures", () => {
  beforeEach(() => vi.mocked(insertCaptureForMember).mockReset());

  it("stores a new capture with its notification id and says it was created", async () => {
    vi.mocked(insertCaptureForMember).mockResolvedValue({ created: true, row });

    const response = await post(capture);

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ capture: { id: "c1" }, created: true });
    expect(vi.mocked(insertCaptureForMember).mock.calls[0][1]).toMatchObject({ eventId: row.eventId });
  });

  it("returns the stored capture with created false when the notification was already stored", async () => {
    vi.mocked(insertCaptureForMember).mockResolvedValue({ created: false, row });

    const response = await post(capture);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ capture: { id: "c1" }, created: false });
  });

  it("still accepts a capture without a notification id, from older app versions", async () => {
    vi.mocked(insertCaptureForMember).mockResolvedValue({ created: true, row: { ...row, eventId: null } });
    // JSON leaves out undefined, as an older app sends no eventId at all.
    const response = await post({ ...capture, eventId: undefined });

    expect(response.status).toBe(201);
    expect(vi.mocked(insertCaptureForMember).mock.calls[0][1].eventId).toBeUndefined();
  });

  it("rejects an empty notification id", async () => {
    const response = await post({ ...capture, eventId: "" });

    expect(response.status).toBe(400);
    expect(insertCaptureForMember).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/api/mobile/captures src/modules/captures`
Expected: FAIL — all 4 tests in `route.test.ts` fail. The first three with `TypeError: Cannot read properties of undefined (reading 'toISOString')`, because the route still expects a bare row; "rejects an empty notification id" because `captureSchema` doesn't know `eventId` yet. `captures.test.ts` still passes.

- [ ] **Step 3: Add the column, accept the id, and report whether the draft is new**

In `src/db/schema/captures.ts`, find:

```ts
    expenseId: uuid("expense_id").references(() => expenses.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("captured_payments_member_occurred_idx").on(table.memberId, table.occurredAt)],
);
```

Replace it with:

```ts
    expenseId: uuid("expense_id").references(() => expenses.id, { onDelete: "set null" }),
    // The phone notification it was read from (the app's "key@postedAt"), so
    // the same notification can't become two drafts. Null on older rows.
    eventId: text("event_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("captured_payments_member_occurred_idx").on(table.memberId, table.occurredAt),
    unique().on(table.memberId, table.eventId),
  ],
);
```

In `src/modules/captures/schemas/capture.schema.ts`, find:

```ts
  direction: z.enum(["debit", "credit"]),
  kind: z.enum(kinds),
```

Replace it with:

```ts
  direction: z.enum(["debit", "credit"]),
  // Which phone notification it came from; older app versions don't send it.
  eventId: z.string().min(1).optional(),
  kind: z.enum(kinds),
```

In `src/modules/captures/api/captures.ts`, find (1 of 2):

```ts
export async function insertCaptureForMember(member: CurrentMember, input: CaptureInput) {
  const [row] = await db
    .insert(capturedPayments)
    .values({
      amount: String(input.amount),
      category: input.category,
      categoryConfidence: input.categoryConfidence,
      counterparty: input.counterparty,
      direction: input.direction,
      householdId: member.householdId,
```

Replace it with:

```ts
// `created` is false when this notification was already stored (two drains
// at once, or a retry after a lost reply); the stored row comes back instead.
export async function insertCaptureForMember(member: CurrentMember, input: CaptureInput) {
  const [row] = await db
    .insert(capturedPayments)
    .values({
      amount: String(input.amount),
      category: input.category,
      categoryConfidence: input.categoryConfidence,
      counterparty: input.counterparty,
      direction: input.direction,
      eventId: input.eventId,
      householdId: member.householdId,
```

In `src/modules/captures/api/captures.ts`, find (2 of 2):

```ts
      status: captureStatusFor(input.direction),
    })
    .returning();
  return row;
}
```

Replace it with:

```ts
      status: captureStatusFor(input.direction),
    })
    .onConflictDoNothing({ target: [capturedPayments.memberId, capturedPayments.eventId] })
    .returning();
  if (row) return { created: true, row };

  // Only a known eventId conflicts (rows without one never do).
  const [existing] = await db
    .select()
    .from(capturedPayments)
    .where(and(ownedBy(member), eq(capturedPayments.eventId, input.eventId ?? "")));
  return { created: false, row: existing };
}
```

In `src/app/api/mobile/captures/route.ts`, find (1 of 2):

```ts
// A transaction the app parsed from a notification. Money going out becomes a
// draft; money coming in is kept as skipped.
```

Replace it with:

```ts
// A transaction the app parsed from a notification. Money going out becomes a
// draft; money coming in is kept as skipped. A notification already stored
// comes back as it is, with `created: false`, so the app alerts only once.
```

In `src/app/api/mobile/captures/route.ts`, find (2 of 2):

```ts
  const row = await insertCaptureForMember(auth, parsed.data);
  return NextResponse.json({ capture: captureJson(row) }, { status: 201 });
```

Replace it with:

```ts
  const { created, row } = await insertCaptureForMember(auth, parsed.data);
  return NextResponse.json({ capture: captureJson(row), created }, { status: created ? 201 : 200 });
```

- [ ] **Step 4: Generate the migration**

Run: `npm run db:generate`
Expected: a new file `drizzle/0028_<random name>.sql` (the name is random), a new `drizzle/meta/0028_snapshot.json`, and a changed `drizzle/meta/_journal.json`. The SQL file must contain exactly:

```sql
ALTER TABLE "captured_payments" ADD COLUMN "event_id" text;--> statement-breakpoint
ALTER TABLE "captured_payments" ADD CONSTRAINT "captured_payments_member_id_event_id_unique" UNIQUE("member_id","event_id");
```

Generating doesn't connect to a database. Don't run `npm run db:migrate`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run`
Expected: PASS — `Tests  478 passed (478)`.

Run: `npm run lint`
Expected: `0 errors`. Two warnings, in `NepaliDateField.tsx` and `ExpenseDialog.tsx`, were there before this plan; leave them.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema/captures.ts src/modules/captures src/app/api/mobile/captures drizzle
git commit -m "feat(captures): one draft per phone notification, and say whether it was new"
```

---

### Task 2: Drafts remember their notification, and a drain reports what it made (app)

**Files:**
- Modify: `mobile/lib/esewa/models.dart` (`RawEvent.id`, `Txn.eventId`)
- Modify: `mobile/lib/esewa/parser.dart` (`parse` sets `eventId`; new `isUnreadable`)
- Modify: `mobile/lib/services/api_client.dart` (`createCapture` returns the id and `created`)
- Modify: `mobile/lib/esewa/piko_txn_repository.dart` (`insert` sends `eventId`, returns `created`)
- Modify: `mobile/lib/esewa/esewa_service.dart` (`TxnRepository.insert` returns `bool`; new `DrainResult`; `drainPending` returns it and calls `notify`; new `idle`)
- Test: `mobile/test/esewa/esewa_service_test.dart`, `mobile/test/esewa/piko_txn_repository_test.dart`, `mobile/test/esewa_parser_test.dart`

**Interfaces:**
- Consumes: Task 1's `POST /api/mobile/captures` reply `{ capture: { id, ... }, created }`.
- Produces:
  - `RawEvent.id` (`String`, `''` when not from the phone queue), read from the queue event's `id` (`key@postedAt`).
  - `Txn.eventId` (`String?`), set by `EsewaParser.parse` from `RawEvent.id`.
  - `EsewaParser.isUnreadable(RawEvent e) → bool`: not on the ignore list, not empty, and `parse` finds no payment.
  - `ApiClient.createCapture(Map) → Future<({String id, bool created})>`; a reply without `created` counts as created.
  - `TxnRepository.insert(Txn) → Future<bool>` (false: the server already had this notification).
  - `class DrainResult { List<Txn> drafts; int unreadable; bool isEmpty; Map<String, Object> toJson(); static String draftLine(Txn) }`. `toJson()` is `{'drafts': [line, ...], 'unreadable': n}`, which is what the native `notify` method receives in Task 4.
  - `EsewaService.drainPending() → Future<DrainResult>`; after a drain that made anything, it calls the method `notify` on channel `finance/esewa` with `result.toJson()`.
  - `EsewaService.idle() → Future<void>`: completes when no drain is running or queued.
  - `EsewaService.ingest` now returns null when the server already had the draft.

- [ ] **Step 1: Write the failing tests**

In `mobile/test/esewa/esewa_service_test.dart`, find (1 of 7):

```dart
// Stores captures in memory; `offline` makes every write fail, like a phone with no data.
class _MemoryRepo implements TxnRepository {
  final txns = <Txn>[];
  final raws = <RawEvent>[];
  bool offline = false;
```

Replace it with:

```dart
// Stores captures in memory; `offline` makes every write fail, like a phone with no data.
// Like the server, it keeps one capture per notification (eventId).
class _MemoryRepo implements TxnRepository {
  final txns = <Txn>[];
  final raws = <RawEvent>[];
  bool offline = false;
```

In `mobile/test/esewa/esewa_service_test.dart`, find (2 of 7):

```dart
  @override
  Future<void> insert(Txn t) async {
    _write();
    txns.add(t);
  }
```

Replace it with:

```dart
  @override
  Future<bool> insert(Txn t) async {
    _write();
    if (t.eventId != null && txns.any((s) => s.eventId == t.eventId)) return false;
    txns.add(t);
    return true;
  }
```

In `mobile/test/esewa/esewa_service_test.dart`, find (3 of 7):

```dart
  // The native queue: events stay until Dart acks them.
  late List<Map<String, Object>> queue;
  late List<String> acked;
```

Replace it with:

```dart
  // The native queue: events stay until Dart acks them.
  late List<Map<String, Object>> queue;
  late List<String> acked;
  // What Dart asked the native notifier to show.
  late List<Map<Object?, Object?>> notified;
```

In `mobile/test/esewa/esewa_service_test.dart`, find (4 of 7):

```dart
  setUp(() {
    queue = [];
    acked = [];
```

Replace it with:

```dart
  setUp(() {
    queue = [];
    acked = [];
    notified = [];
```

In `mobile/test/esewa/esewa_service_test.dart`, find (5 of 7):

```dart
          queue.removeWhere((e) => ids.contains(e['id']));
          return null;
      }
```

Replace it with:

```dart
          queue.removeWhere((e) => ids.contains(e['id']));
          return null;
        case 'notify':
          notified.add(call.arguments as Map<Object?, Object?>);
          return null;
      }
```

In `mobile/test/esewa/esewa_service_test.dart`, find (6 of 7):

```dart
  test('acks notifications that are not payments, keeping them in the log', () async {
```

Replace it with:

```dart
  test('reports the new drafts and asks the notifier to alert with one line each', () async {
    final repo = _MemoryRepo();
    queue.addAll([
      event('a', 'You have paid Rs. 1,250.50 to Daraz.', 0),
      event('b', 'You have received Rs. 200 from Ram.', 5),
      event('c', 'You have paid Rs. 120 to Ncell.', 10),
    ]);

    final result = await serviceWith(repo).drainPending();

    // Money coming in is stored but isn't a draft, so it isn't announced.
    expect(result.drafts.map((t) => t.amount), [1250.5, 120]);
    expect(result.unreadable, 0);
    expect(notified, [
      {
        'drafts': ['Rs 1,250.50 to Daraz', 'Rs 120 to Ncell'],
        'unreadable': 0,
      },
    ]);
  });

  test('gives each draft the id of the notification it came from', () async {
    final repo = _MemoryRepo();
    queue.add(event('k@1', 'You have paid Rs. 500 to Daraz.', 0));

    await serviceWith(repo).drainPending();

    expect(repo.txns.single.eventId, 'k@1');
  });

  test('counts a message it could not read, but not an OTP or login message', () async {
    final repo = _MemoryRepo();
    queue.addAll([
      event('low', 'Your eSewa balance is low. Load fund now.', 0),
      event('otp', 'Your OTP for payment of Rs. 500 is 123456', 1),
      event('login', 'New login to your eSewa account', 2),
    ]);

    final result = await serviceWith(repo).drainPending();

    expect(result.drafts, isEmpty);
    expect(result.unreadable, 1);
    expect(notified, [
      {'drafts': <String>[], 'unreadable': 1},
    ]);
    expect(acked, ['low', 'otp', 'login']);
  });

  test('a draft the server already had is acked but not announced again', () async {
    final repo = _MemoryRepo();
    // Another drain (the app and the background at once) stored it first.
    repo.txns.add(Txn(
      amount: 500,
      direction: TxnDirection.debit,
      kind: TxnKind.payment,
      occurredAt: DateTime(2026, 10, 14, 9),
      source: 'notification',
      rawText: 'earlier',
      eventId: 'a',
    ));
    queue.add(event('a', 'You have paid Rs. 500 to Daraz.', 0));

    final result = await serviceWith(repo).drainPending();

    expect(repo.txns, hasLength(1));
    expect(result.isEmpty, isTrue);
    expect(notified, isEmpty);
    expect(acked, ['a']);
  });

  test('does not alert when nothing new was stored, including when offline', () async {
    final repo = _MemoryRepo()..offline = true;
    queue.add(event('a', 'You have paid Rs. 500 to Daraz.', 0));

    final result = await serviceWith(repo).drainPending();

    expect(result.isEmpty, isTrue);
    expect(notified, isEmpty);
  });

  test('idle waits for a drain that starts while another is running', () async {
    final repo = _MemoryRepo();
    queue.add(event('a', 'You have paid Rs. 500 to Daraz.', 0));
    final service = serviceWith(repo);

    final first = service.drainPending();
    queue.add(event('b', 'You have paid Rs. 120 to Ncell.', 10));
    unawaited(service.drainPending());
    await service.idle();

    await first;
    expect(repo.txns, hasLength(2));
  });

  group('DrainResult.draftLine', () {
    Txn paid(double amount, String? payee) => Txn(
          amount: amount,
          direction: TxnDirection.debit,
          kind: TxnKind.payment,
          occurredAt: DateTime(2026, 10, 14),
          source: 'notification',
          rawText: '',
          counterparty: payee,
        );

    test('whole rupees without paisa, grouped', () {
      expect(DrainResult.draftLine(paid(12500, 'Daraz')), 'Rs 12,500 to Daraz');
    });

    test('paisa when there are any', () {
      expect(DrainResult.draftLine(paid(99.5, 'Pathao')), 'Rs 99.50 to Pathao');
    });

    test('no payee', () {
      expect(DrainResult.draftLine(paid(500, null)), 'Rs 500 eSewa payment');
    });
  });

  test('acks notifications that are not payments, keeping them in the log', () async {
```

In `mobile/test/esewa/esewa_service_test.dart`, find (7 of 7):

```dart
import 'dart:convert';
```

Replace it with:

```dart
import 'dart:async';
import 'dart:convert';
```

In `mobile/test/esewa/piko_txn_repository_test.dart`, find:

```dart
  test('approving files it for and paid by me, on the day it was paid, with the payee as the note', () async {
```

Replace it with:

```dart
  test('sends the notification id and reports a capture the server stored now', () async {
    final t = Txn(
      amount: 500,
      direction: TxnDirection.debit,
      kind: TxnKind.payment,
      occurredAt: DateTime(2026, 10, 14, 12),
      source: 'notification',
      rawText: 'You have paid Rs. 500 to Daraz',
      eventId: 'k@1792036530250',
    );
    replies['/api/mobile/captures'] = {
      'capture': {'id': 'cap-1'},
      'created': true,
    };

    expect(await repo().insert(t), isTrue);
    expect(bodyOf('/api/mobile/captures')['eventId'], 'k@1792036530250');
  });

  test('reports a capture the server already had, and still knows its id', () async {
    final r = repo();
    final t = paid();
    replies['/api/mobile/captures'] = {
      'capture': {'id': 'cap-1'},
      'created': false,
    };

    expect(await r.insert(t), isFalse);
    t.status = TxnStatus.rejected;
    await r.update(t);
    expect(bodyOf('/api/mobile/captures/reject'), {'id': 'cap-1'});
  });

  test('leaves the notification id out when there is none, and an older server means stored', () async {
    // The default reply has no `created`, like the server before this change.
    expect(await repo().insert(paid()), isTrue);
    expect(bodyOf('/api/mobile/captures').containsKey('eventId'), isFalse);
  });

  test('approving files it for and paid by me, on the day it was paid, with the payee as the note', () async {
```

In `mobile/test/esewa_parser_test.dart`, find:

```dart
  group('parser', () {
    test('merchant payment', () {
```

Replace it with:

```dart
  group('isUnreadable', () {
    test('a message with no payment in it, not on the ignore list', () {
      expect(parser.isUnreadable(ev('Your eSewa balance is low. Load fund now.')), isTrue);
    });

    test('not a payment it can read', () {
      expect(parser.isUnreadable(ev('You have paid Rs. 500 to Daraz.')), isFalse);
    });

    test('not an OTP, login or promo message', () {
      expect(parser.isUnreadable(ev('Your OTP for payment of Rs. 500 is 123456')), isFalse);
      expect(parser.isUnreadable(ev('New login to your eSewa account')), isFalse);
      expect(parser.isUnreadable(ev('Congratulations! Big offer this Dashain')), isFalse);
    });
  });

  group('parser', () {
    test('a payment from the phone queue keeps the notification id', () {
      final e = RawEvent(
        source: 'notification',
        key: 'k',
        title: 'eSewa',
        text: 'You have paid Rs. 500 to Daraz.',
        postedAt: DateTime(2026, 10, 14, 12),
        id: 'k@1792036530250',
      );
      expect(parser.parse(e)!.eventId, 'k@1792036530250');
      expect(parser.parse(ev('You have paid Rs. 500 to Daraz.'))!.eventId, isNull);
    });

    test('merchant payment', () {
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd mobile; flutter test test/esewa test/esewa_parser_test.dart; cd ..`
Expected: FAIL to compile — errors such as `The getter 'eventId' isn't defined for the type 'Txn'`, `No named parameter with the name 'eventId'`, `This expression has type 'void' and can't be used` (from `drainPending()`), `The method 'idle' isn't defined for the type 'EsewaService'` and `Undefined name 'DrainResult'`.

- [ ] **Step 3: Implement**

In `mobile/lib/esewa/models.dart`, find (1 of 3):

```dart
  final String text;
  final DateTime postedAt;

  RawEvent({
    required this.source,
    required this.key,
    required this.title,
    required this.text,
    required this.postedAt,
  });

  String get body => '$title $text'.trim();

  factory RawEvent.fromJson(Map<String, dynamic> j) => RawEvent(
        source: j['source'] as String? ?? 'notification',
```

Replace it with:

```dart
  final String text;
  final DateTime postedAt;

  /// Piko: the phone queue's name for this notification ("key@postedAt");
  /// empty when it didn't come from the queue.
  final String id;

  RawEvent({
    required this.source,
    required this.key,
    required this.title,
    required this.text,
    required this.postedAt,
    this.id = '',
  });

  String get body => '$title $text'.trim();

  factory RawEvent.fromJson(Map<String, dynamic> j) => RawEvent(
        id: j['id'] as String? ?? '',
        source: j['source'] as String? ?? 'notification',
```

In `mobile/lib/esewa/models.dart`, find (2 of 3):

```dart
  String category;
  double categoryConfidence;
  TxnStatus status;

  Txn({
```

Replace it with:

```dart
  String category;
  double categoryConfidence;
  TxnStatus status;

  /// Piko: the [RawEvent.id] it was read from, so the server keeps one draft
  /// per notification. Null when it didn't come from the phone queue.
  final String? eventId;

  Txn({
```

In `mobile/lib/esewa/models.dart`, find (3 of 3):

```dart
    this.categoryConfidence = 0,
    this.status = TxnStatus.draft,
  });
```

Replace it with:

```dart
    this.categoryConfidence = 0,
    this.status = TxnStatus.draft,
    this.eventId,
  });
```

In `mobile/lib/esewa/parser.dart`, find:

```dart
      occurredAt: e.postedAt,
      source: e.source,
      rawText: e.body,
    );
  }
```

Replace it with:

```dart
      occurredAt: e.postedAt,
      source: e.source,
      rawText: e.body,
      eventId: e.id.isEmpty ? null : e.id,
    );
  }

  /// Piko: true for a message that isn't on the ignore list (OTP, login,
  /// promos) but holds no payment the parser can read: the ones worth a
  /// "couldn't read" alert, so the rules can be taught them.
  bool isUnreadable(RawEvent e) {
    final text = _normalize(e.body);
    return text.isNotEmpty && !rules.ignore.hasMatch(text) && parse(e) == null;
  }
```

In `mobile/lib/services/api_client.dart`, find:

```dart
  // Returns the new capture's id.
  Future<String> createCapture(Map<String, dynamic> capture) async {
    final body = await _authorizedPost('/api/mobile/captures', capture);
    return (body['capture'] as Map<String, dynamic>)['id'] as String;
  }
```

Replace it with:

```dart
  // The capture's id, and whether the server stored it now (false when it
  // already had one from the same notification). A server without the
  // `created` field always stored it.
  Future<({String id, bool created})> createCapture(Map<String, dynamic> capture) async {
    final body = await _authorizedPost('/api/mobile/captures', capture);
    return (
      id: (body['capture'] as Map<String, dynamic>)['id'] as String,
      created: body['created'] as bool? ?? true,
    );
  }
```

In `mobile/lib/esewa/piko_txn_repository.dart`, find (1 of 2):

```dart
  @override
  Future<void> insert(Txn t) async {
    _ids[t] = await client.createCapture({
      'amount': t.amount,
      'category': t.category,
      'categoryConfidence': t.categoryConfidence,
      'counterparty': t.counterparty,
      'direction': t.direction.name,
      'kind': t.kind.name,
```

Replace it with:

```dart
  @override
  Future<bool> insert(Txn t) async {
    final stored = await client.createCapture({
      'amount': t.amount,
      'category': t.category,
      'categoryConfidence': t.categoryConfidence,
      'counterparty': t.counterparty,
      'direction': t.direction.name,
      'eventId': ?t.eventId,
      'kind': t.kind.name,
```

In `mobile/lib/esewa/piko_txn_repository.dart`, find (2 of 2):

```dart
      'refId': t.refId,
      'source': t.source,
    });
  }
```

Replace it with:

```dart
      'refId': t.refId,
      'source': t.source,
    });
    _ids[t] = stored.id;
    return stored.created;
  }
```

In `mobile/lib/esewa/esewa_service.dart`, find (1 of 5):

```dart
  Future<void> insert(Txn t);
```

Replace it with:

```dart
  /// Piko: false when the server already had a draft from the same
  /// notification (two drains at once, or a retry), so nothing new was stored.
  Future<bool> insert(Txn t);
```

In `mobile/lib/esewa/esewa_service.dart`, find (2 of 5):

```dart
import 'categorizer.dart';
```

Replace it with:

```dart
import '../services/money.dart';
import 'categorizer.dart';
```

In `mobile/lib/esewa/esewa_service.dart`, find (3 of 5):

```dart
/// Wires native capture -> parse -> dedupe -> categorize -> store.
class EsewaService {
```

Replace it with:

```dart
/// Piko: what one drain of the phone queue did, for the draft alerts.
class DrainResult {
  const DrainResult({this.drafts = const [], this.unreadable = 0});

  /// New drafts (money going out), oldest first.
  final List<Txn> drafts;

  /// Notifications that weren't ignored (OTP, login...) but held no payment.
  final int unreadable;

  bool get isEmpty => drafts.isEmpty && unreadable == 0;

  /// What the native notifier shows: one line per draft, e.g. "Rs 500 to Daraz".
  Map<String, Object> toJson() => {'drafts': drafts.map(draftLine).toList(), 'unreadable': unreadable};

  static String draftLine(Txn t) {
    final amount = splitAmount(t.amount);
    final rupees = 'Rs ${amount.integer}${amount.decimals == '.00' ? '' : amount.decimals}';
    final payee = t.counterparty;
    return payee == null ? '$rupees eSewa payment' : '$rupees to $payee';
  }
}

/// Wires native capture -> parse -> dedupe -> categorize -> store.
class EsewaService {
```

In `mobile/lib/esewa/esewa_service.dart`, find (4 of 5):

```dart
  Future<void> _draining = Future.value();

  /// Piko: ingests every queued event, oldest first, and acks each one only
  /// once it has been stored, so nothing is lost when the phone is offline or
  /// the app is killed half way. Drains run one at a time, so a live event
  /// arriving mid-drain can't be stored twice. Never throws.
  Future<void> drainPending() => _draining = _draining.then((_) => _drainOnce());

  Future<void> _drainOnce() async {
    final List<dynamic> queued;
    try {
      queued = jsonDecode(await _method.invokeMethod<String>('pending') ?? '[]') as List<dynamic>;
    } catch (_) {
      return;
    }
    for (final e in queued) {
      final event = Map<String, dynamic>.from(e as Map);
      try {
        await ingest(RawEvent.fromJson(event));
        await _method.invokeMethod('ack', [event['id']]);
      } catch (_) {
        // Left queued (offline, or the server failed): tried again next drain.
      }
    }
  }

  /// Single entry point for every source (also call this from statement
  /// import, OCR, or SMS code paths).
  Future<Txn?> ingest(RawEvent e) async {
```

Replace it with:

```dart
  Future<DrainResult> _draining = Future.value(const DrainResult());

  /// Piko: ingests every queued event, oldest first, and acks each one only
  /// once it has been stored, so nothing is lost when the phone is offline or
  /// the app is killed half way. Drains run one at a time, so a live event
  /// arriving mid-drain can't be stored twice. Hands what it did to the
  /// native notifier, which decides whether to alert. Never throws.
  Future<DrainResult> drainPending() => _draining = _draining.then((_) => _drainOnce());

  /// Piko: completes once no drain is running or waiting, including drains
  /// that live events start meanwhile.
  Future<void> idle() async {
    Future<DrainResult> last;
    do {
      last = _draining;
      await last;
    } while (!identical(last, _draining));
  }

  Future<DrainResult> _drainOnce() async {
    final List<dynamic> queued;
    try {
      queued = jsonDecode(await _method.invokeMethod<String>('pending') ?? '[]') as List<dynamic>;
    } catch (_) {
      return const DrainResult();
    }
    final drafts = <Txn>[];
    var unreadable = 0;
    for (final e in queued) {
      final event = Map<String, dynamic>.from(e as Map);
      final raw = RawEvent.fromJson(event);
      try {
        final txn = await ingest(raw);
        await _method.invokeMethod('ack', [event['id']]);
        if (txn != null && txn.isExpense) {
          drafts.add(txn);
        } else if (txn == null && parser.isUnreadable(raw)) {
          unreadable++;
        }
      } catch (_) {
        // Left queued (offline, or the server failed): tried again next drain.
      }
    }
    final result = DrainResult(drafts: drafts, unreadable: unreadable);
    if (!result.isEmpty) {
      try {
        await _method.invokeMethod('notify', result.toJson());
      } catch (_) {
        // No alert this time; the drafts are stored and Home still shows them.
      }
    }
    return result;
  }

  /// Single entry point for every source (also call this from statement
  /// import, OCR, or SMS code paths). Piko: null unless a new transaction was
  /// stored (not a payment, a duplicate, or already on the server).
  Future<Txn?> ingest(RawEvent e) async {
```

In `mobile/lib/esewa/esewa_service.dart`, find (5 of 5):

```dart
    txn.status = TxnStatus.draft; // never straight to real data
    await repo.insert(txn);
    _newTxns.add(txn);
```

Replace it with:

```dart
    txn.status = TxnStatus.draft; // never straight to real data
    if (!await repo.insert(txn)) return null;
    _newTxns.add(txn);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd mobile; flutter analyze; flutter test; cd ..`
Expected: `No issues found!` and `+170: All tests passed!`

- [ ] **Step 5: Commit**

```bash
git add mobile/lib mobile/test
git commit -m "feat(esewa): drafts remember their notification, and a drain reports what it made"
```

---

### Task 3: A background entry point that makes drafts with Piko closed (app)

`runEsewaBackground` is what the headless engine (Task 4) runs: it signs in with the stored token, drains the queue exactly as the app does, keeps draining while new notifications wake it, and tells Android it's finished.

**Files:**
- Create: `mobile/lib/esewa/background.dart`
- Modify: `mobile/lib/esewa/esewa_service.dart` (`isSupported` becomes a field, settable in tests)
- Modify: `mobile/lib/main.dart` (the `esewaBackgroundMain` entry point)
- Test: `mobile/test/esewa/background_test.dart` (new)

**Interfaces:**
- Consumes: Task 2's `EsewaService.drainPending`, `EsewaService.idle`, `PikoTxnRepository`.
- Produces:
  - `EsewaService(repo, {parser, dedup, bool? supported})`; `isSupported` is `supported ?? Platform.isAndroid`.
  - `Future<void> runEsewaBackground({TokenStorage? tokens, SettingsService? settings, http.Client? client, bool? supported})`: never throws; always ends by calling `finished` on channel `finance/esewa`.
  - `esewaBackgroundMain()` in `mobile/lib/main.dart`, a top-level function with `@pragma('vm:entry-point')`. Task 4's Kotlin starts it by this exact name.

- [ ] **Step 1: Write the failing test**

Create `mobile/test/esewa/background_test.dart` with:

```dart
import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:piko/esewa/background.dart';
import 'package:piko/services/settings_service.dart';
import 'package:piko/services/token_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _Tokens implements TokenStorage {
  _Tokens(this.token);

  final String? token;

  @override
  Future<String?> readToken() async => token;

  @override
  Future<void> writeToken(String token) async {}

  @override
  Future<void> clearToken() async {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const method = MethodChannel('finance/esewa');
  const events = EventChannel('finance/esewa/events');
  final messenger = TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;

  // Native side: the queue, and every call Dart made, in order.
  late List<Map<String, Object>> queue;
  late List<String> calls;
  late List<http.Request> requests;
  late int serverStatus;

  setUp(() {
    SharedPreferences.setMockInitialValues({'piko_server_url': 'https://piko.test'});
    queue = [
      {
        'id': 'k@1',
        'key': 'k',
        'postedAt': DateTime(2026, 10, 17, 12).millisecondsSinceEpoch,
        'source': 'notification',
        'text': 'You have paid Rs. 500 to Daraz.',
        'title': 'eSewa',
      },
    ];
    calls = [];
    requests = [];
    serverStatus = 200;
    messenger.setMockMethodCallHandler(method, (call) async {
      calls.add(call.method);
      switch (call.method) {
        case 'pending':
          return jsonEncode(queue);
        case 'ack':
          final ids = (call.arguments as List).cast<String>();
          queue.removeWhere((e) => ids.contains(e['id']));
      }
      return null;
    });
    messenger.setMockStreamHandler(events, MockStreamHandler.inline(onListen: (_, _) {}));
  });

  tearDown(() {
    messenger.setMockMethodCallHandler(method, null);
    messenger.setMockStreamHandler(events, null);
  });

  http.Client server() => MockClient((request) async {
        requests.add(request);
        if (serverStatus != 200) return http.Response('{}', serverStatus);
        final body = switch (request.url.path) {
          '/api/mobile/captures' => {
              'capture': {'id': 'cap-1'},
              'created': true,
            },
          '/api/mobile/captures/around' => {'captures': <Object>[]},
          '/api/mobile/capture-rules' => {'rules': <Object>[]},
          '/api/mobile/categories' => {'categories': <Object>[], 'members': <Object>[], 'currentMemberId': 'mem-1'},
          _ => <String, Object>{},
        };
        return http.Response(jsonEncode(body), 200);
      });

  test('signed in: stores the queue on the saved server, alerts, then says it is finished', () async {
    await runEsewaBackground(tokens: _Tokens('jwt'), settings: SettingsService(), client: server(), supported: true);

    expect(queue, isEmpty);
    expect(requests.map((r) => r.url.host).toSet(), {'piko.test'});
    expect(requests.every((r) => r.headers['Authorization'] == 'Bearer jwt'), isTrue);
    expect(calls, containsAllInOrder(['pending', 'ack', 'notify', 'finished']));
    expect(calls.last, 'finished');
  });

  test('signed out: stores nothing, leaves the queue, and still says it is finished', () async {
    await runEsewaBackground(tokens: _Tokens(null), settings: SettingsService(), client: server(), supported: true);

    expect(requests, isEmpty);
    expect(queue, hasLength(1));
    expect(calls, ['finished']);
  });

  test('server down: leaves the queue for next time and still says it is finished', () async {
    serverStatus = 500;

    await runEsewaBackground(tokens: _Tokens('jwt'), settings: SettingsService(), client: server(), supported: true);

    expect(queue, hasLength(1));
    expect(calls, isNot(contains('notify')));
    expect(calls.last, 'finished');
  });
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd mobile; flutter test test/esewa/background_test.dart; cd ..`
Expected: FAIL to compile — `Error when reading 'lib/esewa/background.dart': The system cannot find the file specified` and `Method not found: 'runEsewaBackground'`.

- [ ] **Step 3: Implement**

In `mobile/lib/esewa/esewa_service.dart`, find (1 of 2):

```dart
  EsewaService(this.repo, {EsewaParser? parser, Deduplicator? dedup})
      : parser = parser ?? EsewaParser(),
        dedup = dedup ?? Deduplicator();
```

Replace it with:

```dart
  /// Piko: [supported] stands in for "running on Android" in tests.
  EsewaService(this.repo, {EsewaParser? parser, Deduplicator? dedup, bool? supported})
      : parser = parser ?? EsewaParser(),
        dedup = dedup ?? Deduplicator(),
        isSupported = supported ?? Platform.isAndroid;
```

In `mobile/lib/esewa/esewa_service.dart`, find (2 of 2):

```dart
  bool get isSupported => Platform.isAndroid;
```

Replace it with:

```dart
  final bool isSupported;
```

In `mobile/lib/main.dart`, find (1 of 2):

```dart
import 'providers/auth_provider.dart';
```

Replace it with:

```dart
import 'esewa/background.dart';
import 'providers/auth_provider.dart';
```

In `mobile/lib/main.dart`, find (2 of 2):

```dart
class PikoApp extends ConsumerWidget {
```

Replace it with:

```dart
// Started by Android (EsewaBackgroundRunner) when an eSewa notification
// arrives and no Piko screen is running: makes the drafts and alerts, with no UI.
@pragma('vm:entry-point')
Future<void> esewaBackgroundMain() async {
  WidgetsFlutterBinding.ensureInitialized();
  await runEsewaBackground();
}

class PikoApp extends ConsumerWidget {
```

Create `mobile/lib/esewa/background.dart` with:

```dart
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

import '../models/categories_result.dart';
import '../services/api_client.dart';
import '../services/settings_service.dart';
import '../services/token_storage.dart';
import 'esewa_service.dart';
import 'piko_txn_repository.dart';

const _method = MethodChannel('finance/esewa');

/// What the background engine does when an eSewa notification arrives and no
/// Piko screen is running: drains the phone queue exactly as the app does
/// (the drain also asks the notifier to alert), keeps draining while new
/// notifications wake it, then tells Android it's done so the engine can go.
/// Signed out, it stores nothing: notifications wait in the queue for sign-in.
/// Never throws; whatever wasn't stored stays queued for the next try.
Future<void> runEsewaBackground({
  TokenStorage? tokens,
  SettingsService? settings,
  http.Client? client,
  bool? supported,
}) async {
  try {
    final token = await (tokens ?? SecureTokenStorage()).readToken();
    if (token == null || token.isEmpty) return;
    final baseUrl = await (settings ?? SettingsService()).readServerUrl();
    final api = ApiClient(getBaseUrl: () => baseUrl, getToken: () => token, onUnauthorized: () {}, client: client);
    // Fetched at most once per run, and only if a draft needs a category.
    Future<CategoriesResult>? categories;
    final repo = PikoTxnRepository(client: api, options: () => categories ??= api.fetchCategories());
    final service = EsewaService(repo, supported: supported);
    await service.start();
    await service.idle();
    await service.dispose();
  } catch (_) {
    // Left queued.
  } finally {
    try {
      await _method.invokeMethod('finished');
    } catch (_) {
      // The engine's 60-second limit ends it instead.
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd mobile; flutter analyze; flutter test; cd ..`
Expected: `No issues found!` and `+173: All tests passed!`

- [ ] **Step 5: Commit**

```bash
git add mobile/lib mobile/test
git commit -m "feat(esewa): a background entry point that makes drafts with Piko closed"
```

---

### Task 4: Android runs the drain in the background and shows the alerts (app, Kotlin)

How the pieces fit:
- `EsewaNotificationListener` queues each eSewa notification (unchanged), then calls `EsewaBridge.deliver`.
- `EsewaBridge` is now one instance per Flutter engine. `deliver` wakes the app's Dart if a Piko screen's engine is listening, otherwise `EsewaBackgroundRunner.wake`.
- `EsewaBackgroundRunner` keeps at most one headless engine running `esewaBackgroundMain`. It ends the engine when Dart calls `finished`, or after 60 seconds. If a notification arrived during the run (the `wakes` count changed), it runs once more, so a notification that came in after the last look at the queue isn't left waiting.
- `DraftNotifier` shows the alerts, unless `MainActivity` is in front.
- `MainActivity` marks when it's in front, asks the listener to reconnect, keeps a tapped alert's intent for Dart, and detaches its bridge when its engine goes.
- The listener also re-reads eSewa notifications still in the shade when it connects, and `rebindIfDisconnected` asks Android to reconnect it. Android can keep notification access on but stop delivering, often after an update; this happened on the owner's phone on 2026-10-17.

Kotlin has no automated tests in this repo; this task's check is a release build plus two checks on what it produced.

**Files:**
- Modify (whole file): `mobile/android/app/src/main/kotlin/com/nirjal/piko/esewa/EsewaNotificationListener.kt`
- Modify (whole file): `mobile/android/app/src/main/kotlin/com/nirjal/piko/esewa/EsewaBridge.kt`
- Create: `mobile/android/app/src/main/kotlin/com/nirjal/piko/esewa/EsewaBackgroundRunner.kt`
- Create: `mobile/android/app/src/main/kotlin/com/nirjal/piko/esewa/DraftNotifier.kt`
- Create: `mobile/android/app/src/main/res/drawable/ic_stat_piko.xml`
- Modify (whole file): `mobile/android/app/src/main/kotlin/com/nirjal/piko/MainActivity.kt`
- Modify: `mobile/android/app/src/main/AndroidManifest.xml`

**Interfaces:**
- Consumes: Task 3's `esewaBackgroundMain` (by name); Task 2's `notify` arguments `{'drafts': [String], 'unreadable': int}`.
- Produces, on method channel `finance/esewa` (in addition to the existing `isAccessGranted`, `openAccessSettings`, `pending`, `ack`):
  - `notify(map)` → shows the alerts; `finished()` → ends the background engine (background engine only).
  - `notificationsAllowed() → bool`.
  - `askNotificationsOnce() → bool`: Android 13+, prompts only the first time.
  - `requestNotificationPermission()`: the prompt while Android will still show it, else Piko's notification settings.
  - `takeOpenTarget() → String?` (`'review'`, `'captured'` or null; each tap is handed out once).
  - `clearDraftAlerts()`.

  Task 5 calls these.

- [ ] **Step 1: The listener hands each notification on, reconnects, and catches up on the shade**

Replace the whole of `mobile/android/app/src/main/kotlin/com/nirjal/piko/esewa/EsewaNotificationListener.kt` with:

```kotlin
package com.nirjal.piko.esewa

import android.app.Notification
import android.content.ComponentName
import android.content.Context
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONObject

/**
 * Captures eSewa (and optionally bank) notifications.
 *
 * Runs even when the Flutter UI is closed. Every event is queued in
 * PendingStore first, then handed on: to the app's Dart if a Piko screen's
 * engine is listening, otherwise to the background engine
 * (EsewaBackgroundRunner). Either one drains the queue.
 *
 * Parsing is intentionally NOT done here — Dart owns parsing so you can update
 * the patterns without touching native code.
 */
class EsewaNotificationListener : NotificationListenerService() {

    companion object {
        // Verify on a real device: adb shell pm list packages | grep -i esewa
        val WATCHED_PACKAGES = setOf(
            "com.f1soft.esewa",
        )

        /** Whether Android has this listener connected right now (in this process). */
        @Volatile
        var connected = false
            private set

        /**
         * Android sometimes keeps notification access switched on but stops
         * delivering to the listener (often after an app update). Asks it to
         * reconnect; harmless when access is off.
         */
        fun rebindIfDisconnected(ctx: Context) {
            if (connected) return
            try {
                requestRebind(ComponentName(ctx, EsewaNotificationListener::class.java))
            } catch (_: RuntimeException) {
                // Never let a refused rebind stop the app from opening.
            }
        }
    }

    // Catches up on eSewa notifications still in the shade, posted while the
    // listener was disconnected. Ones already sent are dropped by the server,
    // so re-reading them is harmless.
    override fun onListenerConnected() {
        connected = true
        val active = try { activeNotifications } catch (_: SecurityException) { null } ?: return
        active.forEach(::onNotificationPosted)
    }

    override fun onListenerDisconnected() {
        connected = false
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (sbn.packageName !in WATCHED_PACKAGES) return

        val extras = sbn.notification.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
        // BigText often contains the full message; fall back to normal text.
        val text = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
            ?: extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()
            ?: ""
        if (title.isBlank() && text.isBlank()) return

        // Ignore group-summary notifications (they duplicate the individual ones).
        if (sbn.notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) return

        val event = JSONObject().apply {
            put("source", "notification")
            put("package", sbn.packageName)
            put("key", sbn.key)                 // stable per-notification id
            put("title", title)
            put("text", text)
            put("postedAt", sbn.postTime)       // epoch millis
        }

        // Queued first, so it survives until Dart has stored it; then hand it
        // to whichever Dart can drain it now.
        PendingStore.append(applicationContext, event)
        EsewaBridge.deliver(applicationContext, event)
    }
}
```

- [ ] **Step 2: One bridge per engine, with the new methods**

Replace the whole of `mobile/android/app/src/main/kotlin/com/nirjal/piko/esewa/EsewaBridge.kt` with:

```kotlin
package com.nirjal.piko.esewa

import android.Manifest
import android.app.Activity
import android.app.NotificationManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodChannel
import org.json.JSONArray
import org.json.JSONObject

/**
 * Flutter <-> native bridge, set up on each engine that runs Piko's Dart code:
 * the app's (with its activity) and the background one (EsewaBackgroundRunner).
 *  MethodChannel "finance/esewa": isAccessGranted, openAccessSettings, pending,
 *    ack, notify, finished (background only), notificationsAllowed,
 *    askNotificationsOnce, requestNotificationPermission, takeOpenTarget,
 *    clearDraftAlerts
 *  EventChannel "finance/esewa/events": a wake-up for each new notification
 *    (the event itself is already queued in PendingStore)
 */
class EsewaBridge private constructor(
    engine: FlutterEngine,
    private val ctx: Context,
    private val activity: Activity?,
    private val onFinished: () -> Unit,
) {
    private var sink: EventChannel.EventSink? = null

    init {
        val messenger = engine.dartExecutor.binaryMessenger

        MethodChannel(messenger, METHOD).setMethodCallHandler { call, result ->
            when (call.method) {
                "isAccessGranted" -> result.success(isAccessGranted(ctx))
                "openAccessSettings" -> {
                    ctx.startActivity(
                        Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    )
                    result.success(null)
                }
                "pending" -> result.success(PendingStore.pending(ctx))
                "ack" -> {
                    val ids = (call.arguments as? List<*>)?.filterIsInstance<String>() ?: emptyList()
                    PendingStore.ack(ctx, ids)
                    result.success(null)
                }
                "notify" -> {
                    val args = JSONObject(call.arguments as Map<*, *>)
                    val lines = args.optJSONArray("drafts") ?: JSONArray()
                    DraftNotifier.show(
                        ctx,
                        drafts = (0 until lines.length()).map { lines.getString(it) },
                        unreadable = args.optInt("unreadable"),
                    )
                    result.success(null)
                }
                "finished" -> {
                    result.success(null)
                    onFinished()
                }
                "notificationsAllowed" -> result.success(notificationsAllowed())
                "askNotificationsOnce" -> result.success(askNotificationsOnce())
                "requestNotificationPermission" -> {
                    requestNotificationPermission()
                    result.success(null)
                }
                "takeOpenTarget" -> {
                    val intent = activity?.intent
                    val target = intent?.getStringExtra(DraftNotifier.EXTRA_OPEN)
                    intent?.removeExtra(DraftNotifier.EXTRA_OPEN)
                    result.success(target)
                }
                "clearDraftAlerts" -> {
                    DraftNotifier.clearDrafts(ctx)
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }

        EventChannel(messenger, EVENTS).setStreamHandler(object : EventChannel.StreamHandler {
            override fun onListen(args: Any?, events: EventChannel.EventSink) { sink = events }
            override fun onCancel(args: Any?) { sink = null }
        })
    }

    /** Wakes this engine's Dart; false when it isn't listening. */
    fun wake(event: JSONObject): Boolean {
        val s = sink ?: return false
        main.post { s.success(event.toString()) }
        return true
    }

    private fun notificationsAllowed(): Boolean =
        ctx.getSystemService(NotificationManager::class.java).areNotificationsEnabled()

    private fun prefs() = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** Android 13+: shows the permission prompt the first time only. True when it did. */
    private fun askNotificationsOnce(): Boolean {
        val a = activity ?: return false
        if (Build.VERSION.SDK_INT < 33 || notificationsAllowed() || prefs().getBoolean(ASKED, false)) return false
        prefs().edit().putBoolean(ASKED, true).apply()
        a.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), PERMISSION_REQUEST)
        return true
    }

    /**
     * Settings' "Draft alerts" row: the prompt while Android will still show
     * it, otherwise Piko's notification settings (denied twice, or turned off
     * there, or Android 12 and older).
     */
    private fun requestNotificationPermission() {
        val a = activity ?: return
        val canPrompt = Build.VERSION.SDK_INT >= 33 && !notificationsAllowed() &&
            (!prefs().getBoolean(ASKED, false) ||
                a.shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS))
        if (canPrompt) {
            prefs().edit().putBoolean(ASKED, true).apply()
            a.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), PERMISSION_REQUEST)
            return
        }
        val settings = if (Build.VERSION.SDK_INT >= 26) {
            Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, ctx.packageName)
        } else {
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", ctx.packageName, null))
        }
        a.startActivity(settings)
    }

    companion object {
        private const val METHOD = "finance/esewa"
        private const val EVENTS = "finance/esewa/events"
        private const val PREFS = "esewa_alerts"
        private const val ASKED = "asked_permission"
        private const val PERMISSION_REQUEST = 7103
        private val main = Handler(Looper.getMainLooper())

        /** The app's engine, while a Piko screen has one. */
        private var ui: EsewaBridge? = null

        /** Bumped for every new notification, so the runner can tell one arrived during a run. */
        @Volatile
        var wakes = 0L
            private set

        fun attachUi(engine: FlutterEngine, ctx: Context, activity: Activity) {
            ui = EsewaBridge(engine, ctx, activity) {}
        }

        fun detachUi() {
            ui = null
        }

        fun background(engine: FlutterEngine, ctx: Context, onFinished: () -> Unit) =
            EsewaBridge(engine, ctx, null, onFinished)

        /**
         * A notification is queued: the app's Dart drains it if it's listening,
         * otherwise the background engine does.
         */
        fun deliver(ctx: Context, event: JSONObject) {
            wakes++
            if (ui?.wake(event) != true) EsewaBackgroundRunner.wake(ctx, event)
        }

        fun isAccessGranted(ctx: Context): Boolean {
            val enabled = Settings.Secure.getString(ctx.contentResolver, "enabled_notification_listeners") ?: return false
            val me = ComponentName(ctx, EsewaNotificationListener::class.java).flattenToString()
            return enabled.split(":").any { it == me }
        }
    }
}
```

- [ ] **Step 3: The background runner**

Create `mobile/android/app/src/main/kotlin/com/nirjal/piko/esewa/EsewaBackgroundRunner.kt` with:

```kotlin
package com.nirjal.piko.esewa

import android.content.Context
import android.os.Handler
import android.os.Looper
import io.flutter.FlutterInjector
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.embedding.engine.dart.DartExecutor
import org.json.JSONObject

/**
 * Runs Piko's Dart code with no UI (`esewaBackgroundMain` in lib/main.dart)
 * when an eSewa notification arrives and no Piko screen is running, so the
 * draft is made, and announced, without opening the app. At most one engine;
 * it ends when Dart says it's finished, or after a minute. Anything not yet
 * stored stays queued in PendingStore.
 */
object EsewaBackgroundRunner {
    private const val LIMIT_MS = 60_000L

    private val main = Handler(Looper.getMainLooper())
    private var engine: FlutterEngine? = null
    private var bridge: EsewaBridge? = null
    private var wakesAtStart = 0L
    private val timeout = Runnable { stop() }

    fun wake(ctx: Context, event: JSONObject) {
        val app = ctx.applicationContext
        main.post {
            // Running: its Dart drains again. Still starting: its first drain reads the queue.
            if (bridge?.wake(event) == true || engine != null) return@post
            start(app)
        }
    }

    private fun start(ctx: Context) {
        val e = FlutterEngine(ctx)
        engine = e
        wakesAtStart = EsewaBridge.wakes
        bridge = EsewaBridge.background(e, ctx) { main.post { finished(ctx) } }
        val bundle = FlutterInjector.instance().flutterLoader().findAppBundlePath()
        e.dartExecutor.executeDartEntrypoint(DartExecutor.DartEntrypoint(bundle, "esewaBackgroundMain"))
        main.postDelayed(timeout, LIMIT_MS)
    }

    private fun finished(ctx: Context) {
        stop()
        // A notification arrived while it ran, maybe after its last look at
        // the queue: run once more. (Not a loop: the next run starts from now.)
        if (EsewaBridge.wakes != wakesAtStart) start(ctx)
    }

    private fun stop() {
        main.removeCallbacks(timeout)
        engine?.destroy()
        engine = null
        bridge = null
    }
}
```

- [ ] **Step 4: The notifier and its status-bar icon**

Create `mobile/android/app/src/main/kotlin/com/nirjal/piko/esewa/DraftNotifier.kt` with:

```kotlin
package com.nirjal.piko.esewa

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.nirjal.piko.MainActivity
import com.nirjal.piko.R

/**
 * Piko's own notifications about eSewa capture, on their own channel ("eSewa
 * drafts") so they can be switched off without stopping capture:
 *  - drafts: one notification, updated rather than stacked; the count resets
 *    when the review screen opens. Tap → review screen.
 *  - couldn't read: an eSewa notification that held no payment Piko could
 *    read. Tap → Captured notifications.
 * Nothing is shown while a Piko screen is in front; Home's banner covers it.
 */
object DraftNotifier {
    const val EXTRA_OPEN = "piko_open"

    private const val CHANNEL = "esewa_drafts"
    private const val DRAFTS_ID = 7101
    private const val UNREADABLE_ID = 7102
    private const val PREFS = "esewa_alerts"
    private const val UNSEEN = "unseen_drafts"

    /** True while MainActivity is resumed. */
    @Volatile
    var appVisible = false

    fun show(ctx: Context, drafts: List<String>, unreadable: Int) {
        if (appVisible) return
        val nm = ctx.getSystemService(NotificationManager::class.java)
        ensureChannel(nm)
        if (drafts.isNotEmpty()) {
            val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val unseen = prefs.getInt(UNSEEN, 0) + drafts.size
            prefs.edit().putInt(UNSEEN, unseen).apply()
            val title = if (unseen == 1) "Draft: ${drafts.last()}" else "$unseen eSewa drafts to review"
            val text = if (unseen == 1) "Tap to review" else "Latest: ${drafts.last()}"
            nm.notify(DRAFTS_ID, build(ctx, title, text, "review", DRAFTS_ID))
        }
        if (unreadable > 0) {
            nm.notify(
                UNREADABLE_ID,
                build(ctx, "Piko couldn't read an eSewa notification", "Tap to see it", "captured", UNREADABLE_ID),
            )
        }
    }

    fun clearDrafts(ctx: Context) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putInt(UNSEEN, 0).apply()
        ctx.getSystemService(NotificationManager::class.java).cancel(DRAFTS_ID)
    }

    private fun ensureChannel(nm: NotificationManager) {
        if (Build.VERSION.SDK_INT < 26 || nm.getNotificationChannel(CHANNEL) != null) return
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL, "eSewa drafts", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "When an eSewa payment becomes a draft to review"
            }
        )
    }

    private fun build(ctx: Context, title: String, text: String, open: String, requestCode: Int): Notification {
        val intent = Intent(ctx, MainActivity::class.java)
            .putExtra(EXTRA_OPEN, open)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val tap = PendingIntent.getActivity(
            ctx, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val builder = if (Build.VERSION.SDK_INT >= 26) {
            Notification.Builder(ctx, CHANNEL)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(ctx)
        }
        return builder
            .setSmallIcon(R.drawable.ic_stat_piko)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(tap)
            .setAutoCancel(true)
            .build()
    }
}
```

Create `mobile/android/app/src/main/res/drawable/ic_stat_piko.xml` with:

```xml
<?xml version="1.0" encoding="utf-8"?>
<!-- Status-bar icon for Piko's eSewa alerts: a receipt (Material "receipt",
     Apache 2.0). Status-bar icons must be one flat colour. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FFFFFFFF"
        android:pathData="M18,17H6v-2h12v2zM18,13H6v-2h12v2zM18,9H6V7h12v2zM3,22l1.5,-1.5L6,22l1.5,-1.5L9,22l1.5,-1.5L12,22l1.5,-1.5L15,22l1.5,-1.5L18,22l1.5,-1.5L21,22V2l-1.5,1.5L18,2l-1.5,1.5L15,2l-1.5,1.5L12,2l-1.5,1.5L9,2L7.5,3.5L6,2L4.5,3.5L3,2v20z" />
</vector>
```

- [ ] **Step 5: The activity, and the notification permission**

Replace the whole of `mobile/android/app/src/main/kotlin/com/nirjal/piko/MainActivity.kt` with:

```kotlin
package com.nirjal.piko

import android.content.Intent
import com.nirjal.piko.esewa.DraftNotifier
import com.nirjal.piko.esewa.EsewaBridge
import com.nirjal.piko.esewa.EsewaNotificationListener
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // eSewa auto-capture: the channels Dart uses to read the notification queue.
        EsewaBridge.attachUi(flutterEngine, applicationContext, this)
    }

    override fun cleanUpFlutterEngine(flutterEngine: FlutterEngine) {
        // New notifications go to the background engine from now on.
        EsewaBridge.detachUi()
        super.cleanUpFlutterEngine(flutterEngine)
    }

    override fun onResume() {
        super.onResume()
        DraftNotifier.appVisible = true
        EsewaNotificationListener.rebindIfDisconnected(applicationContext)
    }

    override fun onPause() {
        DraftNotifier.appVisible = false
        super.onPause()
    }

    // A tapped alert while Piko is running: Dart reads its target on resume.
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }
}
```

In `mobile/android/app/src/main/AndroidManifest.xml`, find:

```xml
    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />
```

Replace it with:

```xml
    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />
    <!-- Android 13+: Piko's own alerts when an eSewa payment becomes a draft. -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

- [ ] **Step 6: Build, and check what the build produced**

Run: `cd mobile; flutter build apk --release --split-per-abi; cd ..`
Expected: three `√ Built build\app\outputs\flutter-apk\app-…-release.apk` lines and no `e:` (Kotlin error) lines. The first build in a fresh checkout can take several minutes.

Check that the permission reached the release manifest:
Run (Git Bash): `grep -c POST_NOTIFICATIONS mobile/build/app/intermediates/merged_manifest/release/*/AndroidManifest.xml`
Expected: one line per merged manifest (there are two), each ending in `:1`.

Check that the background entry point survived the release build's tree shaking:
Run (Git Bash): `cd mobile && unzip -o -q build/app/outputs/flutter-apk/app-arm64-v8a-release.apk lib/arm64-v8a/libapp.so -d /tmp/piko-apk && grep -c esewaBackgroundMain /tmp/piko-apk/lib/arm64-v8a/libapp.so; cd ..`
Expected: `1` (or more). `0` means `@pragma('vm:entry-point')` is missing from `esewaBackgroundMain` in `mobile/lib/main.dart`.

Run: `cd mobile; flutter analyze; flutter test; cd ..`
Expected: `No issues found!` and `+173: All tests passed!` (no Dart changed).

- [ ] **Step 7: Commit**

```bash
git add mobile/android
git commit -m "feat(esewa): Android runs the drain in the background and shows draft alerts" -m "Also: re-read eSewa notifications still in the shade when the listener connects, and ask Android to reconnect it when Piko opens."
```

---

### Task 5: Open from an alert, Draft alerts in Settings, and ask once for the permission (app)

**Files:**
- Create: `mobile/lib/esewa/esewa_alerts.dart`
- Modify: `mobile/lib/providers/esewa_provider.dart` (`esewaAlertsProvider`, `esewaAlertsAllowedProvider`)
- Modify: `mobile/lib/esewa/review_screen.dart` (clears the drafts alert on open)
- Modify: `mobile/lib/screens/home_screen.dart` (open a tapped alert's screen; ask once)
- Modify: `mobile/lib/screens/settings_screen.dart` ("Draft alerts" row)
- Test: `mobile/test/esewa/esewa_alerts_test.dart` (new), `mobile/test/esewa/review_screen_test.dart`

**Interfaces:**
- Consumes: Task 4's channel methods `notificationsAllowed`, `askNotificationsOnce`, `requestNotificationPermission`, `takeOpenTarget`, `clearDraftAlerts`.
- Produces:
  - `enum AlertTarget { review, captured }`.
  - `class EsewaAlerts { const EsewaAlerts({this._supported}); bool get isSupported; Future<bool> allowed(); Future<void> askOnce(); Future<void> request(); Future<AlertTarget?> takeOpenTarget(); Future<void> clearDrafts(); }`: everything does nothing off Android.
  - `esewaAlertsProvider` (`Provider<EsewaAlerts>`) and `esewaAlertsAllowedProvider` (`FutureProvider.autoDispose<bool>`).

  The constructor's parameter is a private named initializing formal, `{this._supported}`, which callers pass as `supported:` (Dart 3.12; `flutter analyze` asks for this form).

- [ ] **Step 1: Write the failing tests**

Create `mobile/test/esewa/esewa_alerts_test.dart` with:

```dart
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/esewa/esewa_alerts.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('finance/esewa');
  final messenger = TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;

  late List<String> calls;
  late Object? reply;

  setUp(() {
    calls = [];
    reply = null;
    messenger.setMockMethodCallHandler(channel, (call) async {
      calls.add(call.method);
      return reply;
    });
  });

  tearDown(() => messenger.setMockMethodCallHandler(channel, null));

  const alerts = EsewaAlerts(supported: true);

  test('a tapped drafts alert opens the review screen', () async {
    reply = 'review';
    expect(await alerts.takeOpenTarget(), AlertTarget.review);
  });

  test('a tapped couldn\'t-read alert opens Captured notifications', () async {
    reply = 'captured';
    expect(await alerts.takeOpenTarget(), AlertTarget.captured);
  });

  test('opened normally, or with a target it does not know: nothing to open', () async {
    expect(await alerts.takeOpenTarget(), isNull);
    reply = 'somewhere-else';
    expect(await alerts.takeOpenTarget(), isNull);
  });

  test('passes the permission and clearing calls to Android', () async {
    reply = true;
    expect(await alerts.allowed(), isTrue);
    await alerts.askOnce();
    await alerts.request();
    await alerts.clearDrafts();

    expect(calls, ['notificationsAllowed', 'askNotificationsOnce', 'requestNotificationPermission', 'clearDraftAlerts']);
  });

  test('off Android it asks nothing and reports alerts off', () async {
    const off = EsewaAlerts(supported: false);

    expect(await off.allowed(), isFalse);
    expect(await off.takeOpenTarget(), isNull);
    await off.askOnce();
    await off.request();
    await off.clearDrafts();

    expect(calls, isEmpty);
  });
}
```

In `mobile/test/esewa/review_screen_test.dart`, find (1 of 5):

```dart
import 'package:piko/esewa/categorizer.dart';
```

Replace it with:

```dart
import 'package:piko/esewa/categorizer.dart';
import 'package:piko/esewa/esewa_alerts.dart';
```

In `mobile/test/esewa/review_screen_test.dart`, find (2 of 5):

```dart
void main() {
  final calendar = BsCalendar.fromJson(
```

Replace it with:

```dart
// Counts how often the drafts alert was cleared.
class _Alerts extends EsewaAlerts {
  int cleared = 0;

  @override
  Future<void> clearDrafts() async => cleared++;
}

void main() {
  final calendar = BsCalendar.fromJson(
```

In `mobile/test/esewa/review_screen_test.dart`, find (3 of 5):

```dart
  late _FakeServer server;
```

Replace it with:

```dart
  late _FakeServer server;
  late _Alerts alerts;
```

In `mobile/test/esewa/review_screen_test.dart`, find (4 of 5):

```dart
          esewaServiceProvider.overrideWithValue(service),
```

Replace it with:

```dart
          esewaServiceProvider.overrideWithValue(service),
          esewaAlertsProvider.overrideWithValue(alerts),
```

In `mobile/test/esewa/review_screen_test.dart`, find (5 of 5):

```dart
  setUp(() => server = _FakeServer());
```

Replace it with:

```dart
  setUp(() {
    server = _FakeServer();
    alerts = _Alerts();
  });

  testWidgets('opening it clears the drafts alert, since every draft is on screen', (tester) async {
    await pumpReview(tester);

    expect(alerts.cleared, 1);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd mobile; flutter test test/esewa/esewa_alerts_test.dart test/esewa/review_screen_test.dart; cd ..`
Expected: FAIL to compile — `Error when reading 'lib/esewa/esewa_alerts.dart': The system cannot find the file specified`, `Method not found: 'EsewaAlerts'`, `Undefined name 'AlertTarget'` and `Undefined name 'esewaAlertsProvider'`.

- [ ] **Step 3: Implement**

Create `mobile/lib/esewa/esewa_alerts.dart` with:

```dart
import 'dart:io' show Platform;

import 'package:flutter/services.dart';

/// The screen a tapped Piko alert opens.
enum AlertTarget { review, captured }

/// Piko's own eSewa alerts, shown by DraftNotifier on the Android side: the
/// notification permission they need, which screen a tapped one opens, and
/// clearing the drafts alert once the review screen is open. Does nothing off
/// Android.
class EsewaAlerts {
  /// [supported] stands in for "running on Android" in tests.
  const EsewaAlerts({this._supported});

  static const _method = MethodChannel('finance/esewa');

  final bool? _supported;

  bool get isSupported => _supported ?? Platform.isAndroid;

  /// Whether Android lets Piko show notifications.
  Future<bool> allowed() async => isSupported && (await _method.invokeMethod<bool>('notificationsAllowed') ?? false);

  /// Android 13+: the permission prompt, only the first time.
  Future<void> askOnce() async {
    if (isSupported) await _method.invokeMethod('askNotificationsOnce');
  }

  /// The prompt if Android will still show it, else Piko's notification settings.
  Future<void> request() async {
    if (isSupported) await _method.invokeMethod('requestNotificationPermission');
  }

  /// Where the alert that opened Piko points; null when it wasn't opened from
  /// one. Each tap is handed out once.
  Future<AlertTarget?> takeOpenTarget() async {
    if (!isSupported) return null;
    final name = await _method.invokeMethod<String>('takeOpenTarget');
    return AlertTarget.values.where((t) => t.name == name).firstOrNull;
  }

  /// Removes the drafts alert and restarts its count.
  Future<void> clearDrafts() async {
    if (isSupported) await _method.invokeMethod('clearDraftAlerts');
  }
}
```

In `mobile/lib/providers/esewa_provider.dart`, find (1 of 2):

```dart
import '../esewa/esewa_service.dart';
```

Replace it with:

```dart
import '../esewa/esewa_alerts.dart';
import '../esewa/esewa_service.dart';
```

In `mobile/lib/providers/esewa_provider.dart`, find (2 of 2):

```dart
final captureEventsProvider = FutureProvider.autoDispose<List<CaptureEvent>>(
```

Replace it with:

```dart
// Piko's own eSewa alerts (permission, tapped-alert target).
final esewaAlertsProvider = Provider<EsewaAlerts>((ref) => const EsewaAlerts());

// Whether Android lets Piko show its draft alerts.
final esewaAlertsAllowedProvider = FutureProvider.autoDispose<bool>(
  (ref) => ref.watch(esewaAlertsProvider).allowed(),
);

final captureEventsProvider = FutureProvider.autoDispose<List<CaptureEvent>>(
```

In `mobile/lib/esewa/review_screen.dart`, find:

```dart
    _sub = ref.read(esewaServiceProvider)?.onDraft.listen((_) => _load());
    _load();
  }
```

Replace it with:

```dart
    _sub = ref.read(esewaServiceProvider)?.onDraft.listen((_) => _load());
    // Everything the drafts alert announced is on this screen now.
    ref.read(esewaAlertsProvider).clearDrafts().catchError((_) {});
    _load();
  }
```

In `mobile/lib/screens/home_screen.dart`, find (1 of 3):

```dart
import '../esewa/models.dart';
```

Replace it with:

```dart
import '../esewa/captured_notifications_screen.dart';
import '../esewa/esewa_alerts.dart';
import '../esewa/models.dart';
```

In `mobile/lib/screens/home_screen.dart`, find (2 of 3):

```dart
      onResume: () {
        ref.invalidate(availableUpdateProvider);
        _startEsewa();
      },
    );
    _startEsewa();
    // Capturing an expense is the app's main job, so jump straight into voice capture on launch.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _openVoiceFlow(context, ref);
    });
  }
```

Replace it with:

```dart
      onResume: () {
        ref.invalidate(availableUpdateProvider);
        _startEsewa();
        _openAlertTarget();
      },
    );
    _startEsewa();
    WidgetsBinding.instance.addPostFrameCallback((_) => _openOnLaunch());
  }

  // Opened from a Piko alert: go where it points. Otherwise capturing an
  // expense is the app's main job, so jump straight into voice capture.
  Future<void> _openOnLaunch() async {
    if (await _openAlertTarget()) return;
    if (mounted) _openVoiceFlow(context, ref);
  }

  // True when Piko was opened from an alert and its screen is now showing.
  Future<bool> _openAlertTarget() async {
    final AlertTarget? target;
    try {
      target = await ref.read(esewaAlertsProvider).takeOpenTarget();
    } catch (_) {
      return false;
    }
    if (target == null || !mounted) return false;
    switch (target) {
      case AlertTarget.review:
        unawaited(_openReview(context));
      case AlertTarget.captured:
        unawaited(Navigator.of(context).push(MaterialPageRoute(builder: (_) => const CapturedNotificationsScreen())));
    }
    return true;
  }
```

In `mobile/lib/screens/home_screen.dart`, find (3 of 3):

```dart
    esewa.start().catchError((_) {}).whenComplete(() {
      if (mounted) ref.invalidate(esewaDraftCountProvider);
    });
  }
```

Replace it with:

```dart
    esewa.start().catchError((_) {}).whenComplete(() {
      if (mounted) ref.invalidate(esewaDraftCountProvider);
    });
    // Alerts start to matter once capture is on: Android 13+ asks once.
    esewa.isAccessGranted().then((on) {
      if (on && mounted) return ref.read(esewaAlertsProvider).askOnce();
    }).catchError((_) {});
  }
```

In `mobile/lib/screens/settings_screen.dart`, find (1 of 2):

```dart
    _lifecycle = AppLifecycleListener(onResume: () => ref.invalidate(esewaAccessProvider));
```

Replace it with:

```dart
    _lifecycle = AppLifecycleListener(
      onResume: () {
        ref.invalidate(esewaAccessProvider);
        ref.invalidate(esewaAlertsAllowedProvider);
      },
    );
```

In `mobile/lib/screens/settings_screen.dart`, find (2 of 2):

```dart
                    OutlinedButton(onPressed: esewa.openAccessSettings, child: const Text('Notification access')),
                  ],
                ),
              ),
```

Replace it with:

```dart
                    OutlinedButton(onPressed: esewa.openAccessSettings, child: const Text('Notification access')),
                  ],
                ),
              ),
              _SettingRow(
                title: 'Draft alerts',
                description: 'A notification when an eSewa payment becomes a draft, even with Piko closed, '
                    "and when Piko can't read one.",
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        ref.watch(esewaAlertsAllowedProvider).valueOrNull == true ? 'On' : 'Off',
                        key: const Key('esewa-alerts'),
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ),
                    OutlinedButton(
                      onPressed: () => ref.read(esewaAlertsProvider).request(),
                      child: const Text('Notifications'),
                    ),
                  ],
                ),
              ),
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd mobile; flutter analyze; flutter test; cd ..`
Expected: `No issues found!` and `+179: All tests passed!`

- [ ] **Step 5: Commit**

```bash
git add mobile/lib mobile/test
git commit -m "feat(esewa): open from an alert, Draft alerts in Settings, and ask once for the permission"
```

---

### Task 6: Docs, the phone checklist, and release 1.4.0+6

**Files:**
- Modify: `docs/architecture.md` (data model line; "eSewa capture" section)
- Modify: `mobile/README.md` (phone setup step 6, reconnecting, "Checking draft alerts on a phone")
- Modify: `mobile/pubspec.yaml` (`version: 1.4.0+6`)

- [ ] **Step 1: Update the docs and the version**

In `docs/architecture.md`, find (1 of 2):

```markdown
- **eSewa captures** — `captured_payments` (each transaction a member's phone read from an
  eSewa notification: `status` draft / approved / rejected / skipped, `expenseId` once
  approved), `capture_events`
```

Replace it with:

```markdown
- **eSewa captures** — `captured_payments` (each transaction a member's phone read from an
  eSewa notification: `status` draft / approved / rejected / skipped, `expenseId` once
  approved, `eventId` the notification it came from, unique per member), `capture_events`
```

In `docs/architecture.md`, find (2 of 2):

```markdown
  `mobile/test/esewa_parser_test.dart`.
- **Drafts never count.**
```

Replace it with:

```markdown
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
- **Drafts never count.**
```

In `mobile/README.md`, find:

```markdown
5. Make a small eSewa payment (e.g. a Rs. 10 top-up) and check that a draft appears.
```

Replace it with:

```markdown
5. Make a small eSewa payment (e.g. a Rs. 10 top-up) and check that a draft appears.
6. Allow Piko's notifications when it asks (Android 13+), or later in Settings → eSewa →
   **Draft alerts**. Without them capture still works, just without alerts.

If captures stop (often after an update) while Notification access still shows On, open
Piko once: it asks Android to reconnect. If that doesn't help, switch Piko's notification
access off and on.

### Checking draft alerts on a phone

Not covered by the automated tests; do these after installing a build that changes them:

1. Piko fully closed (swiped away) → pay with eSewa → within seconds, "Draft: Rs … to …";
   tapping it opens the review screen, and the alert is gone.
2. Two payments with Piko closed → one alert, "2 eSewa drafts to review".
3. Phone offline → pay → no alert. Back online, open Piko → the draft is there.
4. Piko open on screen → pay → no alert; Home's "to review" banner updates.
5. A message Piko can't read → "Piko couldn't read an eSewa notification"; tapping it
   opens Captured notifications.
6. Notifications turned off for Piko → pay → no alert, but the draft is still made.
```

In `mobile/pubspec.yaml`, find:

```yaml
version: 1.3.0+4
```

Replace it with:

```yaml
version: 1.4.0+6
```

- [ ] **Step 2: Build the release**

Run: `cd mobile; flutter analyze; flutter test; flutter build apk --release --split-per-abi; cd ..`
Expected: `No issues found!`, `+179: All tests passed!`, and three `√ Built` lines; `app-arm64-v8a-release.apk` is about 18 MB.

- [ ] **Step 3: Commit**

```bash
git add docs/architecture.md mobile/README.md mobile/pubspec.yaml
git commit -m "docs: eSewa draft alerts in the architecture doc and the phone checklist; release 1.4.0+6"
```

---

## STOP: hand over to the owner

Don't merge, push, migrate, deploy or publish. Send the owner:

1. The six commit hashes on `feat/esewa-draft-alerts`, and the final test counts (web 478, app 179) and `flutter analyze` result.
2. These release steps, in this order. The website must go first: the old app works with the new server, but the new app needs the server's `created` reply to alert only once.
   1. Merge to `main`, run `npm run db:migrate` against the real database (adds `captured_payments.event_id` and its unique constraint; existing rows keep a null id), and deploy the website.
   2. Publish `mobile/build/app/outputs/flutter-apk/app-arm64-v8a-release.apk` in Settings → App updates on the website, as version `1.4.0` build `6`.
   3. On the phone: install the update, open Piko once, allow notifications when asked, then work through "Checking draft alerts on a phone" in `mobile/README.md`.
