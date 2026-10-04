import { describe, expect, it } from "vitest";

import { parseActivityFilters } from "./activity-filter.schema";

const MEMBER = "3f1c2a4e-9b7d-4c1a-8e2f-0a1b2c3d4e5f";
const OTHER_HOUSEHOLD_MEMBER = "7a2b3c4d-1e2f-4a3b-9c4d-5e6f7a8b9c0d";
const members = new Set([MEMBER]);

describe("parseActivityFilters", () => {
  it("returns no filters for an empty query", () => {
    expect(parseActivityFilters({}, members)).toEqual({});
  });

  it("parses every valid filter", () => {
    const filters = parseActivityFilters(
      {
        action: "deleted",
        cursor: `1759569600123_${MEMBER}`,
        from: "2026-10-01",
        member: MEMBER,
        q: "  rent  ",
        section: "expenses",
        to: "2026-10-04",
      },
      members,
    );
    expect(filters).toEqual({
      action: "deleted",
      cursor: { createdAt: new Date(1759569600123), id: MEMBER },
      from: "2026-10-01",
      member: MEMBER,
      q: "rent",
      section: "expenses",
      to: "2026-10-04",
    });
  });

  it("drops invalid values field by field instead of failing", () => {
    const filters = parseActivityFilters(
      {
        action: "exploded",
        cursor: "garbage",
        from: "2026-02-31",
        member: OTHER_HOUSEHOLD_MEMBER,
        q: "   ",
        section: "nope",
        to: "yesterday",
      },
      members,
    );
    expect(filters).toEqual({});
  });

  it("drops dates and cursors outside the range Postgres can store", () => {
    // Chrome's date input passes through years like 0002 while a year is being typed.
    const filters = parseActivityFilters(
      { cursor: `999999999999999_${MEMBER}`, from: "0001-01-01", to: "0000-01-01" },
      members,
    );
    expect(filters).toEqual({});
  });

  it("uses the first value of repeated params and caps search length", () => {
    const filters = parseActivityFilters({ q: ["first", "second"], section: ["loans", "dhuku"] }, members);
    expect(filters).toEqual({ q: "first", section: "loans" });
    expect(parseActivityFilters({ q: "x".repeat(300) }, members).q).toHaveLength(100);
  });
});
