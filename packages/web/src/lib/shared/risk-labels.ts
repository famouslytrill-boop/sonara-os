import type { RiskLevel } from "./types.ts";

export const riskLabels: Record<RiskLevel, string> = {
  low: "Low review load",
  medium: "Managed review load",
  high: "Human review required",
  critical: "Launch-blocking until reviewed"
};
