import { describe, expect, it } from "vitest";

import { activityActionEnum, activityEntityTypeEnum } from "@/db/schema";

import { ACTION_GROUPS, actionsForGroup, ACTIVITY_SECTIONS, entityTypesForSection, sectionForEntityType } from "./sections";

describe("activity sections", () => {
  it("puts every entity type in exactly one section", () => {
    for (const entityType of activityEntityTypeEnum.enumValues) {
      const owners = ACTIVITY_SECTIONS.filter((s) => (s.entityTypes as readonly string[]).includes(entityType));
      expect(owners, entityType).toHaveLength(1);
    }
  });

  it("puts every action in exactly one action group", () => {
    for (const action of activityActionEnum.enumValues) {
      const owners = ACTION_GROUPS.filter((g) => (g.actions as readonly string[]).includes(action));
      expect(owners, action).toHaveLength(1);
    }
  });

  it("maps sections and groups to their members", () => {
    expect(entityTypesForSection("savings")).toEqual(["savings_goal", "savings_contribution"]);
    expect(actionsForGroup("updated")).toEqual(["updated"]);
    expect(sectionForEntityType("loan_payment")).toBe("loans");
  });
});
