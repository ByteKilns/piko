import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requireMobileAuth } from "@/lib/mobile-request";
import { parseVoiceEntry } from "@/modules/voice-entry/api/voice-entry";

export async function POST(request: NextRequest) {
  const auth = await requireMobileAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const transcript = typeof body?.transcript === "string" ? body.transcript : "";

  if (!transcript.trim()) {
    return NextResponse.json({ error: { message: "transcript is required" } }, { status: 400 });
  }

  const result = await parseVoiceEntry(transcript, {
    householdId: auth.householdId,
    memberId: auth.memberId,
  });

  return NextResponse.json(result);
}
