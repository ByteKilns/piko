import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { publishRelease, ReleaseRejectedError } from "@/modules/app-releases/api/app-releases";

import { POST } from "./route";

vi.mock("@/modules/app-releases/api/app-releases", () => ({
  publishRelease: vi.fn(),
  ReleaseRejectedError: class ReleaseRejectedError extends Error {},
}));

const release = {
  apkUrl: "https://abc.private.blob.vercel-storage.com/app-releases/piko-1.4.2-x1y2.apk",
  notes: "Smoother loading.",
  sha256: "a".repeat(64),
  sizeBytes: 19_000_000,
  versionCode: 8,
  versionName: "1.4.2",
};

function post(body: unknown, authorization = "Bearer s3cret-token") {
  return POST(
    new NextRequest("https://piko.test/api/release-bot/publish", {
      body: JSON.stringify(body),
      headers: { authorization },
      method: "POST",
    }),
  );
}

describe("POST /api/release-bot/publish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("APP_RELEASE_TOKEN", "s3cret-token");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("publishes a release", async () => {
    vi.mocked(publishRelease).mockResolvedValue({ cleanupFailed: false });

    const res = await post(release);

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ cleanupFailed: false });
    expect(publishRelease).toHaveBeenCalledWith(release);
  });

  it("passes on why a release was refused", async () => {
    vi.mocked(publishRelease).mockRejectedValue(new ReleaseRejectedError("Build number must be higher than the current 8"));

    const res = await post(release);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: { message: "Build number must be higher than the current 8" } });
  });

  it("rejects an APK that isn't in our Blob storage", async () => {
    const res = await post({ ...release, apkUrl: "https://example.com/piko.apk" });

    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toBe("APK must be uploaded to Blob storage");
    expect(publishRelease).not.toHaveBeenCalled();
  });

  it("refuses without the release token", async () => {
    expect((await post(release, "Bearer wrong")).status).toBe(401);
    vi.stubEnv("APP_RELEASE_TOKEN", "");
    expect((await post(release, "Bearer ")).status).toBe(401);
    expect(publishRelease).not.toHaveBeenCalled();
  });
});
