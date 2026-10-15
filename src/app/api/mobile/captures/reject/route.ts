import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requireMobileAuth } from "@/lib/mobile-request";
import { rejectCaptureForMember } from "@/modules/captures/api/captures";
import { captureIdSchema } from "@/modules/captures/schemas/capture.schema";

// Hides a draft. It stays stored, so the same payment isn't drafted again.
export async function POST(request: NextRequest) {
  const auth = await requireMobileAuth(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = captureIdSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { message: "Invalid capture" } }, { status: 400 });
  }

  if (!(await rejectCaptureForMember(auth, parsed.data.id))) {
    return NextResponse.json({ error: { message: "This payment was already reviewed." } }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
