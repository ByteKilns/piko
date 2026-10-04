import { describe, expect, it } from "vitest";

import { describeActivity, sourceBadge } from "./activity-format";

describe("sourceBadge", () => {
  it("labels mobile and imported entries, not web ones", () => {
    expect(sourceBadge("mobile")).toBe("via mobile");
    expect(sourceBadge("import")).toBe("imported");
    expect(sourceBadge("web")).toBeNull();
  });
});

describe("describeActivity", () => {
  it("builds a verb phrase for the action and entity", () => {
    expect(describeActivity("created", "expense")).toBe("added an expense");
    expect(describeActivity("updated", "savings_goal")).toBe("edited a savings goal");
    expect(describeActivity("archived", "category")).toBe("archived a category");
    expect(describeActivity("paid", "recurring_expense")).toBe("marked a recurring bill paid");
  });

  it("describes an entry written by a revert", () => {
    expect(describeActivity("updated", "expense", true)).toBe("reverted a change to an expense");
  });
});
