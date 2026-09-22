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
