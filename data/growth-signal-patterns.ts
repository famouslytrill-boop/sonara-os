import type { GrowthSignalCategory } from "../lib/growth/signal-taxonomy";

export type GrowthSignalPattern = {
  title: string;
  category: GrowthSignalCategory;
  productFit: string;
  recommendation: string;
};

export const growthSignalPatterns: GrowthSignalPattern[] = [
  {
    title: "Proof before promotion",
    category: "content_quality",
    productFit: "Business Builder and Growth Studio",
    recommendation: "Improve proof, offer clarity, and booking/payment readiness before launching campaigns.",
  },
  {
    title: "Permission-aware follow-up",
    category: "review_readiness",
    productFit: "Growth Studio",
    recommendation: "Draft follow-up only for customers with permission and route sends to owner approval.",
  },
  {
    title: "Useful format comparison",
    category: "format",
    productFit: "Creator Studio and Growth Studio",
    recommendation: "Compare educational posts, short demos, checklists, and customer-safe proof assets.",
  },
  {
    title: "Sustainable cadence",
    category: "consistency",
    productFit: "Growth Studio",
    recommendation: "Plan a realistic campaign cadence instead of pushing volume, spam, or fake urgency.",
  },
];
