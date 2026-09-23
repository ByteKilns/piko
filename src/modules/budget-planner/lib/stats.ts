// Small, pure numeric helpers shared by the planner's aggregation. No dates,
// no DB, no ambient state — everything here is a deterministic function of its
// arguments so the planner's math is reproducible in tests.

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

// Lower median: for an even count, the lower of the two middle values (not
// their average). Deliberately conservative — used for both spend history and
// the income anchor, where we'd rather under-plan than over-commit.
export function lowerMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? sorted[middle - 1] : sorted[middle];
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

// part/whole as a ratio, guarding division by zero and non-finite results.
export function shareOf(part: number, whole: number): number {
  if (whole <= 0) return 0;
  const share = part / whole;
  return Number.isFinite(share) ? share : 0;
}

export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = mean(values.map((v) => (v - avg) ** 2));
  return Math.sqrt(variance);
}

// Coefficient of variation (stddev / mean). Null when there aren't enough
// points or the mean isn't positive — callers render that as "unknown".
export function coefficientOfVariation(values: number[]): null | number {
  if (values.length < 2) return null;
  const avg = mean(values);
  if (avg <= 0) return null;
  return standardDeviation(values) / avg;
}
