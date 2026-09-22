# piko

Flutter companion app for Piko: capture expenses by voice on the go.

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

2. **Web.** In Vercel, create a Blob store and connect it to the project (this sets
   `BLOB_READ_WRITE_TOKEN`). Add `APP_RELEASE_ADMIN_EMAILS` with the emails
   allowed to publish, then run `npm run db:migrate`.

### Each release

1. Bump `version:` in `pubspec.yaml` — the number after `+` must go up
   (e.g. `1.0.0+1` → `1.1.0+2`).
2. `flutter build apk --release --split-per-abi`
3. On the website, go to **Settings → App updates**, choose
   `build/app/outputs/flutter-apk/app-arm64-v8a-release.apk`, enter the same
   version and build number, add release notes and publish.

`--split-per-abi` builds one APK per CPU type instead of a single ~50 MB
"fat" APK bundling all three; the arm64 one (~19 MB) covers practically every
phone from the last several years. Things to know:

- **Always publish the arm64 APK.** Flutter renumbers split APKs' Android
  versionCode to `2000 + build` for arm64 (the app strips this when comparing).
  A fat APK keeps the plain build number, so Android would reject it as a
  downgrade on phones already running an arm64 build.
- **Build numbers must stay below 1000** (the website enforces this).
- Old 32-bit-only phones can't install the arm64 APK.
