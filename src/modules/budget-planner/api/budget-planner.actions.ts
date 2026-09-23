"use server";

import { getCurrentMember, getHouseholdMembers } from "@/lib/session";

import { buildPlan, type BuiltPlan } from "../lib/build-plan";
import { plannerMode } from "../lib/mode";
import { rawPlanSchema } from "../schemas/budget-plan.schema";
import { buildPlannerPreview } from "./budget-planner.queries";
import { runPlanner } from "./planner-ai";

export type GeneratePlanResult =
  | { ok: false; reason: "disabled" | "failed" | "no_history" | "no_income" }
  | { ok: true; plan: BuiltPlan };

// Generates a plan for review. Never persists anything — the user applies rows
// individually (via setBudgetItemAction), so a bad model response can't write
// itself into the budget.
export async function generateBudgetPlanAction(): Promise<GeneratePlanResult> {
  const mode = plannerMode();
  if (!mode) return { ok: false, reason: "disabled" };

  const { householdId } = await getCurrentMember();
  const preview = await buildPlannerPreview(householdId);
  if (!preview.ok) return { ok: false, reason: preview.reason };

  const members = await getHouseholdMembers(householdId);
  const ownerNameById = new Map(members.map((m) => [m.id, m.user.name]));

  try {
    const raw = rawPlanSchema.parse(await runPlanner(preview.masked, mode));
    return {
      ok: true,
      plan: buildPlan({
        categoryNameById: preview.categoryNameById,
        ownerNameById,
        profile: preview.profile,
        raw,
      }),
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
