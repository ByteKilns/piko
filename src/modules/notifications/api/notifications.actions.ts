"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { db } from "@/db/client";
import { notifications } from "@/db/schema";
import { NOTIFICATION_PREFS_COOKIE_NAME, type NotificationPreferences } from "@/lib/notification-preferences-cookie";
import { getCurrentMember } from "@/lib/session";

export async function markNotificationReadAction(id: string) {
  const { householdId } = await getCurrentMember();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.householdId, householdId)));
  revalidatePath("/notifications");
}

export async function markAllNotificationsReadAction() {
  const { householdId } = await getCurrentMember();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.householdId, householdId), isNull(notifications.readAt)));
  revalidatePath("/notifications");
}

export async function setNotificationPreferencesAction(preferences: NotificationPreferences) {
  const cookieStore = await cookies();
  cookieStore.set(NOTIFICATION_PREFS_COOKIE_NAME, JSON.stringify(preferences), {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  revalidatePath("/notifications");
}
