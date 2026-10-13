import type { ActivityFormatters } from "@/modules/activity/lib/activity-values";

// "Asoj 2083 · RS 4,200 left · Shared savings RS 2,000 · kept RS 2,200",
// or "Asoj 2083 · went over by RS 2,000, taken from the cushion".
export function settlementSummary(
  f: ActivityFormatters,
  settlement: { amount: number; month: number; year: number },
  parts: { amount: number; label: string }[],
): string {
  const period = f.period(settlement.year, settlement.month);
  if (settlement.amount < 0) return `${period} · went over by ${f.money(-settlement.amount)}, taken from the cushion`;
  if (settlement.amount === 0) return `${period} · came out even`;
  return [period, `${f.money(settlement.amount)} left`, ...parts.filter((p) => p.amount > 0).map((p) => `${p.label} ${f.money(p.amount)}`)].join(" · ");
}

// "Cushion · RS 20,000 · aiming for RS 30,000"
export function cushionSummary(f: ActivityFormatters, cushion: { balance: number; target: null | number }): string {
  return ["Cushion", f.money(cushion.balance), cushion.target === null ? null : `aiming for ${f.money(cushion.target)}`].filter(Boolean).join(" · ");
}
