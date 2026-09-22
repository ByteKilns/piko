import { afterEach, describe, expect, it, vi } from "vitest";

import { isReleaseAdminEmail } from "./release-admin";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

describe("isReleaseAdminEmail", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is false when the allowlist is unset", () => {
    vi.stubEnv("APP_RELEASE_ADMIN_EMAILS", "");
    expect(isReleaseAdminEmail("a@example.com")).toBe(false);
  });

  it("is false for a missing email", () => {
    vi.stubEnv("APP_RELEASE_ADMIN_EMAILS", "a@example.com");
    expect(isReleaseAdminEmail(undefined)).toBe(false);
  });

  it("matches listed emails ignoring case and whitespace", () => {
    vi.stubEnv("APP_RELEASE_ADMIN_EMAILS", " a@example.com , B@Example.com ");
    expect(isReleaseAdminEmail("A@example.com")).toBe(true);
    expect(isReleaseAdminEmail("b@example.com")).toBe(true);
  });

  it("rejects emails not on the list", () => {
    vi.stubEnv("APP_RELEASE_ADMIN_EMAILS", "a@example.com");
    expect(isReleaseAdminEmail("c@example.com")).toBe(false);
  });
});
