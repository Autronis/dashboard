import type { BudgetTier, BudgetType } from "./types";

export function classifyBudgetTier(
  type: BudgetType | undefined,
  min: number | undefined,
  max: number | undefined,
): BudgetTier | null {
  if (!type) return null;
  const value = min ?? max;
  if (value === undefined || !Number.isFinite(value) || value < 0) return null;

  if (type === "fixed") {
    if (value < 500) return "low";
    if (value < 5000) return "mid";
    return "premium";
  }
  // hourly
  if (value < 20) return "low";
  if (value <= 60) return "mid";
  return "premium";
}
