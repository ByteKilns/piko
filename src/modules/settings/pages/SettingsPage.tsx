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
import { listReleaseRuns, type ReleaseRun, releaseWorkflowConfigured } from "@/modules/app-releases/api/release-workflow";
import { AppReleasesSection } from "@/modules/app-releases/components/AppReleasesSection";
import { ReleaseWorkflowSection } from "@/modules/app-releases/components/ReleaseWorkflowSection";
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
  const workflow = canPublishReleases ? await releaseWorkflowState() : null;

  return (
    <div className="max-w-180">
      <header className="mb-8 flex flex-col gap-2">
        <h1 className="text-[34px] leading-none font-extrabold tracking-[-0.02em]">Settings</h1>
        <p className="text-[15px] text-n-700">Manage your account and appearance</p>
      </header>

      <div className="flex flex-col gap-9" data-tour="settings-appearance">
        <AppearanceSection />
        <DateFormatSection initialFormat={dateFormat} />
        <DemoLocked locked={isDemo}>
          <ProfilePictureSection initialImage={user?.image ?? null} name={user?.name ?? "?"} />
        </DemoLocked>
        <DemoLocked locked={isDemo}>
          <PasswordSection />
        </DemoLocked>
        {workflow && <ReleaseWorkflowSection {...workflow} />}
        {canPublishReleases && <AppReleasesSection releases={releases} />}

        <section data-tour="settings-account">
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

// The release section's first paint. GitHub being unreachable shows as a note
// in the section rather than breaking Settings.
async function releaseWorkflowState(): Promise<{ configured: boolean; initialError: null | string; initialRuns: ReleaseRun[] }> {
  if (!releaseWorkflowConfigured()) return { configured: false, initialError: null, initialRuns: [] };
  try {
    return { configured: true, initialError: null, initialRuns: await listReleaseRuns() };
  } catch (error) {
    return { configured: true, initialError: error instanceof Error ? error.message : "Couldn't reach GitHub", initialRuns: [] };
  }
}
