import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { isReleaseAdmin } from "@/lib/release-admin";
import { APK_UPLOAD_OPTIONS } from "@/modules/app-releases/api/app-releases";

// Issues short-lived tokens so the browser uploads the APK straight to Vercel
// Blob — the file is far over Vercel's 4.5 MB function body limit. The release
// row itself is written afterwards by publishReleaseAction.
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      onBeforeGenerateToken: async () => {
        if (!(await isReleaseAdmin())) throw new Error("Not allowed to publish app releases");
        return APK_UPLOAD_OPTIONS;
      },
      request,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : "Upload failed" } },
      { status: 400 },
    );
  }
}
