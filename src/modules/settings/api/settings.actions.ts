"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { db } from "@/db/client";
import { households, users } from "@/db/schema";
import { ACCENT_COLOR_COOKIE_NAME, isAccentColor } from "@/lib/accent-color-cookie";
import { isDateFormat } from "@/lib/date-format-cookie";
import { getCurrentMember } from "@/lib/session";

import { type ChangePasswordInput, changePasswordSchema } from "../schemas/password.schema";
import { profileImageSchema } from "../schemas/profile-image.schema";

export async function changePasswordAction(input: ChangePasswordInput) {
  const { userId } = await getCurrentMember();
  const parsed = changePasswordSchema.parse(input);

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new Error("User not found");

  const valid = await bcrypt.compare(parsed.currentPassword, user.passwordHash);
  if (!valid) throw new Error("Current password is incorrect");

  const passwordHash = await bcrypt.hash(parsed.newPassword, 12);
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

export async function updateProfileImageAction(imageDataUrl: string) {
  const { userId } = await getCurrentMember();
  const parsed = profileImageSchema.parse(imageDataUrl);

  await db.update(users).set({ image: parsed }).where(eq(users.id, userId));
  revalidatePath("/", "layout");
}

export async function setAccentColorAction(color: string) {
  if (!isAccentColor(color)) throw new Error("Invalid accent color");

  const cookieStore = await cookies();
  cookieStore.set(ACCENT_COLOR_COOKIE_NAME, color, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  revalidatePath("/", "layout");
}

export async function setDateFormatAction(format: string) {
  if (!isDateFormat(format)) throw new Error("Invalid date format");

  const { householdId } = await getCurrentMember();
  await db.update(households).set({ dateFormat: format }).where(eq(households.id, householdId));
  revalidatePath("/", "layout");
}

export async function setPlannerEnabledAction(enabled: boolean) {
  const { householdId } = await getCurrentMember();
  await db.update(households).set({ plannerEnabled: enabled }).where(eq(households.id, householdId));
  revalidatePath("/", "layout");
}
