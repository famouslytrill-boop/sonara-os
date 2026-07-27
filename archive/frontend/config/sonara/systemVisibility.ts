export const sonaraSystemVisibility = {
  publicDoors: [
    "Build a Song",
    "Build a Release",
    "Build an Artist System",
    "Run a Studio Workflow",
  ],
  adminOnly: [
    "Business Principles Layer™",
    "Economic Moat Scorecard™",
    "Profitability & Differentiation Engine™",
    "Final Company Audit™",
    "System Visibility Engine™",
  ],
  studioOnly: [
    "Launch Focus Mode™",
    "Feature Audit Engine",
    "Plan Profitability Scoring",
    "Differentiation Scoring",
    "Company Operations Layer™",
  ],
  researchOnly: [
    "Adaptive Artist Genome™",
    "Marketable Experience Layer™",
    "Creator State Intelligence™",
  ],
  delayed: [
    "Full Marketplace",
    "ERPNext",
    "Advanced EEG/MNE workflows",
    "Open-source AGI execution",
    "Fully autonomous public posting",
    "Unlimited heavy generation",
  ],
  dead: [
    "Profit guarantees",
    "Income guarantees",
    "Hit guarantees",
    "Placement guarantees",
    "Unauthorized voice/likeness cloning",
    "Overwhelming beginner UI",
  ],
} as const;

export type SonaraVisibilityBucket = keyof typeof sonaraSystemVisibility;
