import { describe, expect, it } from "vitest";

import { formatMonthRangeLabel } from "./date-format";

describe("formatMonthRangeLabel", () => {
  it("returns a plain AD month/year in english mode, ignoring BS boundaries entirely", () => {
    expect(formatMonthRangeLabel(2026, 8, "english")).toBe("August 2026");
  });

  it("shows the honest BS range when the AD month spans two BS months (the common case)", () => {
    // AD August 2026 runs Shrawan 16 -> Bhadra 15, 2083 (verified against
    // the published 2083 calendar) — every AD month in 2026 spans two BS
    // months, so this is the realistic case, not an edge case.
    expect(formatMonthRangeLabel(2026, 8, "nepali")).toBe("Shrawan 16 – Bhadra 15, 2083");
  });

  it("spans a BS year boundary correctly", () => {
    // AD April 2026 runs BS 2082-12-18 -> 2083-01-17, i.e. Chaitra 2082 into
    // Baisakh 2083 — the BS new year falls inside this AD month.
    expect(formatMonthRangeLabel(2026, 4, "nepali")).toBe("Chaitra 18, 2082 – Baisakh 17, 2083");
  });
});
