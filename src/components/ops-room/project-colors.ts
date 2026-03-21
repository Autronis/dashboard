// Consistent project colors across all Ops Room views
export const PROJECT_COLORS: Record<string, string> = {
  "Autronis Dashboard": "#23C6B7",
  "Sales Engine": "#f97316",
  "Investment Engine": "#10b981",
  "Case Study Generator": "#6366f1",
  "Learning Radar": "#eab308",
  "Autronis Website": "#ec4899",
  "Agent Office / Ops Room": "#8b5cf6",
  "Documenten": "#06b6d4",
  "Systeem": "#4ade80",
  "Alle projecten": "#f59e0b",
};

export function getProjectColor(project: string): string {
  return PROJECT_COLORS[project] ?? "#64748b";
}
