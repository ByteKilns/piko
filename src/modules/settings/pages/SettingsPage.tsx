import { eq } from "drizzle-orm";

import { SectionHeading } from "@/components/SectionHeading";
import { Button } from "@/components/ui/button";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { logoutAction } from "@/lib/actions/auth";
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { isReleaseAdmin } from "@/lib/release-admin";
import { getCurrentMember } from "@/lib/session";
import { listReleases } from "@/modules/app-releases/api/app-releases";
import { AppReleasesSection } from "@/modules/app-releases/components/AppReleasesSection";
import { DemoLocked } from "@/modules/demo/components/DemoLocked";
import { AppearanceSection } from "@/modules/settings/components/AppearanceSection";
import { DateFormatSection } from "@/modules/settings/components/DateFormatSection";
import { PasswordSection } from "@/modules/settings/components/PasswordSection";
import { ProfilePictureSection } from "@/modules/settings/components/ProfilePictureSection";
import { SettingsRow } from "@/modules/settings/components/SettingsRow";

export async function SettingsPage() {
  const { householdId, isDemo, userId } = await getCurrentMember();
  const [[user], dateFormat, canPublishReleases] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)),
    getDateFormatPref(householdId),
    isReleaseAdmin(),
  ]);
  const releases = canPublishReleases ? await listReleases() : [];

  return (
    <div className="max-w-180">
      <header className="mb-8 flex flex-col gap-2">
        <h1 className="text-[34px] leading-none font-extrabold tracking-[-0.02em]">Settings</h1>
        <p className="text-[15px] text-n-700">Manage your account and appearance</p>
      </header>

      <div className="flex flex-col gap-9">
        <AppearanceSection />
        <DateFormatSection initialFormat={dateFormat} />
        <DemoLocked locked={isDemo}>
          <ProfilePictureSection initialImage={user?.image ?? null} name={user?.name ?? "?"} />
        </DemoLocked>
        <DemoLocked locked={isDemo}>
          <PasswordSection />
        </DemoLocked>
        {canPublishReleases && <AppReleasesSection releases={releases} />}

        <section>
          <SectionHeading>Account</SectionHeading>
          <SettingsRow
            control={
              <form action={logoutAction}>
                <Button className="text-signal-ink" type="submit" variant="ghost">
                  Sign out
                </Button>
              </form>
            }
            description="Sign out of this device."
            label="Sign out"
          />
        </section>
      </div>
    </div>
  );
}
