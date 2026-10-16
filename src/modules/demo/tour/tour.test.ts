import { describe, expect, it } from "vitest";

import { markSeen, readTourMemory, shouldAutoRun, skipAll } from "./tour-memory";
import { tourForPath, TOURS } from "./tour-steps";
import { resolveSteps } from "./tour-targets";

describe("TOURS", () => {
  it("has the Home tour of eight steps and three-step page tours", () => {
    expect(TOURS.home).toHaveLength(8);
    expect(TOURS.budget).toHaveLength(3);
    expect(TOURS.savings).toHaveLength(3);
    expect(TOURS.dhuku).toHaveLength(3);
  });

  it("finds a page's tour from its path", () => {
    expect(tourForPath("/dashboard")).toBe("home");
    expect(tourForPath("/budget")).toBe("budget");
    expect(tourForPath("/expenses")).toBeNull();
  });
});

describe("tour memory", () => {
  it("starts fresh from nothing or from anything unreadable", () => {
    expect(readTourMemory(null)).toEqual({ seen: [], skippedAll: false });
    expect(readTourMemory("not json")).toEqual({ seen: [], skippedAll: false });
    expect(readTourMemory("42")).toEqual({ seen: [], skippedAll: false });
  });

  it("runs each tour by itself once", () => {
    const fresh = readTourMemory(null);
    expect(shouldAutoRun(fresh, "home")).toBe(true);
    const seen = markSeen(fresh, "home");
    expect(shouldAutoRun(seen, "home")).toBe(false);
    expect(shouldAutoRun(seen, "budget")).toBe(true);
    expect(markSeen(seen, "home")).toBe(seen);
  });

  it("runs none by itself once the visitor skips them all", () => {
    const skipped = skipAll(readTourMemory(null));
    expect(shouldAutoRun(skipped, "budget")).toBe(false);
    expect(readTourMemory(JSON.stringify(skipped))).toEqual(skipped);
  });
});

describe("resolveSteps", () => {
  const steps = [
    { body: "", targets: [], title: "Middle" },
    { body: "", targets: ["sidebar-button", "floating-button"], title: "Either" },
    { body: "", targets: ["not-here"], title: "Missing" },
  ];

  it("uses the first section on screen and drops steps with none", () => {
    const onScreen = new Set(["floating-button"]);
    const resolved = resolveSteps(steps, (target) => (onScreen.has(target) ? target : null));
    expect(resolved.map((r) => [r.step.title, r.element])).toEqual([
      ["Middle", null],
      ["Either", "floating-button"],
    ]);
  });
});
