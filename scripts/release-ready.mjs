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
