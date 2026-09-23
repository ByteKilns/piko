import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Offline evaluation harness for the budget planner — NOT part of the test
// suite. Runs the real model over a handful of fixed masked fixtures, writes
// the raw answers to eval/planner/ for eyeballing/diffing, and prints the hard
// invariants (over-pool, unknown tokens). Run manually:
//
//   AI_BUDGET_PLANNER=live npm run eval:planner
//
// Requires GEMINI_API_KEY in .env.local. Model output is non-deterministic, so
// this is a review tool, not a gate.
import { config } from "dotenv";

config({ path: ".env.local" });

const fixtures: Record<string, unknown> = {
  "high-fixed": {
    categories: [
      { budgetType: "fixed", group: "Obligations", label: "EMI", ownerSplit: { shared: 1 }, spendShares: [0.28, 0.28, 0.28], token: "c1" },
      { budgetType: "flexible", group: "Household", label: "Groceries", ownerSplit: { m1: 0.6, m2: 0.4 }, spendShares: [0.09, 0.11, 0.1], token: "c2" },
      { budgetType: "flexible", group: "Lifestyle", label: "Entertainment", ownerSplit: { m1: 1 }, spendShares: [0.04, 0.07, 0.05], token: "c3" },
    ],
    confidence: "medium",
    envelope: { fixedShare: 0.55, flexibleShare: 0.35, savingsShare: 0.1 },
    incomeVariability: "medium",
    monthsUsed: 3,
    owners: ["m1", "m2", "shared"],
    version: 1,
  },
  "variable-income": {
    categories: [
      { budgetType: "flexible", group: "Household", label: "Groceries", ownerSplit: { shared: 1 }, spendShares: [0.12, 0.2, 0.15], token: "c1" },
      { budgetType: "flexible", group: "Lifestyle", label: "Dining Out", ownerSplit: { m1: 0.5, m2: 0.5 }, spendShares: [0.05, 0.12, 0.08], token: "c2" },
      { budgetType: "flexible", group: "Personal", label: null, ownerSplit: { m2: 1 }, spendShares: [0.03, 0.06, 0.04], token: "c3" },
    ],
    confidence: "low",
    envelope: { fixedShare: 0.3, flexibleShare: 0.6, savingsShare: 0.1 },
    incomeVariability: "high",
    monthsUsed: 3,
    owners: ["m1", "m2", "shared"],
    version: 1,
  },
};

async function main() {
  const { maskedFinancialContextSchema } = await import("../src/modules/budget-planner/schemas/masked-context.schema");
  const { plannerMode } = await import("../src/modules/budget-planner/lib/mode");
  const { runPlanner } = await import("../src/modules/budget-planner/api/planner-ai");

  if (plannerMode() !== "live") {
    console.error("Set AI_BUDGET_PLANNER=live (and GEMINI_API_KEY) to run the eval harness.");
    process.exit(1);
  }

  const outDir = path.resolve("eval", "planner");
  await mkdir(outDir, { recursive: true });

  for (const [name, fixture] of Object.entries(fixtures)) {
    const masked = maskedFinancialContextSchema.parse(fixture);
    const raw = await runPlanner(masked, "live");

    const validTokens = new Set(masked.categories.map((c) => c.token));
    const unknownTokens = raw.allocations.filter((a) => !validTokens.has(a.token)).map((a) => a.token);
    const totalShare = raw.allocations.reduce((s, a) => s + a.shareOfEnvelope, 0);
    const overPool = totalShare > masked.envelope.flexibleShare + 0.01;

    await writeFile(path.join(outDir, `${name}.json`), JSON.stringify(raw, null, 2), "utf8");

    console.log(`\n=== ${name} ===`);
    console.log(
      `allocations: ${raw.allocations.length} | total share: ${totalShare.toFixed(3)} | flexible pool: ${masked.envelope.flexibleShare}`,
    );
    console.log(`invariants: ${overPool ? "OVER POOL" : "ok"} | unknown tokens: ${unknownTokens.length ? unknownTokens.join(", ") : "none"}`);
    console.log(`summary: ${raw.summary}`);
  }

  console.log(`\nWrote raw answers to ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
