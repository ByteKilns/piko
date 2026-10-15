# eSewa Auto-Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. If you don't have those skills, do the tasks in order, one step at a time. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the owner's eSewa payments into drafts automatically, by reading eSewa's Android notifications, so that each one becomes an expense only after the owner approves it in the app.

**Architecture:** Ten tasks on one branch, in two phases. Phase 1 (Tasks 1–4) is the website: a duplicate-name check for categories, a word → category table built from past expense notes, three new tables (`captured_payments`, `capture_events`, `capture_rules`) and the mobile endpoints that store, list, approve and reject captures. Drafts never enter `expenses`: approving one calls the existing `createExpenseForHousehold`. Phase 2 (Tasks 5–10) is the Flutter app: category suggestions from the note, the provided eSewa module (a Kotlin notification listener plus a Dart parser, deduplicator and categorizer) wired to the server through a `PikoTxnRepository`, a Review screen reached from Home, an eSewa section in Settings with a log of captured notifications, and the docs. Each task is one commit that leaves everything building with every test passing.

**Tech Stack:** Next.js 16 route handlers, Drizzle ORM (PostgreSQL), Zod 4, Vitest; Flutter 3.44 / Dart 3.12, flutter_riverpod 2, http, flutter_test; Kotlin (an Android `NotificationListenerService`); Husky pre-commit hook (`tsc` + `next build`).

**Spec:** There is no separate spec file. The design is the "Design (agreed)" section below: points 1–10 were agreed with the owner one by one on 2026-10-14, and points 11–13 were decided in this plan, which the owner approves by approving the plan. Read the Design section fully before starting.

**Verified:** on 2026-10-15 this whole plan was built and then checked by following it literally:
- **Dry run:** it was built first in a throwaway copy of the repo from `93735b8`. Each of the ten commits went through the real pre-commit hook (`tsc` and a full `next build`).
- **Replay:** this file was then followed step by step in a fresh copy of `main` at `0663df3`. Every step applied cleanly in order; each task's new tests failed first with the error shown in its Step 2 and then passed; and after each task the code matched the dry run file for file. Only the generated `drizzle/meta` files differ, in their random id and timestamp.
- **Counts after each task:** web tests 426, 437, 437, 441 (Tasks 1–4); app tests 108, 129, 141, 152, 154, 154 (Tasks 5–10); `flutter analyze` clean and lint at 0 errors throughout.
- **The server was exercised against a throwaway PostgreSQL** with every migration applied (never the real database): 28 API checks (status from the direction, the time window, approving twice → 409, a failed approve putting the draft back, the other member seeing and approving nothing, rules updated in place), plus one run of the app's own Dart code against it (parse → de-duplicate → store → approve → learn the payee, with OTP digits masked in the log).
- `flutter build apk --release --split-per-abi` built all three APKs (arm64: 18.2 MB), and the notification listener is in the release manifest.
- **Not run:** anything on a real phone (notification access, the listener, a real eSewa payment). Those are the owner's checks at the final STOP.

If a step doesn't match what you see, something has changed since then. Stop and report rather than improvise.

## How to use this plan

- Do the tasks **in order**, 1 → 10. There are two **STOP checkpoints**: after Task 4, when the website half is done and the owner updates the database, and at the end. At each one, stop, send the owner the report it describes, and wait for them before going on.
- Code blocks are complete. Every code step is one of these kinds:
  - **"Create `path` with:"** — a new file; paste the whole block.
  - **"Replace the whole of `path` with:"** — overwrite the file with the whole block.
  - **"In `path`, find:" … "Replace it with:"** — find the exact old text (match by text, not line number) and replace it with the new text. Each old block occurs exactly once in the file at that point. When a file has several, they're numbered "(1 of 3)" and so on; do them in that order.
- Before Task 1, create the branch once from `main`: `git switch -c feat/esewa-capture`. Every task commits to that branch.
- Flutter commands must run inside `mobile/`. Each one is written as `cd mobile; <command>; cd ..` so you end up back at the repo root, where every other command runs.
- `esewa_capture.zip` in the repo root is the module the owner was given. Everything this plan needs from it is written out in full below, so you don't need to open it. **Don't commit it and don't delete it.**

## Design (agreed)

### Why

The owner pays with eSewa many times a day and types each payment into Piko by hand. eSewa has no API for reading a person's own transactions, but its Android app posts a notification for each one. Piko's app, installed from an APK on the owner's phone, can read those notifications, turn each payment into a **draft**, and let the owner approve it. Only an approved draft becomes an expense; until then it must not count anywhere.

### Agreed with the owner (2026-10-14)

1. **Integrate the provided module; don't rewrite it.** The module has a Kotlin `NotificationListenerService` that only captures and forwards, and Dart code that does all the parsing: `EsewaParser` (`ParserRules`), `Deduplicator`, `Categorizer` and `EsewaService`, behind a `TxnRepository` interface. Its parser rules and deduplicator are used exactly as they are. The notification wording in its parser is a guess until real eSewa texts are collected (see point 12), so `ParserRules` isn't tuned in this plan.
2. **Drafts are stored on the server, in their own table** (`captured_payments`), never in `expenses`. So no total, report, budget, alert or Home figure can count a draft, and nothing about `expenses` or the money maths changes. The module's README suggests a `status` column on the expense table instead; that was rejected, because every query that reads expenses, now and later, would have to remember to leave drafts out. **Approving** a draft first claims it (draft → approved in one update), then calls the existing `createExpenseForHousehold`, so an approved payment is an ordinary expense added from mobile: the same validation, notifications, activity log entry and undo. A double tap or a retry can't create a second expense, and if creating fails the draft is put back.
3. **Money coming in is skipped.** Cashback, refunds and transfers received are stored with status `skipped`: the duplicate check sees them, but they're never offered for review and no income is written. (Income in Piko is per person per month, and money received is usually a loan repayment, a dhuku payout or a friend settling up, not income.)
4. **Each person's own.** A capture belongs to the member whose phone captured it, worked out from their sign-in, and only they see it. Drafts appear only in the app, not on the website. Learned payee → category rules are per person.
5. **Tapping a draft opens the app's existing Add expense sheet**, filled in from the draft, titled "Approve payment" with an **Approve** button. Amount, Category, For, Paid by, Date and Note can all be changed. A changed category is learned for that payee. Learning is keyed by the **payee from the notification**, never by the note: the owner writes notes like "T shirt from Basemark" or "groceries, banana", which may or may not name the shop.
6. **No AI.** Nothing from a notification goes to Gemini or any other AI. The privacy rule in `AGENTS.md` stays exactly as it is.
7. **The category follows the note.** In the Add expense sheet, everywhere it's used (typed, voice, eSewa), typing a note picks the category the household's past notes point to:
   - The server builds a word → category table from every note the household has written: for each word, the category its **last 5 uses** point to, a tie going to the most recent. Only active categories count. Words found in exactly one category's name fill the gaps ("petrol" → Petrol) but never override a word from the notes. Filler words ("from", "the", "and", romanised Nepali "ko", "lai" …), one-letter words and bare numbers are ignored.
   - `GET /api/mobile/categories` sends the table as `noteWords` (word → category id). It stays small (tens of KB after years of notes) and the lookup runs on the phone, so typing never waits on the network.
   - Once a category is picked by hand (the dropdown or a chip), the note stops changing it. A small "From your notes" line shows when the suggestion set it. A voice draft keeps Gemini's category until its note is edited.
8. **Starting guesses use the household's own category names.** Only the right-hand values of the categorizer's tables change:

   | eSewa payee or text | Category |
   | --- | --- |
   | NEA, Nepal Electricity | Electricity |
   | Khanepani, KUKL, water supply | Water |
   | NTC, Ncell, Smart Cell; any top-up or recharge | Mobile/Telephone |
   | WorldLink, Vianet, Subisu, DishHome, Classic Tech, NetTV; text with internet, wifi, TV | Internet |
   | Daraz, SastoDeal, HamroBazar | Shopping |
   | Foodmandu, Bhojdeals, Pathao Food, Foodpanda | Dining Out |
   | Cafe, restaurant, momo, bakery, khaja, chiya, tea house | Lunch |
   | Pathao, inDrive, Tootle, Yango; Buddha Air, Yeti, airlines, bus sewa, travels | Transportation |
   | Petrol, fuel, Nepal Oil, pump | Petrol |
   | Bhatbhateni, Big Mart, Salesberry, kirana, grocery, mart | Groceries |
   | Pharmacy, hospital, clinic, medic, aushadhi | Medicine |
   | Insurance, LIC | Insurance |
   | QFX, Big Movies, FCube, Netflix, Spotify, YouTube | Entertainment |
   | Text with electricity or water bill | Utilities |
   | Text with loan, EMI, installment | EMI |
   | Any other bill payment | Bills |
   | School, college, fees, tuition, rent, money sent to a person, anything else | no guess: the draft shows "Pick a category" |

   A guess only counts when the household has a category with that name (ignoring capitals); otherwise the draft waits for a pick.
9. **Five fixes to the module**, found while checking it against this repo:
   1. **It lost payments when offline.** Its native queue was emptied before Dart had stored anything, and live notifications weren't queued at all. Now every notification is queued first and stays until Dart acks it, after the server has it. The queue also tells notifications apart by time as well as key, because an app may reuse one notification slot: the original kept only the first of two payments made while Piko was closed.
   2. **It sent OTPs to the server.** Every notification is logged before parsing. Digits are now masked (•) in messages the parser ignores (OTP, login, promos), so the log keeps their wording but never a code.
   3. **Swipe-approve and "Approve all" can't approve a draft without one of the household's categories.** Such a draft stays for a pick; swiping it right opens the sheet instead.
   4. **The review screen didn't follow the app's design** (hard-coded green and red, stock Material). It's rebuilt with the app's shared widgets and `context.piko` colours.
   5. **The activity log** records approving, as an expense added from mobile, and undo works as for any expense. Captures and rejections aren't logged: they're a personal inbox, not household data, and would flood the log. This is a deliberate exception to "every household data mutation is logged".
10. **Duplicate category names are blocked on the website.** The household had two categories called "Books" (the owner is archiving the empty one; that's not part of this plan). Adding or renaming a category now checks the household's other categories by name, ignoring capitals and extra spaces. An active match says "You already have a category called Books."; an archived one says "Parents is archived. Restore it from the Archived tab instead." It's checked on the server, so it covers both the Categories page and "Add as new category" in the expense form, and it shows as an error under Name. Near spellings ("Book" / "Books") aren't blocked.

### Decided in this plan

11. **Endpoints**, all behind `requireMobileAuth` and scoped to the signed-in household **and member**:

    | Endpoint | Does |
    | --- | --- |
    | `GET /api/mobile/captures` | the member's drafts, newest first |
    | `POST /api/mobile/captures` | stores one parsed transaction. The server sets its status from its direction (debit → draft, credit → skipped), so the app can't file anything as approved |
    | `GET /api/mobile/captures/around?at=&seconds=` | captures in any status within the window, for the duplicate check |
    | `POST /api/mobile/captures/approve` `{ id, expense }` | claims the draft and creates the expense; 409 when it isn't a draft, 400 for an invalid expense |
    | `POST /api/mobile/captures/reject` `{ id }` | hides a draft; 409 when it isn't one |
    | `GET` / `POST /api/mobile/capture-events` | the latest 50 notifications / log one (a repeat is ignored) |
    | `GET` / `POST /api/mobile/capture-rules` | the member's payee rules / add or update some. It never deletes, because a set loaded while offline may be missing older rules |

    IDs travel in the request body, not the URL, so no dynamic route segment is needed.
12. **Screens:**
    - **Home:** when drafts wait, a strip in the update strip's style says "3 eSewa payments to review", with **Review**. It refreshes when a payment is captured and when you come back from Review. Capture catches up whenever the app opens or comes back to the front.
    - **Review:** "eSewa payments" over a 2px ink rule. Each row has the category's icon, the payee (or "Top-up", "Bill payment" …), the category or a red "Pick a category", the date and time, and the amount. Swipe right (ink, ✓ Approve) or left (red, ✕ Reject), or tap to check it in the sheet. **Approve all** in the app bar approves the drafts that have a category.
    - **Settings → eSewa** (on Android, when signed in): **Auto-capture** On/Off with a **Notification access** button, rechecked when you come back to the app, and **Captured notifications**, the latest 50 notifications, each with **Copy** (its title and text, for tuning the parser).
13. **Release:** version `1.3.0+4`. The owner builds and publishes the APK (see `mobile/README.md`).

### Out of scope (do NOT build)

- Credits as income; drafts on the website; note suggestions in the website's Add expense dialog.
- Changing `ParserRules`, the deduplicator or the parser's behaviour beyond the five fixes in point 9.
- A `status` column on `expenses`, or any change to how money is counted.
- Sending anything to an AI.
- iOS, SMS or statement import.
- New packages, `flutter pub upgrade`, or changes to `pubspec.lock`.

## Global Constraints

- **Staging:** stage files only by exact path, as each task's commit step lists them. Never use `git add -A`, `git add .`, `git commit -a`, `git stash`, `git checkout -- <file>` or `git reset --hard`. Never stage `esewa_capture.zip`.
- **Shell:** this is a Windows machine. Commands work in both PowerShell and Git Bash unless a step says otherwise, and run from the repo root `C:\Users\nirja\OneDrive\Documents\piko`.
- **Line endings:** files are checked out with Windows line endings (CRLF), while the code blocks in this plan use LF. If your edit tool matches text byte for byte, compare line by line and ignore `\r`. Don't convert whole files' line endings.
- **Pre-commit hook:** it runs `npx tsc --noEmit` then `npm run build` on every commit, even one that only touches `mobile/`, and takes 1–2 minutes. That's expected. **Never use `--no-verify`.** If the hook fails, read the error, fix the code, `git add` the same files again, and commit again. If `tsc` complains that `LayoutProps` or `PageProps` can't be found, run `npx next typegen` once and commit again.
- **Web checks:** `npx vitest run` must pass with the count each task gives. Two existing tests depend on the clock and can fail on `main` too: in `src/modules/voice-entry/lib/sanitize-voice-expense.test.ts`, "falls back to today's date …" fails between midnight and 05:45 Nepal time, and in `src/lib/nepali-date.test.ts`, "round-trips every day …" can time out when the machine is busy. If only those fail, run them again later; don't change them. `npm run lint` must show **0 errors**; the 2 existing warnings (`NepaliDateField.tsx`, `ExpenseDialog.tsx`) are fine.
- **Flutter checks:** `cd mobile; flutter analyze; cd ..` must end with `No issues found!`, and `cd mobile; flutter test; cd ..` with `All tests passed!` and the count each task gives.
- **Database:** run `npm run db:generate -- --name esewa_captures` exactly once, in Task 3. It only writes files and doesn't touch any database. Never run `npm run db:migrate` or `npm run db:seed`: the owner migrates at the first STOP.
- **Household and member scoping:** every capture query takes the `CurrentMember` from `requireMobileAuth` and filters by both `householdId` and `memberId`. Never take either from the request body or URL.
- **Privacy:** nothing from a notification, a capture or a note is sent to Gemini or any other AI.
- **Colours and fonts (app):** never hard-code a colour in a screen or widget; read `context.piko`. The only literal colours allowed are `Colors.white` (text on the red fill) and `Colors.transparent`. Use font weights 400, 600 and 800 only.
- **The module:** copy its files as given here. Don't reformat them, and don't change `ParserRules`, `Deduplicator` or `EsewaParser`.
- **Don't run `dart format`** on whole files; it would reformat code this plan doesn't change.
- **Comments:** short `//` comments that say *why*, matching the surrounding code.
- **Edits:** change only what each step says. Don't rename, reformat or "tidy" other code. If a "find" block doesn't match exactly, find the same code by meaning, make the same change, and mention it in your report.

## Review Focus

The five things most likely to go wrong for the person using this, each pinned by a test in the task that owns it:

1. **A payment made with no data connection, or with Piko closed.** It must still become a draft once the app is open and online, never be dropped, and never be stored twice. Pinned in Task 6 by "keeps a payment queued when it could not be stored, and stores it next time" and "two drains at once store a payment only once".
2. **A draft whose guess isn't one of the household's categories** (a transfer to a person, a school fee). It must never be approved into a category that doesn't exist: swiping right opens the sheet, and Approve all leaves it. Pinned in Task 7 by "can't approve as it is without one of the household's categories", and in Task 8 by "swiping right on a draft without a category opens the sheet instead" and "Approve all approves only the drafts that have a category".
3. **A note that doesn't name the shop.** Changing the category while approving must teach the payee from the notification, not the note. Pinned in Task 8 by "approving from the sheet uses what was picked and learns it for that payee".
4. **A late-night payment.** It must be filed on the day it was paid by the phone's clock, not the UTC day, and stored with its exact time. Pinned in Task 7 by "approving files it for and paid by me, on the day it was paid, with the payee as the note" (23:30 local) and "stores a capture with its time in UTC".
5. **OTP and login notifications.** Their codes must never reach the server. Pinned in Task 7 by "masks the digits of OTP and login messages in the log, and only those".

Also worth a reviewer's eye, with no automated test in this repo:

- **Approving twice, and member scoping, on the server** (the claim in `approveCaptureForMember`, and every query filtering by member). The repo has no database tests. In the dry run these were exercised against a throwaway PostgreSQL: a second approve got 409, a failed approve put the draft back, and the other member could neither see nor approve the drafts.
- **The Android side** (the listener, the queue and notification access) needs a real phone. The owner's test payment at the final STOP covers it.
- **Settings → eSewa** only shows on Android, so no widget test covers it.

---

### Task 1: A category name can't be used twice

Design point 10. The categorizer and the Review screen match categories by name, and the household already had two called "Books". `categoryNameClash` is a pure helper. The two actions call it with every category in the household, archived ones too, and **return** its message rather than throwing it: in production, Next hides the message of anything a server action throws (see "Handling expected errors" in `node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md`). Both category forms show it under Name.

**Files:**

- Modify: `src/modules/categories/api/categories.actions.ts`
- Modify: `src/modules/categories/components/CategoryDialog.tsx`
- Modify: `src/modules/categories/components/CategoryFormModal.tsx`
- Test: `src/modules/categories/lib/category-name.test.ts` (new)
- Create: `src/modules/categories/lib/category-name.ts`

**Interfaces:**

- Produces: `categoryNameClash(name: string, categories: { archived: boolean; id: string; name: string }[], exceptId?: string): null | string` in `src/modules/categories/lib/category-name.ts`.
- Produces: `createCategoryAction(input)` now resolves to `{ error: string; ok: false } | { category; ok: true }`, and `updateCategoryAction(id, input)` to `{ error: string; ok: false } | undefined` (undefined once saved). Their only callers are the two forms changed here.

- [ ] **Step 1: Write the failing tests**

Create `src/modules/categories/lib/category-name.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

import { categoryNameClash } from "./category-name";

const categories = [
  { archived: false, id: "c1", name: "Books" },
  { archived: false, id: "c2", name: "Dining Out" },
  { archived: true, id: "c3", name: "Parents" },
];

describe("categoryNameClash", () => {
  it("allows a name nobody has", () => {
    expect(categoryNameClash("Groceries", categories)).toBeNull();
  });

  it("blocks a name an active category has, ignoring capitals and spaces", () => {
    expect(categoryNameClash("  books ", categories)).toBe("You already have a category called Books.");
    expect(categoryNameClash("dining   out", categories)).toBe("You already have a category called Dining Out.");
  });

  it("points to the archived category instead of making a second one", () => {
    expect(categoryNameClash("parents", categories)).toBe("Parents is archived. Restore it from the Archived tab instead.");
  });

  it("lets a category keep its own name when it is renamed", () => {
    expect(categoryNameClash("BOOKS", categories, "c1")).toBeNull();
  });

  it("names the active one when an archived category has the same name", () => {
    const withArchivedTwin = [{ archived: true, id: "c9", name: "Books" }, ...categories];
    expect(categoryNameClash("Books", withArchivedTwin)).toBe("You already have a category called Books.");
  });

  it("doesn't treat a near spelling as the same name", () => {
    expect(categoryNameClash("Book", categories)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the new tests and watch them fail**

Run:

```bash
npx vitest run src/modules/categories/lib/category-name.test.ts
```

Expected: FAIL, with `Error: Cannot find module './category-name'`

- [ ] **Step 3: Implement**

Create `src/modules/categories/lib/category-name.ts` with:

```ts
type NamedCategory = { archived: boolean; id: string; name: string };

// Two names are the same category when they differ only in capitals or spacing.
function normalize(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

// Why a new or renamed category can't be called `name`, or null when it can.
// `exceptId` is the category being renamed, which may keep its own name. An
// archived match points back to it, so a name never ends up in use twice.
export function categoryNameClash(name: string, categories: NamedCategory[], exceptId?: string): null | string {
  const wanted = normalize(name);
  const same = categories.filter((c) => c.id !== exceptId && normalize(c.name) === wanted);
  const active = same.find((c) => !c.archived);
  if (active) return `You already have a category called ${active.name}.`;
  if (same.length > 0) return `${same[0].name} is archived. Restore it from the Archived tab instead.`;
  return null;
}
```

In `src/modules/categories/api/categories.actions.ts`, find (1 of 3):

```ts
import { activityActor, logActivity } from "@/modules/activity/api/activity";

import { categoryChanges, categorySummary } from "../lib/category-activity";
import { type CategoryInput, categorySchema } from "../schemas/category.schema";

function revalidateCategoryPaths() {
  revalidatePath("/categories");
```

Replace it with:

```ts
import { activityActor, logActivity } from "@/modules/activity/api/activity";

import { categoryChanges, categorySummary } from "../lib/category-activity";
import { categoryNameClash } from "../lib/category-name";
import { type CategoryInput, categorySchema } from "../schemas/category.schema";
import { listCategories } from "./categories";

type SavedCategory = { archived: boolean; budgetType: "fixed" | "flexible"; groupName: string; icon: null | string; id: string; name: string };

// A name already in use is an expected error, so it comes back as a value:
// Next hides the message of anything a server action throws in production.
type NameTaken = { error: string; ok: false };

function revalidateCategoryPaths() {
  revalidatePath("/categories");
```

In `src/modules/categories/api/categories.actions.ts`, find (2 of 3):

```ts
  return category;
}

export async function createCategoryAction(input: CategoryInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = categorySchema.parse(input);

  const [row] = await db
    .insert(categories)
```

Replace it with:

```ts
  return category;
}

export async function createCategoryAction(input: CategoryInput): Promise<NameTaken | { category: SavedCategory; ok: true }> {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = categorySchema.parse(input);
  const clash = categoryNameClash(parsed.name, await listCategories(householdId, { includeArchived: true }));
  if (clash) return { error: clash, ok: false };

  const [row] = await db
    .insert(categories)
```

In `src/modules/categories/api/categories.actions.ts`, find (3 of 3):

```ts
  revalidateCategoryPaths();

  return category;
}

export async function updateCategoryAction(id: string, input: CategoryInput) {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = categorySchema.parse(input);

  const before = await findCategoryInHousehold(householdId, id);
  if (!before) return;

  const [updated] = await db
    .update(categories)
```

Replace it with:

```ts
  revalidateCategoryPaths();

  return { category, ok: true };
}

// Resolves to undefined once saved (or when there's no such category).
export async function updateCategoryAction(id: string, input: CategoryInput): Promise<NameTaken | undefined> {
  const member = await getCurrentMember();
  const { householdId } = member;
  const parsed = categorySchema.parse(input);

  const before = await findCategoryInHousehold(householdId, id);
  if (!before) return;
  const clash = categoryNameClash(parsed.name, await listCategories(householdId, { includeArchived: true }), id);
  if (clash) return { error: clash, ok: false };

  const [updated] = await db
    .update(categories)
```

In `src/modules/categories/components/CategoryDialog.tsx`, find:

```tsx
    try {
      const payload = { budgetType, groupName, icon, name: name.trim() };
      if (category) {
        await updateCategoryAction(category.id, payload);
        toast.success("Category updated");
      } else {
        await createCategoryAction(payload);
        toast.success("Category added");
      }
      onDone();
```

Replace it with:

```tsx
    try {
      const payload = { budgetType, groupName, icon, name: name.trim() };
      if (category) {
        const taken = await updateCategoryAction(category.id, payload);
        if (taken) {
          setError(taken.error);
          return;
        }
        toast.success("Category updated");
      } else {
        const result = await createCategoryAction(payload);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        toast.success("Category added");
      }
      onDone();
```

In `src/modules/categories/components/CategoryFormModal.tsx`, find (1 of 2):

```tsx
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<CategoryInput>({
    defaultValues: category ?? { ...EMPTY, name: defaultName ?? "" },
    resolver: zodResolver(categorySchema),
```

Replace it with:

```tsx
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<CategoryInput>({
    defaultValues: category ?? { ...EMPTY, name: defaultName ?? "" },
    resolver: zodResolver(categorySchema),
```

In `src/modules/categories/components/CategoryFormModal.tsx`, find (2 of 2):

```tsx
  const onSubmit = handleSubmit(async (values) => {
    try {
      if (category) {
        await updateCategoryAction(category.id, values);
        toast.success("Category updated");
      } else {
        const created = await createCategoryAction(values);
        toast.success("Category added");
        if (created) onCreated?.(created);
      }
      onOpenChange(false);
    } catch (err) {
```

Replace it with:

```tsx
  const onSubmit = handleSubmit(async (values) => {
    try {
      if (category) {
        const taken = await updateCategoryAction(category.id, values);
        if (taken) {
          setError("name", { message: taken.error });
          return;
        }
        toast.success("Category updated");
      } else {
        const result = await createCategoryAction(values);
        if (!result.ok) {
          setError("name", { message: result.error });
          return;
        }
        toast.success("Category added");
        onCreated?.(result.category);
      }
      onOpenChange(false);
    } catch (err) {
```

- [ ] **Step 4: Run the new tests again**

Run:

```bash
npx vitest run src/modules/categories/lib/category-name.test.ts
```

Expected: `Tests  6 passed (6)`

- [ ] **Step 5: Run every check**

Run:

```bash
npx vitest run
npx tsc --noEmit
npm run lint
```

Expected: `Tests  426 passed (426)`; `tsc` prints nothing; lint shows 0 errors (the 2 existing warnings are fine).

- [ ] **Step 6: Commit**

```bash
git add src/modules/categories/api/categories.actions.ts src/modules/categories/components/CategoryDialog.tsx src/modules/categories/components/CategoryFormModal.tsx src/modules/categories/lib/category-name.test.ts src/modules/categories/lib/category-name.ts
git commit -m "feat(categories): a category name can't be used twice"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.

### Task 2: A word → category table from past notes

Design point 7, the server half. `noteWords` splits a note into words the same way the app will (Task 5 copies the filler list), and `noteCategoryTable` builds the table from the household's notes, newest first. It works with a `Map` inside, so words that are also object property names, like "constructor", can't confuse it. `noteCategoryTableForHousehold` reads every expense with a note, and the categories route sends the result as `noteWords`. The field is additive, so installed apps ignore it.

**Files:**

- Modify: `src/app/api/mobile/categories/route.ts`
- Create: `src/modules/expenses/api/note-words.ts`
- Test: `src/modules/expenses/lib/note-words.test.ts` (new)
- Create: `src/modules/expenses/lib/note-words.ts`

**Interfaces:**

- Produces: `noteWords(note: string): string[]` and `noteCategoryTable(samples: { categoryId: string; note: string }[], categories: { id: string; name: string }[]): Record<string, string>` in `src/modules/expenses/lib/note-words.ts`. `samples` are newest first; `categories` are the active ones.
- Produces: `noteCategoryTableForHousehold(householdId: string): Promise<Record<string, string>>` in `src/modules/expenses/api/note-words.ts`.
- Produces: `GET /api/mobile/categories` gains `noteWords: { [word: string]: categoryId }` (Task 5 reads it).

- [ ] **Step 1: Write the failing tests**

Create `src/modules/expenses/lib/note-words.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

import { noteCategoryTable, noteWords } from "./note-words";

const categories = [
  { id: "groceries", name: "Groceries" },
  { id: "lunch", name: "Lunch" },
  { id: "dates", name: "Dates" },
  { id: "shopping", name: "Shopping" },
  { id: "petrol", name: "Petrol" },
  { id: "other-personal", name: "Other Personal" },
  { id: "personal", name: "Personal" },
];

describe("noteWords", () => {
  it("lowercases and splits on anything that isn't a letter or digit", () => {
    expect(noteWords("Groceries, BANANA & apples")).toEqual(["groceries", "banana", "apples"]);
  });

  it("drops filler words, one-letter words and bare numbers", () => {
    expect(noteWords("T shirt from Basemark for 1500")).toEqual(["shirt", "basemark"]);
    expect(noteWords("momo ko lagi")).toEqual(["momo"]);
  });

  it("keeps words in any script", () => {
    expect(noteWords("केरा र स्याउ")).toEqual(["केरा", "स्याउ"]);
  });
});

describe("noteCategoryTable", () => {
  it("maps each word to the category it was written under", () => {
    const table = noteCategoryTable([{ categoryId: "groceries", note: "banana and apples" }], categories);
    expect(table.banana).toBe("groceries");
    expect(table.apples).toBe("groceries");
  });

  it("follows the last five uses, so a recent change of habit wins", () => {
    // Newest first: lately momo is filed under Lunch, before that under Dates.
    const samples = [
      ...Array.from({ length: 3 }, () => ({ categoryId: "lunch", note: "momo" })),
      ...Array.from({ length: 6 }, () => ({ categoryId: "dates", note: "momo" })),
    ];
    expect(noteCategoryTable(samples, categories).momo).toBe("lunch");
  });

  it("gives a tie to the most recent use", () => {
    const samples = [
      { categoryId: "dates", note: "momo" },
      { categoryId: "lunch", note: "momo" },
    ];
    expect(noteCategoryTable(samples, categories).momo).toBe("dates");
  });

  it("counts a word once per expense", () => {
    const samples = [
      { categoryId: "shopping", note: "shirt shirt shirt" },
      { categoryId: "shopping", note: "shirt" },
      { categoryId: "groceries", note: "shirt" },
      { categoryId: "groceries", note: "shirt" },
    ];
    // 2 uses each, so the newest (Shopping) wins rather than the repeated word.
    expect(noteCategoryTable(samples, categories).shirt).toBe("shopping");
  });

  it("skips expenses whose category isn't active any more", () => {
    const samples = [
      { categoryId: "parents", note: "medicine" },
      { categoryId: "groceries", note: "medicine" },
    ];
    expect(noteCategoryTable(samples, categories).medicine).toBe("groceries");
  });

  it("fills gaps with words found in exactly one category's name", () => {
    const table = noteCategoryTable([], categories);
    expect(table.petrol).toBe("petrol");
    expect(table.groceries).toBe("groceries");
    expect(table.other).toBe("other-personal");
    // "personal" is in two names, so it says nothing.
    expect(table.personal).toBeUndefined();
  });

  it("lets what was written in notes beat a category's name", () => {
    const table = noteCategoryTable([{ categoryId: "groceries", note: "petrol station snacks" }], categories);
    expect(table.petrol).toBe("groceries");
  });

  it("handles words that are also object property names", () => {
    expect(Object.hasOwn(noteCategoryTable([], categories), "constructor")).toBe(false);
    const table = noteCategoryTable([{ categoryId: "shopping", note: "constructor set" }], categories);
    expect(Object.hasOwn(table, "constructor")).toBe(true);
    expect(table["constructor"]).toBe("shopping");
  });
});
```

- [ ] **Step 2: Run the new tests and watch them fail**

Run:

```bash
npx vitest run src/modules/expenses/lib/note-words.test.ts
```

Expected: FAIL, with `Error: Cannot find module './note-words'`

- [ ] **Step 3: Implement**

Create `src/modules/expenses/lib/note-words.ts` with:

```ts
// Words that say nothing about what was bought, in English and in romanised
// Nepali.
const FILLER = new Set([
  "a", "an", "and", "at", "by", "for", "from", "in", "is", "me", "my", "of", "on", "or", "our", "the", "to", "was", "with",
  "bata", "ka", "ki", "ko", "lagi", "lai", "le", "ma", "ra",
]);

// How many of a word's latest uses decide its category.
const LAST_USES = 5;

// The words of a note, lowercased: runs of letters (with their accents and
// vowel signs, so Devanagari stays whole) and digits, at least two long,
// without filler words or bare numbers. The app splits notes the same way.
export function noteWords(note: string): string[] {
  const words = note.toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
  return words.filter((word) => word.length >= 2 && !FILLER.has(word) && !/^\p{N}+$/u.test(word));
}

// The category used most often in `uses` (newest first); a tie goes to the
// most recent.
function mostUsed(uses: string[]): string {
  const counts = new Map<string, number>();
  for (const id of uses) counts.set(id, (counts.get(id) ?? 0) + 1);
  const top = Math.max(...counts.values());
  return uses.find((id) => counts.get(id) === top)!;
}

// For each word the household has written in a note (`samples`, newest
// first), the category its last five uses point to. Only active categories
// count. Words found in exactly one category's name fill the gaps, so
// "petrol" suggests Petrol before anyone has written it in a note.
export function noteCategoryTable(
  samples: { categoryId: string; note: string }[],
  categories: { id: string; name: string }[],
): Record<string, string> {
  const active = new Set(categories.map((c) => c.id));
  const uses = new Map<string, string[]>();
  for (const sample of samples) {
    if (!active.has(sample.categoryId)) continue;
    for (const word of new Set(noteWords(sample.note))) {
      const list = uses.get(word) ?? [];
      if (list.length < LAST_USES) uses.set(word, [...list, sample.categoryId]);
    }
  }

  const table = new Map([...uses].map(([word, list]) => [word, mostUsed(list)]));

  const owners = new Map<string, Set<string>>();
  for (const category of categories) {
    for (const word of noteWords(category.name)) owners.set(word, (owners.get(word) ?? new Set()).add(category.id));
  }
  for (const [word, ids] of owners) {
    if (ids.size === 1 && !table.has(word)) table.set(word, [...ids][0]);
  }

  return Object.fromEntries(table);
}
```

Create `src/modules/expenses/api/note-words.ts` with:

```ts
import { and, desc, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db/client";
import { expenses } from "@/db/schema";
import { listCategories } from "@/modules/categories/api/categories";

import { noteCategoryTable } from "../lib/note-words";

// The word → category table the app's Add expense sheet suggests from, built
// from every note the household has written, newest first.
export async function noteCategoryTableForHousehold(householdId: string) {
  const [samples, categories] = await Promise.all([
    db
      .select({ categoryId: expenses.categoryId, note: expenses.note })
      .from(expenses)
      .where(and(eq(expenses.householdId, householdId), isNotNull(expenses.note)))
      .orderBy(desc(expenses.date), desc(expenses.createdAt)),
    listCategories(householdId),
  ]);
  return noteCategoryTable(
    samples.flatMap((s) => (s.note === null ? [] : [{ categoryId: s.categoryId, note: s.note }])),
    categories,
  );
}
```

Replace the whole of `src/app/api/mobile/categories/route.ts` with:

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requireMobileAuth } from "@/lib/mobile-request";
import { getHouseholdMembers } from "@/lib/session";
import { listCategories } from "@/modules/categories/api/categories";
import { noteCategoryTableForHousehold } from "@/modules/expenses/api/note-words";

export async function GET(request: NextRequest) {
  const auth = await requireMobileAuth(request);
  if (auth instanceof NextResponse) return auth;

  const [categories, members, noteWords] = await Promise.all([
    listCategories(auth.householdId),
    getHouseholdMembers(auth.householdId),
    noteCategoryTableForHousehold(auth.householdId),
  ]);

  return NextResponse.json({
    categories: categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon })),
    // Lets the app say "Me" and pick the signed-in person by default.
    currentMemberId: auth.memberId,
    members: members.map((m) => ({ id: m.id, name: m.user.name })),
    // Word → category id, for suggesting a category as a note is typed.
    noteWords,
  });
}
```

- [ ] **Step 4: Run the new tests again**

Run:

```bash
npx vitest run src/modules/expenses/lib/note-words.test.ts
```

Expected: `Tests  11 passed (11)`

- [ ] **Step 5: Run every check**

Run:

```bash
npx vitest run
npx tsc --noEmit
npm run lint
```

Expected: `Tests  437 passed (437)`; `tsc` prints nothing; lint shows 0 errors (the 2 existing warnings are fine).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/mobile/categories/route.ts src/modules/expenses/api/note-words.ts src/modules/expenses/lib/note-words.test.ts src/modules/expenses/lib/note-words.ts
git commit -m "feat(mobile-api): send a word-to-category table built from past notes"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.

### Task 3: Tables for captured payments, notifications and payee rules

Design points 2–4. Three tables, each with `householdId` and `memberId` (both cascade on delete):

- `captured_payments`: `status` is draft / approved / rejected / skipped. `expenseId` is set once approved and goes back to null if that expense is later deleted; the capture stays approved, so the payment isn't drafted again. Times keep milliseconds and a time zone (`precision: 3, withTimezone: true`), so the app's times round-trip exactly.
- `capture_events`: unique on `(memberId, key, postedAt)`, so a notification the app resends is ignored.
- `capture_rules`: unique on `(memberId, counterparty)`, so a rule can be updated in place.

There are no tests here; the migration's SQL is the check.

**Files:**

- Generated: `drizzle/0026_esewa_captures.sql` (by the command in this task)
- Generated: `drizzle/meta/0026_snapshot.json` (by the command in this task)
- Generated: `drizzle/meta/_journal.json` (by the command in this task)
- Create: `src/db/schema/captures.ts`
- Modify: `src/db/schema/index.ts`

- [ ] **Step 1: Add the tables**

Create `src/db/schema/captures.ts` with:

```ts
import { doublePrecision, index, numeric, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { categories } from "./categories";
import { expenses } from "./expenses";
import { householdMembers } from "./householdMembers";
import { households } from "./households";

// draft: waiting for review, never counted anywhere. approved: an expense was
// made from it (expenseId). rejected: dismissed. skipped: money coming in,
// kept only so the duplicate check and the debug log see it.
export const captureStatusEnum = pgEnum("capture_status", ["draft", "approved", "rejected", "skipped"]);
export const captureDirectionEnum = pgEnum("capture_direction", ["debit", "credit"]);

// Payments the app read from eSewa notifications on one member's phone. They
// stay out of `expenses`, and so out of every total, until approved.
export const capturedPayments = pgTable(
  "captured_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    // Whose phone captured it; only they review it.
    memberId: uuid("member_id")
      .notNull()
      .references(() => householdMembers.id, { onDelete: "cascade" }),
    status: captureStatusEnum("status").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    direction: captureDirectionEnum("direction").notNull(),
    // The app's TxnKind name: payment, transfer, topup, billPay, ...
    kind: text("kind").notNull(),
    counterparty: text("counterparty"),
    refId: text("ref_id"),
    occurredAt: timestamp("occurred_at", { precision: 3, withTimezone: true }).notNull(),
    source: text("source").notNull(),
    rawText: text("raw_text").notNull(),
    // The app's category guess, by name ("Uncategorized" when it had none).
    category: text("category").notNull(),
    categoryConfidence: doublePrecision("category_confidence").notNull(),
    expenseId: uuid("expense_id").references(() => expenses.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("captured_payments_member_occurred_idx").on(table.memberId, table.occurredAt)],
);

// Every eSewa notification the app saw, as captured (digits masked in OTP and
// login messages), for the app's debug screen and for tuning the parser.
export const captureEvents = pgTable(
  "capture_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => householdMembers.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    // Android's notification key; with postedAt it names one notification, so
    // the app can resend it safely.
    key: text("key").notNull(),
    title: text("title").notNull(),
    text: text("text").notNull(),
    postedAt: timestamp("posted_at", { precision: 3, withTimezone: true }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [unique().on(table.memberId, table.key, table.postedAt)],
);

// Payee → category, learned when a member changes the category while
// approving. Each member has their own.
export const captureRules = pgTable(
  "capture_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => householdMembers.id, { onDelete: "cascade" }),
    // The payee as the app lowercases it.
    counterparty: text("counterparty").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [unique().on(table.memberId, table.counterparty)],
);
```

In `src/db/schema/index.ts`, find:

```ts
export * from "./dhukus";
export * from "./appReleases";
export * from "./activityLogs";
```

Replace it with:

```ts
export * from "./dhukus";
export * from "./appReleases";
export * from "./activityLogs";
export * from "./captures";
```

- [ ] **Step 2: Generate the migration**

Run:

```bash
npm run db:generate -- --name esewa_captures
```

Expected: it lists the tables (`capture_events 9 columns 0 indexes 2 fks`, `capture_rules 6 columns 0 indexes 3 fks`, `captured_payments 17 columns 1 indexes 3 fks`) and ends with `Your SQL migration file ➜ drizzle\0026_esewa_captures.sql`. It also writes `drizzle/meta/0026_snapshot.json` and updates `drizzle/meta/_journal.json`; never edit those by hand. Open `drizzle/0026_esewa_captures.sql`: it must contain exactly the statements below (only new types, tables, keys and an index; nothing that changes an existing table). If it contains anything else, stop and report.

```sql
CREATE TYPE "public"."capture_direction" AS ENUM('debit', 'credit');--> statement-breakpoint
CREATE TYPE "public"."capture_status" AS ENUM('draft', 'approved', 'rejected', 'skipped');--> statement-breakpoint
CREATE TABLE "capture_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"source" text NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"text" text NOT NULL,
	"posted_at" timestamp (3) with time zone NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "capture_events_member_id_key_posted_at_unique" UNIQUE("member_id","key","posted_at")
);
--> statement-breakpoint
CREATE TABLE "capture_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"counterparty" text NOT NULL,
	"category_id" uuid NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "capture_rules_member_id_counterparty_unique" UNIQUE("member_id","counterparty")
);
--> statement-breakpoint
CREATE TABLE "captured_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"status" "capture_status" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"direction" "capture_direction" NOT NULL,
	"kind" text NOT NULL,
	"counterparty" text,
	"ref_id" text,
	"occurred_at" timestamp (3) with time zone NOT NULL,
	"source" text NOT NULL,
	"raw_text" text NOT NULL,
	"category" text NOT NULL,
	"category_confidence" double precision NOT NULL,
	"expense_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "capture_events" ADD CONSTRAINT "capture_events_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capture_events" ADD CONSTRAINT "capture_events_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capture_rules" ADD CONSTRAINT "capture_rules_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capture_rules" ADD CONSTRAINT "capture_rules_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capture_rules" ADD CONSTRAINT "capture_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captured_payments" ADD CONSTRAINT "captured_payments_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captured_payments" ADD CONSTRAINT "captured_payments_member_id_household_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."household_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captured_payments" ADD CONSTRAINT "captured_payments_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "captured_payments_member_occurred_idx" ON "captured_payments" USING btree ("member_id","occurred_at");
```

- [ ] **Step 3: Run every check**

Run:

```bash
npx vitest run
npx tsc --noEmit
npm run lint
```

Expected: `Tests  437 passed (437)`; `tsc` prints nothing; lint shows 0 errors (the 2 existing warnings are fine).

- [ ] **Step 4: Commit**

```bash
git add drizzle/0026_esewa_captures.sql drizzle/meta/0026_snapshot.json drizzle/meta/_journal.json src/db/schema/captures.ts src/db/schema/index.ts
git commit -m "feat(db): tables for captured eSewa payments, notifications and payee rules"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.

### Task 4: Endpoints to store, review and approve captures

Design points 2, 3, 4 and 11. The logic goes in a new `src/modules/captures/` module: pure helpers in `lib/`, Zod schemas in `schemas/`, and the `...ForMember` queries in `api/captures.ts`. The six route files are thin, like the existing mobile routes. Every query filters by the signed-in member's household **and** member. `approveCaptureForMember` claims the draft with one `UPDATE … WHERE status = 'draft'` before creating the expense: that's what makes a double tap or a retry safe. If creating fails (say, the category isn't the household's), the draft is put back and the route answers 400.

**Files:**

- Create: `src/app/api/mobile/capture-events/route.ts`
- Create: `src/app/api/mobile/capture-rules/route.ts`
- Create: `src/app/api/mobile/captures/approve/route.ts`
- Create: `src/app/api/mobile/captures/around/route.ts`
- Create: `src/app/api/mobile/captures/reject/route.ts`
- Create: `src/app/api/mobile/captures/route.ts`
- Create: `src/modules/captures/api/captures.ts`
- Test: `src/modules/captures/lib/captures.test.ts` (new)
- Create: `src/modules/captures/lib/captures.ts`
- Create: `src/modules/captures/schemas/capture.schema.ts`

**Interfaces:**

- Consumes: `createExpenseForHousehold(input, actor)` and `ExpenseValidationError` (expenses module), `activityActor(member, "mobile")`, `listCategories(householdId)`, `requireMobileAuth(request)`, and the tables from Task 3.
- Produces the endpoints in Design point 11, with these JSON shapes (Task 7 relies on them):
  - A capture is `{ amount: number, category: string, categoryConfidence: number, counterparty: string | null, direction: "debit" | "credit", id: string, kind: string, occurredAt: string, rawText: string, refId: string | null, source: string, status: "draft" | "approved" | "rejected" | "skipped" }`, with `occurredAt` in UTC with milliseconds (`2026-10-14T06:15:30.250Z`).
  - `GET captures` → `{ captures: [capture] }`; `POST captures` takes a capture without `id` and `status` (`occurredAt` must end in `Z`) → 201 `{ capture }`; `GET captures/around` → `{ captures }`.
  - `POST captures/approve` `{ id, expense }` (`expense` is the usual expense body the app sends to `POST /api/mobile/expenses`) → `{ expense }`, the created expense with `amount` as a number; 409 `{ error: { message } }` when it isn't a draft; 400 for an invalid expense.
  - `POST captures/reject` `{ id }` → `{ ok: true }`, or 409.
  - `GET capture-events` → `{ events: [{ key, postedAt, source, text, title }] }` (latest 50); `POST capture-events` `{ key, postedAt, source, text, title }` → 201.
  - `GET capture-rules` → `{ rules: [{ categoryId, counterparty }] }`; `POST capture-rules` `{ rules: [{ categoryId, counterparty }] }` → `{ ok: true }`.

- [ ] **Step 1: Write the failing tests**

Create `src/modules/captures/lib/captures.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

import { captureJson, captureStatusFor } from "./captures";

describe("captureStatusFor", () => {
  it("makes money going out a draft to review", () => {
    expect(captureStatusFor("debit")).toBe("draft");
  });

  it("skips money coming in, so it is never offered for review", () => {
    expect(captureStatusFor("credit")).toBe("skipped");
  });
});

describe("captureJson", () => {
  const row = {
    amount: "1250.50",
    category: "Groceries",
    categoryConfidence: 0.9,
    counterparty: "Bhatbhateni Supermarket",
    createdAt: new Date("2026-10-14T06:20:00.000Z"),
    direction: "debit" as const,
    expenseId: null,
    householdId: "h1",
    id: "c1",
    kind: "payment",
    memberId: "m1",
    occurredAt: new Date("2026-10-14T06:15:30.250Z"),
    rawText: "eSewa You have paid Rs. 1,250.50 to Bhatbhateni Supermarket",
    refId: "0ABC12345",
    source: "notification",
    status: "draft" as const,
    updatedAt: new Date("2026-10-14T06:20:00.000Z"),
  };

  it("sends the amount as a number and the time as UTC with milliseconds", () => {
    expect(captureJson(row)).toEqual({
      amount: 1250.5,
      category: "Groceries",
      categoryConfidence: 0.9,
      counterparty: "Bhatbhateni Supermarket",
      direction: "debit",
      id: "c1",
      kind: "payment",
      occurredAt: "2026-10-14T06:15:30.250Z",
      rawText: "eSewa You have paid Rs. 1,250.50 to Bhatbhateni Supermarket",
      refId: "0ABC12345",
      source: "notification",
      status: "draft",
    });
  });

  it("leaves out who captured it and which household it belongs to", () => {
    const json = captureJson(row);
    expect(json).not.toHaveProperty("householdId");
    expect(json).not.toHaveProperty("memberId");
  });
});
```

- [ ] **Step 2: Run the new tests and watch them fail**

Run:

```bash
npx vitest run src/modules/captures
```

Expected: FAIL, with `Error: Cannot find module './captures'`

- [ ] **Step 3: Implement**

Create `src/modules/captures/lib/captures.ts` with:

```ts
import type { capturedPayments } from "@/db/schema";

type CaptureRow = typeof capturedPayments.$inferSelect;

// Money going out waits for review; money coming in (cashback, refunds,
// transfers received) is kept only so the duplicate check sees it. Piko has
// no place for it yet: income is per person per month.
export function captureStatusFor(direction: CaptureRow["direction"]): CaptureRow["status"] {
  return direction === "debit" ? "draft" : "skipped";
}

// A captured payment as the app reads it. Money is a number (Drizzle returns
// numeric as a string) and the time is UTC.
export function captureJson(row: CaptureRow) {
  return {
    amount: Number(row.amount),
    category: row.category,
    categoryConfidence: row.categoryConfidence,
    counterparty: row.counterparty,
    direction: row.direction,
    id: row.id,
    kind: row.kind,
    occurredAt: row.occurredAt.toISOString(),
    rawText: row.rawText,
    refId: row.refId,
    source: row.source,
    status: row.status,
  };
}
```

Create `src/modules/captures/schemas/capture.schema.ts` with:

```ts
import { z } from "zod";

import { expenseSchema } from "@/modules/expenses/schemas/expense.schema";

// The app's TxnKind names (mobile/lib/esewa/models.dart).
const kinds = ["payment", "transfer", "topup", "billPay", "load", "cashback", "refund", "unknown"] as const;

// One transaction the app parsed from a notification. The server decides its
// status from the direction, so the app can't file anything as approved.
export const captureSchema = z.object({
  amount: z.number().positive(),
  category: z.string().min(1),
  categoryConfidence: z.number().min(0).max(1),
  counterparty: z.string().trim().min(1).nullable(),
  direction: z.enum(["debit", "credit"]),
  kind: z.enum(kinds),
  occurredAt: z.iso.datetime(),
  rawText: z.string(),
  refId: z.string().trim().min(1).nullable(),
  source: z.string().min(1),
});

export const captureEventSchema = z.object({
  key: z.string(),
  postedAt: z.iso.datetime(),
  source: z.string().min(1),
  text: z.string(),
  title: z.string(),
});

export const captureRulesSchema = z.object({
  rules: z.array(z.object({ categoryId: z.string().uuid(), counterparty: z.string().trim().min(1) })).max(500),
});

export const approveCaptureSchema = z.object({ expense: expenseSchema, id: z.string().uuid() });

export const captureIdSchema = z.object({ id: z.string().uuid() });

export type CaptureInput = z.infer<typeof captureSchema>;
export type CaptureEventInput = z.infer<typeof captureEventSchema>;
export type CaptureRuleInput = z.infer<typeof captureRulesSchema>["rules"][number];
```

Create `src/modules/captures/api/captures.ts` with:

```ts
import { and, between, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { capturedPayments, captureEvents, captureRules } from "@/db/schema";
import type { CurrentMember } from "@/lib/session";
import { activityActor } from "@/modules/activity/api/activity";
import { listCategories } from "@/modules/categories/api/categories";
import { createExpenseForHousehold } from "@/modules/expenses/api/expenses.actions";
import type { ExpenseInput } from "@/modules/expenses/schemas/expense.schema";

import { captureStatusFor } from "../lib/captures";
import type { CaptureEventInput, CaptureInput, CaptureRuleInput } from "../schemas/capture.schema";

// Everything here belongs to one member: the household and member always come
// from their sign-in, never from the request.
function ownedBy(member: CurrentMember) {
  return and(eq(capturedPayments.householdId, member.householdId), eq(capturedPayments.memberId, member.memberId));
}

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
      kind: input.kind,
      memberId: member.memberId,
      occurredAt: new Date(input.occurredAt),
      rawText: input.rawText,
      refId: input.refId,
      source: input.source,
      status: captureStatusFor(input.direction),
    })
    .returning();
  return row;
}

// Drafts waiting for review, newest first.
export async function listDraftCapturesForMember(member: CurrentMember) {
  return db
    .select()
    .from(capturedPayments)
    .where(and(ownedBy(member), eq(capturedPayments.status, "draft")))
    .orderBy(desc(capturedPayments.occurredAt));
}

// Captures in any status within `seconds` of `at`, for the app's duplicate check.
export async function listCapturesAroundForMember(member: CurrentMember, at: Date, seconds: number) {
  const from = new Date(at.getTime() - seconds * 1000);
  const to = new Date(at.getTime() + seconds * 1000);
  return db
    .select()
    .from(capturedPayments)
    .where(and(ownedBy(member), between(capturedPayments.occurredAt, from, to)));
}

// False when it wasn't a draft (already reviewed, or not this member's).
export async function rejectCaptureForMember(member: CurrentMember, id: string) {
  const rows = await db
    .update(capturedPayments)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(and(ownedBy(member), eq(capturedPayments.id, id), eq(capturedPayments.status, "draft")))
    .returning({ id: capturedPayments.id });
  return rows.length > 0;
}

// Turns a draft into a real expense through the same path as adding one by
// hand, so validation, notifications and the activity log all apply. The
// draft is claimed first, so a double tap or a retry can't make a second
// expense; if creating fails it goes back to being a draft. Null when it
// wasn't a draft.
export async function approveCaptureForMember(member: CurrentMember, id: string, expense: ExpenseInput) {
  const claimed = await db
    .update(capturedPayments)
    .set({ status: "approved", updatedAt: new Date() })
    .where(and(ownedBy(member), eq(capturedPayments.id, id), eq(capturedPayments.status, "draft")))
    .returning({ id: capturedPayments.id });
  if (claimed.length === 0) return null;

  try {
    const created = await createExpenseForHousehold(expense, activityActor(member, "mobile"));
    await db.update(capturedPayments).set({ expenseId: created.id }).where(eq(capturedPayments.id, id));
    return created;
  } catch (error) {
    await db.update(capturedPayments).set({ status: "draft", updatedAt: new Date() }).where(eq(capturedPayments.id, id));
    throw error;
  }
}

// The same notification can be sent again (the app retries until it hears
// back), so a repeat is ignored.
export async function saveCaptureEventForMember(member: CurrentMember, input: CaptureEventInput) {
  await db
    .insert(captureEvents)
    .values({
      householdId: member.householdId,
      key: input.key,
      memberId: member.memberId,
      postedAt: new Date(input.postedAt),
      source: input.source,
      text: input.text,
      title: input.title,
    })
    .onConflictDoNothing();
}

export async function listCaptureEventsForMember(member: CurrentMember, limit: number) {
  return db
    .select()
    .from(captureEvents)
    .where(and(eq(captureEvents.householdId, member.householdId), eq(captureEvents.memberId, member.memberId)))
    .orderBy(desc(captureEvents.postedAt))
    .limit(limit);
}

export async function listCaptureRulesForMember(member: CurrentMember) {
  return db
    .select({ categoryId: captureRules.categoryId, counterparty: captureRules.counterparty })
    .from(captureRules)
    .where(and(eq(captureRules.householdId, member.householdId), eq(captureRules.memberId, member.memberId)));
}

// Adds or updates rules; never deletes one. The app sends its whole set, and
// one it loaded while offline could be missing older rules, so replacing the
// set would lose them. Rules for categories outside the household are dropped.
export async function saveCaptureRulesForMember(member: CurrentMember, rules: CaptureRuleInput[]) {
  const known = new Set((await listCategories(member.householdId)).map((c) => c.id));
  const byPayee = new Map(
    rules.filter((r) => known.has(r.categoryId)).map((r) => [r.counterparty.toLowerCase(), r.categoryId]),
  );
  if (byPayee.size === 0) return;

  await db
    .insert(captureRules)
    .values(
      [...byPayee].map(([counterparty, categoryId]) => ({
        categoryId,
        counterparty,
        householdId: member.householdId,
        memberId: member.memberId,
      })),
    )
    .onConflictDoUpdate({
      set: { categoryId: sql`excluded.category_id`, updatedAt: new Date() },
      target: [captureRules.memberId, captureRules.counterparty],
    });
}
```

Create `src/app/api/mobile/captures/route.ts` with:

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requireMobileAuth } from "@/lib/mobile-request";
import { insertCaptureForMember, listDraftCapturesForMember } from "@/modules/captures/api/captures";
import { captureJson } from "@/modules/captures/lib/captures";
import { captureSchema } from "@/modules/captures/schemas/capture.schema";

// The signed-in member's eSewa drafts waiting for review, newest first.
export async function GET(request: NextRequest) {
  const auth = await requireMobileAuth(request);
  if (auth instanceof NextResponse) return auth;

  const rows = await listDraftCapturesForMember(auth);
  return NextResponse.json({ captures: rows.map(captureJson) });
}

// A transaction the app parsed from a notification. Money going out becomes a
// draft; money coming in is kept as skipped.
export async function POST(request: NextRequest) {
  const auth = await requireMobileAuth(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = captureSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { message: "Invalid capture" } }, { status: 400 });
  }

  const row = await insertCaptureForMember(auth, parsed.data);
  return NextResponse.json({ capture: captureJson(row) }, { status: 201 });
}
```

Create `src/app/api/mobile/captures/around/route.ts` with:

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requireMobileAuth } from "@/lib/mobile-request";
import { listCapturesAroundForMember } from "@/modules/captures/api/captures";
import { captureJson } from "@/modules/captures/lib/captures";

const MAX_SECONDS = 3600;

// Captures in any status near ?at= (an ISO time), within ?seconds=, for the
// app's duplicate check, so a rejected payment is never drafted again.
export async function GET(request: NextRequest) {
  const auth = await requireMobileAuth(request);
  if (auth instanceof NextResponse) return auth;

  const at = new Date(request.nextUrl.searchParams.get("at") ?? "");
  const seconds = Number(request.nextUrl.searchParams.get("seconds"));
  if (Number.isNaN(at.getTime()) || !Number.isInteger(seconds) || seconds < 0 || seconds > MAX_SECONDS) {
    return NextResponse.json({ error: { message: "Invalid time window" } }, { status: 400 });
  }

  const rows = await listCapturesAroundForMember(auth, at, seconds);
  return NextResponse.json({ captures: rows.map(captureJson) });
}
```

Create `src/app/api/mobile/captures/approve/route.ts` with:

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requireMobileAuth } from "@/lib/mobile-request";
import { approveCaptureForMember } from "@/modules/captures/api/captures";
import { approveCaptureSchema } from "@/modules/captures/schemas/capture.schema";
import { ExpenseValidationError } from "@/modules/expenses/api/expense-errors";

// Makes a draft a real expense, with the details as checked on the phone.
export async function POST(request: NextRequest) {
  const auth = await requireMobileAuth(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = approveCaptureSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { message: "Invalid expense data", fields: parsed.error.flatten() } }, { status: 400 });
  }

  try {
    const created = await approveCaptureForMember(auth, parsed.data.id, parsed.data.expense);
    if (!created) {
      return NextResponse.json({ error: { message: "This payment was already reviewed." } }, { status: 409 });
    }
    return NextResponse.json({ expense: { ...created, amount: Number(created.amount) } });
  } catch (error) {
    if (error instanceof ExpenseValidationError) {
      return NextResponse.json({ error: { message: error.message } }, { status: 400 });
    }
    throw error;
  }
}
```

Create `src/app/api/mobile/captures/reject/route.ts` with:

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requireMobileAuth } from "@/lib/mobile-request";
import { rejectCaptureForMember } from "@/modules/captures/api/captures";
import { captureIdSchema } from "@/modules/captures/schemas/capture.schema";

// Hides a draft. It stays stored, so the same payment isn't drafted again.
export async function POST(request: NextRequest) {
  const auth = await requireMobileAuth(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = captureIdSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { message: "Invalid capture" } }, { status: 400 });
  }

  if (!(await rejectCaptureForMember(auth, parsed.data.id))) {
    return NextResponse.json({ error: { message: "This payment was already reviewed." } }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
```

Create `src/app/api/mobile/capture-events/route.ts` with:

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requireMobileAuth } from "@/lib/mobile-request";
import { listCaptureEventsForMember, saveCaptureEventForMember } from "@/modules/captures/api/captures";
import { captureEventSchema } from "@/modules/captures/schemas/capture.schema";

// The app's debug screen shows this many of the latest notifications.
const LIMIT = 50;

export async function GET(request: NextRequest) {
  const auth = await requireMobileAuth(request);
  if (auth instanceof NextResponse) return auth;

  const rows = await listCaptureEventsForMember(auth, LIMIT);
  return NextResponse.json({
    events: rows.map((e) => ({ key: e.key, postedAt: e.postedAt.toISOString(), source: e.source, text: e.text, title: e.title })),
  });
}

// One eSewa notification as the phone saw it (OTP digits already masked).
export async function POST(request: NextRequest) {
  const auth = await requireMobileAuth(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = captureEventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { message: "Invalid notification" } }, { status: 400 });
  }

  await saveCaptureEventForMember(auth, parsed.data);
  return NextResponse.json({ ok: true }, { status: 201 });
}
```

Create `src/app/api/mobile/capture-rules/route.ts` with:

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requireMobileAuth } from "@/lib/mobile-request";
import { listCaptureRulesForMember, saveCaptureRulesForMember } from "@/modules/captures/api/captures";
import { captureRulesSchema } from "@/modules/captures/schemas/capture.schema";

// The signed-in member's learned payee → category rules.
export async function GET(request: NextRequest) {
  const auth = await requireMobileAuth(request);
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({ rules: await listCaptureRulesForMember(auth) });
}

// Adds or updates rules; rules not sent are kept.
export async function POST(request: NextRequest) {
  const auth = await requireMobileAuth(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = captureRulesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { message: "Invalid rules" } }, { status: 400 });
  }

  await saveCaptureRulesForMember(auth, parsed.data.rules);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run the new tests again**

Run:

```bash
npx vitest run src/modules/captures
```

Expected: `Tests  4 passed (4)`

- [ ] **Step 5: Run every check**

Run:

```bash
npx vitest run
npx tsc --noEmit
npm run lint
```

Expected: `Tests  441 passed (441)`; `tsc` prints nothing; lint shows 0 errors (the 2 existing warnings are fine).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/mobile/capture-events/route.ts src/app/api/mobile/capture-rules/route.ts src/app/api/mobile/captures/approve/route.ts src/app/api/mobile/captures/around/route.ts src/app/api/mobile/captures/reject/route.ts src/app/api/mobile/captures/route.ts src/modules/captures/api/captures.ts src/modules/captures/lib/captures.test.ts src/modules/captures/lib/captures.ts src/modules/captures/schemas/capture.schema.ts
git commit -m "feat(mobile-api): endpoints to capture, review and approve eSewa payments"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.

### Checkpoint: STOP (the website half is done)

Stop here and send the owner a report with the four commit hashes and subjects (`git log --oneline main..HEAD`), the last `npx vitest run` line and the `npm run lint` result.

Then the owner:

1. Runs `npm run db:migrate`. It applies `drizzle/0026_esewa_captures.sql` to the database in `.env.local`; the migration only adds three tables and two types.
2. If they like, runs `npm run dev` and tries to add a category whose name already exists: it must be refused under Name.
3. Tells you to carry on with Task 5.

### Task 5: The note suggests a category

Design point 7, the app half. `note_suggest.dart` splits notes exactly as the server does: the same filler list, and letters together with their marks, so Devanagari words stay whole. It then votes: the category most of the note's known words point to, a tie going to the earlier word. The sheet only reacts to edits of the note, so a voice draft keeps Gemini's pick until its note changes, and it stops reacting once a category is picked by hand.

**Files:**

- Modify: `mobile/lib/models/categories_result.dart`
- Modify: `mobile/lib/screens/home_screen.dart`
- Create: `mobile/lib/services/note_suggest.dart`
- Modify: `mobile/lib/widgets/expense_confirm_sheet.dart`
- Test: `mobile/test/models/categories_result_test.dart`
- Test: `mobile/test/services/note_suggest_test.dart` (new)
- Test: `mobile/test/widgets/expense_confirm_sheet_test.dart`

**Interfaces:**

- Consumes: `noteWords` from `GET /api/mobile/categories` (Task 2).
- Produces: `noteWords(String note): List<String>` and `suggestCategoryId(String note, Map<String, String> wordTable, Iterable<String> offeredIds): String?` in `mobile/lib/services/note_suggest.dart`.
- Produces: `CategoriesResult.noteWords` (`Map<String, String>`, empty from an older server) and `ExpenseConfirmSheet(noteWords: …)` (optional, default empty). Task 8 passes both on.

- [ ] **Step 1: Write the failing tests**

In `mobile/test/models/categories_result_test.dart`, find:

```dart
    });

    expect(result.currentMemberId, isNull);
  });
}
```

Replace it with:

```dart
    });

    expect(result.currentMemberId, isNull);
    expect(result.noteWords, isEmpty);
  });

  test('CategoriesResult.fromJson reads the note word table', () {
    final result = CategoriesResult.fromJson({
      'categories': <dynamic>[],
      'members': <dynamic>[],
      'noteWords': {'banana': 'cat-1', 'petrol': 'cat-2'},
    });

    expect(result.noteWords, {'banana': 'cat-1', 'petrol': 'cat-2'});
  });
}
```

Create `mobile/test/services/note_suggest_test.dart` with:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/services/note_suggest.dart';

void main() {
  group('noteWords', () {
    // The same cases as the server's note-words.test.ts, so both split notes alike.
    test('lowercases and splits on anything that is not a letter or digit', () {
      expect(noteWords('Groceries, BANANA & apples'), ['groceries', 'banana', 'apples']);
    });

    test('drops filler words, one-letter words and bare numbers', () {
      expect(noteWords('T shirt from Basemark for 1500'), ['shirt', 'basemark']);
      expect(noteWords('momo ko lagi'), ['momo']);
    });

    test('keeps words in any script', () {
      expect(noteWords('केरा र स्याउ'), ['केरा', 'स्याउ']);
    });
  });

  group('suggestCategoryId', () {
    const table = {'banana': 'groceries', 'apples': 'groceries', 'momo': 'lunch', 'shirt': 'shopping'};
    const offered = ['groceries', 'lunch', 'shopping'];

    test('suggests the category a known word points to', () {
      expect(suggestCategoryId('Banana', table, offered), 'groceries');
    });

    test('goes with what most of the words point to', () {
      expect(suggestCategoryId('momo, banana and apples', table, offered), 'groceries');
    });

    test('gives a tie to the earlier word', () {
      expect(suggestCategoryId('shirt and momo', table, offered), 'shopping');
      expect(suggestCategoryId('momo and shirt', table, offered), 'lunch');
    });

    test('suggests nothing for words it has never seen', () {
      expect(suggestCategoryId('t shirt', const {'banana': 'groceries'}, offered), isNull);
      expect(suggestCategoryId('', table, offered), isNull);
    });

    test("ignores a category the sheet doesn't offer", () {
      expect(suggestCategoryId('banana', table, const ['lunch']), isNull);
    });
  });
}
```

In `mobile/test/widgets/expense_confirm_sheet_test.dart`, find (1 of 3):

```dart
    AppDateFormat dateFormat = AppDateFormat.nepali,
    String? currentMemberId = 'mem-1',
    List<String> quickCategoryIds = const [],
  }) async {
    // Tall enough that every field is on screen without scrolling.
    tester.view.physicalSize = const Size(800, 1400);
```

Replace it with:

```dart
    AppDateFormat dateFormat = AppDateFormat.nepali,
    String? currentMemberId = 'mem-1',
    List<String> quickCategoryIds = const [],
    Map<String, String> noteWords = const {},
  }) async {
    // Tall enough that every field is on screen without scrolling.
    tester.view.physicalSize = const Size(800, 1400);
```

In `mobile/test/widgets/expense_confirm_sheet_test.dart`, find (2 of 3):

```dart
            members: members,
            currentMemberId: currentMemberId,
            quickCategoryIds: quickCategoryIds,
            dateFormat: dateFormat,
            calendar: calendar,
            onSave: (d) async => onSave(d),
```

Replace it with:

```dart
            members: members,
            currentMemberId: currentMemberId,
            quickCategoryIds: quickCategoryIds,
            noteWords: noteWords,
            dateFormat: dateFormat,
            calendar: calendar,
            onSave: (d) async => onSave(d),
```

In `mobile/test/widgets/expense_confirm_sheet_test.dart`, find (3 of 3):

```dart
  }

  Finder inField(String key, String text) => find.descendant(of: find.byKey(Key(key)), matching: find.text(text));

  testWidgets('shows the prefilled amount and note', (tester) async {
    await pumpSheet(tester, initialDraft: draft(), onSave: (_) {});
```

Replace it with:

```dart
  }

  Finder inField(String key, String text) => find.descendant(of: find.byKey(Key(key)), matching: find.text(text));

  group('the note suggests a category', () {
    const noteWords = {'banana': 'cat-1', 'bus': 'cat-2', 'yango': 'cat-2'};

    String categoryShown(WidgetTester tester) =>
        tester.widget<DropdownButton<String>>(find.byKey(const Key('category-field'))).value!;

    testWidgets('typing a known word picks its category and says why', (tester) async {
      ExpenseDraft? saved;
      await pumpSheet(tester, initialDraft: draft(), onSave: (d) => saved = d, noteWords: noteWords);
      expect(find.byKey(const Key('category-suggested')), findsNothing);

      await tester.enterText(find.byKey(const Key('note-field')), 'Yango to office');
      await tester.pump();

      expect(categoryShown(tester), 'cat-2');
      expect(find.text('From your notes'), findsOneWidget);
      await tester.tap(find.byKey(const Key('save-button')));
      await tester.pump();
      expect(saved!.categoryId, 'cat-2');
    });

    testWidgets('a word it has never seen leaves the category alone', (tester) async {
      await pumpSheet(tester, initialDraft: draft(), onSave: (_) {}, noteWords: noteWords);

      await tester.enterText(find.byKey(const Key('note-field')), 'something new');
      await tester.pump();

      expect(categoryShown(tester), 'cat-1');
      expect(find.byKey(const Key('category-suggested')), findsNothing);
    });

    testWidgets('a category picked by hand stays, whatever the note says', (tester) async {
      await pumpSheet(
        tester,
        initialDraft: draft(),
        onSave: (_) {},
        noteWords: noteWords,
        quickCategoryIds: const ['cat-1', 'cat-2'],
      );

      await tester.tap(find.byKey(const Key('quick-category-cat-1')));
      await tester.pump();
      await tester.enterText(find.byKey(const Key('note-field')), 'bus');
      await tester.pump();

      expect(categoryShown(tester), 'cat-1');
      expect(find.byKey(const Key('category-suggested')), findsNothing);
    });

    testWidgets("a draft's category stays until the note is edited", (tester) async {
      // The draft's own note ("groceries") isn't a known word; nothing changes on open.
      await pumpSheet(tester, initialDraft: draft(), onSave: (_) {}, noteWords: const {'groceries': 'cat-2'});

      expect(categoryShown(tester), 'cat-1');
      expect(find.byKey(const Key('category-suggested')), findsNothing);
    });
  });

  testWidgets('shows the prefilled amount and note', (tester) async {
    await pumpSheet(tester, initialDraft: draft(), onSave: (_) {});
```

- [ ] **Step 2: Run the new tests and watch them fail**

Run:

```bash
cd mobile; flutter test test/services/note_suggest_test.dart test/models/categories_result_test.dart test/widgets/expense_confirm_sheet_test.dart; cd ..
```

Expected: FAIL to compile, starting with `test/services/note_suggest_test.dart:2:8: Error: Error when reading 'lib/services/note_suggest.dart': The system cannot find the file specified`

- [ ] **Step 3: Implement**

Create `mobile/lib/services/note_suggest.dart` with:

```dart
// Words that say nothing about what was bought, in English and in romanised
// Nepali. Keep in step with the server's list in
// src/modules/expenses/lib/note-words.ts, which builds the word table.
const _filler = {
  'a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'is', 'me', 'my', 'of', 'on', 'or', 'our', 'the', 'to', 'was', 'with',
  'bata', 'ka', 'ki', 'ko', 'lagi', 'lai', 'le', 'ma', 'ra',
};

// Letters with their accents and vowel signs, so Devanagari stays whole.
final _word = RegExp(r'[\p{L}\p{M}\p{N}]+', unicode: true);
final _number = RegExp(r'^\p{N}+$', unicode: true);

// The words of a note, split the way the server splits them.
List<String> noteWords(String note) => [
      for (final match in _word.allMatches(note.toLowerCase()))
        if (match[0]!.length >= 2 && !_filler.contains(match[0]) && !_number.hasMatch(match[0]!)) match[0]!,
    ];

// The category a note points to, from the server's word → category table:
// the one most of its known words point to, a tie going to the earlier word.
// Null when no word is known or its category isn't among [offeredIds].
String? suggestCategoryId(String note, Map<String, String> wordTable, Iterable<String> offeredIds) {
  final offered = offeredIds.toSet();
  final votes = <String, int>{};
  for (final word in noteWords(note)) {
    final id = wordTable[word];
    if (id != null && offered.contains(id)) votes[id] = (votes[id] ?? 0) + 1;
  }
  if (votes.isEmpty) return null;
  // Map keys keep first-seen order, so the first with the top count is the earliest word.
  final top = votes.values.reduce((a, b) => a > b ? a : b);
  return votes.keys.firstWhere((id) => votes[id] == top);
}
```

Replace the whole of `mobile/lib/models/categories_result.dart` with:

```dart
import 'category_option.dart';
import 'member_option.dart';

class CategoriesResult {
  final List<CategoryOption> categories;
  final List<MemberOption> members;
  // The signed-in member. Null from a server older than this field.
  final String? currentMemberId;
  // Word → category id, learned from the household's notes, for suggesting a
  // category as a note is typed. Empty from a server older than this field.
  final Map<String, String> noteWords;

  CategoriesResult({required this.categories, required this.members, this.currentMemberId, this.noteWords = const {}});

  factory CategoriesResult.fromJson(Map<String, dynamic> json) {
    return CategoriesResult(
      categories: (json['categories'] as List<dynamic>)
          .map((c) => CategoryOption.fromJson(c as Map<String, dynamic>))
          .toList(),
      members: (json['members'] as List<dynamic>)
          .map((m) => MemberOption.fromJson(m as Map<String, dynamic>))
          .toList(),
      currentMemberId: json['currentMemberId'] as String?,
      noteWords: (json['noteWords'] as Map<String, dynamic>? ?? const {}).map((word, id) => MapEntry(word, id as String)),
    );
  }
}
```

In `mobile/lib/widgets/expense_confirm_sheet.dart`, find (1 of 8):

```dart
import '../models/expense_draft.dart';
import '../models/member_option.dart';
import '../services/bs_calendar.dart';
import '../services/people.dart';
import '../theme/app_theme.dart';
import 'amount_field.dart';
```

Replace it with:

```dart
import '../models/expense_draft.dart';
import '../models/member_option.dart';
import '../services/bs_calendar.dart';
import '../services/note_suggest.dart';
import '../services/people.dart';
import '../theme/app_theme.dart';
import 'amount_field.dart';
```

In `mobile/lib/widgets/expense_confirm_sheet.dart`, find (2 of 8):

```dart
  final String? currentMemberId;
  // Categories offered as chips under the picker, most used first.
  final List<String> quickCategoryIds;
  final AppDateFormat dateFormat;
  final BsCalendar calendar;
  final Future<void> Function(ExpenseDraft draft) onSave;
```

Replace it with:

```dart
  final String? currentMemberId;
  // Categories offered as chips under the picker, most used first.
  final List<String> quickCategoryIds;
  // Word → category id from the household's past notes (CategoriesResult.noteWords).
  final Map<String, String> noteWords;
  final AppDateFormat dateFormat;
  final BsCalendar calendar;
  final Future<void> Function(ExpenseDraft draft) onSave;
```

In `mobile/lib/widgets/expense_confirm_sheet.dart`, find (3 of 8):

```dart
    required this.members,
    this.currentMemberId,
    this.quickCategoryIds = const [],
    required this.dateFormat,
    required this.calendar,
    required this.onSave,
```

Replace it with:

```dart
    required this.members,
    this.currentMemberId,
    this.quickCategoryIds = const [],
    this.noteWords = const {},
    required this.dateFormat,
    required this.calendar,
    required this.onSave,
```

In `mobile/lib/widgets/expense_confirm_sheet.dart`, find (4 of 8):

```dart
  late String? _ownerMemberId; // null = shared
  late String _date;
  bool _saving = false;

  double get _amount => double.tryParse(_amountController.text) ?? -1;
  bool get _canSave =>
```

Replace it with:

```dart
  late String? _ownerMemberId; // null = shared
  late String _date;
  bool _saving = false;
  // Once a category is picked by hand, the note stops changing it.
  bool _categoryPicked = false;
  bool _categorySuggested = false;

  double get _amount => double.tryParse(_amountController.text) ?? -1;
  bool get _canSave =>
```

In `mobile/lib/widgets/expense_confirm_sheet.dart`, find (5 of 8):

```dart
    _amountController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  // Someone's own expense is usually paid by them; Shared keeps whoever was picked.
```

Replace it with:

```dart
    _amountController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  void _pickCategory(String id) {
    setState(() {
      _categoryId = id;
      _categoryPicked = true;
      _categorySuggested = false;
    });
  }

  // The category follows what the note says, from the household's past notes,
  // until one is picked by hand. A note it can't place leaves it as it is.
  void _noteChanged(String note) {
    if (_categoryPicked) return;
    final id = suggestCategoryId(note, widget.noteWords, widget.categories.map((c) => c.id));
    if (id == null || id == _categoryId) return;
    setState(() {
      _categoryId = id;
      _categorySuggested = true;
    });
  }

  // Someone's own expense is usually paid by them; Shared keeps whoever was picked.
```

In `mobile/lib/widgets/expense_confirm_sheet.dart`, find (6 of 8):

```dart
                    for (final category in widget.categories)
                      DropdownMenuItem(value: category.id, child: Text(category.name)),
                  ],
                  onChanged: (value) => setState(() => _categoryId = value!),
                ),
              ),
            ),
          ),
          if (quick.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
```

Replace it with:

```dart
                    for (final category in widget.categories)
                      DropdownMenuItem(value: category.id, child: Text(category.name)),
                  ],
                  onChanged: (value) => _pickCategory(value!),
                ),
              ),
            ),
          ),
          if (_categorySuggested) ...[
            const SizedBox(height: 6),
            Text('From your notes', key: const Key('category-suggested'), style: text.bodySmall),
          ],
          if (quick.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
```

In `mobile/lib/widgets/expense_confirm_sheet.dart`, find (7 of 8):

```dart
                    key: Key('quick-category-${category.id}'),
                    label: category.name,
                    selected: category.id == _categoryId,
                    onTap: () => setState(() => _categoryId = category.id),
                  ),
              ],
            ),
```

Replace it with:

```dart
                    key: Key('quick-category-${category.id}'),
                    label: category.name,
                    selected: category.id == _categoryId,
                    onTap: () => _pickCategory(category.id),
                  ),
              ],
            ),
```

In `mobile/lib/widgets/expense_confirm_sheet.dart`, find (8 of 8):

```dart
              key: const Key('note-field'),
              controller: _noteController,
              textCapitalization: TextCapitalization.sentences,
            ),
          ),
        ],
```

Replace it with:

```dart
              key: const Key('note-field'),
              controller: _noteController,
              textCapitalization: TextCapitalization.sentences,
              onChanged: _noteChanged,
            ),
          ),
        ],
```

In `mobile/lib/screens/home_screen.dart`, find:

```dart
          members: categoriesResult.members,
          currentMemberId: categoriesResult.currentMemberId,
          quickCategoryIds: quickCategoryIds(recent, categoriesResult.categories),
          dateFormat: ref.read(dateFormatProvider),
          calendar: ref.read(bsCalendarProvider),
          onSave: (finalDraft) async {
```

Replace it with:

```dart
          members: categoriesResult.members,
          currentMemberId: categoriesResult.currentMemberId,
          quickCategoryIds: quickCategoryIds(recent, categoriesResult.categories),
          noteWords: categoriesResult.noteWords,
          dateFormat: ref.read(dateFormatProvider),
          calendar: ref.read(bsCalendarProvider),
          onSave: (finalDraft) async {
```

- [ ] **Step 4: Run the new tests again**

Run:

```bash
cd mobile; flutter test test/services/note_suggest_test.dart test/models/categories_result_test.dart test/widgets/expense_confirm_sheet_test.dart; cd ..
```

Expected: `+28: All tests passed!`

- [ ] **Step 5: Run every check**

Run:

```bash
cd mobile; flutter analyze; cd ..
cd mobile; flutter test; cd ..
```

Expected: `No issues found!`; `+108: All tests passed!`.

- [ ] **Step 6: Commit**

```bash
git add mobile/lib/models/categories_result.dart mobile/lib/screens/home_screen.dart mobile/lib/services/note_suggest.dart mobile/lib/widgets/expense_confirm_sheet.dart mobile/test/models/categories_result_test.dart mobile/test/services/note_suggest_test.dart mobile/test/widgets/expense_confirm_sheet_test.dart
git commit -m "feat(mobile): the note suggests a category from past notes"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.

### Task 6: The eSewa module, with a queue that survives offline

Design points 1, 8 and 9 (fix 1). The module's Dart files go in `mobile/lib/esewa/` and its Kotlin files in `mobile/android/app/src/main/kotlin/com/nirjal/piko/esewa/`, under the app's own package (the module shipped as `com.example.financeapp`). Compared with the module as given:

- `models.dart`, `parser.dart` and `deduplicator.dart` are exactly as given.
- `categorizer.dart`: only the right-hand category names change, to the household's own (Design point 8).
- `esewa_service.dart`: `start()` subscribes to live events before draining and can be called again; `drainPending()` reads the native queue without emptying it, acks each event only once it's stored, runs one drain at a time and never throws. A live event now only means "something new arrived".
- `PendingStore.kt`: every notification is appended, named by key and post time, and kept until acked (`pending`, `ack`), written with `commit()` so a killed process can't lose it.
- `EsewaBridge.kt`: `pending` and `ack` replace `drainPending`; `emit` only wakes Dart.
- `EsewaNotificationListener.kt`: queues first, then wakes Dart.
- The module's own tests switch to `package:piko/...` imports.

The module's `review_screen.dart` isn't copied: Task 8 writes Piko's own. `MainActivity` gains `configureFlutterEngine` to register the bridge, and the manifest gains the listener service, labelled "Piko" in Android's Notification access list.

**Files:**

- Modify: `mobile/android/app/src/main/AndroidManifest.xml`
- Modify: `mobile/android/app/src/main/kotlin/com/nirjal/piko/MainActivity.kt`
- Create: `mobile/android/app/src/main/kotlin/com/nirjal/piko/esewa/EsewaBridge.kt`
- Create: `mobile/android/app/src/main/kotlin/com/nirjal/piko/esewa/EsewaNotificationListener.kt`
- Create: `mobile/android/app/src/main/kotlin/com/nirjal/piko/esewa/PendingStore.kt`
- Create: `mobile/lib/esewa/categorizer.dart`
- Create: `mobile/lib/esewa/deduplicator.dart`
- Create: `mobile/lib/esewa/esewa_service.dart`
- Create: `mobile/lib/esewa/models.dart`
- Create: `mobile/lib/esewa/parser.dart`
- Test: `mobile/test/esewa/categorizer_mapping_test.dart` (new)
- Test: `mobile/test/esewa/esewa_service_test.dart` (new)
- Test: `mobile/test/esewa_parser_test.dart` (new)

**Interfaces:**

- Produces (used by Tasks 7–9): `EsewaService(TxnRepository repo)` with `start()`, `drainPending()`, `ingest(RawEvent)`, `pendingReview()`, `approve(Txn t, {String? category, double? amount, String? counterparty})`, `reject(Txn t)`, `onDraft` (`Stream<Txn>`), `isSupported`, `isAccessGranted()`, `openAccessSettings()`; the public `categorizer` field.
- Produces: `abstract class TxnRepository` with `around`, `drafts`, `insert`, `update`, `saveRaw`, `loadUserRules`, `saveUserRules`; `Txn`, `RawEvent`, `TxnStatus`, `TxnKind`, `TxnDirection` (`models.dart`); `ParserRules.defaults().ignore` (`parser.dart`); `Categorizer`.
- Produces: native method channel `finance/esewa` with `isAccessGranted`, `openAccessSettings`, `pending` (a JSON list of queued events, each with an `id`) and `ack` (a list of ids); event channel `finance/esewa/events`.

- [ ] **Step 1: Write the failing tests**

Create `mobile/test/esewa/categorizer_mapping_test.dart` with:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/esewa/categorizer.dart';
import 'package:piko/esewa/models.dart';

// The starting guesses land in the household's own categories (agreed 2026-10-14).
void main() {
  String guess(String counterparty, {TxnKind kind = TxnKind.payment, String? raw}) {
    final t = Txn(
      amount: 100,
      direction: TxnDirection.debit,
      kind: kind,
      occurredAt: DateTime(2026, 10, 14),
      source: 'notification',
      rawText: raw ?? 'You have paid Rs. 100 to $counterparty',
      counterparty: counterparty,
    );
    Categorizer().categorize(t);
    return t.category;
  }

  test('bills and phones', () {
    expect(guess('NEA'), 'Electricity');
    expect(guess('KUKL'), 'Water');
    expect(guess('Ncell'), 'Mobile/Telephone');
    expect(guess('Worldlink'), 'Internet');
    expect(guess('Someone', kind: TxnKind.topup, raw: 'Topup of Rs 100 is successful'), 'Mobile/Telephone');
    expect(guess('Someone', kind: TxnKind.billPay, raw: 'Bill payment of Rs 100 successful'), 'Bills');
  });

  test('food, rides and shops', () {
    expect(guess('Momo Center'), 'Lunch');
    expect(guess('Foodmandu'), 'Dining Out');
    expect(guess('Yango'), 'Transportation');
    expect(guess('Buddha Air'), 'Transportation');
    expect(guess('Nepal Oil'), 'Petrol');
    expect(guess('Bhatbhateni Supermarket'), 'Groceries');
    expect(guess('Daraz'), 'Shopping');
    expect(guess('City Pharmacy'), 'Medicine');
  });

  test('loans by keyword', () {
    expect(guess('Bank', raw: 'You have paid Rs. 100 for EMI'), 'EMI');
  });

  test("leaves a name the household doesn't have, so the draft waits for a pick", () {
    expect(guess('Hari Shrestha', kind: TxnKind.transfer, raw: 'You have sent Rs. 100 to Hari Shrestha'), 'Transfers');
    expect(guess('Kathmandu Academy'), 'Education');
  });
}
```

Create `mobile/test/esewa/esewa_service_test.dart` with:

```dart
import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/esewa/categorizer.dart';
import 'package:piko/esewa/esewa_service.dart';
import 'package:piko/esewa/models.dart';

// Stores captures in memory; `offline` makes every write fail, like a phone with no data.
class _MemoryRepo implements TxnRepository {
  final txns = <Txn>[];
  final raws = <RawEvent>[];
  bool offline = false;

  void _write() {
    if (offline) throw Exception('offline');
  }

  @override
  Future<List<Txn>> around(DateTime at, Duration window) async =>
      txns.where((t) => t.occurredAt.difference(at).abs() <= window).toList();

  @override
  Future<List<Txn>> drafts() async => txns.where((t) => t.isDraft).toList();

  @override
  Future<void> insert(Txn t) async {
    _write();
    txns.add(t);
  }

  @override
  Future<void> update(Txn t) async => _write();

  @override
  Future<void> saveRaw(RawEvent e) async {
    _write();
    raws.add(e);
  }

  @override
  Future<Map<String, String>> loadUserRules() async => {};

  @override
  Future<void> saveUserRules(Map<String, String> rules) async {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('finance/esewa');

  // The native queue: events stay until Dart acks them.
  late List<Map<String, Object>> queue;
  late List<String> acked;

  Map<String, Object> event(String id, String text, int minute) => {
        'id': id,
        'key': 'k',
        'postedAt': DateTime(2026, 10, 14, 12, minute).millisecondsSinceEpoch,
        'source': 'notification',
        'text': text,
        'title': 'eSewa',
      };

  setUp(() {
    queue = [];
    acked = [];
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(channel, (call) async {
      switch (call.method) {
        case 'pending':
          return jsonEncode(queue);
        case 'ack':
          final ids = (call.arguments as List).cast<String>();
          acked.addAll(ids);
          queue.removeWhere((e) => ids.contains(e['id']));
          return null;
      }
      return null;
    });
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(channel, null);
  });

  EsewaService serviceWith(_MemoryRepo repo) => EsewaService(repo)..categorizer = Categorizer();

  test('stores each queued payment as a draft and only then acks it', () async {
    final repo = _MemoryRepo();
    queue.addAll([
      event('a', 'You have paid Rs. 500 to Daraz.', 0),
      event('b', 'You have paid Rs. 120 to Ncell.', 10),
    ]);

    await serviceWith(repo).drainPending();

    expect(repo.txns.map((t) => t.amount), [500, 120]);
    expect(repo.txns.every((t) => t.isDraft), isTrue);
    expect(acked, ['a', 'b']);
    expect(queue, isEmpty);
  });

  test('keeps a payment queued when it could not be stored, and stores it next time', () async {
    final repo = _MemoryRepo()..offline = true;
    queue.add(event('a', 'You have paid Rs. 500 to Daraz.', 0));
    final service = serviceWith(repo);

    await service.drainPending();
    expect(repo.txns, isEmpty);
    expect(acked, isEmpty);
    expect(queue, hasLength(1));

    repo.offline = false;
    await service.drainPending();
    expect(repo.txns, hasLength(1));
    expect(acked, ['a']);
  });

  test('two drains at once store a payment only once', () async {
    final repo = _MemoryRepo();
    queue.add(event('a', 'You have paid Rs. 500 to Daraz.', 0));
    final service = serviceWith(repo);

    await Future.wait([service.drainPending(), service.drainPending()]);

    expect(repo.txns, hasLength(1));
  });

  test('acks notifications that are not payments, keeping them in the log', () async {
    final repo = _MemoryRepo();
    queue.add(event('otp', 'Your OTP for payment of Rs. 500 is 123456', 0));

    await serviceWith(repo).drainPending();

    expect(repo.txns, isEmpty);
    expect(repo.raws, hasLength(1));
    expect(acked, ['otp']);
  });
}
```

Create `mobile/test/esewa_parser_test.dart` with:

```dart
// Run with: flutter test test/esewa_parser_test.dart
//
// NOTE: These sample strings are ILLUSTRATIVE, not copied from real eSewa
// notifications. Replace/extend them with real (anonymized) samples you
// capture on devices — this file becomes your regression suite.
import 'package:flutter_test/flutter_test.dart';

import 'package:piko/esewa/categorizer.dart';
import 'package:piko/esewa/deduplicator.dart';
import 'package:piko/esewa/models.dart';
import 'package:piko/esewa/parser.dart';

RawEvent ev(String text, {String title = 'eSewa', DateTime? at, String key = 'k'}) =>
    RawEvent(source: 'notification', key: key, title: title, text: text, postedAt: at ?? DateTime(2026, 10, 14, 12));

void main() {
  final parser = EsewaParser();
  final cat = Categorizer();

  group('parser', () {
    test('merchant payment', () {
      final t = parser.parse(ev('You have paid Rs. 1,250.50 to Bhatbhateni Supermarket on 14-10-2026. Ref ID: 0ABC12345'))!;
      expect(t.amount, 1250.50);
      expect(t.direction, TxnDirection.debit);
      expect(t.kind, TxnKind.payment);
      expect(t.counterparty, 'Bhatbhateni Supermarket');
      expect(t.refId, '0ABC12345');
      expect(t.status, TxnStatus.draft, reason: 'captures must start as drafts');
    });

    test('received money is credit', () {
      final t = parser.parse(ev('You have received NPR 2000 from Ram Bahadur.'))!;
      expect(t.direction, TxnDirection.credit);
      expect(t.kind, TxnKind.transfer);
      expect(t.counterparty, 'Ram Bahadur');
    });

    test('topup', () {
      final t = parser.parse(ev('Ncell topup of Rs 200 is successful.'))!;
      expect(t.kind, TxnKind.topup);
      expect(t.amount, 200);
    });

    test('bill payment', () {
      final t = parser.parse(ev('NEA electricity bill payment of Rs. 845 successful.'))!;
      expect(t.kind, TxnKind.billPay);
    });

    test('cashback is credit', () {
      final t = parser.parse(ev('Congrats! Cashback of Rs. 10 received.', title: 'Cashback'));
      // "congratulations" is in ignore list but "Congrats!" is not; cashback should parse.
      expect(t!.kind, TxnKind.cashback);
      expect(t.direction, TxnDirection.credit);
    });

    test('ignores OTP', () {
      expect(parser.parse(ev('Your OTP for payment of Rs. 500 is 123456')), isNull);
    });

    test('ignores text without money verb', () {
      expect(parser.parse(ev('Get Rs. 100 off with code XYZ')), isNull);
    });
  });

  group('categorizer', () {
    test('known merchant', () {
      final t = parser.parse(ev('You have paid Rs. 500 to Bhatbhateni Supermarket.'))!;
      cat.categorize(t);
      expect(t.category, 'Groceries');
      expect(t.categoryConfidence, greaterThanOrEqualTo(Categorizer.reviewThreshold));
    });

    test('learns from correction', () {
      final c = Categorizer();
      final t1 = parser.parse(ev('You have paid Rs. 300 to Hari Shrestha.'))!;
      c.categorize(t1);
      expect(t1.categoryConfidence, lessThan(Categorizer.reviewThreshold));
      c.learn(t1, 'Rent');

      final t2 = parser.parse(ev('You have paid Rs. 15000 to Hari Shrestha.'))!;
      c.categorize(t2);
      expect(t2.category, 'Rent');
      expect(t2.categoryConfidence, 1.0);
    });
  });

  group('dedup', () {
    final d = Deduplicator();
    test('same ref id is duplicate', () {
      final a = parser.parse(ev('Paid Rs. 500 to Daraz. Ref ID: ABC123456'))!;
      final b = parser.parse(ev('Payment Rs 500 to DARAZ Ref: ABC123456', at: DateTime(2026, 10, 14, 18)))!;
      expect(d.isDuplicate(b, [a]), isTrue);
    });

    test('amount + time window without ref', () {
      final a = parser.parse(ev('Paid Rs. 500 to Daraz.'))!;
      final b = parser.parse(ev('Paid Rs. 500 to Daraz Nepal.', at: DateTime(2026, 10, 14, 12, 2)))!;
      expect(d.isDuplicate(b, [a]), isTrue);
    });

    test('rejected draft still blocks re-drafting', () {
      final a = parser.parse(ev('Paid Rs. 500 to Daraz.'))!..status = TxnStatus.rejected;
      final b = parser.parse(ev('Paid Rs. 500 to Daraz.', at: DateTime(2026, 10, 14, 12, 1)))!;
      expect(d.isDuplicate(b, [a]), isTrue);
    });

    test('same amount far apart is not duplicate', () {
      final a = parser.parse(ev('Paid Rs. 500 to Daraz.'))!;
      final b = parser.parse(ev('Paid Rs. 500 to Daraz.', at: DateTime(2026, 10, 14, 15)))!;
      expect(d.isDuplicate(b, [a]), isFalse);
    });
  });
}
```

- [ ] **Step 2: Run the new tests and watch them fail**

Run:

```bash
cd mobile; flutter test test/esewa_parser_test.dart test/esewa; cd ..
```

Expected: FAIL to compile, starting with `test/esewa_parser_test.dart:8:8: Error: Error when reading 'lib/esewa/categorizer.dart': The system cannot find the path specified`

- [ ] **Step 3: Implement**

Create `mobile/lib/esewa/models.dart` with:

```dart
enum TxnDirection { debit, credit }

enum TxnKind { payment, transfer, topup, billPay, load, cashback, refund, unknown }

/// draft    -> auto-captured, waiting for review (NOT counted in totals)
/// approved -> user confirmed; this is real data
/// rejected -> user dismissed; kept only so the same txn isn't re-drafted
enum TxnStatus { draft, approved, rejected }

/// Raw event exactly as captured (notification / SMS / statement row / OCR).
/// Keep these: when the parser improves you can re-parse history.
class RawEvent {
  final String source; // notification | sms | statement | ocr | manual
  final String key; // source-specific unique key
  final String title;
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
        key: j['key'] as String? ?? '',
        title: j['title'] as String? ?? '',
        text: j['text'] as String? ?? '',
        postedAt: DateTime.fromMillisecondsSinceEpoch(
            (j['postedAt'] as num?)?.toInt() ?? DateTime.now().millisecondsSinceEpoch),
      );
}

/// Normalized transaction, independent of where it came from.
class Txn {
  double amount; // always positive, NPR (editable during review)
  final TxnDirection direction;
  final TxnKind kind;
  String? counterparty; // merchant / person / biller (editable during review)
  final String? refId; // eSewa reference / transaction code if present
  final DateTime occurredAt;
  final String source;
  final String rawText;
  String category;
  double categoryConfidence;
  TxnStatus status;

  Txn({
    required this.amount,
    required this.direction,
    required this.kind,
    required this.occurredAt,
    required this.source,
    required this.rawText,
    this.counterparty,
    this.refId,
    this.category = 'Uncategorized',
    this.categoryConfidence = 0,
    this.status = TxnStatus.draft,
  });

  bool get isExpense => direction == TxnDirection.debit;
  bool get isDraft => status == TxnStatus.draft;

  Map<String, dynamic> toJson() => {
        'amount': amount,
        'direction': direction.name,
        'kind': kind.name,
        'counterparty': counterparty,
        'refId': refId,
        'occurredAt': occurredAt.toIso8601String(),
        'source': source,
        'rawText': rawText,
        'category': category,
        'categoryConfidence': categoryConfidence,
        'status': status.name,
      };

  @override
  String toString() =>
      'Txn(${status.name} ${direction.name} Rs.$amount, ${kind.name}, $counterparty, ref=$refId, $category)';
}
```

Create `mobile/lib/esewa/parser.dart` with:

```dart
import 'models.dart';

/// Pattern-driven parser for eSewa notification / SMS text.
///
/// IMPORTANT: The exact wording of eSewa notifications is not documented and
/// changes between app versions. The patterns below are deliberately loose and
/// keyword based. Collect real (anonymized) samples from your users/devices,
/// add them to test/parser_test.dart, and tune [ParserRules]. Ideally ship
/// ParserRules as JSON from your backend so you can fix breakage without an
/// app release.
class ParserRules {
  /// Amount like "Rs. 1,250.50", "NPR 500", "Rs500", "रु 200".
  final RegExp amount;

  /// Keywords -> (direction, kind). First match wins, so order matters.
  final List<(RegExp, TxnDirection, TxnKind)> kindRules;

  /// Ways the counterparty is introduced: "to X", "from X", "at X", "for X".
  final List<RegExp> counterparty;

  /// Reference / transaction id.
  final RegExp refId;

  /// Messages to ignore outright (OTP, promos, login alerts...).
  final RegExp ignore;

  ParserRules({
    required this.amount,
    required this.kindRules,
    required this.counterparty,
    required this.refId,
    required this.ignore,
  });

  factory ParserRules.defaults() {
    RegExp r(String p) => RegExp(p, caseSensitive: false);
    return ParserRules(
      amount: r(r'(?:rs\.?|npr|रु\.?)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)'),
      kindRules: [
        (r(r'cash\s*back'), TxnDirection.credit, TxnKind.cashback),
        (r(r'refund(ed)?|revers(ed|al)'), TxnDirection.credit, TxnKind.refund),
        (r(r'received|credited|has sent you|transferred to you'), TxnDirection.credit, TxnKind.transfer),
        (r(r'load(ed)?\s+(?:fund|money|balance)|fund load|added to your (?:esewa|wallet)'),
            TxnDirection.credit, TxnKind.load),
        (r(r'top\s*-?\s*up|recharge'), TxnDirection.debit, TxnKind.topup),
        (r(r'\b(?:bill|electricity|nea|khanepani|water|internet|tv|insurance|fees?)\b'),
            TxnDirection.debit, TxnKind.billPay),
        (r(r'\b(?:sent|transferred|fund transfer)\b'), TxnDirection.debit, TxnKind.transfer),
        (r(r'\b(?:paid|payment|purchased?|debited|deducted)\b'), TxnDirection.debit, TxnKind.payment),
      ],
      counterparty: [
        // "to Ram Kirana Pasal on", "to Ram Kirana Pasal." etc.
        r(r'\b(?:to|at)\s+([A-Za-z0-9&.\-\s]{2,60}?)(?=\s+(?:on|for|via|with|is|has|ref|txn|\()|[.,]|$)'),
        r(r'\bfrom\s+([A-Za-z0-9&.\-\s]{2,60}?)(?=\s+(?:on|for|via|with|is|has|ref|txn|\()|[.,]|$)'),
        r(r'\bfor\s+([A-Za-z0-9&.\-\s]{2,60}?)(?=\s+(?:on|via|with|is|has|ref|txn|\()|[.,]|$)'),
      ],
      // Must contain a digit, so "transaction successful" isn't read as an id.
      refId: r(r'(?:ref(?:erence)?|txn|transaction)\s*(?:id|no|code)?\s*[:#.\-]?\s*((?=[A-Z0-9]*[0-9])[A-Z0-9]{6,})'),
      ignore: r(r'\botp\b|one[\s-]?time password|login|logged in|offer|promo|win |congratulations|kyc'),
    );
  }
}

class EsewaParser {
  final ParserRules rules;
  EsewaParser([ParserRules? rules]) : rules = rules ?? ParserRules.defaults();

  /// Returns null when the message is not a money movement.
  Txn? parse(RawEvent e) {
    final text = _normalize(e.body);
    if (text.isEmpty || rules.ignore.hasMatch(text)) return null;

    final amountMatch = rules.amount.firstMatch(text);
    if (amountMatch == null) return null;
    final amount = double.tryParse(amountMatch.group(1)!.replaceAll(',', ''));
    if (amount == null || amount <= 0) return null;

    var direction = TxnDirection.debit;
    var kind = TxnKind.unknown;
    for (final (re, dir, k) in rules.kindRules) {
      if (re.hasMatch(text)) {
        direction = dir;
        kind = k;
        break;
      }
    }
    // Amount with no recognisable verb: not confident it's a transaction.
    if (kind == TxnKind.unknown) return null;

    return Txn(
      amount: amount,
      direction: direction,
      kind: kind,
      counterparty: _counterparty(text),
      refId: rules.refId.firstMatch(text)?.group(1),
      occurredAt: e.postedAt,
      source: e.source,
      rawText: e.body,
    );
  }

  String? _counterparty(String text) {
    // Strip the amount so "to Rs. 500" style text doesn't get picked up.
    final cleaned = text.replaceAll(rules.amount, ' ');
    for (final re in rules.counterparty) {
      final m = re.firstMatch(cleaned);
      final v = m?.group(1)?.trim();
      if (v != null && v.isNotEmpty && !_isNoise(v)) return _title(v);
    }
    return null;
  }

  bool _isNoise(String v) =>
      RegExp(r'^(your|you|esewa|wallet|account|the|a|an)$', caseSensitive: false).hasMatch(v) ||
      RegExp(r'^[0-9\s]+$').hasMatch(v);

  static String _normalize(String s) => s.replaceAll(RegExp(r'\s+'), ' ').trim();

  static String _title(String s) => s
      .split(' ')
      .where((w) => w.isNotEmpty)
      .map((w) => w.length <= 3 && w == w.toUpperCase() ? w : w[0].toUpperCase() + w.substring(1).toLowerCase())
      .join(' ');
}
```

Create `mobile/lib/esewa/deduplicator.dart` with:

```dart
import 'models.dart';

/// The same payment can arrive via notification, SMS and a later statement
/// import. Decide whether [candidate] is already present in [existing].
class Deduplicator {
  /// Notifications vs statements can differ by a few minutes.
  final Duration window;
  Deduplicator({this.window = const Duration(minutes: 3)});

  bool isDuplicate(Txn candidate, Iterable<Txn> existing) {
    for (final t in existing) {
      // 1. Reference id is authoritative when both sides have one.
      if (candidate.refId != null && t.refId != null) {
        if (candidate.refId == t.refId) return true;
        continue;
      }
      // 2. Fuzzy: same amount + direction, close in time, compatible counterparty.
      if (t.amount != candidate.amount || t.direction != candidate.direction) continue;
      if (t.occurredAt.difference(candidate.occurredAt).abs() > window) continue;
      if (_sameParty(t.counterparty, candidate.counterparty)) return true;
    }
    return false;
  }

  /// Merge a duplicate into the existing record (fill gaps, keep best data).
  Txn merge(Txn kept, Txn incoming) => Txn(
        amount: kept.amount,
        direction: kept.direction,
        kind: kept.kind == TxnKind.unknown ? incoming.kind : kept.kind,
        counterparty: kept.counterparty ?? incoming.counterparty,
        refId: kept.refId ?? incoming.refId,
        occurredAt: kept.occurredAt,
        source: kept.source,
        rawText: kept.rawText,
        category: kept.category,
        categoryConfidence: kept.categoryConfidence,
        status: kept.status,
      );

  bool _sameParty(String? a, String? b) {
    if (a == null || b == null) return true; // one side unknown: rely on amount+time
    final x = a.toLowerCase(), y = b.toLowerCase();
    return x == y || x.contains(y) || y.contains(x);
  }
}
```

Create `mobile/lib/esewa/categorizer.dart` with:

```dart
import 'models.dart';

/// Layered categorizer:
///   1. user rules (learned from corrections)   -> confidence 1.0
///   2. known merchant/biller table             -> 0.9
///   3. keyword rules on the raw text           -> 0.7
///   4. kind-based fallback                     -> 0.4
/// Anything below [reviewThreshold] should show in a "Review" inbox.
class Categorizer {
  static const reviewThreshold = 0.6;

  /// counterparty (lowercased) -> category. Persist this per user.
  final Map<String, String> userRules;

  Categorizer({Map<String, String>? userRules}) : userRules = userRules ?? {};

  /// Known Nepali merchants / billers. Extend freely (or load from backend).
  ///
  /// Piko: the right-hand values are the household's own category names
  /// (agreed 2026-10-14). A name the household doesn't have (Education, Rent,
  /// Transfers, Uncategorized) means no guess: the draft waits for a pick.
  static final Map<RegExp, String> merchantTable = {
    _r(r'\bnea\b|nepal electricity'): 'Electricity',
    _r(r'khanepani|kukl|water supply'): 'Water',
    _r(r'\bntc\b|nepal telecom|ncell|smart ?cell'): 'Mobile/Telephone',
    _r(r'worldlink|vianet|classic tech|subisu|dishhome|clear ?tv|net ?tv'): 'Internet',
    _r(r'daraz|sastodeal|hamrobazar'): 'Shopping',
    _r(r'foodmandu|bhojdeals|pathao food|foodpanda'): 'Dining Out',
    _r(r'pathao|indrive|tootle|yango'): 'Transportation',
    _r(r'bhatbhateni|big ?mart|salesberry|kirana|grocery|mart\b'): 'Groceries',
    _r(r'cafe|restaurant|momo|bakery|khaja|chiya|tea house'): 'Lunch',
    _r(r'pharmacy|hospital|clinic|medic|aushadhi'): 'Medicine',
    _r(r'school|college|university|tuition|academy'): 'Education',
    _r(r'insurance|\blife\b|\blic\b'): 'Insurance',
    _r(r'qfx|big movies|fcube|netflix|spotify|youtube'): 'Entertainment',
    _r(r'buddha air|yeti|shree airlines|airlines|bus sewa|travels'): 'Transportation',
    _r(r'petrol|fuel|nepal oil|pump'): 'Petrol',
  };

  static final Map<RegExp, String> keywordTable = {
    _r(r'electricity|water bill'): 'Utilities',
    _r(r'recharge|top ?up|data pack'): 'Mobile/Telephone',
    _r(r'internet|wifi|\btv\b'): 'Internet',
    _r(r'\bfees?\b|tuition'): 'Education',
    _r(r'\brent\b'): 'Rent',
    _r(r'\bloan\b|\bemi\b|installment'): 'EMI',
  };

  void categorize(Txn t) {
    if (!t.isExpense) {
      t.category = switch (t.kind) {
        TxnKind.cashback => 'Cashback',
        TxnKind.refund => 'Refund',
        TxnKind.load => 'Wallet Load', // transfer between own accounts, not income
        _ => 'Income',
      };
      t.categoryConfidence = 0.8;
      return;
    }

    final cp = t.counterparty?.toLowerCase().trim();
    if (cp != null && userRules.containsKey(cp)) {
      return _set(t, userRules[cp]!, 1.0);
    }

    final haystack = '${t.counterparty ?? ''} ${t.rawText}'.toLowerCase();
    for (final e in merchantTable.entries) {
      if (cp != null && e.key.hasMatch(cp)) return _set(t, e.value, 0.9);
    }
    for (final e in merchantTable.entries) {
      if (e.key.hasMatch(haystack)) return _set(t, e.value, 0.75);
    }
    for (final e in keywordTable.entries) {
      if (e.key.hasMatch(haystack)) return _set(t, e.value, 0.7);
    }

    switch (t.kind) {
      case TxnKind.topup:
        return _set(t, 'Mobile/Telephone', 0.8);
      case TxnKind.billPay:
        return _set(t, 'Bills', 0.5);
      case TxnKind.transfer:
        return _set(t, 'Transfers', 0.4);
      default:
        return _set(t, 'Uncategorized', 0.0);
    }
  }

  /// Call when the user changes a category; future txns from the same
  /// counterparty are categorized automatically.
  void learn(Txn t, String newCategory) {
    final cp = t.counterparty?.toLowerCase().trim();
    if (cp != null && cp.isNotEmpty) userRules[cp] = newCategory;
    _set(t, newCategory, 1.0);
  }

  static void _set(Txn t, String c, double conf) {
    t.category = c;
    t.categoryConfidence = conf;
  }

  static RegExp _r(String p) => RegExp(p, caseSensitive: false);
}
```

Create `mobile/lib/esewa/esewa_service.dart` with:

```dart
import 'dart:async';
import 'dart:convert';
import 'dart:io' show Platform;

import 'package:flutter/services.dart';

import 'categorizer.dart';
import 'deduplicator.dart';
import 'models.dart';
import 'parser.dart';

/// Your persistence layer (sqflite / drift / isar / Firestore...).
///
/// Store [Txn.status] as a column. Your existing reports, totals and budgets
/// must only read rows where status == approved.
abstract class TxnRepository {
  /// Transactions near [at] in ANY status (draft, approved, rejected) — used
  /// for duplicate checks, so a rejected txn is never re-drafted.
  Future<List<Txn>> around(DateTime at, Duration window);

  /// Drafts waiting for review, newest first.
  Future<List<Txn>> drafts();

  Future<void> insert(Txn t);
  Future<void> update(Txn t);
  Future<void> saveRaw(RawEvent e); // keep raw events for re-parsing
  Future<Map<String, String>> loadUserRules();
  Future<void> saveUserRules(Map<String, String> rules);
}

/// Wires native capture -> parse -> dedupe -> categorize -> store.
class EsewaService {
  static const _method = MethodChannel('finance/esewa');
  static const _events = EventChannel('finance/esewa/events');

  final TxnRepository repo;
  final EsewaParser parser;
  final Deduplicator dedup;
  late Categorizer categorizer;

  final _newTxns = StreamController<Txn>.broadcast();
  StreamSubscription? _sub;

  EsewaService(this.repo, {EsewaParser? parser, Deduplicator? dedup})
      : parser = parser ?? EsewaParser(),
        dedup = dedup ?? Deduplicator();

  /// Emits every new draft (use it to refresh a "N to review" badge).
  Stream<Txn> get onDraft => _newTxns.stream;

  bool get isSupported => Platform.isAndroid;

  Future<bool> isAccessGranted() async =>
      isSupported && (await _method.invokeMethod<bool>('isAccessGranted') ?? false);

  /// Show your own explanation screen first, then call this.
  Future<void> openAccessSettings() => _method.invokeMethod('openAccessSettings');

  /// Safe to call again (Piko calls it whenever the app comes back to the
  /// front): it reloads the learned rules and drains the queue once more.
  Future<void> start() async {
    categorizer = Categorizer(userRules: await repo.loadUserRules());
    if (!isSupported) return;

    // Piko: the native side queues every notification before it tells us, so
    // a live event only means "something new": draining picks it up along
    // with anything older that hasn't been stored yet.
    _sub ??= _events.receiveBroadcastStream().listen((_) => drainPending());

    // Catch up on anything captured while the app was closed or offline.
    await drainPending();
  }

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
    await repo.saveRaw(e);
    final txn = parser.parse(e);
    if (txn == null) return null;

    final nearby = await repo.around(txn.occurredAt, dedup.window);
    if (dedup.isDuplicate(txn, nearby)) return null;

    categorizer.categorize(txn);
    txn.status = TxnStatus.draft; // never straight to real data
    await repo.insert(txn);
    _newTxns.add(txn);
    return txn;
  }

  // ---------------- Review ----------------

  Future<List<Txn>> pendingReview() => repo.drafts();

  /// User okays a draft, optionally fixing fields first. Only now does it
  /// become real data. A changed category is learned for next time.
  Future<void> approve(Txn t, {String? category, double? amount, String? counterparty}) async {
    if (amount != null && amount > 0) t.amount = amount;
    if (counterparty != null && counterparty.trim().isNotEmpty) t.counterparty = counterparty.trim();
    if (category != null && category != t.category) {
      categorizer.learn(t, category);
      await repo.saveUserRules(categorizer.userRules);
    }
    t.status = TxnStatus.approved;
    await repo.update(t);
  }

  /// User dismisses a draft (wrong parse, not an expense, already entered by
  /// hand...). Kept as rejected so the same notification isn't drafted again.
  Future<void> reject(Txn t) async {
    t.status = TxnStatus.rejected;
    await repo.update(t);
  }

  /// "Approve all" button: approves every draft as-is.
  Future<int> approveAll() async {
    final list = await repo.drafts();
    for (final t in list) {
      await approve(t);
    }
    return list.length;
  }

  Future<void> dispose() async {
    await _sub?.cancel();
    await _newTxns.close();
  }
}
```

Create `mobile/android/app/src/main/kotlin/com/nirjal/piko/esewa/PendingStore.kt` with:

```kotlin
package com.nirjal.piko.esewa

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Durable queue of raw events. Every captured notification goes in here first,
 * whether or not the app is running, and stays until Dart acks it after
 * storing it on the server. So a payment made while the phone is offline, or
 * while Piko is closed, is never lost.
 * Capped so a long-closed app can't grow it without limit.
 */
object PendingStore {
    private const val PREFS = "esewa_pending"
    private const val KEY = "events"
    private const val MAX = 500

    /**
     * Names one notification. Android re-posts an updated notification under
     * the same key, and an app may reuse one key for every notification, so
     * the post time is part of the name.
     */
    private fun idOf(event: JSONObject) = "${event.optString("key")}@${event.optLong("postedAt")}"

    @Synchronized
    fun append(ctx: Context, event: JSONObject) {
        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val arr = JSONArray(prefs.getString(KEY, "[]"))
        val id = idOf(event)
        for (i in 0 until arr.length()) {
            if (arr.getJSONObject(i).optString("id") == id) return
        }
        arr.put(event.put("id", id))
        val trimmed = if (arr.length() > MAX) {
            JSONArray().also { out -> for (i in arr.length() - MAX until arr.length()) out.put(arr.get(i)) }
        } else arr
        // commit, not apply: the process may be killed right after a notification.
        prefs.edit().putString(KEY, trimmed.toString()).commit()
    }

    /** Every queued event, oldest first. Nothing is removed until [ack]. */
    @Synchronized
    fun pending(ctx: Context): String =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "[]") ?: "[]"

    /** Removes the events Dart has stored. */
    @Synchronized
    fun ack(ctx: Context, ids: Collection<String>) {
        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val arr = JSONArray(prefs.getString(KEY, "[]"))
        val kept = JSONArray()
        for (i in 0 until arr.length()) {
            val event = arr.getJSONObject(i)
            if (event.optString("id") !in ids) kept.put(event)
        }
        prefs.edit().putString(KEY, kept.toString()).commit()
    }
}
```

Create `mobile/android/app/src/main/kotlin/com/nirjal/piko/esewa/EsewaBridge.kt` with:

```kotlin
package com.nirjal.piko.esewa

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodChannel
import org.json.JSONObject

/**
 * Flutter <-> native bridge.
 *  MethodChannel "finance/esewa":  isAccessGranted, openAccessSettings, pending, ack
 *  EventChannel  "finance/esewa/events": live raw events (JSON strings)
 */
object EsewaBridge {
    private const val METHOD = "finance/esewa"
    private const val EVENTS = "finance/esewa/events"

    private var sink: EventChannel.EventSink? = null
    private val main = Handler(Looper.getMainLooper())

    fun register(engine: FlutterEngine, ctx: Context) {
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
                else -> result.notImplemented()
            }
        }

        EventChannel(messenger, EVENTS).setStreamHandler(object : EventChannel.StreamHandler {
            override fun onListen(args: Any?, events: EventChannel.EventSink) { sink = events }
            override fun onCancel(args: Any?) { sink = null }
        })
    }

    /** Wakes Dart if it is listening. The event is already queued in PendingStore. */
    fun emit(event: JSONObject) {
        val s = sink ?: return
        main.post { s.success(event.toString()) }
    }

    private fun isAccessGranted(ctx: Context): Boolean {
        val enabled = Settings.Secure.getString(ctx.contentResolver, "enabled_notification_listeners") ?: return false
        val me = ComponentName(ctx, EsewaNotificationListener::class.java).flattenToString()
        return enabled.split(":").any { it == me }
    }
}
```

Create `mobile/android/app/src/main/kotlin/com/nirjal/piko/esewa/EsewaNotificationListener.kt` with:

```kotlin
package com.nirjal.piko.esewa

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONObject

/**
 * Captures eSewa (and optionally bank) notifications.
 *
 * Runs even when the Flutter UI is closed. Every event is queued in
 * PendingStore first; if the Flutter side is listening it is also woken
 * through EsewaBridge, and it drains the queue.
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

        // Queued first, so it survives until Dart has stored it; then wake Dart
        // in case the app is running.
        PendingStore.append(applicationContext, event)
        EsewaBridge.emit(event)
    }
}
```

Replace the whole of `mobile/android/app/src/main/kotlin/com/nirjal/piko/MainActivity.kt` with:

```kotlin
package com.nirjal.piko

import com.nirjal.piko.esewa.EsewaBridge
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // eSewa auto-capture: the channels Dart uses to read the notification queue.
        EsewaBridge.register(flutterEngine, applicationContext)
    }
}
```

In `mobile/android/app/src/main/AndroidManifest.xml`, find:

```xml
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
        </activity>
        <provider
            android:name="sk.fourq.otaupdate.OtaUpdateFileProvider"
            android:authorities="${applicationId}.ota_update_provider"
```

Replace it with:

```xml
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
        </activity>
        <!-- eSewa auto-capture: reads eSewa's notifications once the user turns on
             notification access for Piko (Settings in the app opens that screen). -->
        <service
            android:name=".esewa.EsewaNotificationListener"
            android:label="Piko"
            android:exported="false"
            android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE">
            <intent-filter>
                <action android:name="android.service.notification.NotificationListenerService" />
            </intent-filter>
        </service>
        <provider
            android:name="sk.fourq.otaupdate.OtaUpdateFileProvider"
            android:authorities="${applicationId}.ota_update_provider"
```

- [ ] **Step 4: Run the new tests again**

Run:

```bash
cd mobile; flutter test test/esewa_parser_test.dart test/esewa; cd ..
```

Expected: `+21: All tests passed!`

- [ ] **Step 5: Run every check**

Run:

```bash
cd mobile; flutter analyze; cd ..
cd mobile; flutter test; cd ..
cd mobile; flutter build apk --debug --target-platform android-arm64; cd ..
```

Expected: `No issues found!`; `+129: All tests passed!`; the build (1–5 minutes; it compiles the Kotlin) ends with `√ Built build\app\outputs\flutter-apk\app-debug.apk`. The Gradle warnings about plugins and "Built-in Kotlin" were there before and are fine. Don't commit anything under `mobile/build/`; it's ignored.

- [ ] **Step 6: Commit**

```bash
git add mobile/android/app/src/main/AndroidManifest.xml mobile/android/app/src/main/kotlin/com/nirjal/piko/MainActivity.kt mobile/android/app/src/main/kotlin/com/nirjal/piko/esewa/EsewaBridge.kt mobile/android/app/src/main/kotlin/com/nirjal/piko/esewa/EsewaNotificationListener.kt mobile/android/app/src/main/kotlin/com/nirjal/piko/esewa/PendingStore.kt mobile/lib/esewa/categorizer.dart mobile/lib/esewa/deduplicator.dart mobile/lib/esewa/esewa_service.dart mobile/lib/esewa/models.dart mobile/lib/esewa/parser.dart mobile/test/esewa/categorizer_mapping_test.dart mobile/test/esewa/esewa_service_test.dart mobile/test/esewa_parser_test.dart
git commit -m "feat(mobile): the eSewa capture module, with a queue that survives offline"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.

### Task 7: Store captures on Piko's server

Design points 2–5 and 9 (fix 2). `PikoTxnRepository` implements the module's `TxnRepository` with the endpoints from Task 4:

- `Txn` has no id field, so each capture's server id rides alongside it in an `Expando`.
- `prepareApproval` keeps what was checked in the sheet for the next approve. Without it, `approvalDraft` approves the draft as it is: for and paid by the signed-in person, on the payment's local date, with the payee as the note. It's null when the draft's category isn't one of the household's, and then approving throws instead of calling the server.
- `saveRaw` masks the digits of messages the parser ignores.
- Rules travel as payee → category id and are turned into the categorizer's names and back, so renaming a category on the website doesn't break them. Loading rules while offline gives none, which is safe because the server never deletes rules.

**Files:**

- Create: `mobile/lib/esewa/piko_txn_repository.dart`
- Modify: `mobile/lib/services/api_client.dart`
- Test: `mobile/test/esewa/piko_txn_repository_test.dart` (new)

**Interfaces:**

- Consumes: the JSON shapes from Task 4; the module types from Task 6; `CategoriesResult` (`categories`, `currentMemberId`).
- Produces: `PikoTxnRepository({required ApiClient client, required Future<CategoriesResult> Function() options, RegExp? ignore})` with `prepareApproval(Txn t, ExpenseDraft draft)` and `approvalDraft(Txn t, CategoriesResult options): ExpenseDraft?`, and the top-level `categoryNamed(String name, List<CategoryOption> categories): CategoryOption?`, in `mobile/lib/esewa/piko_txn_repository.dart`.
- Produces: `ApiClient` methods `fetchCaptureDrafts`, `fetchCapturesAround`, `createCapture`, `approveCapture`, `rejectCapture`, `saveCaptureEvent`, `fetchCaptureRules`, `saveCaptureRules`.

- [ ] **Step 1: Write the failing tests**

Create `mobile/test/esewa/piko_txn_repository_test.dart` with:

```dart
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:piko/esewa/models.dart';
import 'package:piko/esewa/piko_txn_repository.dart';
import 'package:piko/models/categories_result.dart';
import 'package:piko/models/category_option.dart';
import 'package:piko/models/expense_draft.dart';
import 'package:piko/models/member_option.dart';
import 'package:piko/services/api_client.dart';

void main() {
  final options = CategoriesResult(
    categories: [CategoryOption(id: 'cat-groceries', name: 'Groceries'), CategoryOption(id: 'cat-lunch', name: 'Lunch')],
    members: [MemberOption(id: 'mem-1', name: 'Nirjal'), MemberOption(id: 'mem-2', name: 'Karuna')],
    currentMemberId: 'mem-1',
  );

  // Every request the repository makes, and a canned reply per path.
  late List<http.Request> requests;
  late Map<String, Object> replies;

  PikoTxnRepository repo() {
    final client = MockClient((request) async {
      requests.add(request);
      return http.Response(jsonEncode(replies[request.url.path] ?? {}), 200);
    });
    return PikoTxnRepository(
      client: ApiClient(getBaseUrl: () => 'https://piko.test', getToken: () => 'jwt', onUnauthorized: () {}, client: client),
      options: () async => options,
    );
  }

  Map<String, dynamic> bodyOf(String path) =>
      jsonDecode(requests.lastWhere((r) => r.url.path == path).body) as Map<String, dynamic>;

  Txn paid({String category = 'Groceries', String? counterparty = 'Bhatbhateni Supermarket'}) => Txn(
        amount: 1250.5,
        direction: TxnDirection.debit,
        kind: TxnKind.payment,
        // Late at night, local time: the expense must still land on this day.
        occurredAt: DateTime(2026, 10, 14, 23, 30),
        source: 'notification',
        rawText: 'You have paid Rs. 1,250.50 to Bhatbhateni Supermarket',
        counterparty: counterparty,
        refId: '0ABC12345',
        category: category,
        categoryConfidence: 0.9,
      );

  Map<String, Object?> serverCapture(String id, String status) => {
        'amount': 500,
        'category': 'Lunch',
        'categoryConfidence': 0.75,
        'counterparty': 'Momo Center',
        'direction': 'debit',
        'id': id,
        'kind': 'payment',
        'occurredAt': '2026-10-14T06:15:30.250Z',
        'rawText': 'You have paid Rs. 500 to Momo Center',
        'refId': null,
        'source': 'notification',
        'status': status,
      };

  setUp(() {
    requests = [];
    replies = {
      '/api/mobile/captures': {
        'capture': {'id': 'cap-1'},
      },
      '/api/mobile/captures/approve': {
        'expense': {
          'amount': 1250.5,
          'categoryId': 'cat-groceries',
          'date': '2026-10-14',
          'id': 'exp-1',
          'note': 'Bhatbhateni Supermarket',
          'ownerMemberId': 'mem-1',
          'paidByMemberId': 'mem-1',
        },
      },
    };
  });

  test('stores a capture with its time in UTC', () async {
    final t = paid();
    await repo().insert(t);

    final sent = bodyOf('/api/mobile/captures');
    expect(sent['occurredAt'], t.occurredAt.toUtc().toIso8601String());
    expect(sent['occurredAt'], endsWith('Z'));
    expect(sent['amount'], 1250.5);
    expect(sent['direction'], 'debit');
    expect(sent['kind'], 'payment');
    expect(sent['category'], 'Groceries');
  });

  test('approving files it for and paid by me, on the day it was paid, with the payee as the note', () async {
    final r = repo();
    final t = paid();
    await r.insert(t);

    t.status = TxnStatus.approved;
    await r.update(t);

    final sent = bodyOf('/api/mobile/captures/approve');
    expect(sent['id'], 'cap-1');
    expect(sent['expense'], {
      'amount': 1250.5,
      'categoryId': 'cat-groceries',
      'ownerMemberId': 'mem-1',
      'paidByMemberId': 'mem-1',
      'date': '2026-10-14',
      'note': 'Bhatbhateni Supermarket',
    });
  });

  test('approving uses what was checked in the sheet', () async {
    final r = repo();
    final t = paid();
    await r.insert(t);
    final checked = ExpenseDraft(
      amount: 1200,
      categoryId: 'cat-lunch',
      ownerMemberId: null,
      paidByMemberId: 'mem-1',
      date: '2026-10-13',
      note: 'T shirt from Basemark',
    );

    r.prepareApproval(t, checked);
    t.status = TxnStatus.approved;
    await r.update(t);

    expect(bodyOf('/api/mobile/captures/approve')['expense'], checked.toJson());
  });

  test("can't approve as it is without one of the household's categories", () async {
    final r = repo();
    final t = paid(category: 'Transfers');
    await r.insert(t);

    expect(r.approvalDraft(t, options), isNull);
    t.status = TxnStatus.approved;
    await expectLater(r.update(t), throwsStateError);
    expect(requests.where((q) => q.url.path == '/api/mobile/captures/approve'), isEmpty);
  });

  test('matches a category by name whatever its capitals', () async {
    expect(repo().approvalDraft(paid(category: 'groceries '), options)?.categoryId, 'cat-groceries');
  });

  test('rejecting tells the server which capture', () async {
    final r = repo();
    final t = paid();
    await r.insert(t);

    t.status = TxnStatus.rejected;
    await r.update(t);

    expect(bodyOf('/api/mobile/captures/reject'), {'id': 'cap-1'});
  });

  test('reads drafts back with their ids, so they can be approved', () async {
    replies['/api/mobile/captures'] = {
      'captures': [serverCapture('cap-9', 'draft')],
    };
    final r = repo();

    final drafts = await r.drafts();
    expect(drafts.single.amount, 500);
    expect(drafts.single.counterparty, 'Momo Center');
    expect(drafts.single.occurredAt, DateTime.utc(2026, 10, 14, 6, 15, 30, 250).toLocal());
    expect(drafts.single.isDraft, isTrue);

    drafts.single.status = TxnStatus.rejected;
    await r.update(drafts.single);
    expect(bodyOf('/api/mobile/captures/reject'), {'id': 'cap-9'});
  });

  test('a skipped capture counts as dismissed in the duplicate check', () async {
    replies['/api/mobile/captures/around'] = {
      'captures': [serverCapture('cap-3', 'skipped'), serverCapture('cap-4', 'approved')],
    };

    final nearby = await repo().around(DateTime.utc(2026, 10, 14, 6, 15), const Duration(minutes: 3));

    expect(nearby.map((t) => t.status), [TxnStatus.rejected, TxnStatus.approved]);
    expect(requests.last.url.queryParameters, {'at': '2026-10-14T06:15:00.000Z', 'seconds': '180'});
  });

  test('masks the digits of OTP and login messages in the log, and only those', () async {
    final r = repo();
    await r.saveRaw(RawEvent(source: 'notification', key: 'k1', title: 'eSewa', text: 'Your OTP for payment of Rs. 500 is 123456', postedAt: DateTime.utc(2026, 10, 14, 6)));
    expect(bodyOf('/api/mobile/capture-events')['text'], 'Your OTP for payment of Rs. ••• is ••••••');

    await r.saveRaw(RawEvent(source: 'notification', key: 'k2', title: 'eSewa', text: 'You have paid Rs. 500 to Daraz.', postedAt: DateTime.utc(2026, 10, 14, 6)));
    final sent = bodyOf('/api/mobile/capture-events');
    expect(sent['text'], 'You have paid Rs. 500 to Daraz.');
    expect(sent['key'], 'k2');
    expect(sent['postedAt'], '2026-10-14T06:00:00.000Z');
  });

  test('loads learned rules by category name, dropping ones whose category is gone', () async {
    replies['/api/mobile/capture-rules'] = {
      'rules': [
        {'categoryId': 'cat-lunch', 'counterparty': 'momo center'},
        {'categoryId': 'cat-archived', 'counterparty': 'old shop'},
      ],
    };

    expect(await repo().loadUserRules(), {'momo center': 'Lunch'});
  });

  test('starts with no rules when they cannot be loaded', () async {
    final failing = PikoTxnRepository(
      client: ApiClient(
        getBaseUrl: () => 'https://piko.test',
        getToken: () => 'jwt',
        onUnauthorized: () {},
        client: MockClient((_) async => throw http.ClientException('offline')),
      ),
      options: () async => options,
    );

    expect(await failing.loadUserRules(), isEmpty);
  });

  test('saves rules by category id, leaving out names the household does not have', () async {
    await repo().saveUserRules({'momo center': 'Lunch', 'hari shrestha': 'Rent'});

    expect(bodyOf('/api/mobile/capture-rules'), {
      'rules': [
        {'categoryId': 'cat-lunch', 'counterparty': 'momo center'},
      ],
    });
  });
}
```

- [ ] **Step 2: Run the new tests and watch them fail**

Run:

```bash
cd mobile; flutter test test/esewa/piko_txn_repository_test.dart; cd ..
```

Expected: FAIL to compile, starting with `test/esewa/piko_txn_repository_test.dart:7:8: Error: Error when reading 'lib/esewa/piko_txn_repository.dart': The system cannot find the file specified`

- [ ] **Step 3: Implement**

In `mobile/lib/services/api_client.dart`, find:

```dart
    return BsCalendar.fromJson(await _authorizedGet('/api/mobile/calendar'));
  }

  Future<AppRelease?> fetchLatestRelease() async {
    final body = await _authorizedGet('/api/mobile/app-version');
    final latest = body['latest'];
```

Replace it with:

```dart
    return BsCalendar.fromJson(await _authorizedGet('/api/mobile/calendar'));
  }

  // eSewa captures. The JSON shape is mapped to the module's Txn in
  // lib/esewa/piko_txn_repository.dart.

  Future<List<Map<String, dynamic>>> fetchCaptureDrafts() async {
    final body = await _authorizedGet('/api/mobile/captures');
    return (body['captures'] as List<dynamic>).cast<Map<String, dynamic>>();
  }

  Future<List<Map<String, dynamic>>> fetchCapturesAround(DateTime at, Duration window) async {
    final when = Uri.encodeQueryComponent(at.toUtc().toIso8601String());
    final body = await _authorizedGet('/api/mobile/captures/around?at=$when&seconds=${window.inSeconds}');
    return (body['captures'] as List<dynamic>).cast<Map<String, dynamic>>();
  }

  // Returns the new capture's id.
  Future<String> createCapture(Map<String, dynamic> capture) async {
    final body = await _authorizedPost('/api/mobile/captures', capture);
    return (body['capture'] as Map<String, dynamic>)['id'] as String;
  }

  Future<Expense> approveCapture(String id, ExpenseDraft expense) async {
    final body = await _authorizedPost('/api/mobile/captures/approve', {'expense': expense.toJson(), 'id': id});
    return Expense.fromJson(body['expense'] as Map<String, dynamic>);
  }

  Future<void> rejectCapture(String id) async {
    await _authorizedPost('/api/mobile/captures/reject', {'id': id});
  }

  Future<void> saveCaptureEvent(Map<String, dynamic> event) async {
    await _authorizedPost('/api/mobile/capture-events', event);
  }

  // Payee → category id.
  Future<Map<String, String>> fetchCaptureRules() async {
    final body = await _authorizedGet('/api/mobile/capture-rules');
    return {
      for (final rule in (body['rules'] as List<dynamic>).cast<Map<String, dynamic>>())
        rule['counterparty'] as String: rule['categoryId'] as String,
    };
  }

  // Adds or updates these rules; the server keeps any not sent.
  Future<void> saveCaptureRules(Map<String, String> rules) async {
    await _authorizedPost('/api/mobile/capture-rules', {
      'rules': [
        for (final MapEntry(key: payee, value: categoryId) in rules.entries) {'categoryId': categoryId, 'counterparty': payee},
      ],
    });
  }

  Future<AppRelease?> fetchLatestRelease() async {
    final body = await _authorizedGet('/api/mobile/app-version');
    final latest = body['latest'];
```

Create `mobile/lib/esewa/piko_txn_repository.dart` with:

```dart
import '../models/categories_result.dart';
import '../models/category_option.dart';
import '../models/expense_draft.dart';
import '../services/api_client.dart';
import '../services/bs_calendar.dart';
import 'esewa_service.dart';
import 'models.dart';
import 'parser.dart';

/// The household's category called [name], ignoring capitals and spaces at
/// the ends; null when there's none (the categorizer's guess isn't one of
/// theirs).
CategoryOption? categoryNamed(String name, List<CategoryOption> categories) {
  final wanted = name.trim().toLowerCase();
  for (final category in categories) {
    if (category.name.trim().toLowerCase() == wanted) return category;
  }
  return null;
}

/// [TxnRepository] on Piko's server. Captures live in their own table, so a
/// draft never reaches the household's expenses, or any total, until it is
/// approved; approving goes through the server's normal add-expense path.
class PikoTxnRepository implements TxnRepository {
  PikoTxnRepository({required this.client, required this.options, RegExp? ignore})
      : _ignore = ignore ?? ParserRules.defaults().ignore;

  final ApiClient client;

  /// The household's categories and the signed-in member.
  final Future<CategoriesResult> Function() options;

  // The parser's "not a money movement" rule (OTP, login, promos).
  final RegExp _ignore;

  // Txn has no id field, so the server's id for each capture rides alongside.
  final _ids = Expando<String>('capture id');
  final _approvals = Expando<ExpenseDraft>('approval');

  /// What was checked in the Add expense sheet, used the next time [t] is
  /// approved. Without it, [t] is approved as it is ([approvalDraft]).
  void prepareApproval(Txn t, ExpenseDraft draft) => _approvals[t] = draft;

  /// [t] as an expense for and paid by the signed-in person, on the day it
  /// was paid, with the payee as the note. Null when its category isn't one
  /// of the household's, or the server doesn't say who is signed in.
  ExpenseDraft? approvalDraft(Txn t, CategoriesResult options) {
    final me = options.currentMemberId;
    final category = categoryNamed(t.category, options.categories);
    if (me == null || category == null) return null;
    return ExpenseDraft(
      amount: t.amount,
      categoryId: category.id,
      ownerMemberId: me,
      paidByMemberId: me,
      date: formatAd(t.occurredAt.toLocal()),
      note: t.counterparty,
    );
  }

  Txn _fromJson(Map<String, dynamic> json) {
    final t = Txn(
      amount: (json['amount'] as num).toDouble(),
      direction: TxnDirection.values.byName(json['direction'] as String),
      kind: TxnKind.values.byName(json['kind'] as String),
      occurredAt: DateTime.parse(json['occurredAt'] as String).toLocal(),
      source: json['source'] as String,
      rawText: json['rawText'] as String,
      counterparty: json['counterparty'] as String?,
      refId: json['refId'] as String?,
      category: json['category'] as String,
      categoryConfidence: (json['categoryConfidence'] as num).toDouble(),
      // Skipped (money coming in) counts as dismissed for the duplicate check.
      status: switch (json['status']) {
        'draft' => TxnStatus.draft,
        'approved' => TxnStatus.approved,
        _ => TxnStatus.rejected,
      },
    );
    _ids[t] = json['id'] as String;
    return t;
  }

  @override
  Future<List<Txn>> around(DateTime at, Duration window) async =>
      (await client.fetchCapturesAround(at, window)).map(_fromJson).toList();

  @override
  Future<List<Txn>> drafts() async => (await client.fetchCaptureDrafts()).map(_fromJson).toList();

  @override
  Future<void> insert(Txn t) async {
    _ids[t] = await client.createCapture({
      'amount': t.amount,
      'category': t.category,
      'categoryConfidence': t.categoryConfidence,
      'counterparty': t.counterparty,
      'direction': t.direction.name,
      'kind': t.kind.name,
      'occurredAt': t.occurredAt.toUtc().toIso8601String(),
      'rawText': t.rawText,
      'refId': t.refId,
      'source': t.source,
    });
  }

  @override
  Future<void> update(Txn t) async {
    final id = _ids[t];
    if (id == null) throw StateError('This payment was never stored');
    switch (t.status) {
      case TxnStatus.approved:
        final draft = _approvals[t] ?? approvalDraft(t, await options());
        if (draft == null) throw StateError('Pick a category first');
        await client.approveCapture(id, draft);
      case TxnStatus.rejected:
        await client.rejectCapture(id);
      case TxnStatus.draft:
        break;
    }
  }

  @override
  Future<void> saveRaw(RawEvent e) async {
    // OTP and login messages stay in the log for tuning, but never with their codes.
    final hide = _ignore.hasMatch(e.body.replaceAll(RegExp(r'\s+'), ' '));
    String mask(String s) => hide ? s.replaceAll(RegExp(r'\d'), '•') : s;
    await client.saveCaptureEvent({
      'key': e.key,
      'postedAt': e.postedAt.toUtc().toIso8601String(),
      'source': e.source,
      'text': mask(e.text),
      'title': mask(e.title),
    });
  }

  @override
  Future<Map<String, String>> loadUserRules() async {
    // Offline at start: carry on without them. The server only ever adds or
    // updates rules, so saving from this smaller set later loses nothing.
    try {
      final rules = await client.fetchCaptureRules();
      final names = {for (final c in (await options()).categories) c.id: c.name};
      return {
        for (final MapEntry(key: payee, value: id) in rules.entries) payee: ?names[id],
      };
    } catch (_) {
      return {};
    }
  }

  @override
  Future<void> saveUserRules(Map<String, String> rules) async {
    final categories = (await options()).categories;
    await client.saveCaptureRules({
      for (final MapEntry(key: payee, value: name) in rules.entries)
        if (categoryNamed(name, categories) case final category?) payee: category.id,
    });
  }
}
```

- [ ] **Step 4: Run the new tests again**

Run:

```bash
cd mobile; flutter test test/esewa/piko_txn_repository_test.dart; cd ..
```

Expected: `+12: All tests passed!`

- [ ] **Step 5: Run every check**

Run:

```bash
cd mobile; flutter analyze; cd ..
cd mobile; flutter test; cd ..
```

Expected: `No issues found!`; `+141: All tests passed!`.

- [ ] **Step 6: Commit**

```bash
git add mobile/lib/esewa/piko_txn_repository.dart mobile/lib/services/api_client.dart mobile/test/esewa/piko_txn_repository_test.dart
git commit -m "feat(mobile): store eSewa captures on Piko's server"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.

### Task 8: Review drafts from Home and approve them like an expense

Design points 5, 9 (fixes 3 and 4) and 12.

- **Providers** (`esewa_provider.dart`) make the repository and the service for the signed-in person. They're null when signed out, so nothing is filed under nobody and notifications wait in the phone's queue.
- **Home** starts capture when it opens and whenever the app comes back to the front. `start()` can run again: it reloads the rules and drains the queue. Home shows the strip while drafts wait.
- **Review** is Piko's own screen, replacing the module's. Swipe-approve uses `approvalDraft` and opens the sheet when there's none; a row disappears only after the server agrees.
- **The sheet** gains `title` and `saveLabel`. When it saves, the screen hands what was checked to `prepareApproval`, then calls the module's `approve` with the category's name, so a changed category is learned for the payee.

**Files:**

- Create: `mobile/lib/esewa/review_rows.dart`
- Create: `mobile/lib/esewa/review_screen.dart`
- Create: `mobile/lib/providers/esewa_provider.dart`
- Modify: `mobile/lib/screens/home_screen.dart`
- Create: `mobile/lib/widgets/esewa_review_banner.dart`
- Modify: `mobile/lib/widgets/expense_confirm_sheet.dart`
- Test: `mobile/test/esewa/review_rows_test.dart` (new)
- Test: `mobile/test/esewa/review_screen_test.dart` (new)
- Test: `mobile/test/widgets/esewa_review_banner_test.dart` (new)

**Interfaces:**

- Consumes: `PikoTxnRepository` and `categoryNamed` (Task 7), `EsewaService` (Task 6), `ExpenseConfirmSheet(noteWords: …)` (Task 5).
- Produces: `esewaRepositoryProvider` (`Provider<PikoTxnRepository?>`), `esewaServiceProvider` (`Provider<EsewaService?>`) and `esewaDraftCountProvider` (`FutureProvider.autoDispose<int>`) in `mobile/lib/providers/esewa_provider.dart`. Task 9 adds to this file.
- Produces: `EsewaReviewScreen()` (no arguments), `EsewaReviewBanner({required int count, required VoidCallback onTap})`, `draftTitle(Txn t)` and `draftWhen(Txn t, AppDateFormat format, BsCalendar calendar)`, and `ExpenseConfirmSheet(title: …, saveLabel: …)` (both default to "Add expense").

- [ ] **Step 1: Write the failing tests**

Create `mobile/test/esewa/review_rows_test.dart` with:

```dart
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:piko/esewa/models.dart';
import 'package:piko/esewa/review_rows.dart';
import 'package:piko/services/bs_calendar.dart';

void main() {
  final calendar = BsCalendar.fromJson(
    jsonDecode(File('assets/bs_calendar.json').readAsStringSync()) as Map<String, dynamic>,
  );

  Txn txn({String? counterparty, TxnKind kind = TxnKind.payment}) => Txn(
        amount: 100,
        direction: TxnDirection.debit,
        kind: kind,
        occurredAt: DateTime(2026, 10, 14, 9, 5),
        source: 'notification',
        rawText: '',
        counterparty: counterparty,
      );

  test('a row is called by who was paid', () {
    expect(draftTitle(txn(counterparty: 'Bhatbhateni Supermarket')), 'Bhatbhateni Supermarket');
  });

  test('without a payee, by the kind of payment', () {
    expect(draftTitle(txn(kind: TxnKind.topup)), 'Top-up');
    expect(draftTitle(txn(kind: TxnKind.billPay)), 'Bill payment');
    expect(draftTitle(txn(counterparty: '  ')), 'Payment');
  });

  test('shows the date the way the app shows dates, and the time', () {
    expect(draftWhen(txn(), AppDateFormat.english, calendar), '14 Oct 2026 · 09:05');
    expect(draftWhen(txn(), AppDateFormat.nepali, calendar), '28 Ashwin 2083 · 09:05');
  });
}
```

Create `mobile/test/esewa/review_screen_test.dart` with:

```dart
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:piko/esewa/categorizer.dart';
import 'package:piko/esewa/esewa_service.dart';
import 'package:piko/esewa/piko_txn_repository.dart';
import 'package:piko/esewa/review_screen.dart';
import 'package:piko/models/categories_result.dart';
import 'package:piko/models/category_option.dart';
import 'package:piko/models/expense.dart';
import 'package:piko/models/member_option.dart';
import 'package:piko/providers/calendar_provider.dart';
import 'package:piko/providers/categories_provider.dart';
import 'package:piko/providers/esewa_provider.dart';
import 'package:piko/providers/expenses_provider.dart';
import 'package:piko/services/api_client.dart';
import 'package:piko/services/bs_calendar.dart';
import 'package:piko/theme/app_theme.dart';
import 'package:shared_preferences/shared_preferences.dart';

// Piko's capture endpoints, in memory.
class _FakeServer {
  final drafts = <Map<String, Object?>>[
    _capture('cap-bhat', 1250.5, 'Bhatbhateni Supermarket', 'Groceries'),
    _capture('cap-hari', 300, 'Hari Shrestha', 'Transfers', kind: 'transfer'),
  ];
  final approved = <Map<String, dynamic>>[];
  final rejected = <String>[];
  final rules = <Map<String, dynamic>>[];

  static Map<String, Object?> _capture(String id, num amount, String payee, String category, {String kind = 'payment'}) => {
        'amount': amount,
        'category': category,
        'categoryConfidence': 0.9,
        'counterparty': payee,
        'direction': 'debit',
        'id': id,
        'kind': kind,
        'occurredAt': '2026-10-14T06:00:00.000Z',
        'rawText': 'You have paid Rs. $amount to $payee',
        'refId': null,
        'source': 'notification',
        'status': 'draft',
      };

  http.Client get client => MockClient((request) async {
        http.Response json(Object body) => http.Response(jsonEncode(body), 200);
        final body = request.body.isEmpty ? <String, dynamic>{} : jsonDecode(request.body) as Map<String, dynamic>;
        switch ('${request.method} ${request.url.path}') {
          case 'GET /api/mobile/captures':
            return json({'captures': drafts});
          case 'POST /api/mobile/captures/approve':
            approved.add(body);
            drafts.removeWhere((d) => d['id'] == body['id']);
            return json({
              'expense': {...(body['expense'] as Map<String, dynamic>), 'id': 'exp-${approved.length}'},
            });
          case 'POST /api/mobile/captures/reject':
            rejected.add(body['id'] as String);
            drafts.removeWhere((d) => d['id'] == body['id']);
            return json({'ok': true});
          case 'POST /api/mobile/capture-rules':
            rules.addAll((body['rules'] as List<dynamic>).cast<Map<String, dynamic>>());
            return json({'ok': true});
        }
        return http.Response('{}', 404);
      });
}

void main() {
  final calendar = BsCalendar.fromJson(
    jsonDecode(File('assets/bs_calendar.json').readAsStringSync()) as Map<String, dynamic>,
  );
  final options = CategoriesResult(
    categories: [CategoryOption(id: 'cat-groceries', name: 'Groceries'), CategoryOption(id: 'cat-lunch', name: 'Lunch')],
    members: [MemberOption(id: 'mem-1', name: 'Nirjal'), MemberOption(id: 'mem-2', name: 'Karuna')],
    currentMemberId: 'mem-1',
  );

  late _FakeServer server;

  Future<void> pumpReview(WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    tester.view.physicalSize = const Size(800, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final api = ApiClient(getBaseUrl: () => 'https://piko.test', getToken: () => 'jwt', onUnauthorized: () {}, client: server.client);
    final repo = PikoTxnRepository(client: api, options: () async => options);
    final service = EsewaService(repo)..categorizer = Categorizer();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          esewaRepositoryProvider.overrideWithValue(repo),
          esewaServiceProvider.overrideWithValue(service),
          categoriesProvider.overrideWith((ref) async => options),
          recentExpensesProvider.overrideWith((ref) async => const <Expense>[]),
          bsCalendarProvider.overrideWithValue(calendar),
        ],
        child: MaterialApp(theme: AppTheme.light, home: const EsewaReviewScreen()),
      ),
    );
    await tester.pumpAndSettle();
  }

  setUp(() => server = _FakeServer());

  testWidgets('lists each draft with its category, or asks for one', (tester) async {
    await pumpReview(tester);

    expect(find.text('Bhatbhateni Supermarket'), findsOneWidget);
    expect(find.text('Hari Shrestha'), findsOneWidget);
    expect(find.textContaining('Groceries ·', findRichText: true), findsOneWidget);
    expect(find.textContaining('Pick a category ·', findRichText: true), findsOneWidget);
  });

  testWidgets('swiping right approves a draft as it is: for and paid by me, with the payee as the note', (tester) async {
    await pumpReview(tester);

    await tester.drag(find.text('Bhatbhateni Supermarket'), const Offset(600, 0));
    await tester.pumpAndSettle();

    expect(server.approved.single['id'], 'cap-bhat');
    expect(server.approved.single['expense'], {
      'amount': 1250.5,
      'categoryId': 'cat-groceries',
      'ownerMemberId': 'mem-1',
      'paidByMemberId': 'mem-1',
      'date': '2026-10-14',
      'note': 'Bhatbhateni Supermarket',
    });
    expect(find.text('Bhatbhateni Supermarket'), findsNothing);
  });

  testWidgets('swiping right on a draft without a category opens the sheet instead', (tester) async {
    await pumpReview(tester);

    await tester.drag(find.text('Hari Shrestha'), const Offset(600, 0));
    await tester.pumpAndSettle();

    expect(find.text('Approve payment'), findsOneWidget);
    expect(server.approved, isEmpty);
  });

  testWidgets('swiping left rejects a draft', (tester) async {
    await pumpReview(tester);

    await tester.drag(find.text('Hari Shrestha'), const Offset(-600, 0));
    await tester.pumpAndSettle();

    expect(server.rejected, ['cap-hari']);
    expect(find.text('Hari Shrestha'), findsNothing);
  });

  testWidgets('Approve all approves only the drafts that have a category', (tester) async {
    await pumpReview(tester);

    await tester.tap(find.byKey(const Key('approve-all')));
    await tester.pumpAndSettle();

    expect(server.approved.map((a) => a['id']), ['cap-bhat']);
    expect(find.text('Hari Shrestha'), findsOneWidget);
    expect(find.byKey(const Key('approve-all')), findsNothing);
  });

  testWidgets('approving from the sheet uses what was picked and learns it for that payee', (tester) async {
    await pumpReview(tester);

    await tester.tap(find.text('Hari Shrestha'));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(FilledButton, 'Approve'), findsOneWidget);

    await tester.tap(find.byKey(const Key('quick-category-cat-lunch')));
    await tester.enterText(find.byKey(const Key('note-field')), 'Momo with friends');
    await tester.pump();
    await tester.tap(find.byKey(const Key('save-button')));
    await tester.pumpAndSettle();

    final expense = server.approved.single['expense'] as Map<String, dynamic>;
    expect(expense['categoryId'], 'cat-lunch');
    expect(expense['note'], 'Momo with friends');
    // Learned by the payee from the notification, not by the note.
    expect(server.rules, [
      {'categoryId': 'cat-lunch', 'counterparty': 'hari shrestha'},
    ]);
    expect(find.text('Approve payment'), findsNothing);
  });
}
```

Create `mobile/test/widgets/esewa_review_banner_test.dart` with:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/theme/app_theme.dart';
import 'package:piko/widgets/esewa_review_banner.dart';

void main() {
  Future<void> pump(WidgetTester tester, int count, VoidCallback onTap) => tester.pumpWidget(
        MaterialApp(theme: AppTheme.light, home: Scaffold(body: EsewaReviewBanner(count: count, onTap: onTap))),
      );

  testWidgets('says how many payments wait for review', (tester) async {
    await pump(tester, 3, () {});
    expect(find.text('3 eSewa payments to review'), findsOneWidget);

    await pump(tester, 1, () {});
    expect(find.text('1 eSewa payment to review'), findsOneWidget);
  });

  testWidgets('Review opens the review screen', (tester) async {
    var opened = 0;
    await pump(tester, 2, () => opened++);

    await tester.tap(find.text('Review'));
    expect(opened, 1);
  });
}
```

- [ ] **Step 2: Run the new tests and watch them fail**

Run:

```bash
cd mobile; flutter test test/esewa/review_rows_test.dart test/esewa/review_screen_test.dart test/widgets/esewa_review_banner_test.dart; cd ..
```

Expected: FAIL to compile, starting with `test/esewa/review_rows_test.dart:6:8: Error: Error when reading 'lib/esewa/review_rows.dart': The system cannot find the file specified`

- [ ] **Step 3: Implement**

In `mobile/lib/widgets/expense_confirm_sheet.dart`, find (1 of 3):

```dart
  final AppDateFormat dateFormat;
  final BsCalendar calendar;
  final Future<void> Function(ExpenseDraft draft) onSave;

  const ExpenseConfirmSheet({
    super.key,
```

Replace it with:

```dart
  final AppDateFormat dateFormat;
  final BsCalendar calendar;
  final Future<void> Function(ExpenseDraft draft) onSave;
  // The same sheet approves an eSewa payment, under its own title and button.
  final String title;
  final String saveLabel;

  const ExpenseConfirmSheet({
    super.key,
```

In `mobile/lib/widgets/expense_confirm_sheet.dart`, find (2 of 3):

```dart
    required this.dateFormat,
    required this.calendar,
    required this.onSave,
  });

  @override
```

Replace it with:

```dart
    required this.dateFormat,
    required this.calendar,
    required this.onSave,
    this.title = 'Add expense',
    this.saveLabel = 'Add expense',
  });

  @override
```

In `mobile/lib/widgets/expense_confirm_sheet.dart`, find (3 of 3):

```dart
    ];

    return SheetFrame(
      title: 'Add expense',
      footer: Row(
        children: [
          Expanded(
            child: FilledButton(
              key: const Key('save-button'),
              onPressed: _canSave ? _save : null,
              child: Text(_saving ? 'Saving...' : 'Add expense'),
            ),
          ),
          const SizedBox(width: 12),
```

Replace it with:

```dart
    ];

    return SheetFrame(
      title: widget.title,
      footer: Row(
        children: [
          Expanded(
            child: FilledButton(
              key: const Key('save-button'),
              onPressed: _canSave ? _save : null,
              child: Text(_saving ? 'Saving...' : widget.saveLabel),
            ),
          ),
          const SizedBox(width: 12),
```

Create `mobile/lib/providers/esewa_provider.dart` with:

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../esewa/esewa_service.dart';
import '../esewa/piko_txn_repository.dart';
import 'api_client_provider.dart';
import 'auth_provider.dart';
import 'categories_provider.dart';

// eSewa auto-capture for the signed-in person. Null when signed out, so
// nothing is filed under nobody: notifications wait in the phone's queue.
final esewaRepositoryProvider = Provider<PikoTxnRepository?>((ref) {
  final token = ref.watch(authProvider).value;
  if (token == null || token.isEmpty) return null;
  return PikoTxnRepository(client: ref.watch(apiClientProvider), options: () => ref.read(categoriesProvider.future));
});

final esewaServiceProvider = Provider<EsewaService?>((ref) {
  final repo = ref.watch(esewaRepositoryProvider);
  if (repo == null) return null;
  final service = EsewaService(repo);
  ref.onDispose(service.dispose);
  return service;
});

// How many drafts wait for review, for Home's strip. 0 when it can't tell.
final esewaDraftCountProvider = FutureProvider.autoDispose<int>((ref) async {
  final service = ref.watch(esewaServiceProvider);
  if (service == null) return 0;
  try {
    return (await service.pendingReview()).length;
  } catch (_) {
    return 0;
  }
});
```

Create `mobile/lib/esewa/review_rows.dart` with:

```dart
import '../services/bs_calendar.dart';
import 'models.dart';

// What a draft row is called: who was paid, else what kind of payment it was.
String draftTitle(Txn t) {
  final payee = t.counterparty?.trim() ?? '';
  if (payee.isNotEmpty) return payee;
  return switch (t.kind) {
    TxnKind.topup => 'Top-up',
    TxnKind.billPay => 'Bill payment',
    TxnKind.transfer => 'Transfer',
    TxnKind.load => 'Load',
    TxnKind.cashback => 'Cashback',
    TxnKind.refund => 'Refund',
    TxnKind.payment || TxnKind.unknown => 'Payment',
  };
}

// When it was paid, in the phone's time: the date as the app shows dates, and
// the time ("2 Kartik 2083 · 14:05").
String draftWhen(Txn t, AppDateFormat format, BsCalendar calendar) {
  final local = t.occurredAt.toLocal();
  final time = '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
  return '${formatAppDate(formatAd(local), format, calendar)} · $time';
}
```

Create `mobile/lib/esewa/review_screen.dart` with:

```dart
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/categories_result.dart';
import '../models/category_option.dart';
import '../models/expense.dart';
import '../models/expense_draft.dart';
import '../providers/calendar_provider.dart';
import '../providers/categories_provider.dart';
import '../providers/esewa_provider.dart';
import '../providers/expenses_provider.dart';
import '../providers/settings_provider.dart';
import '../services/api_client.dart';
import '../services/bs_calendar.dart';
import '../services/expense_list.dart';
import '../theme/app_theme.dart';
import '../widgets/category_icon.dart';
import '../widgets/expense_confirm_sheet.dart';
import '../widgets/money_text.dart';
import 'models.dart';
import 'piko_txn_repository.dart';
import 'review_rows.dart';

/// Review inbox for auto-captured eSewa drafts, in Piko's design (it replaces
/// the module's minimal one). Swipe right approves a draft as it is, swipe
/// left rejects it, and a tap opens the Add expense sheet to check it first.
class EsewaReviewScreen extends ConsumerStatefulWidget {
  const EsewaReviewScreen({super.key});

  @override
  ConsumerState<EsewaReviewScreen> createState() => _EsewaReviewScreenState();
}

class _EsewaReviewScreenState extends ConsumerState<EsewaReviewScreen> {
  List<Txn> _drafts = const [];
  bool _loading = true;
  bool _failed = false;
  bool _approvingAll = false;
  StreamSubscription<Txn>? _sub;

  @override
  void initState() {
    super.initState();
    _sub = ref.read(esewaServiceProvider)?.onDraft.listen((_) => _load());
    _load();
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    final service = ref.read(esewaServiceProvider);
    if (service == null) return;
    try {
      final drafts = await service.pendingReview();
      if (!mounted) return;
      setState(() {
        _drafts = drafts;
        _loading = false;
        _failed = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _failed = true;
      });
    }
  }

  String _message(Object error) =>
      error is ApiException ? error.message : "Couldn't reach Piko — check your connection and try again.";

  void _show(Object error) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_message(error))));
  }

  // The module marks a Txn before saving it; when saving fails it is still a
  // draft on the server, so put it back here too.
  Future<bool> _save(Txn t, Future<void> Function() action) async {
    try {
      await action();
      return true;
    } catch (e) {
      t.status = TxnStatus.draft;
      _show(e);
      return false;
    }
  }

  Future<bool> _approveAsIs(Txn t) => _save(t, () => ref.read(esewaServiceProvider)!.approve(t));

  Future<bool> _reject(Txn t) => _save(t, () => ref.read(esewaServiceProvider)!.reject(t));

  // Swipe right approves as it is when the draft has one of the household's
  // categories; without one, it opens the sheet to pick one instead.
  Future<bool> _confirmSwipe(Txn t, DismissDirection direction, CategoriesResult options) async {
    if (direction == DismissDirection.endToStart) return _reject(t);
    if (ref.read(esewaRepositoryProvider)!.approvalDraft(t, options) == null) {
      await _check(t, options);
      return false;
    }
    return _approveAsIs(t);
  }

  void _dismissed(Txn t) {
    setState(() => _drafts = [..._drafts]..remove(t));
    ref.invalidate(recentExpensesProvider);
  }

  // The Add expense sheet, filled in from the draft. Saving approves it with
  // what was checked; a changed category is learned for that payee. The
  // payee stays separate from the note, which can be anything.
  Future<void> _check(Txn t, CategoriesResult options) async {
    final repo = ref.read(esewaRepositoryProvider)!;
    final service = ref.read(esewaServiceProvider)!;
    final initial = repo.approvalDraft(t, options) ??
        ExpenseDraft(
          amount: t.amount,
          categoryId: '',
          ownerMemberId: options.currentMemberId,
          paidByMemberId: options.currentMemberId ?? options.members.firstOrNull?.id ?? '',
          date: formatAd(t.occurredAt.toLocal()),
          note: t.counterparty,
        );
    final recent = ref.read(recentExpensesProvider).valueOrNull ?? const <Expense>[];

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (sheetContext) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(sheetContext).viewInsets.bottom),
        child: ExpenseConfirmSheet(
          title: 'Approve payment',
          saveLabel: 'Approve',
          initialDraft: initial,
          categories: options.categories,
          members: options.members,
          currentMemberId: options.currentMemberId,
          quickCategoryIds: quickCategoryIds(recent, options.categories),
          noteWords: options.noteWords,
          dateFormat: ref.read(dateFormatProvider),
          calendar: ref.read(bsCalendarProvider),
          onSave: (draft) async {
            final category = options.categories.firstWhere((c) => c.id == draft.categoryId);
            repo.prepareApproval(t, draft);
            try {
              await service.approve(t, category: category.name, amount: draft.amount);
              if (sheetContext.mounted) Navigator.of(sheetContext).pop();
            } catch (e) {
              t.status = TxnStatus.draft;
              if (sheetContext.mounted) {
                ScaffoldMessenger.of(sheetContext).showSnackBar(SnackBar(content: Text(_message(e))));
              }
            }
          },
        ),
      ),
    );
    ref.invalidate(recentExpensesProvider);
    await _load();
  }

  // Approves every draft that has a category, one at a time; the rest stay.
  Future<void> _approveAll(CategoriesResult options) async {
    final repo = ref.read(esewaRepositoryProvider)!;
    setState(() => _approvingAll = true);
    for (final t in _drafts.where((t) => repo.approvalDraft(t, options) != null).toList()) {
      if (!await _approveAsIs(t)) break;
    }
    if (!mounted) return;
    setState(() => _approvingAll = false);
    ref.invalidate(recentExpensesProvider);
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.piko;
    final text = Theme.of(context).textTheme;
    final optionsAsync = ref.watch(categoriesProvider);
    final options = optionsAsync.valueOrNull;
    final repo = ref.watch(esewaRepositoryProvider);
    final format = ref.watch(dateFormatProvider);
    final calendar = ref.watch(bsCalendarProvider);
    final approvable =
        options == null || repo == null ? 0 : _drafts.where((t) => repo.approvalDraft(t, options) != null).length;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Review'),
        actions: [
          if (approvable > 0)
            TextButton(
              key: const Key('approve-all'),
              onPressed: _approvingAll ? null : () => _approveAll(options!),
              child: Text(_approvingAll ? 'Approving...' : 'Approve all'),
            ),
          const SizedBox(width: 8),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          children: [
            Text('eSewa payments', style: text.headlineLarge),
            const SizedBox(height: 6),
            Text('Swipe right to approve, left to reject, or tap to check it first.', style: text.bodySmall),
            const SizedBox(height: 20),
            if (_failed || optionsAsync.hasError)
              Text("Couldn't load the payments. Pull down to try again.", style: text.bodyMedium)
            else if (_loading || options == null)
              const LinearProgressIndicator()
            else if (_drafts.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 32),
                child: Text('Nothing to review.', style: text.titleLarge),
              )
            else ...[
              // The 2px ink rule that tops every list on the website.
              Container(height: 2, color: c.ink),
              for (final t in _drafts)
                _DraftRow(
                  txn: t,
                  category: categoryNamed(t.category, options.categories),
                  when: draftWhen(t, format, calendar),
                  onTap: () => _check(t, options),
                  confirmDismiss: (direction) => _confirmSwipe(t, direction, options),
                  onDismissed: () => _dismissed(t),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

// One draft, laid out like a row of the expense list: the category's icon,
// who was paid with the category (or "Pick a category") and when, and the
// amount. Swiping shows what it will do.
class _DraftRow extends StatelessWidget {
  const _DraftRow({
    required this.txn,
    required this.category,
    required this.when,
    required this.onTap,
    required this.confirmDismiss,
    required this.onDismissed,
  });

  final Txn txn;
  final CategoryOption? category;
  final String when;
  final VoidCallback onTap;
  final Future<bool> Function(DismissDirection direction) confirmDismiss;
  final VoidCallback onDismissed;

  @override
  Widget build(BuildContext context) {
    final c = context.piko;
    final text = Theme.of(context).textTheme;

    return Dismissible(
      key: ObjectKey(txn),
      confirmDismiss: confirmDismiss,
      onDismissed: (_) => onDismissed(),
      background: _SwipeLabel(
        alignment: Alignment.centerLeft,
        color: c.ink,
        foreground: c.paper,
        icon: Icons.check,
        label: 'Approve',
      ),
      secondaryBackground: _SwipeLabel(
        alignment: Alignment.centerRight,
        color: c.signalFill,
        foreground: Colors.white,
        icon: Icons.close,
        label: 'Reject',
      ),
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(border: Border(bottom: BorderSide(color: c.n300))),
          child: Row(
            children: [
              CategoryIcon(name: category?.name ?? 'Uncategorized', iconKey: category?.icon),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(draftTitle(txn), maxLines: 1, overflow: TextOverflow.ellipsis, style: text.titleMedium),
                    const SizedBox(height: 4),
                    Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(
                            text: category?.name ?? 'Pick a category',
                            style: category == null ? TextStyle(color: c.signalInk) : null,
                          ),
                          TextSpan(text: ' · $when'),
                        ],
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: text.bodySmall,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              MoneyText(txn.amount, style: text.titleMedium),
            ],
          ),
        ),
      ),
    );
  }
}

class _SwipeLabel extends StatelessWidget {
  const _SwipeLabel({
    required this.alignment,
    required this.color,
    required this.foreground,
    required this.icon,
    required this.label,
  });

  final Alignment alignment;
  final Color color;
  final Color foreground;
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: color,
      alignment: alignment,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: foreground, size: 20),
          const SizedBox(width: 8),
          Text(label, style: Theme.of(context).textTheme.titleMedium!.copyWith(color: foreground)),
        ],
      ),
    );
  }
}
```

Create `mobile/lib/widgets/esewa_review_banner.dart` with:

```dart
import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

// Home's strip for eSewa payments waiting for review, in the update strip's
// style: the red square for anything unread, a line, and Review.
class EsewaReviewBanner extends StatelessWidget {
  const EsewaReviewBanner({super.key, required this.count, required this.onTap});

  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.piko;

    return Material(
      color: c.surface,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 4, 4, 4),
          child: Row(
            children: [
              Container(width: 8, height: 8, color: c.signal),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  count == 1 ? '1 eSewa payment to review' : '$count eSewa payments to review',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              TextButton(onPressed: onTap, child: const Text('Review')),
            ],
          ),
        ),
      ),
    );
  }
}
```

In `mobile/lib/screens/home_screen.dart`, find (1 of 7):

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/categories_result.dart';
import '../models/expense.dart';
import '../models/expense_draft.dart';
```

Replace it with:

```dart
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../esewa/models.dart';
import '../esewa/review_screen.dart';
import '../models/categories_result.dart';
import '../models/expense.dart';
import '../models/expense_draft.dart';
```

In `mobile/lib/screens/home_screen.dart`, find (2 of 7):

```dart
import '../providers/app_update_provider.dart';
import '../providers/calendar_provider.dart';
import '../providers/categories_provider.dart';
import '../providers/expenses_provider.dart';
import '../providers/settings_provider.dart';
import '../services/api_client.dart';
```

Replace it with:

```dart
import '../providers/app_update_provider.dart';
import '../providers/calendar_provider.dart';
import '../providers/categories_provider.dart';
import '../providers/esewa_provider.dart';
import '../providers/expenses_provider.dart';
import '../providers/settings_provider.dart';
import '../services/api_client.dart';
```

In `mobile/lib/screens/home_screen.dart`, find (3 of 7):

```dart
import '../theme/app_theme.dart';
import '../widgets/app_update_sheet.dart';
import '../widgets/brand_mark.dart';
import '../widgets/expense_confirm_sheet.dart';
import '../widgets/expense_list_tile.dart';
import '../widgets/money_text.dart';
```

Replace it with:

```dart
import '../theme/app_theme.dart';
import '../widgets/app_update_sheet.dart';
import '../widgets/brand_mark.dart';
import '../widgets/esewa_review_banner.dart';
import '../widgets/expense_confirm_sheet.dart';
import '../widgets/expense_list_tile.dart';
import '../widgets/money_text.dart';
```

In `mobile/lib/screens/home_screen.dart`, find (4 of 7):

```dart
class _HomeScreenState extends ConsumerState<HomeScreen> {
  // Re-check for a new build whenever the app comes back to the foreground, not just on cold start.
  late final AppLifecycleListener _lifecycle;

  @override
  void initState() {
    super.initState();
    _lifecycle = AppLifecycleListener(onResume: () => ref.invalidate(availableUpdateProvider));
    // Capturing an expense is the app's main job, so jump straight into voice capture on launch.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _openVoiceFlow(context, ref);
    });
  }

  Future<void> _openVoiceFlow(BuildContext context, WidgetRef ref) async {
```

Replace it with:

```dart
class _HomeScreenState extends ConsumerState<HomeScreen> {
  // Re-check for a new build whenever the app comes back to the foreground, not just on cold start.
  late final AppLifecycleListener _lifecycle;
  StreamSubscription<Txn>? _newDrafts;

  @override
  void initState() {
    super.initState();
    _lifecycle = AppLifecycleListener(
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

  // eSewa auto-capture: store anything captured while the app was away (or
  // offline), then keep the review count fresh as new payments arrive.
  void _startEsewa() {
    final esewa = ref.read(esewaServiceProvider);
    if (esewa == null) return;
    _newDrafts ??= esewa.onDraft.listen((_) => ref.invalidate(esewaDraftCountProvider));
    esewa.start().catchError((_) {}).whenComplete(() {
      if (mounted) ref.invalidate(esewaDraftCountProvider);
    });
  }

  Future<void> _openReview(BuildContext context) async {
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const EsewaReviewScreen()));
    ref.invalidate(esewaDraftCountProvider);
    ref.invalidate(recentExpensesProvider);
  }

  Future<void> _openVoiceFlow(BuildContext context, WidgetRef ref) async {
```

In `mobile/lib/screens/home_screen.dart`, find (5 of 7):

```dart
  @override
  void dispose() {
    _lifecycle.dispose();
    super.dispose();
  }
```

Replace it with:

```dart
  @override
  void dispose() {
    _lifecycle.dispose();
    _newDrafts?.cancel();
    super.dispose();
  }
```

In `mobile/lib/screens/home_screen.dart`, find (6 of 7):

```dart
    final text = Theme.of(context).textTheme;
    final expensesAsync = ref.watch(recentExpensesProvider);
    final update = ref.watch(availableUpdateProvider).valueOrNull;
    final options = ref.watch(categoriesProvider).valueOrNull;
    final dateFormat = ref.watch(dateFormatProvider);
    final calendar = ref.watch(bsCalendarProvider);
```

Replace it with:

```dart
    final text = Theme.of(context).textTheme;
    final expensesAsync = ref.watch(recentExpensesProvider);
    final update = ref.watch(availableUpdateProvider).valueOrNull;
    final toReview = ref.watch(esewaDraftCountProvider).valueOrNull ?? 0;
    final options = ref.watch(categoriesProvider).valueOrNull;
    final dateFormat = ref.watch(dateFormatProvider);
    final calendar = ref.watch(bsCalendarProvider);
```

In `mobile/lib/screens/home_screen.dart`, find (7 of 7):

```dart
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          children: [
            if (update != null) ...[AppUpdateBanner(release: update), const SizedBox(height: 20)],
            Text('Recent expenses', style: text.headlineLarge),
            const SizedBox(height: 6),
            Text('The latest across the household', style: text.bodySmall),
```

Replace it with:

```dart
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          children: [
            if (update != null) ...[AppUpdateBanner(release: update), const SizedBox(height: 20)],
            if (toReview > 0) ...[
              EsewaReviewBanner(count: toReview, onTap: () => _openReview(context)),
              const SizedBox(height: 20),
            ],
            Text('Recent expenses', style: text.headlineLarge),
            const SizedBox(height: 6),
            Text('The latest across the household', style: text.bodySmall),
```

- [ ] **Step 4: Run the new tests again**

Run:

```bash
cd mobile; flutter test test/esewa/review_rows_test.dart test/esewa/review_screen_test.dart test/widgets/esewa_review_banner_test.dart; cd ..
```

Expected: `+11: All tests passed!`

- [ ] **Step 5: Run every check**

Run:

```bash
cd mobile; flutter analyze; cd ..
cd mobile; flutter test; cd ..
```

Expected: `No issues found!`; `+152: All tests passed!`.

- [ ] **Step 6: Commit**

```bash
git add mobile/lib/esewa/review_rows.dart mobile/lib/esewa/review_screen.dart mobile/lib/providers/esewa_provider.dart mobile/lib/screens/home_screen.dart mobile/lib/widgets/esewa_review_banner.dart mobile/lib/widgets/expense_confirm_sheet.dart mobile/test/esewa/review_rows_test.dart mobile/test/esewa/review_screen_test.dart mobile/test/widgets/esewa_review_banner_test.dart
git commit -m "feat(mobile): review eSewa drafts from Home and approve them like an expense"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.

### Task 9: eSewa in Settings, and a log of captured notifications

Design points 9 (fix 2) and 12. Settings gets an eSewa section, shown on Android when signed in. **Auto-capture** says On or Off, from `isAccessGranted`, and is checked again when the app comes back from Android's settings; its button opens Android's Notification access screen. **Captured notifications** shows the latest 50 notifications from `GET /api/mobile/capture-events`, each with **Copy**. Copy puts the title and the text on the clipboard, which is exactly what tuning `ParserRules` needs.

**Files:**

- Create: `mobile/lib/esewa/captured_notifications_screen.dart`
- Create: `mobile/lib/models/capture_event.dart`
- Modify: `mobile/lib/providers/esewa_provider.dart`
- Modify: `mobile/lib/screens/settings_screen.dart`
- Modify: `mobile/lib/services/api_client.dart`
- Test: `mobile/test/esewa/captured_notifications_screen_test.dart` (new)

**Interfaces:**

- Consumes: `esewaServiceProvider` (Task 8), `GET /api/mobile/capture-events` (Task 4).
- Produces: `CaptureEvent` (`title`, `text`, `postedAt` in local time, `copyText`) in `mobile/lib/models/capture_event.dart`; `ApiClient.fetchCaptureEvents()`; `esewaAccessProvider` and `captureEventsProvider`; `CapturedNotificationsScreen()`.

- [ ] **Step 1: Write the failing tests**

Create `mobile/test/esewa/captured_notifications_screen_test.dart` with:

```dart
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:piko/esewa/captured_notifications_screen.dart';
import 'package:piko/models/capture_event.dart';
import 'package:piko/providers/calendar_provider.dart';
import 'package:piko/providers/esewa_provider.dart';
import 'package:piko/services/bs_calendar.dart';
import 'package:piko/theme/app_theme.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  final calendar = BsCalendar.fromJson(
    jsonDecode(File('assets/bs_calendar.json').readAsStringSync()) as Map<String, dynamic>,
  );

  test('reads a notification with its time in local time', () {
    final event = CaptureEvent.fromJson({
      'key': 'k',
      'postedAt': '2026-10-14T06:15:00.000Z',
      'source': 'notification',
      'text': 'You have paid Rs. 500 to Daraz.',
      'title': 'eSewa',
    });

    expect(event.postedAt, DateTime.utc(2026, 10, 14, 6, 15).toLocal());
    expect(event.copyText, 'eSewa\nYou have paid Rs. 500 to Daraz.');
  });

  testWidgets('lists the notifications and copies one as it was sent', (tester) async {
    SharedPreferences.setMockInitialValues({});
    String? copied;
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.setData') copied = (call.arguments as Map)['text'] as String;
      return null;
    });
    addTearDown(() => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          captureEventsProvider.overrideWith(
            (ref) async => [
              CaptureEvent(title: 'eSewa', text: 'Payment of NPR 845 to Nepal Oil done', postedAt: DateTime(2026, 10, 14, 9, 5)),
              CaptureEvent(title: 'eSewa', text: 'Your OTP is ••••••', postedAt: DateTime(2026, 10, 14, 9, 1)),
            ],
          ),
          bsCalendarProvider.overrideWithValue(calendar),
        ],
        child: MaterialApp(theme: AppTheme.light, home: const CapturedNotificationsScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Payment of NPR 845 to Nepal Oil done'), findsOneWidget);
    expect(find.text('Your OTP is ••••••'), findsOneWidget);

    await tester.tap(find.text('Copy').first);
    await tester.pump();

    expect(copied, 'eSewa\nPayment of NPR 845 to Nepal Oil done');
    expect(find.text('Copied'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run the new tests and watch them fail**

Run:

```bash
cd mobile; flutter test test/esewa/captured_notifications_screen_test.dart; cd ..
```

Expected: FAIL to compile, starting with `test/esewa/captured_notifications_screen_test.dart:8:8: Error: Error when reading 'lib/esewa/captured_notifications_screen.dart': The system cannot find the file specified`

- [ ] **Step 3: Implement**

Create `mobile/lib/models/capture_event.dart` with:

```dart
// One eSewa notification as the phone saw it (OTP digits masked), for the
// Captured notifications screen.
class CaptureEvent {
  final String title;
  final String text;
  final DateTime postedAt; // local time

  CaptureEvent({required this.title, required this.text, required this.postedAt});

  factory CaptureEvent.fromJson(Map<String, dynamic> json) => CaptureEvent(
        title: json['title'] as String,
        text: json['text'] as String,
        postedAt: DateTime.parse(json['postedAt'] as String).toLocal(),
      );

  // What to paste back to tune the parser: the title and the text, as sent.
  String get copyText => '$title\n$text';
}
```

In `mobile/lib/services/api_client.dart`, find (1 of 2):

```dart
import 'package:http/http.dart' as http;

import '../models/app_release.dart';
import '../models/categories_result.dart';
import '../models/expense.dart';
import '../models/expense_draft.dart';
```

Replace it with:

```dart
import 'package:http/http.dart' as http;

import '../models/app_release.dart';
import '../models/capture_event.dart';
import '../models/categories_result.dart';
import '../models/expense.dart';
import '../models/expense_draft.dart';
```

In `mobile/lib/services/api_client.dart`, find (2 of 2):

```dart
    await _authorizedPost('/api/mobile/capture-events', event);
  }

  // Payee → category id.
  Future<Map<String, String>> fetchCaptureRules() async {
    final body = await _authorizedGet('/api/mobile/capture-rules');
```

Replace it with:

```dart
    await _authorizedPost('/api/mobile/capture-events', event);
  }

  // The latest notifications this person's phone captured, newest first.
  Future<List<CaptureEvent>> fetchCaptureEvents() async {
    final body = await _authorizedGet('/api/mobile/capture-events');
    return [
      for (final event in (body['events'] as List<dynamic>).cast<Map<String, dynamic>>()) CaptureEvent.fromJson(event),
    ];
  }

  // Payee → category id.
  Future<Map<String, String>> fetchCaptureRules() async {
    final body = await _authorizedGet('/api/mobile/capture-rules');
```

In `mobile/lib/providers/esewa_provider.dart`, find (1 of 2):

```dart
import '../esewa/esewa_service.dart';
import '../esewa/piko_txn_repository.dart';
import 'api_client_provider.dart';
import 'auth_provider.dart';
import 'categories_provider.dart';
```

Replace it with:

```dart
import '../esewa/esewa_service.dart';
import '../esewa/piko_txn_repository.dart';
import '../models/capture_event.dart';
import 'api_client_provider.dart';
import 'auth_provider.dart';
import 'categories_provider.dart';
```

In `mobile/lib/providers/esewa_provider.dart`, find (2 of 2):

```dart
  return service;
});

// How many drafts wait for review, for Home's strip. 0 when it can't tell.
final esewaDraftCountProvider = FutureProvider.autoDispose<int>((ref) async {
  final service = ref.watch(esewaServiceProvider);
```

Replace it with:

```dart
  return service;
});

// Whether Piko may read notifications (Android's Notification access).
final esewaAccessProvider = FutureProvider.autoDispose<bool>((ref) async {
  final service = ref.watch(esewaServiceProvider);
  if (service == null || !service.isSupported) return false;
  return service.isAccessGranted();
});

final captureEventsProvider = FutureProvider.autoDispose<List<CaptureEvent>>(
  (ref) => ref.watch(apiClientProvider).fetchCaptureEvents(),
);

// How many drafts wait for review, for Home's strip. 0 when it can't tell.
final esewaDraftCountProvider = FutureProvider.autoDispose<int>((ref) async {
  final service = ref.watch(esewaServiceProvider);
```

Create `mobile/lib/esewa/captured_notifications_screen.dart` with:

```dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/capture_event.dart';
import '../providers/calendar_provider.dart';
import '../providers/esewa_provider.dart';
import '../providers/settings_provider.dart';
import '../services/bs_calendar.dart';
import '../theme/app_theme.dart';

// The latest eSewa notifications this phone saw, read or not, each with Copy:
// when a payment doesn't show up as a draft, its text here is what tunes the
// parser (lib/esewa/parser.dart and test/esewa_parser_test.dart).
class CapturedNotificationsScreen extends ConsumerWidget {
  const CapturedNotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final events = ref.watch(captureEventsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Captured notifications')),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(captureEventsProvider),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          children: [
            Text(
              'The latest eSewa notifications this phone saw. Codes in OTP and login messages are hidden.',
              style: text.bodySmall,
            ),
            const SizedBox(height: 16),
            ...events.when(
              loading: () => [const LinearProgressIndicator()],
              error: (error, _) => [Text("Couldn't load them. Pull down to try again.", style: text.bodyMedium)],
              data: (list) => list.isEmpty
                  ? [Text('None yet.', style: text.titleLarge)]
                  : [
                      Container(height: 2, color: context.piko.ink),
                      for (final event in list) _EventRow(event: event),
                    ],
            ),
          ],
        ),
      ),
    );
  }
}

class _EventRow extends ConsumerWidget {
  const _EventRow({required this.event});

  final CaptureEvent event;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.piko;
    final text = Theme.of(context).textTheme;
    final at = event.postedAt;
    final time = '${at.hour.toString().padLeft(2, '0')}:${at.minute.toString().padLeft(2, '0')}';
    final date = formatAppDate(formatAd(at), ref.watch(dateFormatProvider), ref.watch(bsCalendarProvider));

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: c.n300))),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('$date · $time', style: text.bodySmall),
                const SizedBox(height: 4),
                Text(event.title, style: text.titleMedium),
                const SizedBox(height: 2),
                SelectableText(event.text, style: text.bodyMedium),
              ],
            ),
          ),
          TextButton(
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: event.copyText));
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Copied')));
              }
            },
            child: const Text('Copy'),
          ),
        ],
      ),
    );
  }
}
```

In `mobile/lib/screens/settings_screen.dart`, find (1 of 4):

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/auth_provider.dart';
import '../providers/settings_provider.dart';
import '../services/bs_calendar.dart';
import '../theme/app_theme.dart';
```

Replace it with:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../esewa/captured_notifications_screen.dart';
import '../providers/auth_provider.dart';
import '../providers/esewa_provider.dart';
import '../providers/settings_provider.dart';
import '../services/bs_calendar.dart';
import '../theme/app_theme.dart';
```

In `mobile/lib/screens/settings_screen.dart`, find (2 of 4):

```dart
class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  late final TextEditingController _urlController;
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    _urlController = TextEditingController();
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }
```

Replace it with:

```dart
class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  late final TextEditingController _urlController;
  // Notification access is switched on in Android's settings, so check again
  // when the app comes back from there.
  late final AppLifecycleListener _lifecycle;
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    _urlController = TextEditingController();
    _lifecycle = AppLifecycleListener(onResume: () => ref.invalidate(esewaAccessProvider));
  }

  @override
  void dispose() {
    _urlController.dispose();
    _lifecycle.dispose();
    super.dispose();
  }
```

In `mobile/lib/screens/settings_screen.dart`, find (3 of 4):

```dart
    final c = context.piko;
    final serverUrl = ref.watch(serverUrlProvider);
    final isLoggedIn = ref.watch(authProvider).value != null;

    if (!_initialized && serverUrl.hasValue) {
      _urlController.text = serverUrl.value!;
```

Replace it with:

```dart
    final c = context.piko;
    final serverUrl = ref.watch(serverUrlProvider);
    final isLoggedIn = ref.watch(authProvider).value != null;
    final esewa = ref.watch(esewaServiceProvider);

    if (!_initialized && serverUrl.hasValue) {
      _urlController.text = serverUrl.value!;
```

In `mobile/lib/screens/settings_screen.dart`, find (4 of 4):

```dart
                ],
              ),
            ),
            if (isLoggedIn) ...[
              const SizedBox(height: 36),
              const _SectionHeading('Account'),
```

Replace it with:

```dart
                ],
              ),
            ),
            if (esewa != null && esewa.isSupported) ...[
              const SizedBox(height: 36),
              const _SectionHeading('eSewa'),
              _SettingRow(
                title: 'Auto-capture',
                description: 'Lets Piko read eSewa notifications, so each payment arrives as a draft to review. '
                    'On Android 13 or later, first allow it: phone Settings → Apps → Piko → ⋮ → Allow restricted settings.',
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        ref.watch(esewaAccessProvider).valueOrNull == true ? 'On' : 'Off',
                        key: const Key('esewa-access'),
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ),
                    OutlinedButton(onPressed: esewa.openAccessSettings, child: const Text('Notification access')),
                  ],
                ),
              ),
              _SettingRow(
                title: 'Captured notifications',
                description: "The latest eSewa notifications this phone saw. Copy one when a payment wasn't read right.",
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const CapturedNotificationsScreen()),
                    ),
                    child: const Text('Show'),
                  ),
                ),
              ),
            ],
            if (isLoggedIn) ...[
              const SizedBox(height: 36),
              const _SectionHeading('Account'),
```

- [ ] **Step 4: Run the new tests again**

Run:

```bash
cd mobile; flutter test test/esewa/captured_notifications_screen_test.dart; cd ..
```

Expected: `+2: All tests passed!`

- [ ] **Step 5: Run every check**

Run:

```bash
cd mobile; flutter analyze; cd ..
cd mobile; flutter test; cd ..
```

Expected: `No issues found!`; `+154: All tests passed!`.

- [ ] **Step 6: Commit**

```bash
git add mobile/lib/esewa/captured_notifications_screen.dart mobile/lib/models/capture_event.dart mobile/lib/providers/esewa_provider.dart mobile/lib/screens/settings_screen.dart mobile/lib/services/api_client.dart mobile/test/esewa/captured_notifications_screen_test.dart
git commit -m "feat(mobile): eSewa settings and a log of captured notifications"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.

### Task 10: Docs, phone setup and release 1.3.0+4

Design point 13. `docs/architecture.md` gets the new tables in the domain model and an "eSewa capture" section; `mobile/README.md` gets the phone setup the owner does once, and how to tune the parser; the app's version goes up.

**Files:**

- Modify: `docs/architecture.md`
- Modify: `mobile/README.md`
- Modify: `mobile/pubspec.yaml`

- [ ] **Step 1: Update the docs and the version**

In `docs/architecture.md`, find (1 of 2):

````markdown
  `activity_logs` (append-only audit trail: actor, entity, action, display-ready
  summary + field diffs, web/mobile source; written by actions via `logActivity`,
  shown on `/activity`), `app_releases` (global, not per-household; published APK builds).

Conventions to keep when adding columns/tables:
````

Replace it with:

````markdown
  `activity_logs` (append-only audit trail: actor, entity, action, display-ready
  summary + field diffs, web/mobile source; written by actions via `logActivity`,
  shown on `/activity`), `app_releases` (global, not per-household; published APK builds).
- **eSewa captures** — `captured_payments` (each transaction a member's phone read from an
  eSewa notification: `status` draft / approved / rejected / skipped, `expenseId` once
  approved), `capture_events` (every notification as captured, OTP digits masked; unique
  `(memberId, key, postedAt)`), `capture_rules` (payee → category, per member). Scoped by
  household **and** member. See [eSewa capture](#esewa-capture).

Conventions to keep when adding columns/tables:
````

In `docs/architecture.md`, find (2 of 2):

````markdown
  decide on is always Home's Unallocated. Settling records deposits and loan repayments
  on the month's last day, fund money for that month, and the rest as a cushion entry;
  a month that went over is taken from the cushion.

## Cross-cutting concerns
````

Replace it with:

````markdown
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

## Cross-cutting concerns
````

In `mobile/README.md`, find (1 of 2):

````markdown
# piko

Flutter companion app for Piko: capture expenses by voice on the go.

## Design
````

Replace it with:

````markdown
# piko

Flutter companion app for Piko: capture expenses by voice on the go, and eSewa
payments automatically.

## Design
````

In `mobile/README.md`, find (2 of 2):

````markdown
  `CategoryIcon`, `SheetFrame` (Modal), `LabeledField`, `BrandMark`.
- Light, Dark or System is chosen in Settings and stored on the phone; the app
  opens in Light, like the website.

## Publishing an update
````

Replace it with:

````markdown
  `CategoryIcon`, `SheetFrame` (Modal), `LabeledField`, `BrandMark`.
- Light, Dark or System is chosen in Settings and stored on the phone; the app
  opens in Light, like the website.

## eSewa auto-capture

eSewa payments arrive as drafts to review (Home → "N eSewa payments to review"); only
approved ones become expenses. How it works: the "eSewa capture" section of
`docs/architecture.md`.

Phone setup, once, after installing a build with it:

1. Phone Settings → Apps → Piko → ⋮ → **Allow restricted settings**. Android 13 and later
   block notification access for apps installed from an APK until this is done.
2. Open Piko → Settings → eSewa → **Notification access**, and turn it on for Piko.
3. Battery: set Piko to **Unrestricted**. On Xiaomi, Oppo, Vivo or Realme, also turn on
   **Autostart**.
4. Check eSewa's package name: `adb shell pm list packages | grep -i esewa`. It should be
   `com.f1soft.esewa`; if not, change `WATCHED_PACKAGES` in
   `android/app/src/main/kotlin/com/nirjal/piko/esewa/EsewaNotificationListener.kt`.
5. Make a small eSewa payment (e.g. a Rs. 10 top-up) and check that a draft appears.

The notification wording in `lib/esewa/parser.dart` is a guess until real texts are
collected. When a payment doesn't show up as a draft, open Settings → eSewa → Captured
notifications, copy it, and add it as a case in `test/esewa_parser_test.dart` before
changing `ParserRules`.

## Publishing an update
````

In `mobile/pubspec.yaml`, find:

```yaml
# https://developer.apple.com/library/archive/documentation/General/Reference/InfoPlistKeyReference/Articles/CoreFoundationKeys.html
# In Windows, build-name is used as the major, minor, and patch parts
# of the product and file versions while build-number is used as the build suffix.
version: 1.2.0+3

environment:
  sdk: ^3.12.2
```

Replace it with:

```yaml
# https://developer.apple.com/library/archive/documentation/General/Reference/InfoPlistKeyReference/Articles/CoreFoundationKeys.html
# In Windows, build-name is used as the major, minor, and patch parts
# of the product and file versions while build-number is used as the build suffix.
version: 1.3.0+4

environment:
  sdk: ^3.12.2
```

- [ ] **Step 2: Run every check**

Run:

```bash
cd mobile; flutter analyze; cd ..
cd mobile; flutter test; cd ..
cd mobile; flutter build apk --release --split-per-abi; cd ..
```

Expected: `No issues found!`; `+154: All tests passed!`. The build takes 2–5 minutes and ends with three `√ Built build\app\outputs\flutter-apk\app-…-release.apk` lines, including `app-arm64-v8a-release.apk` (about 18 MB). The Gradle warnings were there before and are fine; so is "key.properties not found" if it appears (the owner's own build signs with the release key). Don't commit anything under `mobile/build/`.

- [ ] **Step 3: Commit**

```bash
git add docs/architecture.md mobile/README.md mobile/pubspec.yaml
git commit -m "docs: eSewa capture in the architecture doc and phone setup; release 1.3.0+4"
```

The pre-commit hook takes 1–2 minutes. If it fails, fix the error it names, `git add` the same files and commit again.

- [ ] **Step 4: Refresh the knowledge graph**

If the `graphify` command exists, run `graphify update .` from the repo root. It only changes `graphify-out/`, which is ignored; don't commit anything from it. If the command isn't found, skip this step and say so in your report.

### Final checkpoint: STOP

Stop here and send the owner a report with:

- The branch name (`feat/esewa-capture`) and the ten commit hashes and subjects (`git log --oneline main..HEAD`).
- The last `npx vitest run` and `flutter test` result lines, the `flutter analyze` result, and the APK path from Task 10.
- Every place where a "find" block didn't match exactly and how you resolved it, and anything else you did that this plan didn't say.

Then the owner:

1. Reviews the branch and merges it to `main`. The push deploys the website (the new endpoints and `noteWords`) on Vercel. Deploy the website **before** installing the new app: until the endpoints exist, captured payments just wait in the phone's queue.
2. Installs `mobile/build/app/outputs/flutter-apk/app-arm64-v8a-release.apk` and does the phone setup in `mobile/README.md` (restricted settings, notification access, battery, Autostart, the eSewa package name). Then makes a small eSewa payment and checks a draft appears, once with Piko open and once with it closed.
3. Approves it from Home → Review and checks it shows in the expense list and in Home's figures; rejects another and checks it's gone; changes a category while approving and checks the next payment to that payee gets it.
4. Publishes the APK under **Settings → App updates** as version `1.3.0`, build `4` (see `mobile/README.md`).
5. If a payment doesn't show up as a draft: Settings → eSewa → Captured notifications → **Copy**, and send the text to have `ParserRules` tuned with a new test case.
