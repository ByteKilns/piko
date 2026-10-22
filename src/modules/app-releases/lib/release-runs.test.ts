import { describe, expect, it } from "vitest";

import { runLabel } from "./release-runs";

const run = { conclusion: null, createdAt: "2026-10-22T08:00:00Z", id: 1, number: 1, status: "queued", url: "" };

describe("runLabel", () => {
  it.each([
    [{ status: "queued" }, "Waiting to start"],
    [{ status: "in_progress" }, "Running"],
    [{ conclusion: "success", status: "completed" }, "Published"],
    [{ conclusion: "cancelled", status: "completed" }, "Cancelled"],
    [{ conclusion: "failure", status: "completed" }, "Failed"],
  ])("%o reads %s", (fields, label) => {
    expect(runLabel({ ...run, ...fields }).label).toBe(label);
  });
});
