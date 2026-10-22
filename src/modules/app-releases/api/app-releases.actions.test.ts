import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireReleaseAdmin } from "@/lib/release-admin";

import { publishRelease } from "./app-releases";
import { publishReleaseAction, runReleaseWorkflowAction } from "./app-releases.actions";
import { dispatchReleaseWorkflow } from "./release-workflow";

vi.mock("@/lib/release-admin", () => ({ requireReleaseAdmin: vi.fn() }));
vi.mock("./app-releases", () => ({ publishRelease: vi.fn() }));
vi.mock("./release-workflow", () => ({ dispatchReleaseWorkflow: vi.fn(), listReleaseRuns: vi.fn() }));

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

describe("runReleaseWorkflowAction", () => {
  beforeEach(() => {
    vi.mocked(requireReleaseAdmin).mockReset();
    vi.mocked(dispatchReleaseWorkflow).mockReset();
  });

  it("starts the workflow with the trimmed notes for a release admin", async () => {
    await expect(runReleaseWorkflowAction({ notes: "  Faster Home  " })).resolves.toEqual({ ok: true, value: null });
    expect(dispatchReleaseWorkflow).toHaveBeenCalledWith("Faster Home");
  });

  it("starts nothing for anyone else", async () => {
    vi.mocked(requireReleaseAdmin).mockRejectedValue(new Error("Not allowed to publish app releases"));

    await expect(runReleaseWorkflowAction({ notes: "x" })).rejects.toThrow("Not allowed");
    expect(dispatchReleaseWorkflow).not.toHaveBeenCalled();
  });

  it("asks for notes before starting", async () => {
    await expect(runReleaseWorkflowAction({ notes: "   " })).resolves.toEqual({ error: "Write what's new first", ok: false });
    expect(dispatchReleaseWorkflow).not.toHaveBeenCalled();
  });

  it("hands back GitHub's refusal as a message", async () => {
    vi.mocked(dispatchReleaseWorkflow).mockRejectedValue(new Error("GitHub refused the token (403)."));

    await expect(runReleaseWorkflowAction({ notes: "x" })).resolves.toEqual({ error: "GitHub refused the token (403).", ok: false });
  });
});
