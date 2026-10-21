import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireMobileAuth } from "@/lib/mobile-request";
import { loadViewerPacing } from "@/modules/dashboard/api/home-pacing";

import { GET } from "./route";

vi.mock("@/lib/mobile-request", () => ({ requireMobileAuth: vi.fn() }));
vi.mock("@/modules/dashboard/api/home-pacing", () => ({ loadViewerPacing: vi.fn() }));

const pacing = {
  carryIn: 0,
  nextWeekAllowance: 490,
  nextWeekday: "Wednesday",
  over: false,
  overrunNote: null,
  safeToday: 78,
  weekLeft: 390,
  weeklyAllowance: 490,
};

function get() {
  return GET(new NextRequest("https://piko.test/api/mobile/pacing", { headers: { authorization: "Bearer jwt" } }));
}

describe("GET /api/mobile/pacing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireMobileAuth).mockResolvedValue({ householdId: "h1", memberId: "m1" } as never);
  });

  it("returns the signed-in member's Safe to spend", async () => {
    vi.mocked(loadViewerPacing).mockResolvedValue(pacing);

    const res = await get();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pacing });
    expect(loadViewerPacing).toHaveBeenCalledWith("h1", "m1");
  });

  it("returns null pacing without can-cut lines", async () => {
    vi.mocked(loadViewerPacing).mockResolvedValue(null);

    expect(await (await get()).json()).toEqual({ pacing: null });
  });

  it("refuses without a valid sign-in", async () => {
    vi.mocked(requireMobileAuth).mockResolvedValue(NextResponse.json({ error: { message: "Missing bearer token" } }, { status: 401 }));

    expect((await get()).status).toBe(401);
    expect(loadViewerPacing).not.toHaveBeenCalled();
  });
});
