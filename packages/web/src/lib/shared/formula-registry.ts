export interface FormulaRegistryReference {
  id: string;
  publicName: string;
  purpose: string;
}

export const formulaRegistryReferences: FormulaRegistryReference[] = [
  {
    id: "business-planning",
    publicName: "Business Planning",
    purpose: "Reference formulas for planning and review only."
  },
  {
    id: "risk-readiness",
    publicName: "Risk Readiness",
    purpose: "Reference formulas for controls, continuity, and launch review."
  },
  {
    id: "growth-planning",
    publicName: "Growth Planning",
    purpose: "Reference formulas for campaign and customer planning."
  }
];
