import type { SonaraBusinessSnapshot, SonaraInitiativeSnapshot } from "../../types/sonaraBusinessPrinciples";
import { sonaraProjectWorkflow } from "./productArchitecture";

export const sonaraProductDoors = [
  {
    id: "song",
    name: "Build a Song",
    route: "/create",
    description: "Shape song identity, hooks, sound direction, and a clean path from idea to record.",
  },
  {
    id: "release",
    name: "Build a Release",
    route: "/export",
    description: "Package release plans, metadata prep, launch checks, and creator-ready assets.",
  },
  {
    id: "artist-system",
    name: "Build an Artist System",
    route: "/library",
    description: "Organize catalog identity, positioning, sound systems, brand assets, and artist workflow.",
  },
  {
    id: "studio-workflow",
    name: "Run a Studio Workflow",
    route: "/dashboard",
    description: "Coordinate sessions, quality gates, delivery discipline, and studio operating rhythm.",
  },
] as const;

export const sonaraBusinessPrinciplesLayer = {
  name: "SONARA Buffett Business Principles Layer™",
  internalName: "Business Principles Layer™",
  positioning:
    "Research-informed operating discipline adapted for SONARA™ as a music-tech company. These are internal strategy tools, not investment advice and not public product clutter.",
  publicBoundary: [
    "No investment advice.",
    "No income guarantees.",
    "No hit guarantees.",
    "No placement guarantees.",
    "No market dominance claims.",
    "No endorsements implied by investor or operator names.",
  ],
  systems: [
    "SONARA Circle of Competence™",
    "SONARA Owner Earnings Dashboard™",
    "SONARA Margin of Safety Engine™",
    "SONARA Float Strategy™",
    "SONARA Incentive Alignment Engine™",
    "SONARA Anti-Stupidity Checklist™",
    "SONARA Trust & Reputation Ledger™",
  ],
  adminSystems: [
    "Business Principles Layer™",
    "Economic Moat Scorecard™",
    "Autonomous Company OS™",
    "Company Operations Layer™",
    "Profitability & Differentiation Engine™",
    "Final Company Audit™",
  ],
  hiddenOrDelayed: [
    "Full Marketplace",
    "ERPNext",
    "Advanced EEG/MNE workflows",
    "Open-source AGI execution",
    "Fully autonomous public posting",
    "Unlimited heavy generation",
  ],
  skippedIntentionally: [
    "Profit guarantees",
    "Income guarantees",
    "Hit guarantees",
    "Placement guarantees",
    "Legal advice",
    "Tax advice",
    "Medical claims",
    "Fully unsupervised autonomy",
    "Unlimited heavy generation",
    "Overwhelming beginner UI",
    "Unauthorized voice/likeness cloning",
  ],
  phaseGateRoadmap: [
    { phase: "Now", gate: "Four product doors, release packaging, brand-safe operating discipline" },
    { phase: "Next", gate: "Supabase persistence, team roles, creator workflow history" },
    { phase: "Later", gate: "Marketplace and advanced automation after trust and margin gates pass" },
  ],
  exportNotice:
    "SONARA™ operating outputs are planning tools for creator workflows and business discipline. They are not financial, legal, tax, medical, or investment advice and do not guarantee income, placements, hits, or market outcomes.",
  projectWorkflow: sonaraProjectWorkflow.map((item) => item.label),
} as const;

export const defaultBusinessSnapshot: SonaraBusinessSnapshot = {
  monthlyRevenue: 12000,
  directDeliveryCost: 3200,
  toolCost: 950,
  supportHours: 34,
  supportHourlyCost: 42,
  reinvestmentReserveRate: 0.18,
  prepaidCreatorBalance: 4600,
  committedDeliveryCost: 2100,
  pricingConfidence: 82,
  trustIncidentCount: 0,
  refundRate: 0.025,
  qualityRewardShare: 0.22,
  featureCreepRisk: 28,
  teamIncentiveClarity: 86,
};

export const defaultInitiativeSnapshot: SonaraInitiativeSnapshot = {
  name: "SONARA™ launch infrastructure",
  door: "studio-workflow",
  tags: ["music technology", "release tools", "creator workflows", "digital assets"],
  complexity: 42,
  expectedCreatorValue: 88,
  marginPressure: 26,
  reputationRisk: 12,
  requiresHeavyGeneration: false,
  requiresAutonomousPosting: false,
};
