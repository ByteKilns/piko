import { issueSignedToken, presignUrl } from "@vercel/blob";
import { desc } from "drizzle-orm";

import { db } from "@/db/client";
import { appReleases } from "@/db/schema";

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
