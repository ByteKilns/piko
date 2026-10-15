import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requireMobileAuth } from "@/lib/mobile-request";
import { listCaptureRulesForMember, saveCaptureRulesForMember } from "@/modules/captures/api/captures";
import { captureRulesSchema } from "@/modules/captures/schemas/capture.schema";

// The signed-in member's learned payee → category rules.
export async function GET(request: NextRequest) {
  const auth = await requireMobileAuth(request);
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({ rules: await listCaptureRulesForMember(auth) });
}

// Adds or updates rules; rules not sent are kept.
export async function POST(request: NextRequest) {
  const auth = await requireMobileAuth(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = captureRulesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { message: "Invalid rules" } }, { status: 400 });
  }

  await saveCaptureRulesForMember(auth, parsed.data.rules);
  return NextResponse.json({ ok: true });
}
