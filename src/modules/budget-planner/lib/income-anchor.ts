import { clamp, coefficientOfVariation, lowerMedian, roundTo, shareOf } from "./stats";

export type IncomeAnchor = {
  amount: number;
  confidence: "high" | "low" | "medium";
  method: "median" | "override";
  monthsUsed: number;
};

export type IncomeVariability = { band: "high" | "low" | "medium" | "unknown"; cv: null | number };

export type SavingsTarget = { amount: number; method: "observed"; share: number };

// Never reserve more than this share of income as savings — beyond it the
// plan stops being a budget and starts being an austerity target.
const MAX_SAVINGS_SHARE = 0.6;

function confidenceFor(months: number): "high" | "low" | "medium" {
  if (months >= 5) return "high";
  if (months >= 3) return "medium";
  return "low";
}

// The envelope to plan against. Defaults to the lower median of recorded
// income — with variable income, planning against the average would commit you
// to a good month you may not repeat. An explicit override always wins.
export function incomeAnchor(incomeAmounts: number[], override?: number): IncomeAnchor {
  const recorded = incomeAmounts.filter((a) => a > 0);

  if (override !== undefined && override > 0) {
    return {
      amount: roundTo(override, 0),
      confidence: confidenceFor(recorded.length),
      method: "override",
      monthsUsed: recorded.length,
    };
  }

  if (recorded.length === 0) {
    return { amount: 0, confidence: "low", method: "median", monthsUsed: 0 };
  }

  return {
    amount: roundTo(lowerMedian(recorded), 0),
    confidence: confidenceFor(recorded.length),
    method: "median",
    monthsUsed: recorded.length,
  };
}

// Coarse band derived from the coefficient of variation. Fewer than two
// recorded months (or a non-positive mean) yields "unknown" rather than a
// misleading number.
export function incomeVariability(incomeAmounts: number[]): IncomeVariability {
  const recorded = incomeAmounts.filter((a) => a > 0);
  const cv = coefficientOfVariation(recorded);
  if (cv === null) return { band: "unknown", cv: null };

  const band = cv < 0.1 ? "low" : cv < 0.25 ? "medium" : "high";
  return { band, cv: roundTo(cv, 3) };
}

// How much to reserve before flexible spending, inferred from history:
// the lower median of (income − spend) over months that recorded income,
// expressed as a share of the anchor and clamped to [0, MAX_SAVINGS_SHARE].
// Overspending (negative saving) clamps to zero rather than a negative target.
export function savingsTarget(months: { income: number; spend: number }[], anchor: number): SavingsTarget {
  const recorded = months.filter((m) => m.income > 0);
  if (recorded.length === 0 || anchor <= 0) return { amount: 0, method: "observed", share: 0 };

  const medianSaving = lowerMedian(recorded.map((m) => m.income - m.spend));
  const share = clamp(shareOf(Math.max(0, medianSaving), anchor), 0, MAX_SAVINGS_SHARE);
  return { amount: roundTo(share * anchor, 0), method: "observed", share: roundTo(share, 3) };
}
