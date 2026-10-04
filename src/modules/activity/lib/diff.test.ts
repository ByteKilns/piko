import { describe, expect, it } from "vitest";

import { diffFields, type FieldSpec } from "./diff";
import { testFormatters } from "./test-formatters";

type Snapshot = { amount: number | string; note?: null | string; ownerMemberId: null | string };

const f = testFormatters();
const specs: FieldSpec<Snapshot>[] = [
  { format: f.money, key: "amount", label: "Amount" },
  { format: f.owner, key: "ownerMemberId", label: "For" },
  { format: f.text, key: "note", label: "Note" },
];

describe("diffFields", () => {
  it("reports only fields whose formatted value changed", () => {
    const changes = diffFields<Snapshot>(
      { amount: "1200.00", note: null, ownerMemberId: null },
      { amount: 1500, note: undefined, ownerMemberId: null },
      specs,
    );
    expect(changes).toEqual([{ field: "Amount", from: "RS 1,200", to: "RS 1,500" }]);
  });

  it("treats DB numeric strings, blank notes and null as equal to their parsed forms", () => {
    const changes = diffFields<Snapshot>(
      { amount: "1200.00", note: null, ownerMemberId: "m-1" },
      { amount: 1200, note: "   ", ownerMemberId: "m-1" },
      specs,
    );
    expect(changes).toEqual([]);
  });

  it("reports null ↔ value transitions", () => {
    const changes = diffFields<Snapshot>(
      { amount: 1, note: null, ownerMemberId: null },
      { amount: 1, note: "rent", ownerMemberId: "m-2" },
      specs,
    );
    expect(changes).toEqual([
      { field: "For", from: "Shared", to: "Ravi" },
      { field: "Note", from: null, to: "rent" },
    ]);
  });
});
