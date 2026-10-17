import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requireMobileAuth } from "@/lib/mobile-request";
import { insertCaptureForMember, listDraftCapturesForMember } from "@/modules/captures/api/captures";
import { captureJson } from "@/modules/captures/lib/captures";
import { captureSchema } from "@/modules/captures/schemas/capture.schema";

// The signed-in member's eSewa drafts waiting for review, newest first.
export async function GET(request: NextRequest) {
  const auth = await requireMobileAuth(request);
  if (auth instanceof NextResponse) return auth;

  const rows = await listDraftCapturesForMember(auth);
  return NextResponse.json({ captures: rows.map(captureJson) });
}

// A transaction the app parsed from a notification. Money going out becomes a
// draft; money coming in is kept as skipped. A notification already stored
// comes back as it is, with `created: false`, so the app alerts only once.
export async function POST(request: NextRequest) {
  const auth = await requireMobileAuth(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = captureSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { message: "Invalid capture" } }, { status: 400 });
  }

  const { created, row } = await insertCaptureForMember(auth, parsed.data);
  return NextResponse.json({ capture: captureJson(row), created }, { status: created ? 201 : 200 });
}
