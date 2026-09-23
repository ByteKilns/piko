import { Type } from "@google/genai";

import { GEMINI_MODEL_ID, geminiClient } from "@/lib/gemini-client";

import { mockPlan } from "../lib/mock-plan";
import { type PlannerMode } from "../lib/mode";
import { buildPlanPrompt } from "../lib/plan-prompt";
import { type RawPlan, rawPlanSchema } from "../schemas/budget-plan.schema";
import type { MaskedFinancialContext } from "../schemas/masked-context.schema";

// The single place the app talks to a model. `mock` is deterministic and
// offline; `live` calls Gemini. The response schema pins `token`/`owner` to the
// exact enums we sent, so the model cannot invent a key we can't map back.
export async function runPlanner(masked: MaskedFinancialContext, mode: PlannerMode): Promise<RawPlan> {
  if (mode === "mock") return mockPlan(masked);

  const response = await geminiClient.models.generateContent({
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        properties: {
          allocations: {
            items: {
              properties: {
                owner: { enum: masked.owners, type: Type.STRING },
                rationale: { type: Type.STRING },
                shareOfEnvelope: { type: Type.NUMBER },
                token: { enum: masked.categories.map((c) => c.token), type: Type.STRING },
              },
              required: ["token", "owner", "shareOfEnvelope", "rationale"],
              type: Type.OBJECT,
            },
            type: Type.ARRAY,
          },
          summary: { type: Type.STRING },
        },
        required: ["summary", "allocations"],
        type: Type.OBJECT,
      },
    },
    contents: buildPlanPrompt(masked),
    model: GEMINI_MODEL_ID,
  });

  return rawPlanSchema.parse(JSON.parse(response.text ?? "{}"));
}
