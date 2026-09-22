"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db/client";
import { appReleases } from "@/db/schema";
import { requireReleaseAdmin } from "@/lib/release-admin";

import { type AppReleaseInput, appReleaseSchema } from "../schemas/app-release.schema";
import { getLatestRelease } from "./app-releases";

export async function publishReleaseAction(input: AppReleaseInput) {
  await requireReleaseAdmin();
  const parsed = appReleaseSchema.parse(input);

  const latest = await getLatestRelease();
  if (latest && parsed.versionCode <= latest.versionCode) {
    throw new Error(`Build number must be higher than the current ${latest.versionCode}`);
  }

  await db.insert(appReleases).values(parsed);
  revalidatePath("/settings");
}
