// Pure view logic for the Savings goals page: the "Emergency fund" starter's
// suggested target (three months of recent spending, rounded).

export function suggestedEmergencyTarget(monthlySpends: number[]): number {
  if (monthlySpends.length === 0) return 0;
  const average = monthlySpends.reduce((sum, value) => sum + value, 0) / monthlySpends.length;
  return Math.round(average * 3);
}
