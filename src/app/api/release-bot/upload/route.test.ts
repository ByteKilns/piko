import { handleUpload } from "@vercel/blob/client";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

vi.mock("@vercel/blob/client", () => ({ handleUpload: vi.fn() }));
vi.mock("@/modules/app-releases/api/app-releases", () => ({
  APK_UPLOAD_OPTIONS: { addRandomSuffix: true, allowedContentTypes: ["application/vnd.android.package-archive"], maximumSizeInBytes: 1 },
}));

const tokenRequest = { payload: { clientPayload: null, multipart: true, pathname: "app-releases/piko-1.4.2.apk" }, type: "blob.generate-client-token" };

function post(authorization = "Bearer s3cret-token") {
  return POST(
    new NextRequest("https://piko.test/api/release-bot/upload", {
      body: JSON.stringify(tokenRequest),
      headers: { authorization },
      method: "POST",
    }),
  );
}

describe("POST /api/release-bot/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("APP_RELEASE_TOKEN", "s3cret-token");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("hands out an upload token limited to APK files", async () => {
    vi.mocked(handleUpload).mockImplementation(async ({ onBeforeGenerateToken }) => {
      expect(await onBeforeGenerateToken("app-releases/piko-1.4.2.apk", null, true)).toEqual({
        addRandomSuffix: true,
        allowedContentTypes: ["application/vnd.android.package-archive"],
        maximumSizeInBytes: 1,
      });
      return { clientToken: "client-token", type: "blob.generate-client-token" };
    });

    const res = await post();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ clientToken: "client-token", type: "blob.generate-client-token" });
    expect(vi.mocked(handleUpload).mock.calls[0][0].body).toEqual(tokenRequest);
  });

  it("refuses without the release token", async () => {
    expect((await post("Bearer wrong")).status).toBe(401);
    expect(handleUpload).not.toHaveBeenCalled();
  });
});
