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
