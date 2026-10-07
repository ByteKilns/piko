// Display helpers for amounts. The modernist design sets every figure as
// "Rs" + grouped rupees + smaller, lighter paisa, so the split lives here once.

export type AmountParts = { decimals: string; integer: string; negative: boolean };

const MINUS = "\u2212";

export function splitAmount(value: number): AmountParts {
  // Work in whole paisa so -0.004 rounds to 0 (not "-0.00") and NaN/Infinity
  // from bad data render as 0.00 instead of leaking into the UI.
  const paisa = Number.isFinite(value) ? Math.round(value * 100) : 0;
  const [integer, decimals] = (Math.abs(paisa) / 100).toFixed(2).split(".");
  return { decimals: `.${decimals}`, integer: Number(integer).toLocaleString("en-US"), negative: paisa < 0 };
}

export function formatMoney(value: number, { currency = true }: { currency?: boolean } = {}): string {
  const { decimals, integer, negative } = splitAmount(value);
  return `${currency ? "Rs " : ""}${negative ? MINUS : ""}${integer}${decimals}`;
}

// Keeps what someone types or pastes into an amount field to digits and one
// decimal point with at most two places; everything else is dropped.
export function sanitizeAmountInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  const fraction = cleaned.slice(dot + 1).replace(/\./g, "").slice(0, 2);
  return `${cleaned.slice(0, dot)}.${fraction}`;
}
