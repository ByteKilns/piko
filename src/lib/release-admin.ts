import { auth } from "@/auth";

// Releases go out to every install of the app, so publishing is limited to an
// explicit allowlist rather than any household member.
export function isReleaseAdminEmail(email: null | string | undefined): boolean {
  if (!email) return false;
  const allowed = (process.env.APP_RELEASE_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

export async function isReleaseAdmin(): Promise<boolean> {
  const session = await auth();
  return isReleaseAdminEmail(session?.user?.email);
}

export async function requireReleaseAdmin(): Promise<void> {
  if (!(await isReleaseAdmin())) throw new Error("Not allowed to publish app releases");
}
