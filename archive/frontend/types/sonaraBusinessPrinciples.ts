export type SonaraPrincipleId =
  | "circle-of-competence"
  | "owner-earnings"
  | "margin-of-safety"
  | "float-strategy"
  | "incentive-alignment"
  | "anti-stupidity-checklist"
  | "trust-reputation-ledger";

export type SonaraDecisionStatus = "clear" | "watch" | "hold";

export type SonaraDoorId = "song" | "release" | "artist-system" | "studio-workflow";

export interface SonaraScoreSignal {
  label: string;
  score: number;
  weight: number;
  rationale: string;
}

export interface SonaraPrincipleResult {
  id: SonaraPrincipleId;
  name: string;
  score: number;
  status: SonaraDecisionStatus;
  summary: string;
  signals: SonaraScoreSignal[];
  actions: string[];
}

export interface SonaraBusinessSnapshot {
  monthlyRevenue: number;
  directDeliveryCost: number;
  toolCost: number;
  supportHours: number;
  supportHourlyCost: number;
  reinvestmentReserveRate: number;
  prepaidCreatorBalance: number;
  committedDeliveryCost: number;
  pricingConfidence: number;
  trustIncidentCount: number;
  refundRate: number;
  qualityRewardShare: number;
  featureCreepRisk: number;
  teamIncentiveClarity: number;
}

export interface SonaraInitiativeSnapshot {
  name: string;
  door: SonaraDoorId;
  tags: string[];
  complexity: number;
  expectedCreatorValue: number;
  marginPressure: number;
  reputationRisk: number;
  requiresHeavyGeneration: boolean;
  requiresAutonomousPosting: boolean;
}

export interface SonaraFinalCompanyAudit {
  name: "SONARA Final Company Audit™";
  oneOfOneCompanyScore: number;
  status: SonaraDecisionStatus;
  productDoors: string[];
  internalSystems: string[];
  hiddenOrDelayed: string[];
  skippedIntentionally: string[];
  results: SonaraPrincipleResult[];
}
