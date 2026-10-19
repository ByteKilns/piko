import { NextResponse } from "next/server";

import { isReleaseToken } from "@/lib/release-token";
import { publishRelease, ReleaseRejectedError } from "@/modules/app-releases/api/app-releases";
import { appReleaseSchema } from "@/modules/app-releases/schemas/app-release.schema";

// The release workflow's publish: the same as the Settings form's, allowed by
// the release token instead of a release admin's session.
export async function POST(request: Request) {
  if (!isReleaseToken(request.headers.get("authorization"))) {
    return NextResponse.json({ error: { message: "Not allowed" } }, { status: 401 });
  }

  const parsed = appReleaseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { message: parsed.error.issues[0].message } }, { status: 400 });
  }

  try {
    return NextResponse.json(await publishRelease(parsed.data), { status: 201 });
  } catch (error) {
    if (error instanceof ReleaseRejectedError) {
      return NextResponse.json({ error: { message: error.message } }, { status: 400 });
    }
    throw error;
  }
}
