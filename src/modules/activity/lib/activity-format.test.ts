import { describe, expect, it } from "vitest";

import { describeActivity } from "./activity-format";

describe("describeActivity", () => {
  it("builds a verb phrase for the action and entity", () => {
    expect(describeActivity("created", "expense")).toBe("added an expense");
    expect(describeActivity("updated", "savings_goal")).toBe("edited a savings goal");
    expect(describeActivity("archived", "category")).toBe("archived a category");
    expect(describeActivity("paid", "recurring_expense")).toBe("marked a recurring bill paid");
  });
});
