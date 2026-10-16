import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/db/client";
import { householdMembers } from "@/db/schema";
import { isDemoEmail } from "@/lib/demo-account";
import { verifyMobileToken } from "@/lib/mobile-auth";
import { VIEWING_AS_COOKIE_NAME } from "@/lib/viewing-as-cookie";

export type CurrentMember = {
  householdId: string;
  // A public demo's sandbox household (src/modules/demo).
  isDemo: boolean;
  memberId: string;
  name: string;
  userId: string;
};

async function findMemberForUser(userId: string): Promise<CurrentMember | null> {
  const member = await db.query.householdMembers.findFirst({
    where: eq(householdMembers.userId, userId),
    with: { household: true, user: true },
  });
  if (!member) return null;

  return {
    memberId: member.id,
    householdId: member.householdId,
    isDemo: member.household.demoExpiresAt !== null,
    userId: member.userId,
    name: member.user.name,
  };
}

async function getMemberForUser(userId: string): Promise<CurrentMember> {
  const member = await findMemberForUser(userId);
  if (!member) {
    throw new Error("User does not belong to a household");
  }
  return member;
}

export async function getCurrentMember(): Promise<CurrentMember> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const member = await findMemberForUser(session.user.id);
  if (member) return member;
  // A demo household is deleted after a day, taking its accounts with it. Its
  // visitor goes back to the demo page instead of an error page. The session
  // still carries the account's email, which is all this needs.
  if (isDemoEmail(session.user.email)) redirect("/demo?expired=1");
  throw new Error("User does not belong to a household");
}

export async function getCurrentMemberFromToken(token: string): Promise<CurrentMember | null> {
  const userId = await verifyMobileToken(token);
  if (!userId) return null;

  try {
    return await getMemberForUser(userId);
  } catch {
    return null;
  }
}

export async function getHouseholdMembers(householdId: string) {
  return db.query.householdMembers.findMany({
    where: eq(householdMembers.householdId, householdId),
    with: { user: true },
  });
}

// Resolves the member whose *perspective* the UI should render from: the
// "viewing as" cookie if it's set to a valid member of the caller's own
// household, otherwise the real logged-in member. This is presentation-only
// — it never changes which household's data is fetched, and it must never
// be used in place of getCurrentMember() when deriving householdId for a
// write (server actions continue to call getCurrentMember() directly for
// that, so a forged/stale cookie can't affect data isolation).
export async function getEffectiveMember(current?: CurrentMember): Promise<CurrentMember> {
  const resolvedCurrent = current ?? (await getCurrentMember());
  const cookieStore = await cookies();
  const viewingAsId = cookieStore.get(VIEWING_AS_COOKIE_NAME)?.value;

  if (!viewingAsId || viewingAsId === resolvedCurrent.memberId) {
    return resolvedCurrent;
  }

  const members = await getHouseholdMembers(resolvedCurrent.householdId);
  const target = members.find((m) => m.id === viewingAsId);
  if (!target) {
    // Stale/forged cookie value (e.g. a removed member) — fall back to the
    // real session rather than throwing.
    return resolvedCurrent;
  }

  return {
    memberId: target.id,
    householdId: resolvedCurrent.householdId,
    isDemo: resolvedCurrent.isDemo,
    userId: target.userId,
    name: target.user.name,
  };
}
