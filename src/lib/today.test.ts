import { describe, expect, it } from "vitest";

import { todayISO } from "@/lib/today";

describe("todayISO", () => {
  it("is already the next day in Nepal at 18:15 UTC", () => {
    expect(todayISO(new Date("2026-10-04T18:15:00Z"))).toBe("2026-10-05");
  });

  it("is still the same day just before Nepal midnight", () => {
    expect(todayISO(new Date("2026-10-04T18:14:00Z"))).toBe("2026-10-04");
  });
});
