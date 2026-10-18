import { afterEach, describe, expect, it, vi } from "vitest";

import { isReleaseToken } from "./release-token";

describe("isReleaseToken", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts the release token as a Bearer header", () => {
    vi.stubEnv("APP_RELEASE_TOKEN", "s3cret-token");
    expect(isReleaseToken("Bearer s3cret-token")).toBe(true);
  });

  it("rejects a wrong or missing token", () => {
    vi.stubEnv("APP_RELEASE_TOKEN", "s3cret-token");
    expect(isReleaseToken("Bearer s3cret-tokeN")).toBe(false);
    expect(isReleaseToken("Bearer ")).toBe(false);
    expect(isReleaseToken("s3cret-token")).toBe(false);
    expect(isReleaseToken(null)).toBe(false);
  });

  it("rejects everything when no token is set on the website", () => {
    vi.stubEnv("APP_RELEASE_TOKEN", "");
    expect(isReleaseToken("Bearer ")).toBe(false);
    expect(isReleaseToken("Bearer anything")).toBe(false);
  });
});
