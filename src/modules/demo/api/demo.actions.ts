"use server";

import { redirect } from "next/navigation";

import { auth, signIn, signOut } from "@/auth";
import { isDemoEmail } from "@/lib/demo-account";
import { getCurrentMember } from "@/lib/session";

import { MAX_LIVE_DEMOS } from "../lib/demo-constants";
import { countLiveDemos, createDemoHousehold, deleteDemoHousehold, deleteExpiredDemos, hasHousehold } from "./demo";

export type DemoStartState = undefined | { busy: boolean };

// "Start the demo" on /demo. A GET never gets here, so link previews (which
// only fetch the page) can't create households.
export async function startDemoAction(): Promise<DemoStartState> {
  const session = await auth();
  const userId = session?.user?.id;
  // A visitor whose demo is still running goes back to it.
  if (userId && isDemoEmail(session.user?.email) && (await hasHousehold(userId))) redirect("/dashboard");

  const now = new Date();
  await deleteExpiredDemos(now);
  if ((await countLiveDemos(now)) >= MAX_LIVE_DEMOS) return { busy: true };

  const { email, password } = await createDemoHousehold(now);
  // Replaces any session already in this browser, including a real account's.
  await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  return undefined;
}

export async function exitDemoAction() {
  const member = await getCurrentMember();
  if (!member.isDemo) throw new Error("Only a demo can be exited");
  await deleteDemoHousehold(member.householdId);
  await signOut({ redirectTo: "/demo?bye=1" });
}
