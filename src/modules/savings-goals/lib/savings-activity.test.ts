import { describe, expect, it } from "vitest";

import { testFormatters } from "@/modules/activity/lib/test-formatters";

import { contributionSummary, goalChanges, goalSummary, type SavingsGoalSnapshot } from "./savings-activity";

const f = testFormatters();
const goal: SavingsGoalSnapshot = {
  description: null,
  name: "Emergency fund",
  ownerMemberId: null,
  targetAmount: "500000.00",
  targetDate: null,
};

describe("savings activity", () => {
  it("summarises a goal, with the target only when it has one", () => {
    expect(goalSummary(f, goal)).toBe("Emergency fund · Shared · target RS 500,000");
    expect(goalSummary(f, { ...goal, targetAmount: null })).toBe("Emergency fund · Shared");
  });

  it("diffs goal fields", () => {
    expect(goalChanges(f, goal, { ...goal, name: "Rainy day", targetDate: "2027-01-01" })).toEqual([
      { field: "Name", from: "Emergency fund", to: "Rainy day" },
      { field: "Target date", from: null, to: "1 January 2027" },
    ]);
  });

  it("records a photo change without exposing the image data", () => {
    const withPhoto = { ...goal, image: "data:image/jpeg;base64,AAAA" };
    expect(goalChanges(f, goal, withPhoto)).toEqual([{ field: "Photo", from: null, to: "New photo" }]);
    expect(goalChanges(f, withPhoto, { ...withPhoto, image: "data:image/jpeg;base64,BBBB" })).toEqual([
      { field: "Photo", from: "Old photo", to: "New photo" },
    ]);
    expect(goalChanges(f, withPhoto, { ...goal, image: null })).toEqual([{ field: "Photo", from: "Old photo", to: null }]);
    expect(goalChanges(f, withPhoto, withPhoto)).toEqual([]);
  });

  it("summarises a contribution", () => {
    expect(contributionSummary(f, { amount: "5000.00", memberId: "m-1" }, "Emergency fund")).toBe(
      "RS 5,000 to Emergency fund · by Asha",
    );
  });
});
