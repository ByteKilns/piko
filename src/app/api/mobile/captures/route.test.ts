import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { insertCaptureForMember } from "@/modules/captures/api/captures";

import { POST } from "./route";

vi.mock("@/lib/mobile-request", () => ({
  requireMobileAuth: vi.fn(async () => ({ householdId: "h1", memberId: "m1" })),
}));
vi.mock("@/modules/captures/api/captures", () => ({
  insertCaptureForMember: vi.fn(),
  listDraftCapturesForMember: vi.fn(),
}));

const row = {
  amount: "500.00",
  category: "Shopping",
  categoryConfidence: 0.8,
  counterparty: "Daraz",
  createdAt: new Date("2026-10-17T06:00:00.000Z"),
  direction: "debit" as const,
  eventId: "0|com.f1soft.esewa|7|null|10123@1792036530250",
  expenseId: null,
  householdId: "h1",
  id: "c1",
  kind: "payment",
  memberId: "m1",
  occurredAt: new Date("2026-10-17T05:55:30.250Z"),
  rawText: "You have paid Rs. 500 to Daraz",
  refId: null,
  source: "notification",
  status: "draft" as const,
  updatedAt: new Date("2026-10-17T06:00:00.000Z"),
};

const capture = {
  amount: 500,
  category: "Shopping",
  categoryConfidence: 0.8,
  counterparty: "Daraz",
  direction: "debit",
  eventId: row.eventId,
  kind: "payment",
  occurredAt: "2026-10-17T05:55:30.250Z",
  rawText: "You have paid Rs. 500 to Daraz",
  refId: null,
  source: "notification",
};

function post(body: unknown) {
  return POST(new NextRequest("https://piko.test/api/mobile/captures", { body: JSON.stringify(body), method: "POST" }));
}

describe("POST /api/mobile/captures", () => {
  beforeEach(() => vi.mocked(insertCaptureForMember).mockReset());

  it("stores a new capture with its notification id and says it was created", async () => {
    vi.mocked(insertCaptureForMember).mockResolvedValue({ created: true, row });

    const response = await post(capture);

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ capture: { id: "c1" }, created: true });
    expect(vi.mocked(insertCaptureForMember).mock.calls[0][1]).toMatchObject({ eventId: row.eventId });
  });

  it("returns the stored capture with created false when the notification was already stored", async () => {
    vi.mocked(insertCaptureForMember).mockResolvedValue({ created: false, row });

    const response = await post(capture);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ capture: { id: "c1" }, created: false });
  });

  it("still accepts a capture without a notification id, from older app versions", async () => {
    vi.mocked(insertCaptureForMember).mockResolvedValue({ created: true, row: { ...row, eventId: null } });
    // JSON leaves out undefined, as an older app sends no eventId at all.
    const response = await post({ ...capture, eventId: undefined });

    expect(response.status).toBe(201);
    expect(vi.mocked(insertCaptureForMember).mock.calls[0][1].eventId).toBeUndefined();
  });

  it("rejects an empty notification id", async () => {
    const response = await post({ ...capture, eventId: "" });

    expect(response.status).toBe(400);
    expect(insertCaptureForMember).not.toHaveBeenCalled();
  });
});
