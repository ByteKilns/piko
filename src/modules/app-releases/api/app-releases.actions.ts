"use server";

import { requireReleaseAdmin } from "@/lib/release-admin";

import { type AppReleaseInput, type ReleaseRunInput, releaseRunSchema } from "../schemas/app-release.schema";
import { publishRelease } from "./app-releases";
import { dispatchReleaseWorkflow, listReleaseRuns, type ReleaseRun } from "./release-workflow";

// The Settings form's publish: only a signed-in release admin.
export async function publishReleaseAction(input: AppReleaseInput): Promise<{ cleanupFailed: boolean }> {
  await requireReleaseAdmin();
  return publishRelease(input);
}

// Failures come back as a message rather than thrown: a production build hides
// a thrown error's message from the browser.
type Result<T> = { error: string; ok: false } | { ok: true; value: T };

function failed(error: unknown): { error: string; ok: false } {
  return { error: error instanceof Error ? error.message : "Something went wrong", ok: false };
}

// Settings → Release the mobile app: starts the workflow on main.
export async function runReleaseWorkflowAction(input: ReleaseRunInput): Promise<Result<null>> {
  await requireReleaseAdmin();
  const parsed = releaseRunSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid notes", ok: false };
  try {
    await dispatchReleaseWorkflow(parsed.data.notes);
    return { ok: true, value: null };
  } catch (error) {
    return failed(error);
  }
}

// The section's list of recent runs, refreshed while one is going.
export async function listReleaseRunsAction(): Promise<Result<ReleaseRun[]>> {
  await requireReleaseAdmin();
  try {
    return { ok: true, value: await listReleaseRuns() };
  } catch (error) {
    return failed(error);
  }
}
