import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireReleaseAdmin } from "@/lib/release-admin";

import { publishRelease } from "./app-releases";
import { publishReleaseAction } from "./app-releases.actions";

vi.mock("@/lib/release-admin", () => ({ requireReleaseAdmin: vi.fn() }));
vi.mock("./app-releases", () => ({ publishRelease: vi.fn() }));

const release = {
  apkUrl: "https://abc.private.blob.vercel-storage.com/app-releases/piko-1.4.2-x1y2.apk",
  notes: "Smoother loading.",
  sha256: "a".repeat(64),
  sizeBytes: 19_000_000,
  versionCode: 8,
  versionName: "1.4.2",
};

describe("publishReleaseAction", () => {
  beforeEach(() => {
    vi.mocked(requireReleaseAdmin).mockReset();
    vi.mocked(publishRelease).mockReset();
  });

  it("publishes for a signed-in release admin", async () => {
    vi.mocked(publishRelease).mockResolvedValue({ cleanupFailed: false });

    await expect(publishReleaseAction(release)).resolves.toEqual({ cleanupFailed: false });
    expect(publishRelease).toHaveBeenCalledWith(release);
  });

  it("publishes nothing for anyone else", async () => {
    vi.mocked(requireReleaseAdmin).mockRejectedValue(new Error("Not allowed to publish app releases"));

    await expect(publishReleaseAction(release)).rejects.toThrow("Not allowed");
    expect(publishRelease).not.toHaveBeenCalled();
  });
});
