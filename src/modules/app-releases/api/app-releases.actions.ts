"use server";

import { del } from "@vercel/blob";
import { ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { appReleases } from "@/db/schema";
import { requireReleaseAdmin } from "@/lib/release-admin";

import { type AppReleaseInput, appReleaseSchema } from "../schemas/app-release.schema";
import { getLatestRelease } from "./app-releases";

// Publishing adds a release row; the app only ever offers the newest one.
// Older APK files are then deleted from Blob storage so superseded builds
// can't be downloaded any more — their rows stay as history (Settings shows
// them as "Removed"). Cleanup runs only after the new row is saved, so a
// failed publish never takes the live build down. A failed cleanup doesn't
// undo the publish, but is reported so the old files can be removed later.
export async function publishReleaseAction(input: AppReleaseInput): Promise<{ cleanupFailed: boolean }> {
  await requireReleaseAdmin();
  const parsed = appReleaseSchema.parse(input);

  const latest = await getLatestRelease();
  if (latest && parsed.versionCode <= latest.versionCode) {
    throw new Error(`Build number must be higher than the current ${latest.versionCode}`);
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
