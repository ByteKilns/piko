"use server";

import { requireReleaseAdmin } from "@/lib/release-admin";

import type { AppReleaseInput } from "../schemas/app-release.schema";
import { publishRelease } from "./app-releases";

// The Settings form's publish: only a signed-in release admin.
export async function publishReleaseAction(input: AppReleaseInput): Promise<{ cleanupFailed: boolean }> {
  await requireReleaseAdmin();
  return publishRelease(input);
}
