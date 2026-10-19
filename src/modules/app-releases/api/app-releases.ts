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
