import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requireMobileAuth } from "@/lib/mobile-request";
import { getHouseholdMembers } from "@/lib/session";
import { listCategories } from "@/modules/categories/api/categories";
import { noteCategoryTableForHousehold } from "@/modules/expenses/api/note-words";

export async function GET(request: NextRequest) {
  const auth = await requireMobileAuth(request);
  if (auth instanceof NextResponse) return auth;

  const [categories, members, noteWords] = await Promise.all([
    listCategories(auth.householdId),
    getHouseholdMembers(auth.householdId),
    noteCategoryTableForHousehold(auth.householdId),
  ]);

  return NextResponse.json({
    categories: categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon })),
    // Lets the app say "Me" and pick the signed-in person by default.
    currentMemberId: auth.memberId,
    members: members.map((m) => ({ id: m.id, name: m.user.name })),
    // Word → category id, for suggesting a category as a note is typed.
    noteWords,
  });
}
