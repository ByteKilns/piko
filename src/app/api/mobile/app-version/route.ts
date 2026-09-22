import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requireMobileAuth } from "@/lib/mobile-request";
import { getLatestRelease } from "@/modules/app-releases/api/app-releases";

export async function GET(request: NextRequest) {
  const auth = await requireMobileAuth(request);
  if (auth instanceof NextResponse) return auth;

  const latest = await getLatestRelease();
  if (!latest) return NextResponse.json({ latest: null });

  return NextResponse.json({
    latest: {
      apkUrl: latest.apkUrl,
      notes: latest.notes,
      sha256: latest.sha256,
      sizeBytes: latest.sizeBytes,
      versionCode: latest.versionCode,
      versionName: latest.versionName,
    },
  });
}
