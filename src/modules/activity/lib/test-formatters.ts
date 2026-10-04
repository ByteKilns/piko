import { activityFormatters } from "./activity-values";

// Shared fixture for the per-module *-activity tests.
export function testFormatters() {
  return activityFormatters({
    categoryNames: new Map([
      ["cat-1", "Groceries"],
      ["cat-2", "Dining"],
    ]),
    dateFormat: "english",
    memberNames: new Map([
      ["m-1", "Asha"],
      ["m-2", "Ravi"],
    ]),
  });
}
