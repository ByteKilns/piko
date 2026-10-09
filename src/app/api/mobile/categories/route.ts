import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requireMobileAuth } from "@/lib/mobile-request";
import { getHouseholdMembers } from "@/lib/session";
import { listCategories } from "@/modules/categories/api/categories";

export async function GET(request: NextRequest) {
  const auth = await requireMobileAuth(request);
  if (auth instanceof NextResponse) return auth;

  const [categories, members] = await Promise.all([
    listCategories(auth.householdId),
    getHouseholdMembers(auth.householdId),
  ]);

  return NextResponse.json({
    categories: categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon })),
    members: members.map((m) => ({ id: m.id, name: m.user.name })),
  });
}
