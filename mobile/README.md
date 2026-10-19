# piko

Flutter companion app for Piko: capture expenses by voice on the go, and eSewa
payments automatically.

## Design

The app follows the website's modernist design
(`docs/superpowers/specs/2026-10-07-modernist-redesign-design.md`): warm paper
and ink, one red accent, square corners, rules instead of cards, Host Grotesk.

- Colours: `lib/theme/piko_colors.dart`, a light and a dark palette copied from
  the website's `src/app/globals.css`. Read them with `context.piko`; never
  hard-code a colour in a screen.
- Type scale and Material component styles: `lib/theme/app_theme.dart`. Use the
  theme's text styles (`headlineLarge` page titles, `titleLarge` headings,
  `titleMedium` row titles, `bodySmall` meta, `labelSmall` micro-labels).
- Shared pieces in `lib/widgets/`, each the counterpart of a website component:
  `MoneyText` (Money), `Monogram`, `Segmented`, `AmountField` (AmountInput),
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

The notification wording in `lib/esewa/parser.dart` is a guess until real texts are
collected. When a payment doesn't show up as a draft, open Settings → eSewa → Captured
notifications, copy it, and add it as a case in `test/esewa_parser_test.dart` before
changing `ParserRules`.

## Publishing an update

Installed apps check `GET /api/mobile/app-version` on launch and when brought
back to the foreground. If a newer build number exists, they show an
"Update available" banner. Tapping **Update** downloads the APK, verifies its
SHA-256 and opens Android's installer.

### One-time setup

1. **Release signing key.** Android only installs an update over the existing app
   if both are signed with the same key. Create it once and keep a backup — if
   it's lost, every user has to uninstall and reinstall.

   ```sh
   keytool -genkey -v -keystore ~/piko-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias piko
   ```

   Then create `android/key.properties` (gitignored):

   ```properties
   storePassword=<password>
   keyPassword=<password>
   keyAlias=piko
   storeFile=C:/Users/<you>/piko-release.jks
   ```

   Builds made before this were signed with a debug key, so existing installs
   need one manual uninstall + reinstall of the first release-signed APK.

2. **Web.** In Vercel, create a **private** Blob store and connect it to the project (this sets
   `BLOB_READ_WRITE_TOKEN`). APKs are uploaded privately; the app downloads the
   latest one through a short-lived signed link from `/api/mobile/app-version`. Add `APP_RELEASE_ADMIN_EMAILS` with the emails
   allowed to publish, then run `npm run db:migrate`.

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

`--split-per-abi` builds one APK per CPU type instead of a single ~50 MB
"fat" APK bundling all three; the arm64 one (~19 MB) covers practically every
phone from the last several years. Things to know:

- **Always publish the arm64 APK.** Flutter renumbers split APKs' Android
  versionCode to `2000 + build` for arm64 (the app strips this when comparing).
  A fat APK keeps the plain build number, so Android would reject it as a
  downgrade on phones already running an arm64 build.
- **Build numbers must stay below 1000** (the website enforces this).
- Old 32-bit-only phones can't install the arm64 APK.
