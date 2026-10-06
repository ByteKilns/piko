import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import calendar from "@/lib/bs-calendar-data.json";
import { requireMobileAuth } from "@/lib/mobile-request";

// The BS month-length table the web converts with, so the app always agrees
// with the website and a calendar correction ships with a web deploy instead
// of a new APK. The app bundles a copy (mobile/assets/bs_calendar.json) as a
// fallback for when this can't be reached.
export async function GET(request: NextRequest) {
  const auth = await requireMobileAuth(request);
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json(calendar);
}
