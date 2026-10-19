import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { isReleaseToken } from "@/lib/release-token";
import { APK_UPLOAD_OPTIONS } from "@/modules/app-releases/api/app-releases";

// Issues the release workflow a short-lived token to upload the APK straight
// to Blob storage, like /api/app-releases/upload does for the Settings form.
// GitHub never holds the Blob store's own key.
export async function POST(request: Request) {
  if (!isReleaseToken(request.headers.get("authorization"))) {
    return NextResponse.json({ error: { message: "Not allowed" } }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({ body, onBeforeGenerateToken: async () => APK_UPLOAD_OPTIONS, request });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : "Upload failed" } },
      { status: 400 },
    );
  }
}
