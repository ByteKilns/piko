import { describe, expect, it } from "vitest";

import { activityHref, decodeCursor, encodeCursor, escapeLike } from "./activity-query";

const ID = "3f1c2a4e-9b7d-4c1a-8e2f-0a1b2c3d4e5f";

describe("activity cursor", () => {
  it("round-trips createdAt (to the ms) and id", () => {
    const createdAt = new Date("2026-10-04T09:20:00.123Z");
    expect(decodeCursor(encodeCursor({ createdAt, id: ID }))).toEqual({ createdAt, id: ID });
  });

  it("rejects malformed cursors", () => {
    expect(decodeCursor("nope")).toBeNull();
    expect(decodeCursor(`123_not-a-uuid`)).toBeNull();
    expect(decodeCursor(`${"9".repeat(20)}_${ID}`)).toBeNull();
  });
});

describe("escapeLike", () => {
  it("escapes LIKE wildcards and the escape character", () => {
    expect(escapeLike("100%")).toBe("100\\%");
    expect(escapeLike("a_b")).toBe("a\\_b");
    expect(escapeLike("c\\d")).toBe("c\\\\d");
  });
});

describe("activityHref", () => {
  it("omits empty params and orders keys", () => {
    expect(activityHref({})).toBe("/activity");
    expect(activityHref({ q: "rent", section: "expenses", to: undefined })).toBe("/activity?q=rent&section=expenses");
  });
});
