import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requireMobileAuth } from "@/lib/mobile-request";
import { loadViewerPacing } from "@/modules/dashboard/api/home-pacing";

// The phone's "Safe to spend today": the signed-in member's figure, the same
// one the website's Home shows. Null without can-cut budget lines.
export async function GET(request: NextRequest) {
  const auth = await requireMobileAuth(request);
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({ pacing: await loadViewerPacing(auth.householdId, auth.memberId) });
}
