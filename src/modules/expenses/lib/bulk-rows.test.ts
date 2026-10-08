import { describe, expect, it } from "vitest";

import { type BulkRow, parseBulkRows } from "./bulk-rows";

function bulkRow(overrides: Partial<BulkRow>): BulkRow {
  return { amount: "", categoryId: "lunch", date: "2026-10-08", note: "", owner: "me", paidByMemberId: "me", ...overrides };
}

describe("parseBulkRows", () => {
  it("skips rows without an amount", () => {
    const { inputs } = parseBulkRows([bulkRow({ amount: "250" }), bulkRow({ amount: "" }), bulkRow({ amount: "0" })]);
    expect(inputs.map((input) => input.amount)).toEqual([250]);
  });

  it("turns the Shared choice into a shared expense and blank notes into none", () => {
    const { inputs } = parseBulkRows([bulkRow({ amount: "100", note: "  ", owner: "shared" }), bulkRow({ amount: "5", note: " tea " })]);
    expect(inputs).toEqual([
      { amount: 100, categoryId: "lunch", date: "2026-10-08", note: undefined, ownerMemberId: null, paidByMemberId: "me" },
      { amount: 5, categoryId: "lunch", date: "2026-10-08", note: "tea", ownerMemberId: "me", paidByMemberId: "me" },
    ]);
  });

  it("reports which rows have an amount but no category (1-based)", () => {
    const { missingCategoryRows } = parseBulkRows([bulkRow({ amount: "100" }), bulkRow({ amount: "40", categoryId: "" }), bulkRow({ categoryId: "" })]);
    expect(missingCategoryRows).toEqual([2]);
  });
});
