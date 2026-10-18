import { NextResponse } from "next/server";

import { isReleaseToken } from "@/lib/release-token";
import { getLatestRelease } from "@/modules/app-releases/api/app-releases";
import { migrationsPending } from "@/modules/app-releases/api/release-status";

// The release workflow asks this before building: which commit the website
// runs (Vercel sets VERCEL_GIT_COMMIT_SHA), whether its database still needs
// `db:migrate`, and the live build number.
export async function GET(request: Request) {
  if (!isReleaseToken(request.headers.get("authorization"))) {
    return NextResponse.json({ error: { message: "Not allowed" } }, { status: 401 });
  }

  const [pending, latest] = await Promise.all([migrationsPending(), getLatestRelease()]);
  return NextResponse.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
    latestVersionCode: latest?.versionCode ?? null,
    migrationsPending: pending,
  });
}
