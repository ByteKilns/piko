# Mobile Release Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. If you don't have those skills, do the tasks in order, one step at a time. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The owner releases the Android app by pressing **Run workflow** on GitHub. The workflow refuses unless the live website is ready for the release, then builds, signs, uploads and publishes the arm64 APK that installed apps update to.

**Architecture:** Six tasks on one branch. Tasks 1–4 are the website:
- **Task 1:** a release token (`APP_RELEASE_TOKEN`) that can only publish app releases.
- **Task 2:** the Settings form's publish logic moves into one shared `publishRelease`.
- **Task 3:** a token-protected `/api/release-bot/status` reports the deployed commit, whether the database is missing a migration, and the live build number.
- **Task 4:** token-protected `/api/release-bot/upload` and `/publish` do what the form does.

Task 5 is the GitHub side: two small Node scripts (`release-ready.mjs`, `publish-apk.mjs`), the hand-run workflow, and a Gradle guard so a CI release build can never be debug-signed. Task 6 is docs. Each task is one commit that leaves everything building with every test passing.

**Tech Stack:** Next.js 16 route handlers, Drizzle ORM (PostgreSQL, `postgres-js`), Zod 4, Vitest, `@vercel/blob` 2.8 (client uploads), Node 20 scripts (ESM), GitHub Actions, Flutter 3.44.6 / Gradle (Kotlin DSL), Husky pre-commit hook (`tsc` + `next build`).

**Spec:** `docs/superpowers/specs/2026-10-18-mobile-release-button-design.md` (approved by the owner on 2026-10-18). Read it before starting.

**Verified:** on 2026-10-18 this plan was built first, then written from that build:
- **Dry run:** built in a throwaway copy of the repo from `main` at `a1aae1f`, with a real `npm ci`. TypeScript, lint and a full `next build` passed. Web tests went 484 → 487, 489, 496, 502, 502, 502 after Tasks 1–6.
- **Database check:** `migrationsPending` ran against a throwaway local PostgreSQL 17 with every migration applied by `drizzle-kit migrate` (never the real database). The results were right in all three cases: never migrated → pending, fully migrated → not pending, newest migration missing → pending.
- **End to end:** the built website ran on that throwaway database, with Blob storage pointed at a local stand-in for Vercel Blob's API. `scripts/publish-apk.mjs` uploaded an 18.2 MB file in parts; it arrived byte for byte with the same SHA-256, and the release row was written with the right size, hash, URL and notes. Then:
  - the same build number again was refused with "Build number must be higher than the current 8";
  - a wrong token was refused;
  - the next build published and deleted the old APK file;
  - empty notes were stored as none.
- **Readiness check:** `scripts/release-ready.mjs` gave the right answer for each case: ready, website older than the release, website newer, build number not higher, wrong token, missing migration.
- **Workflow steps:** the "Read the version" and "Write the signing key" steps were run word for word in bash. Then `CI=true flutter build apk --release --split-per-abi` with a throwaway keystore built an arm64 APK whose signing certificate matched that keystore. Without `key.properties` the same build failed with the guard's message.
- **Not run:** the workflow on GitHub itself, a real Vercel deployment and real Blob storage. Those are the owner's checks at the final STOP.

If a step doesn't match what you see, something has changed since then. Stop and report rather than improvise.

## Global Constraints

- **No new packages.** The scripts use Node 20's own `fetch`/`crypto`/`child_process` and the repo's existing `@vercel/blob`.
- **The release token is the only new way in.** It can reach only `/api/release-bot/*`, and those routes refuse every request when `APP_RELEASE_TOKEN` is unset. The Settings form keeps requiring a signed-in release admin (`APP_RELEASE_ADMIN_EMAILS`).
- **Never log or print secrets.** Workflow inputs and secrets reach shell commands only through `env:`, never `${{ }}` inside a script body; the one exception is the version step's outputs, which come from `pubspec.yaml`.
- **No database changes in this plan.** Never run `npm run db:migrate` and never point anything at the real database.
- **Messages the owner sees** are plain sentences that say what to do: "Deploy the website first", "Run npm run db:migrate first", "Bump the version in mobile/pubspec.yaml first".
- **ESLint order.** Imports, object keys and JSX props stay in the order ESLint enforces (`npm run lint -- --fix` fixes it). `npm run lint` must report no errors; the two existing warnings (`NepaliDateField.tsx`, `ExpenseDialog.tsx`) are not this plan's.

## Review Focus

Behaviour the spec implies that no automated test in this plan can reach, because it only happens on Vercel or GitHub. Each line names where it is checked instead.

1. **Vercel sets `VERCEL_GIT_COMMIT_SHA` on the production deployment**, so `/status` reports a commit. Checked at the STOP by calling `/status` with `curl`.
2. **A real Vercel Blob store accepts the client-token multipart upload from a GitHub runner.** The dry run used a stand-in API. Checked by the first real run.
3. **GitHub installs Flutter 3.44.6 (`subosito/flutter-action`), decodes the key from secrets and signs with it.** Checked by the first real run: the release installs over the existing app on the owner's phone.
4. **The workflow may push the `mobile-v…` tag (`permissions: contents: write`).** Checked by the first real run's last step.
5. **A website deployed without `APP_RELEASE_TOKEN` refuses everything.** That's a unit test here (Tasks 1, 3, 4) and the first thing the STOP's `curl` shows if the token wasn't added.

## How to use this plan

- Do the tasks **in order**, 1 → 6. There is one **STOP checkpoint**, at the end: stop, send the owner the report it describes, and wait for them.
- Code blocks are complete. Every code step is one of these kinds:
  - **"Create `path` with:"** — a new file; paste the whole block.
  - **"Replace the whole of `path` with:"** — overwrite the file with the whole block.
  - **"In `path`, find:" … "Replace it with:"** — find the exact old text (match by text, not line number) and replace it with the new text. Each old block occurs exactly once in the file at that point. When a file has several, they're numbered "(1 of 3)" and so on; do them in that order. A block's last line break isn't part of the text: some old blocks end in the middle of a line, and the rest of that line stays as it is.
- Before Task 1, create the branch once from `main`: `git switch -c feat/release-button`. Every task commits to that branch.
- Every command runs from the repo root.
- `esewa_capture.zip` in the repo root is unrelated to this plan. **Don't commit it and don't delete it.**
- The pre-commit hook runs `npx tsc --noEmit` and `npm run build` (15–25 s). Never bypass it with `--no-verify`; if it fails, fix the cause.

---

### Task 1: The release token check

**Files:**
- Create: `src/lib/release-token.ts`
- Test: `src/lib/release-token.test.ts`

**Interfaces:**
- Produces: `isReleaseToken(authorization: null | string): boolean`. True only for `Bearer <APP_RELEASE_TOKEN>` when that variable is set and not empty. Tasks 3 and 4 call it with `request.headers.get("authorization")`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/release-token.test.ts` with:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { isReleaseToken } from "./release-token";

describe("isReleaseToken", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts the release token as a Bearer header", () => {
    vi.stubEnv("APP_RELEASE_TOKEN", "s3cret-token");
    expect(isReleaseToken("Bearer s3cret-token")).toBe(true);
  });

  it("rejects a wrong or missing token", () => {
    vi.stubEnv("APP_RELEASE_TOKEN", "s3cret-token");
    expect(isReleaseToken("Bearer s3cret-tokeN")).toBe(false);
    expect(isReleaseToken("Bearer ")).toBe(false);
    expect(isReleaseToken("s3cret-token")).toBe(false);
    expect(isReleaseToken(null)).toBe(false);
  });

  it("rejects everything when no token is set on the website", () => {
    vi.stubEnv("APP_RELEASE_TOKEN", "");
    expect(isReleaseToken("Bearer ")).toBe(false);
    expect(isReleaseToken("Bearer anything")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/release-token.test.ts`
Expected: FAIL with `Error: Cannot find module './release-token' imported from …/src/lib/release-token.test.ts` and `Tests  no tests`.

- [ ] **Step 3: Implement it**

Create `src/lib/release-token.ts` with:

```ts
import { createHash, timingSafeEqual } from "node:crypto";

// The GitHub release workflow signs its requests with APP_RELEASE_TOKEN
// instead of a person's login: it can publish app releases and nothing else.
// Unset on the website → every request is refused.
export function isReleaseToken(authorization: null | string): boolean {
  const expected = process.env.APP_RELEASE_TOKEN ?? "";
  if (!expected || !authorization?.startsWith("Bearer ")) return false;
  const given = authorization.slice("Bearer ".length);
  // Hashing first gives equal lengths, so the comparison takes the same time
  // however much of the token is right.
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/release-token.test.ts`
Expected: `Tests  3 passed (3)`.

- [ ] **Step 5: Commit**

```bash
npx eslint --fix src/lib/release-token.ts src/lib/release-token.test.ts
git add src/lib/release-token.ts src/lib/release-token.test.ts
git commit -m "feat(releases): a release token check for the GitHub workflow"
```

Expected: the hook's `tsc` and `next build` pass. `npx vitest run` → `Tests  487 passed (487)`.

---

### Task 2: One publish function for the form and the workflow

**Files:**
- Modify: `src/modules/app-releases/api/app-releases.ts`, `src/modules/app-releases/api/app-releases.actions.ts`, `src/app/api/app-releases/upload/route.ts`
- Test: `src/modules/app-releases/api/app-releases.actions.test.ts`

**Interfaces:**
- Produces, in `@/modules/app-releases/api/app-releases`:
  - `publishRelease(input: AppReleaseInput): Promise<{ cleanupFailed: boolean }>` parses with `appReleaseSchema` and throws `ReleaseRejectedError` when the build number isn't higher. Otherwise it inserts the row, deletes the older APK files and revalidates `/settings`. It checks nobody's identity: callers do.
  - `class ReleaseRejectedError extends Error`.
  - `APK_UPLOAD_OPTIONS = { addRandomSuffix: true, allowedContentTypes: ["application/vnd.android.package-archive"], maximumSizeInBytes: MAX_APK_SIZE_BYTES }`.
- Unchanged for its caller (`AppReleasesSection.tsx`): `publishReleaseAction(input)`, which still requires a signed-in release admin.

- [ ] **Step 1: Write the failing test**

Create `src/modules/app-releases/api/app-releases.actions.test.ts` with:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireReleaseAdmin } from "@/lib/release-admin";

import { publishRelease } from "./app-releases";
import { publishReleaseAction } from "./app-releases.actions";

vi.mock("@/lib/release-admin", () => ({ requireReleaseAdmin: vi.fn() }));
vi.mock("./app-releases", () => ({ publishRelease: vi.fn() }));

const release = {
  apkUrl: "https://abc.private.blob.vercel-storage.com/app-releases/piko-1.4.2-x1y2.apk",
  notes: "Smoother loading.",
  sha256: "a".repeat(64),
  sizeBytes: 19_000_000,
  versionCode: 8,
  versionName: "1.4.2",
};

describe("publishReleaseAction", () => {
  beforeEach(() => {
    vi.mocked(requireReleaseAdmin).mockReset();
    vi.mocked(publishRelease).mockReset();
  });

  it("publishes for a signed-in release admin", async () => {
    vi.mocked(publishRelease).mockResolvedValue({ cleanupFailed: false });

    await expect(publishReleaseAction(release)).resolves.toEqual({ cleanupFailed: false });
    expect(publishRelease).toHaveBeenCalledWith(release);
  });

  it("publishes nothing for anyone else", async () => {
    vi.mocked(requireReleaseAdmin).mockRejectedValue(new Error("Not allowed to publish app releases"));

    await expect(publishReleaseAction(release)).rejects.toThrow("Not allowed");
    expect(publishRelease).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/modules/app-releases`
Expected: FAIL with `Error: This module cannot be imported from a Client Component module. It should only be used from a Server Component.` and `Tests  no tests`. The action still imports the database itself; after this task it only calls `publishRelease`.

- [ ] **Step 3: Implement it**

Replace the whole of `src/modules/app-releases/api/app-releases.ts` with:

```ts
import { del, issueSignedToken, presignUrl } from "@vercel/blob";
import { desc, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { appReleases } from "@/db/schema";

import { type AppReleaseInput, appReleaseSchema, MAX_APK_SIZE_BYTES } from "../schemas/app-release.schema";

// What an APK upload may be, for both the Settings form and the release
// workflow: private Blob storage hands out an upload token only for these.
export const APK_UPLOAD_OPTIONS = {
  addRandomSuffix: true,
  allowedContentTypes: ["application/vnd.android.package-archive"],
  maximumSizeInBytes: MAX_APK_SIZE_BYTES,
};

// A release the server refuses (its build number isn't higher). Callers turn
// it into a message for whoever is publishing.
export class ReleaseRejectedError extends Error {}

export async function getLatestRelease() {
  const [latest] = await db.select().from(appReleases).orderBy(desc(appReleases.versionCode)).limit(1);
  return latest ?? null;
}

export async function listReleases(limit = 10) {
  return db.select().from(appReleases).orderBy(desc(appReleases.versionCode)).limit(limit);
}

const DOWNLOAD_LINK_TTL_MS = 24 * 60 * 60 * 1000;

// The Blob store is private, so a stored apkUrl can't be downloaded as-is.
// The app gets a short-lived signed link instead — issued only for the
// latest release, so superseded builds can't be fetched even by someone who
// kept an old URL. 24h covers an app left open before tapping Update.
export async function signedApkDownloadUrl(apkUrl: string): Promise<string> {
  const pathname = decodeURIComponent(new URL(apkUrl).pathname.slice(1));
  const validUntil = Date.now() + DOWNLOAD_LINK_TTL_MS;
  const signed = await issueSignedToken({ operations: ["get"], pathname, validUntil });
  const { presignedUrl } = await presignUrl(signed, { access: "private", operation: "get", pathname, validUntil });
  return presignedUrl;
}

// Publishing adds a release row; the app only ever offers the newest one.
// Older APK files are then deleted from Blob storage so superseded builds
// can't be downloaded any more — their rows stay as history (Settings shows
// them as "Removed"). Cleanup runs only after the new row is saved, so a
// failed publish never takes the live build down. A failed cleanup doesn't
// undo the publish, but is reported so the old files can be removed later.
// Callers check who is publishing first (the form: a release admin; the
// workflow: the release token).
export async function publishRelease(input: AppReleaseInput): Promise<{ cleanupFailed: boolean }> {
  const parsed = appReleaseSchema.parse(input);

  const latest = await getLatestRelease();
  if (latest && parsed.versionCode <= latest.versionCode) {
    throw new ReleaseRejectedError(`Build number must be higher than the current ${latest.versionCode}`);
  }

  await db.insert(appReleases).values(parsed);

  let cleanupFailed = false;
  const older = await db.select({ apkUrl: appReleases.apkUrl }).from(appReleases).where(ne(appReleases.versionCode, parsed.versionCode));
  if (older.length > 0) {
    try {
      // Per the Blob docs, deleting succeeds whether or not the blob still
      // exists, so re-sending already-removed URLs is harmless.
      await del(older.map((r) => r.apkUrl));
    } catch (error) {
      console.error("Failed to delete superseded APKs", error);
      cleanupFailed = true;
    }
  }

  revalidatePath("/settings");
  return { cleanupFailed };
}
```

Replace the whole of `src/modules/app-releases/api/app-releases.actions.ts` with:

```ts
"use server";

import { requireReleaseAdmin } from "@/lib/release-admin";

import type { AppReleaseInput } from "../schemas/app-release.schema";
import { publishRelease } from "./app-releases";

// The Settings form's publish: only a signed-in release admin.
export async function publishReleaseAction(input: AppReleaseInput): Promise<{ cleanupFailed: boolean }> {
  await requireReleaseAdmin();
  return publishRelease(input);
}
```

Replace the whole of `src/app/api/app-releases/upload/route.ts` with:

```ts
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { isReleaseAdmin } from "@/lib/release-admin";
import { APK_UPLOAD_OPTIONS } from "@/modules/app-releases/api/app-releases";

// Issues short-lived tokens so the browser uploads the APK straight to Vercel
// Blob — the file is far over Vercel's 4.5 MB function body limit. The release
// row itself is written afterwards by publishReleaseAction.
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      onBeforeGenerateToken: async () => {
        if (!(await isReleaseAdmin())) throw new Error("Not allowed to publish app releases");
        return APK_UPLOAD_OPTIONS;
      },
      request,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : "Upload failed" } },
      { status: 400 },
    );
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx tsc --noEmit` then `npx vitest run src/modules/app-releases`
Expected: no type errors; `Tests  2 passed (2)`.

- [ ] **Step 5: Commit**

```bash
npx eslint --fix src/modules/app-releases src/app/api/app-releases
git add src/modules/app-releases src/app/api/app-releases
git commit -m "refactor(releases): one publish function for the Settings form and the release workflow"
```

Expected: the hook passes. `npx vitest run` → `Tests  489 passed (489)`.

---

### Task 3: The status endpoint

**Files:**
- Create: `src/modules/app-releases/api/release-status.ts`, `src/app/api/release-bot/status/route.ts`
- Modify: `src/proxy.ts` (the sign-in redirect skips `api/release-bot`)
- Test: `src/modules/app-releases/api/release-status.test.ts`, `src/app/api/release-bot/status/route.test.ts`

**Interfaces:**
- Consumes: `isReleaseToken` (Task 1), `getLatestRelease()` (existing).
- Produces:
  - `newestMigrationAt(): number`, the largest `when` in `drizzle/meta/_journal.json`.
  - `migrationsPending(): Promise<boolean>`, true when `drizzle.__drizzle_migrations` is missing or its newest `created_at` is older than `newestMigrationAt()`.
  - `GET /api/release-bot/status` → 200 `{ commit: string | null, latestVersionCode: number | null, migrationsPending: boolean }`, or 401 `{ error: { message: "Not allowed" } }`. Task 5's `release-ready.mjs` reads this.

- [ ] **Step 1: Write the failing tests**

Create `src/modules/app-releases/api/release-status.test.ts` with:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db/client";

import journal from "../../../../drizzle/meta/_journal.json";
import { migrationsPending, newestMigrationAt } from "./release-status";

vi.mock("@/db/client", () => ({ db: { execute: vi.fn() } }));

const newest = Math.max(...journal.entries.map((e) => e.when));

// The two queries migrationsPending makes, in order: does the log table
// exist, then the newest migration it recorded.
function database(found: null | string, last?: null | string) {
  vi.mocked(db.execute).mockResolvedValueOnce([{ found }] as never);
  if (last !== undefined) vi.mocked(db.execute).mockResolvedValueOnce([{ last }] as never);
}

describe("migrationsPending", () => {
  beforeEach(() => vi.mocked(db.execute).mockReset());

  it("knows the newest migration this build ships with", () => {
    expect(newestMigrationAt()).toBe(newest);
  });

  it("is false when the database has run the newest migration", async () => {
    database("drizzle.__drizzle_migrations", String(newest));
    await expect(migrationsPending()).resolves.toBe(false);
  });

  it("is true when the database is behind this build", async () => {
    database("drizzle.__drizzle_migrations", String(newest - 1));
    await expect(migrationsPending()).resolves.toBe(true);
  });

  it("is true when nothing was ever migrated", async () => {
    database("drizzle.__drizzle_migrations", null);
    await expect(migrationsPending()).resolves.toBe(true);

    database(null);
    await expect(migrationsPending()).resolves.toBe(true);
    expect(db.execute).toHaveBeenCalledTimes(3);
  });
});
```

Create `src/app/api/release-bot/status/route.test.ts` with:

```ts
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getLatestRelease } from "@/modules/app-releases/api/app-releases";
import { migrationsPending } from "@/modules/app-releases/api/release-status";

import { GET } from "./route";

vi.mock("@/modules/app-releases/api/app-releases", () => ({ getLatestRelease: vi.fn() }));
vi.mock("@/modules/app-releases/api/release-status", () => ({ migrationsPending: vi.fn() }));

function get(authorization?: string) {
  return GET(
    new NextRequest("https://piko.test/api/release-bot/status", {
      headers: authorization ? { authorization } : {},
    }),
  );
}

describe("GET /api/release-bot/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("APP_RELEASE_TOKEN", "s3cret-token");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "abc123");
    vi.mocked(getLatestRelease).mockResolvedValue({ versionCode: 7 } as never);
    vi.mocked(migrationsPending).mockResolvedValue(false);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("says which commit is live, whether migrations are pending, and the live build number", async () => {
    const res = await get("Bearer s3cret-token");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ commit: "abc123", latestVersionCode: 7, migrationsPending: false });
  });

  it("reports pending migrations, no commit off Vercel, and no release yet", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");
    vi.mocked(migrationsPending).mockResolvedValue(true);
    vi.mocked(getLatestRelease).mockResolvedValue(null as never);

    expect(await (await get("Bearer s3cret-token")).json()).toEqual({
      commit: null,
      latestVersionCode: null,
      migrationsPending: true,
    });
  });

  it("refuses without the release token", async () => {
    expect((await get()).status).toBe(401);
    expect((await get("Bearer wrong")).status).toBe(401);
    expect(migrationsPending).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/modules/app-releases/api/release-status.test.ts src/app/api/release-bot`
Expected: FAIL with `Error: Cannot find module '/src/modules/app-releases/api/release-status' …` and `Error: Cannot find package '@/modules/app-releases/api/release-status' …`, and `Tests  no tests`.

- [ ] **Step 3: Implement it**

Create `src/modules/app-releases/api/release-status.ts` with:

```ts
import { sql } from "drizzle-orm";

import { db } from "@/db/client";

import journal from "../../../../drizzle/meta/_journal.json";

// When the newest migration this build ships with was generated. Each entry's
// `when` is also what `drizzle-kit migrate` records as `created_at` once it
// has run that migration on the database.
export function newestMigrationAt(): number {
  return Math.max(...journal.entries.map((e) => e.when));
}

// True while the database is missing a migration this build ships with, so
// the release workflow can refuse until `npm run db:migrate` has run. A
// database that was never migrated has no log table at all.
export async function migrationsPending(): Promise<boolean> {
  const [{ found }] = await db.execute<{ found: null | string }>(
    sql`select to_regclass('drizzle.__drizzle_migrations')::text as found`,
  );
  if (!found) return true;
  const [{ last }] = await db.execute<{ last: null | string }>(
    sql`select max(created_at)::text as last from drizzle.__drizzle_migrations`,
  );
  return last === null || Number(last) < newestMigrationAt();
}
```

Create `src/app/api/release-bot/status/route.ts` with:

```ts
import { NextResponse } from "next/server";

import { isReleaseToken } from "@/lib/release-token";
import { getLatestRelease } from "@/modules/app-releases/api/app-releases";
import { migrationsPending } from "@/modules/app-releases/api/release-status";

// The release workflow asks this before building: which commit the website
// runs (Vercel sets VERCEL_GIT_COMMIT_SHA), whether its database still needs
// `db:migrate`, and the live build number.
export async function GET(request: Request) {
  if (!isReleaseToken(request.headers.get("authorization"))) {
    return NextResponse.json({ error: { message: "Not allowed" } }, { status: 401 });
  }

  const [pending, latest] = await Promise.all([migrationsPending(), getLatestRelease()]);
  return NextResponse.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
    latestVersionCode: latest?.versionCode ?? null,
    migrationsPending: pending,
  });
}
```

In `src/proxy.ts`, find:

```ts
matcher: ["/((?!api/auth|api/mobile|_next/static
```

Replace it with:

```ts
matcher: ["/((?!api/auth|api/mobile|api/release-bot|_next/static
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx tsc --noEmit` then `npx vitest run src/modules/app-releases src/app/api/release-bot`
Expected: no type errors; `Tests  9 passed (9)`.

If `tsc` reports `Cannot find name 'LayoutProps'`, run `npx next typegen` once and try again: Next generates those types on its first dev or build run.

- [ ] **Step 5: Commit**

```bash
npx eslint --fix src/modules/app-releases src/app/api/release-bot src/proxy.ts
git add src/modules/app-releases src/app/api/release-bot src/proxy.ts
git commit -m "feat(releases): a status endpoint for the release workflow (live commit, pending migrations, build number)"
```

Expected: the hook passes, and the build's route list includes `ƒ /api/release-bot/status`. `npx vitest run` → `Tests  496 passed (496)`.

---

### Task 4: The upload and publish endpoints

**Files:**
- Create: `src/app/api/release-bot/upload/route.ts`, `src/app/api/release-bot/publish/route.ts`
- Test: `src/app/api/release-bot/upload/route.test.ts`, `src/app/api/release-bot/publish/route.test.ts`

**Interfaces:**
- Consumes: `isReleaseToken` (Task 1); `publishRelease`, `ReleaseRejectedError`, `APK_UPLOAD_OPTIONS` (Task 2).
- Produces:
  - `POST /api/release-bot/upload`: Vercel Blob's client-upload handshake (`handleUpload`), APK files only. It returns 401 without the token. `@vercel/blob/client`'s `upload()` calls it with `headers: { authorization }`.
  - `POST /api/release-bot/publish` with body `{ apkUrl, notes?, sha256, sizeBytes, versionCode, versionName }`. It returns 201 `{ cleanupFailed }`; 400 `{ error: { message } }` for invalid input or a build number that isn't higher; 401 without the token.

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/release-bot/upload/route.test.ts` with:

```ts
import { handleUpload } from "@vercel/blob/client";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

vi.mock("@vercel/blob/client", () => ({ handleUpload: vi.fn() }));
vi.mock("@/modules/app-releases/api/app-releases", () => ({
  APK_UPLOAD_OPTIONS: { addRandomSuffix: true, allowedContentTypes: ["application/vnd.android.package-archive"], maximumSizeInBytes: 1 },
}));

const tokenRequest = { payload: { clientPayload: null, multipart: true, pathname: "app-releases/piko-1.4.2.apk" }, type: "blob.generate-client-token" };

function post(authorization = "Bearer s3cret-token") {
  return POST(
    new NextRequest("https://piko.test/api/release-bot/upload", {
      body: JSON.stringify(tokenRequest),
      headers: { authorization },
      method: "POST",
    }),
  );
}

describe("POST /api/release-bot/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("APP_RELEASE_TOKEN", "s3cret-token");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("hands out an upload token limited to APK files", async () => {
    vi.mocked(handleUpload).mockImplementation(async ({ onBeforeGenerateToken }) => {
      expect(await onBeforeGenerateToken("app-releases/piko-1.4.2.apk", null, true)).toEqual({
        addRandomSuffix: true,
        allowedContentTypes: ["application/vnd.android.package-archive"],
        maximumSizeInBytes: 1,
      });
      return { clientToken: "client-token", type: "blob.generate-client-token" };
    });

    const res = await post();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ clientToken: "client-token", type: "blob.generate-client-token" });
    expect(vi.mocked(handleUpload).mock.calls[0][0].body).toEqual(tokenRequest);
  });

  it("refuses without the release token", async () => {
    expect((await post("Bearer wrong")).status).toBe(401);
    expect(handleUpload).not.toHaveBeenCalled();
  });
});
```

Create `src/app/api/release-bot/publish/route.test.ts` with:

```ts
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { publishRelease, ReleaseRejectedError } from "@/modules/app-releases/api/app-releases";

import { POST } from "./route";

vi.mock("@/modules/app-releases/api/app-releases", () => ({
  publishRelease: vi.fn(),
  ReleaseRejectedError: class ReleaseRejectedError extends Error {},
}));

const release = {
  apkUrl: "https://abc.private.blob.vercel-storage.com/app-releases/piko-1.4.2-x1y2.apk",
  notes: "Smoother loading.",
  sha256: "a".repeat(64),
  sizeBytes: 19_000_000,
  versionCode: 8,
  versionName: "1.4.2",
};

function post(body: unknown, authorization = "Bearer s3cret-token") {
  return POST(
    new NextRequest("https://piko.test/api/release-bot/publish", {
      body: JSON.stringify(body),
      headers: { authorization },
      method: "POST",
    }),
  );
}

describe("POST /api/release-bot/publish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("APP_RELEASE_TOKEN", "s3cret-token");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("publishes a release", async () => {
    vi.mocked(publishRelease).mockResolvedValue({ cleanupFailed: false });

    const res = await post(release);

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ cleanupFailed: false });
    expect(publishRelease).toHaveBeenCalledWith(release);
  });

  it("passes on why a release was refused", async () => {
    vi.mocked(publishRelease).mockRejectedValue(new ReleaseRejectedError("Build number must be higher than the current 8"));

    const res = await post(release);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: { message: "Build number must be higher than the current 8" } });
  });

  it("rejects an APK that isn't in our Blob storage", async () => {
    const res = await post({ ...release, apkUrl: "https://example.com/piko.apk" });

    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toBe("APK must be uploaded to Blob storage");
    expect(publishRelease).not.toHaveBeenCalled();
  });

  it("refuses without the release token", async () => {
    expect((await post(release, "Bearer wrong")).status).toBe(401);
    vi.stubEnv("APP_RELEASE_TOKEN", "");
    expect((await post(release, "Bearer ")).status).toBe(401);
    expect(publishRelease).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/app/api/release-bot`
Expected: FAIL with `Error: Cannot find module '/src/app/api/release-bot/publish/route' …` and `Error: Cannot find module '/src/app/api/release-bot/upload/route' …`; the status tests from Task 3 still pass (`Tests  3 passed (3)`).

- [ ] **Step 3: Implement them**

Create `src/app/api/release-bot/upload/route.ts` with:

```ts
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { isReleaseToken } from "@/lib/release-token";
import { APK_UPLOAD_OPTIONS } from "@/modules/app-releases/api/app-releases";

// Issues the release workflow a short-lived token to upload the APK straight
// to Blob storage, like /api/app-releases/upload does for the Settings form.
// GitHub never holds the Blob store's own key.
export async function POST(request: Request) {
  if (!isReleaseToken(request.headers.get("authorization"))) {
    return NextResponse.json({ error: { message: "Not allowed" } }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({ body, onBeforeGenerateToken: async () => APK_UPLOAD_OPTIONS, request });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : "Upload failed" } },
      { status: 400 },
    );
  }
}
```

Create `src/app/api/release-bot/publish/route.ts` with:

```ts
import { NextResponse } from "next/server";

import { isReleaseToken } from "@/lib/release-token";
import { publishRelease, ReleaseRejectedError } from "@/modules/app-releases/api/app-releases";
import { appReleaseSchema } from "@/modules/app-releases/schemas/app-release.schema";

// The release workflow's publish: the same as the Settings form's, allowed by
// the release token instead of a release admin's session.
export async function POST(request: Request) {
  if (!isReleaseToken(request.headers.get("authorization"))) {
    return NextResponse.json({ error: { message: "Not allowed" } }, { status: 401 });
  }

  const parsed = appReleaseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { message: parsed.error.issues[0].message } }, { status: 400 });
  }

  try {
    return NextResponse.json(await publishRelease(parsed.data), { status: 201 });
  } catch (error) {
    if (error instanceof ReleaseRejectedError) {
      return NextResponse.json({ error: { message: error.message } }, { status: 400 });
    }
    throw error;
  }
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx tsc --noEmit` then `npx vitest run src/app/api/release-bot`
Expected: no type errors; `Tests  9 passed (9)`.

- [ ] **Step 5: Commit**

```bash
npx eslint --fix src/app/api/release-bot
git add src/app/api/release-bot
git commit -m "feat(releases): upload and publish endpoints for the release workflow"
```

Expected: the hook passes, and the build's route list includes `ƒ /api/release-bot/publish`, `ƒ /api/release-bot/status` and `ƒ /api/release-bot/upload`. `npx vitest run` → `Tests  502 passed (502)`.

---

### Task 5: The Release mobile app workflow

**Files:**
- Create: `scripts/release-ready.mjs`, `scripts/publish-apk.mjs`, `.github/workflows/release-mobile.yml`
- Modify: `mobile/android/app/build.gradle.kts`

**Interfaces:**
- Consumes: Tasks 3 and 4's endpoints.
- Produces:
  - `node scripts/release-ready.mjs <versionCode>` (env `PIKO_URL`, `APP_RELEASE_TOKEN`) exits 0 when ready, or 1 with a `::error::` line saying what to do.
  - `node scripts/publish-apk.mjs <apk> <versionName> <versionCode>` (env `PIKO_URL`, `APP_RELEASE_TOKEN`, `RELEASE_NOTES`) uploads and publishes, and exits 1 with the website's message on failure.
  - The workflow reads secrets `APP_RELEASE_TOKEN`, `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`, `ANDROID_KEY_ALIAS` and the variable `PIKO_URL`.

This task has no automated tests: the scripts were exercised end to end in the dry run (see **Verified**), and the workflow can only run on GitHub. Step 4 checks what can be checked here.

- [ ] **Step 1: Add the two scripts**

Create `scripts/release-ready.mjs` with:

```js
// The "Release mobile app" workflow's first step: refuses to build unless the
// live website is ready for this commit (.github/workflows/release-mobile.yml).
//
//   PIKO_URL=https://… APP_RELEASE_TOKEN=… node scripts/release-ready.mjs <versionCode>
//
// Ready means the website runs this commit or a newer one, its database has
// every migration, and this build number is higher than the live release's.
import { execFileSync } from "node:child_process";

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

const versionCode = Number(process.argv[2]);
const { APP_RELEASE_TOKEN: token, PIKO_URL: site } = process.env;
if (!Number.isInteger(versionCode)) fail("Usage: node scripts/release-ready.mjs <versionCode>");
if (!site || !token) fail("PIKO_URL and APP_RELEASE_TOKEN must be set");

let response;
try {
  response = await fetch(`${site}/api/release-bot/status`, { headers: { authorization: `Bearer ${token}` } });
} catch (error) {
  fail(`Couldn't reach ${site}: ${error instanceof Error ? error.message : error}`);
}
if (response.status === 401) fail("The website refused the release token. Check APP_RELEASE_TOKEN matches in Vercel and GitHub.");
if (!response.ok) fail(`The website's status check failed (${response.status}).`);
const status = await response.json();

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const head = git("rev-parse", "HEAD");
const short = (sha) => sha.slice(0, 7);

if (!status.commit) fail("The website didn't say which commit it runs (VERCEL_GIT_COMMIT_SHA). Is PIKO_URL the Vercel production site?");
let websiteIsNewer;
try {
  git("merge-base", "--is-ancestor", head, status.commit);
  websiteIsNewer = true;
} catch {
  websiteIsNewer = false;
}
if (!websiteIsNewer) {
  fail(`The website runs ${short(status.commit)}, which doesn't include ${short(head)}. Deploy the website first (or wait for Vercel to finish), then run this again.`);
}
if (status.migrationsPending) fail("The website's database is missing a migration. Run npm run db:migrate first, then run this again.");
if (status.latestVersionCode !== null && versionCode <= status.latestVersionCode) {
  fail(`Build ${versionCode} isn't higher than the live build ${status.latestVersionCode}. Bump the version in mobile/pubspec.yaml first.`);
}

console.log(`Ready: the website runs ${short(status.commit)} with every migration; build ${versionCode} > live ${status.latestVersionCode ?? "none"}.`);
```

Create `scripts/publish-apk.mjs` with:

```js
// Uploads a release APK and publishes it, for the "Release mobile app"
// GitHub workflow (.github/workflows/release-mobile.yml).
//
//   PIKO_URL=https://… APP_RELEASE_TOKEN=… RELEASE_NOTES="…" \
//     node scripts/publish-apk.mjs <apk> <versionName> <versionCode>
//
// The website hands out the upload permission and does the publishing
// (/api/release-bot/upload and /publish), with the same checks as the
// Settings form; this script only moves the file and reports the result.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { upload } from "@vercel/blob/client";

const APK_TYPE = "application/vnd.android.package-archive";

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

const [apkPath, versionName, versionCode] = process.argv.slice(2);
const { APP_RELEASE_TOKEN: token, PIKO_URL: site, RELEASE_NOTES: notes } = process.env;
if (!apkPath || !versionName || !versionCode) fail("Usage: node scripts/publish-apk.mjs <apk> <versionName> <versionCode>");
if (!site || !token) fail("PIKO_URL and APP_RELEASE_TOKEN must be set");

const apk = await readFile(apkPath);
const sha256 = createHash("sha256").update(apk).digest("hex");
const authorization = `Bearer ${token}`;

console.log(`Uploading ${apkPath} (${(apk.length / 1024 / 1024).toFixed(1)} MB, sha256 ${sha256})`);
let blob;
try {
  blob = await upload(`app-releases/piko-${versionName}.apk`, apk, {
    access: "private",
    contentType: APK_TYPE,
    handleUploadUrl: `${site}/api/release-bot/upload`,
    headers: { authorization },
    multipart: true,
  });
} catch (error) {
  fail(`Upload failed: ${error instanceof Error ? error.message : error}`);
}

const response = await fetch(`${site}/api/release-bot/publish`, {
  body: JSON.stringify({
    apkUrl: blob.url,
    notes: notes?.trim() || undefined,
    sha256,
    sizeBytes: apk.length,
    versionCode: Number(versionCode),
    versionName,
  }),
  headers: { authorization, "content-type": "application/json" },
  method: "POST",
});
const result = await response.json().catch(() => null);
if (!response.ok) fail(`Publish failed (${response.status}): ${result?.error?.message ?? "no details"}`);

console.log(`Published Piko ${versionName} (${versionCode}).`);
if (result.cleanupFailed) console.log("::warning::Older APK files couldn't be deleted and may still be downloadable.");
```

- [ ] **Step 2: Add the workflow**

Create `.github/workflows/release-mobile.yml` with:

```yaml
# Release mobile app: run by hand (Actions → Release mobile app → Run workflow).
# Builds the latest main, refuses unless the live website is ready for it,
# then publishes the arm64 APK that installed apps update to.
# One-time setup: mobile/README.md, "Publishing an update".
name: Release mobile app

on:
  workflow_dispatch:
    inputs:
      notes:
        description: Release notes, shown in the app's update sheet
        required: true
        type: string

# One release at a time; a second run waits instead of racing the first.
concurrency:
  group: release-mobile
  cancel-in-progress: false

permissions:
  contents: write # for the mobile-v… tag

jobs:
  release:
    runs-on: ubuntu-latest
    timeout-minutes: 45
    env:
      APP_RELEASE_TOKEN: ${{ secrets.APP_RELEASE_TOKEN }}
      PIKO_URL: ${{ vars.PIKO_URL }}
    steps:
      - uses: actions/checkout@v4
        with:
          ref: main
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install the publish script's packages
        run: npm ci --ignore-scripts --no-audit --no-fund

      - name: Read the version from pubspec.yaml
        id: version
        run: |
          version=$(sed -n 's/^version: *//p' mobile/pubspec.yaml)
          echo "name=${version%%+*}" >> "$GITHUB_OUTPUT"
          echo "code=${version##*+}" >> "$GITHUB_OUTPUT"
          echo "Releasing Piko $version from $(git rev-parse --short HEAD)"

      - name: Check the website is ready
        run: node scripts/release-ready.mjs "${{ steps.version.outputs.code }}"

      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17

      - uses: subosito/flutter-action@v2
        with:
          flutter-version: 3.44.6
          channel: stable
          cache: true

      - name: Test and analyze
        working-directory: mobile
        run: |
          flutter pub get
          flutter analyze
          flutter test

      - name: Write the signing key
        env:
          KEYSTORE_BASE64: ${{ secrets.ANDROID_KEYSTORE_BASE64 }}
          KEYSTORE_PASSWORD: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          KEY_PASSWORD: ${{ secrets.ANDROID_KEY_PASSWORD }}
          KEY_ALIAS: ${{ secrets.ANDROID_KEY_ALIAS }}
        run: |
          echo "$KEYSTORE_BASE64" | base64 -d > "$RUNNER_TEMP/piko-release.jks"
          cat > mobile/android/key.properties <<EOF
          storePassword=$KEYSTORE_PASSWORD
          keyPassword=$KEY_PASSWORD
          keyAlias=$KEY_ALIAS
          storeFile=$RUNNER_TEMP/piko-release.jks
          EOF

      - name: Build the APK
        working-directory: mobile
        run: flutter build apk --release --split-per-abi

      - name: Upload and publish
        env:
          RELEASE_NOTES: ${{ inputs.notes }}
        run: >-
          node scripts/publish-apk.mjs
          mobile/build/app/outputs/flutter-apk/app-arm64-v8a-release.apk
          "${{ steps.version.outputs.name }}" "${{ steps.version.outputs.code }}"

      - name: Tag the release
        run: |
          tag="mobile-v${{ steps.version.outputs.name }}+${{ steps.version.outputs.code }}"
          git tag "$tag"
          git push origin "$tag"
          {
            echo "### Published Piko ${{ steps.version.outputs.name }} (${{ steps.version.outputs.code }})"
            echo "Commit \`$(git rev-parse --short HEAD)\`, tag \`$tag\`. Installed apps will offer the update."
          } >> "$GITHUB_STEP_SUMMARY"

      - name: Remove the signing key
        if: always()
        run: rm -f mobile/android/key.properties "$RUNNER_TEMP/piko-release.jks"
```

- [ ] **Step 3: Never sign a CI release build with the debug key**

In `mobile/android/app/build.gradle.kts`, find:

```kotlin
            } else {
                // Keeps `flutter run --release` working without a key, but don't publish these
```

Replace it with:

```kotlin
            } else {
                // The release workflow (CI=true) must never publish a debug-signed build.
                if (System.getenv("CI") == "true") {
                    throw GradleException("key.properties not found: a CI release build must be signed with the release key.")
                }
                // Keeps `flutter run --release` working without a key, but don't publish these
```

- [ ] **Step 4: Check what can be checked locally**

Run each of these:
- `npx eslint scripts/release-ready.mjs scripts/publish-apk.mjs`
  Expected: no output.
- `node scripts/release-ready.mjs 9`
  Expected: `::error::PIKO_URL and APP_RELEASE_TOKEN must be set`, exit code 1.
- `node scripts/publish-apk.mjs`
  Expected: `::error::Usage: node scripts/publish-apk.mjs <apk> <versionName> <versionCode>`, exit code 1.
- `cd mobile; flutter build apk --release --split-per-abi; cd ..`
  Expected: `√ Built build\app\outputs\flutter-apk\app-arm64-v8a-release.apk`. Your own `android/key.properties` is used, so the guard doesn't trigger. Don't run this with `CI=true`, and don't move or edit `key.properties`.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/release-mobile.yml scripts/release-ready.mjs scripts/publish-apk.mjs mobile/android/app/build.gradle.kts
git commit -m "feat(releases): a Release mobile app workflow that checks the website, builds, signs and publishes"
```

Expected: the hook passes. `git status --short` shows nothing new except `esewa_capture.zip` (the APK build output is gitignored).

---

### Task 6: Docs

**Files:**
- Modify: `docs/architecture.md`, `mobile/README.md`

- [ ] **Step 1: Update the docs**

In `docs/architecture.md`, find (1 of 2):

```markdown
    api/          # route handlers: web (auth, app-releases) + mobile/*
```

Replace it with:

```markdown
    api/          # route handlers: web (auth, app-releases), release-bot/* (release workflow) + mobile/*
```

In `docs/architecture.md`, find (2 of 2):

```markdown
  only, and publishing deletes superseded APK files. Full procedure in `mobile/README.md`.
```

Replace it with:

```markdown
  only, and publishing deletes superseded APK files. Both ways to publish share
  `publishRelease` (`modules/app-releases/api/app-releases.ts`): the Settings form
  (a release admin's session) and the **Release mobile app** GitHub workflow
  (`.github/workflows/release-mobile.yml`), which signs its requests with
  `APP_RELEASE_TOKEN` (`src/lib/release-token.ts`) to `/api/release-bot/{status,upload,publish}`.
  Those routes skip the sign-in redirect in `src/proxy.ts`. `/status` reports the
  deployment's commit (`VERCEL_GIT_COMMIT_SHA`) and whether the database is missing a
  migration (`release-status.ts`), so the workflow refuses to publish an APK ahead of the
  website it needs. Full procedure in `mobile/README.md`.
```

In `mobile/README.md`, find:

```markdown
### Each release

1. Bump `version:` in `pubspec.yaml` — the number after `+` must go up
   (e.g. `1.0.0+1` → `1.1.0+2`).
2. `flutter build apk --release --split-per-abi`
3. On the website, go to **Settings → App updates**, choose
   `build/app/outputs/flutter-apk/app-arm64-v8a-release.apk`, enter the same
   version and build number, add release notes and publish.
```

Replace it with:

```markdown
3. **Release button (GitHub Actions).** Lets GitHub build, sign and publish a
   release when you press a button. Set up once:

   - Make a release token: `openssl rand -hex 32`. Add it in Vercel as
     `APP_RELEASE_TOKEN` (Production) and redeploy, so the website accepts it.
   - Turn the signing key into text: `base64 -w0 ~/piko-release.jks` (Git Bash;
     on macOS `base64 -i ~/piko-release.jks`).
   - On GitHub → the repo → Settings → Secrets and variables → Actions, add the
     **secrets** `APP_RELEASE_TOKEN` (the same token), `ANDROID_KEYSTORE_BASE64`
     (that text), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD` and
     `ANDROID_KEY_ALIAS` (the values in `android/key.properties`), and the
     **variable** `PIKO_URL` (the live site, e.g. `https://piko.example.com`, no
     trailing slash).

   The key's passwords must not contain a backslash (`key.properties` would read
   it as an escape).

### Each release

1. Bump `version:` in `pubspec.yaml` — the number after `+` must go up
   (e.g. `1.0.0+1` → `1.1.0+2`) — and push it to `main`.
2. Wait for Vercel to deploy that commit. If it adds a migration, run
   `npm run db:migrate`.
3. On GitHub → Actions → **Release mobile app** → **Run workflow**, type the
   release notes (shown in the app's update sheet) and run it.

The workflow checks the website first and stops, publishing nothing, if the website
doesn't run this commit yet ("Deploy the website first"), a migration is missing
("Run npm run db:migrate first") or the build number isn't higher than the live one.
Then it runs the app's tests, builds and signs the arm64 APK, uploads and publishes
it, and tags the commit `mobile-v<version>+<build>`. A release build on GitHub
without the signing key fails rather than signing with the debug key.

**By hand instead** (fallback): `flutter build apk --release --split-per-abi`, then
on the website go to **Settings → App updates**, choose
`build/app/outputs/flutter-apk/app-arm64-v8a-release.apk`, enter the same version
and build number, add release notes and publish.
```

- [ ] **Step 2: Commit**

```bash
git add docs/architecture.md mobile/README.md
git commit -m "docs: the Release mobile app button: one-time setup and each release"
```

Expected: the hook passes. `npx vitest run` → `Tests  502 passed (502)`; `npm run lint` → `✖ 2 problems (0 errors, 2 warnings)` (the existing two).

---

## STOP: hand over to the owner

Don't merge, push or change anything on Vercel or GitHub yourself. Send the owner this report, then wait:

1. **What was built:** the six commits on `feat/release-button` (`git log --oneline main..`), with the web test count (502) and the lint result.
2. **What the owner does next, in order:**
   1. Merge `feat/release-button` into `main` and push. Vercel deploys it.
   2. Make a token (`openssl rand -hex 32`), add it in Vercel as `APP_RELEASE_TOKEN` (Production), and redeploy.
   3. Check the website accepts it. Run:
      `curl -H "Authorization: Bearer <token>" https://<site>/api/release-bot/status`
      Expected: `{"commit":"<the merge commit>","latestVersionCode":<live build>,"migrationsPending":false}`. If `commit` is `null`, the site isn't the Vercel production deployment.
   4. Add the GitHub secrets and the `PIKO_URL` variable (`mobile/README.md`, "Release button").
   5. For the next release (a build number above the live one), follow `mobile/README.md` "Each release". After the run, check the release installs over the existing app on the phone. That confirms the key from the secrets is the real release key.
3. **What wasn't run:** the workflow on GitHub, real Blob storage and a real Vercel deployment. They're steps 3 and 5 above.
