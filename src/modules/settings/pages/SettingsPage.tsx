import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { ACCENT_COLOR_COOKIE_NAME, isAccentColor } from "@/lib/accent-color-cookie";
import { logoutAction } from "@/lib/actions/auth";
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { isReleaseAdmin } from "@/lib/release-admin";
import { getCurrentMember } from "@/lib/session";
import { listReleases } from "@/modules/app-releases/api/app-releases";
import { AppReleasesSection } from "@/modules/app-releases/components/AppReleasesSection";
import { DateFormatSection } from "@/modules/settings/components/DateFormatSection";
import { PasswordSection } from "@/modules/settings/components/PasswordSection";
import { ProfilePictureSection } from "@/modules/settings/components/ProfilePictureSection";
import { ThemeSection } from "@/modules/settings/components/ThemeSection";

export async function SettingsPage() {
  const { householdId, userId } = await getCurrentMember();
  const [[user], cookieStore, dateFormat, canPublishReleases] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)),
    cookies(),
    getDateFormatPref(householdId),
    isReleaseAdmin(),
  ]);
  const releases = canPublishReleases ? await listReleases() : [];

  const accentCookie = cookieStore.get(ACCENT_COLOR_COOKIE_NAME)?.value ?? "";
  const accent = isAccentColor(accentCookie) ? accentCookie : "purple";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account and appearance</p>
      </div>

      <ThemeSection initialAccent={accent} />
      <DateFormatSection initialFormat={dateFormat} />
      <ProfilePictureSection initialImage={user?.image ?? null} name={user?.name ?? "?"} />
      <PasswordSection />
      {canPublishReleases && <AppReleasesSection releases={releases} />}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Account</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={logoutAction}>
            <Button type="submit" variant="destructive">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
