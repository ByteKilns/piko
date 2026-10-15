import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requireMobileAuth } from "@/lib/mobile-request";
import { listCapturesAroundForMember } from "@/modules/captures/api/captures";
import { captureJson } from "@/modules/captures/lib/captures";

const MAX_SECONDS = 3600;

// Captures in any status near ?at= (an ISO time), within ?seconds=, for the
// app's duplicate check, so a rejected payment is never drafted again.
export async function GET(request: NextRequest) {
  const auth = await requireMobileAuth(request);
  if (auth instanceof NextResponse) return auth;

  const at = new Date(request.nextUrl.searchParams.get("at") ?? "");
  const seconds = Number(request.nextUrl.searchParams.get("seconds"));
  if (Number.isNaN(at.getTime()) || !Number.isInteger(seconds) || seconds < 0 || seconds > MAX_SECONDS) {
    return NextResponse.json({ error: { message: "Invalid time window" } }, { status: 400 });
  }

  const rows = await listCapturesAroundForMember(auth, at, seconds);
  return NextResponse.json({ captures: rows.map(captureJson) });
}
