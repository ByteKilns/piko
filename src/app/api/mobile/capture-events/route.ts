import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requireMobileAuth } from "@/lib/mobile-request";
import { listCaptureEventsForMember, saveCaptureEventForMember } from "@/modules/captures/api/captures";
import { captureEventSchema } from "@/modules/captures/schemas/capture.schema";

// The app's debug screen shows this many of the latest notifications.
const LIMIT = 50;

export async function GET(request: NextRequest) {
  const auth = await requireMobileAuth(request);
  if (auth instanceof NextResponse) return auth;

  const rows = await listCaptureEventsForMember(auth, LIMIT);
  return NextResponse.json({
    events: rows.map((e) => ({ key: e.key, postedAt: e.postedAt.toISOString(), source: e.source, text: e.text, title: e.title })),
  });
}

// One eSewa notification as the phone saw it (OTP digits already masked).
export async function POST(request: NextRequest) {
  const auth = await requireMobileAuth(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = captureEventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { message: "Invalid notification" } }, { status: 400 });
  }

  await saveCaptureEventForMember(auth, parsed.data);
  return NextResponse.json({ ok: true }, { status: 201 });
}
