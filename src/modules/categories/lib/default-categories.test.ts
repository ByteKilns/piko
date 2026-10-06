import { describe, expect, it } from "vitest";

import { DEFAULT_CATEGORIES } from "./default-categories";

describe("DEFAULT_CATEGORIES", () => {
  it("has no duplicate name+group pairs", () => {
    const keys = DEFAULT_CATEGORIES.map((c) => `${c.group}::${c.name}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
