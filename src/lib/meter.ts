// Widths (in %) for the 4px progress meter. Past 100% the bar keeps its full
// length: the budgeted share is drawn in ink and the overspend in red, so the
// red part grows with the overspend.
export type MeterWidths = { fill: number; over: number };

export function meterWidths(ratio: number): MeterWidths {
  // Spending against a zero budget divides to Infinity — that's all overspend.
  if (ratio === Number.POSITIVE_INFINITY) return { fill: 0, over: 100 };
  if (!Number.isFinite(ratio) || ratio <= 0) return { fill: 0, over: 0 };
  if (ratio <= 1) return { fill: ratio * 100, over: 0 };
  return { fill: 100 / ratio, over: 100 - 100 / ratio };
}
