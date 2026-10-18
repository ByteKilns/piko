# Mobile release button — design

Approved in conversation with the owner on 2026-10-18 (sections 1–3 below, each confirmed).

## Why

Releasing the Android app is manual today (`mobile/README.md`, "Publishing an update"): bump `pubspec.yaml`, build the arm64 APK on the owner's PC, then upload it through the website's **Settings → App updates** form while signed in as a release admin. The owner wants one button press instead, from any device, while still choosing when a release goes out.

## What the owner decided

- **A GitHub Actions workflow run by hand** ("Run workflow"), not a local script and not a release on every push. It always releases the latest `main`.
- **Release notes are typed** into a required field on the Run workflow form (they are what the app's update sheet shows), not generated from commits.
- **The workflow checks the website is ready first** and refuses otherwise: the live website must be running the release commit (or a newer one), and its database must have every migration that commit has. Some app releases depend on website changes (1.4.1 needed a new column), and an APK that goes out first breaks quietly.
- **A release token, not a login.** The workflow authenticates with a secret that can only publish app releases. The owner's own email and password never go to GitHub: a leak of those would expose all household data, and a password change would break releases.

## 1. What pressing the button does

1. GitHub → Actions → **Release mobile app** → Run workflow, with the release notes. It runs on the latest `main`.
2. **Readiness check, before building.** The workflow calls the website's status endpoint and stops with a clear message, publishing nothing, when:
   - the website runs a commit older than the one being released → "Deploy the website first";
   - the database is missing a migration → "Run db:migrate first";
   - the build number in `pubspec.yaml` isn't higher than the live release's → "Bump the version in pubspec.yaml".
3. **Build.** Same Flutter version as locally (3.44.6) and Java 17; `flutter test` and `flutter analyze` must pass; then `flutter build apk --release --split-per-abi`, signed with the release key rebuilt from GitHub secrets. A missing key fails the build: a debug-signed APK can't install over the app and must never go out.
4. **Upload.** The website hands out a one-time upload permission; the arm64 APK goes to the private Blob store exactly as the form's upload does. GitHub never holds the Blob store's key.
5. **Publish.** The workflow sends version, build number, size, SHA-256 and the notes to the website's publish endpoint, which runs the same code as the form (build number must go up; older APK files are deleted afterwards).
6. **Record.** It tags the commit `mobile-v<version>+<build>` (e.g. `mobile-v1.4.1+7`) and writes a run summary.

Nothing is live until step 5 succeeds. Only one release runs at a time. The Settings form stays as the manual fallback.

## 2. Website changes

### Release token

- New environment variable `APP_RELEASE_TOKEN`: a long random string, set in Vercel and as a GitHub secret.
- Requests carry it as `Authorization: Bearer <token>`. It's compared in constant time (hash both, `timingSafeEqual`).
- Unset or empty in Vercel → every release-bot request is refused. Nothing is open by default.

### Endpoints under `/api/release-bot/`

`src/proxy.ts` sends everything except `api/auth` and `api/mobile` through the sign-in redirect; `api/release-bot` joins those exceptions, since these routes check the token instead.

- **`GET /api/release-bot/status`** →
  `{ commit: string | null, migrationsPending: boolean, latestVersionCode: number | null }`.
  - `commit`: the deployment's `VERCEL_GIT_COMMIT_SHA` (null when not on Vercel; the workflow treats null as "not ready").
  - `migrationsPending`: true when the newest migration in the bundled `drizzle/meta/_journal.json` (its `when`) is newer than the newest `created_at` in the database's `drizzle.__drizzle_migrations` table, which is where `drizzle-kit migrate` records each applied migration. A missing table counts as pending.
  - `latestVersionCode`: the live release's build number (`getLatestRelease`), null when none.
- **`POST /api/release-bot/upload`**: Vercel Blob's client-upload handshake (`handleUpload`), allowed by the token. The workflow's script calls it through `@vercel/blob/client`'s `upload()` with the `Authorization` header. It allows the same content type, size limit and random suffix as the form's `/api/app-releases/upload`; both routes share one definition of those options.
- **`POST /api/release-bot/publish`**: body `{ apkUrl, notes, sha256, sizeBytes, versionCode, versionName }`, validated by the existing `appReleaseSchema`. It runs the same publish logic as the form. That logic moves out of `publishReleaseAction` into a shared `publishRelease(input)`; the action keeps `requireReleaseAdmin()` and calls it. It returns 201 `{ cleanupFailed }`, 400 for a build number that isn't higher or invalid input, 401 for a bad token.

### Tests (Vitest)

- Each endpoint refuses a missing token, a wrong token, and every request when `APP_RELEASE_TOKEN` is unset.
- Status: commit passed through; migrations pending vs up to date vs no migrations table; latest build number or null.
- Publish: accepts a valid release; rejects a build number that isn't higher; rejects an APK URL outside Blob storage.
- The form's `publishReleaseAction` still requires a signed-in release admin.

## 3. The workflow and its secrets

- **File:** `.github/workflows/release-mobile.yml`, `on: workflow_dispatch` with one required input, `notes`. It runs one job at a time (`concurrency: release-mobile`), with `permissions: contents: write` for the tag.
- **Steps:**
  1. Check out `main` with full history.
  2. Readiness check: call `/status`, then compare with `git merge-base --is-ancestor <release commit> <deployed commit>`, `migrationsPending` and the build number parsed from `pubspec.yaml`.
  3. Set up Java 17 and Flutter 3.44.6.
  4. Run `flutter test` and `flutter analyze`.
  5. Write the keystore and `mobile/android/key.properties` from secrets, then build.
  6. Upload and publish with the script below.
  7. Tag the commit and write the summary.
- **Secrets:** `ANDROID_KEYSTORE_BASE64` (the `.jks` file, base64), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`, `ANDROID_KEY_ALIAS`, `APP_RELEASE_TOKEN`. The site's address is a repository variable, `PIKO_URL`.
- **Signing guard:** in `mobile/android/app/build.gradle.kts`, a release build fails when `key.properties` is missing and the `CI` environment variable is `true` (GitHub sets it). Local builds keep today's warning.
- **`scripts/publish-apk.mjs`:**
  - It reads the APK, then computes its size and SHA-256.
  - It uploads to `app-releases/piko-<version>.apk` with `upload()`, sending the token in the `Authorization` header. The settings are the same as the form's: private access, the APK content type, a multipart upload.
  - Then it POSTs `/publish`. It exits non-zero with the server's message on any failure.
  - Plain Node 20 with the repo's `@vercel/blob`; no TypeScript build step.
- **Docs:** `mobile/README.md` "Publishing an update" gets the one-time setup and the button steps, keeping the form as the fallback:
  - generating the token (`openssl rand -hex 32`) and setting it in Vercel and GitHub;
  - base64-encoding the keystore;
  - adding the secrets and `PIKO_URL`.

  `docs/architecture.md` notes the release-bot endpoints.

## Testing the workflow

The website side is covered by the Vitest tests above. The workflow file can only really be tested by running it, so its first real run is the check. A build number that's already published is refused, so the first run happens with the next release after the owner has published 1.4.1+7 by hand. If a step fails, the run stops before publishing, and the Settings form still works.

## Out of scope

- Publishing automatically on push or on a tag.
- iOS, Play Store, other ABIs (the arm64 APK only, as today).
- Changing how installed apps find and install updates.
