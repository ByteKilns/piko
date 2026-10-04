import { describe, expect, it } from "vitest";

import { revertFailureReason } from "./failure";

const pgError = (code: string) => Object.assign(new Error("duplicate key value"), { code });

describe("revertFailureReason", () => {
  it("explains a unique violation found down the cause chain", () => {
    const wrapped = new Error("Failed query", { cause: pgError("23505") });
    expect(revertFailureReason(wrapped)).toBe("Something added since takes its place — remove that first.");
  });

  it("explains a foreign-key violation", () => {
    expect(revertFailureReason(pgError("23503"))).toBe("Something it depended on no longer exists.");
  });

  it("returns null for anything else", () => {
    expect(revertFailureReason(new Error("Failed query", { cause: pgError("57P01") }))).toBeNull();
    expect(revertFailureReason(new Error("boom"))).toBeNull();
    expect(revertFailureReason("not an error")).toBeNull();
  });
});
