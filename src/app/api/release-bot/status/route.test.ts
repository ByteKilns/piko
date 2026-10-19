import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getLatestRelease } from "@/modules/app-releases/api/app-releases";
import { migrationsPending } from "@/modules/app-releases/api/release-status";

import { GET } from "./route";

vi.mock("@/modules/app-releases/api/app-releases", () => ({ getLatestRelease: vi.fn() }));
vi.mock("@/modules/app-releases/api/release-status", () => ({ migrationsPending: vi.fn() }));

function get(authorization?: string) {
  return GET(
    new NextRequest("https://piko.test/api/release-bot/status", {
      headers: authorization ? { authorization } : {},
    }),
  );
}

describe("GET /api/release-bot/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("APP_RELEASE_TOKEN", "s3cret-token");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "abc123");
    vi.mocked(getLatestRelease).mockResolvedValue({ versionCode: 7 } as never);
    vi.mocked(migrationsPending).mockResolvedValue(false);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("says which commit is live, whether migrations are pending, and the live build number", async () => {
    const res = await get("Bearer s3cret-token");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ commit: "abc123", latestVersionCode: 7, migrationsPending: false });
  });

  it("reports pending migrations, no commit off Vercel, and no release yet", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");
    vi.mocked(migrationsPending).mockResolvedValue(true);
    vi.mocked(getLatestRelease).mockResolvedValue(null as never);

    expect(await (await get("Bearer s3cret-token")).json()).toEqual({
      commit: null,
      latestVersionCode: null,
      migrationsPending: true,
    });
  });

  it("refuses without the release token", async () => {
    expect((await get()).status).toBe(401);
    expect((await get("Bearer wrong")).status).toBe(401);
    expect(migrationsPending).not.toHaveBeenCalled();
  });
});
