export type SonaraProductId = "business_builder" | "creator_studio" | "growth_studio";
export type LaunchTier = "q1_core" | "beta_gated" | "admin_only" | "research_scaffold" | "internal";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface SafetyRule {
  id: string;
  category: string;
  summary: string;
  blocked: boolean;
  requiresHumanReview: boolean;
}

export interface EngineRegistryItem {
  id: string;
  publicName: string;
  internalName: string;
  description: string;
  products: SonaraProductId[];
  launchTier: LaunchTier;
  riskLevel: RiskLevel;
  featureFlag: string;
  publicVisible: boolean;
  adminOnly: boolean;
  betaGated: boolean;
  requiredHumanReview: boolean;
  connectedEngines: string[];
  blockedScope: string[];
  safetyRules: string[];
}

export interface ModuleRegistryItem {
  id: string;
  publicName: string;
  description: string;
  productArea: string;
  routeHint: string;
  featureFlag: string;
  launchPriority: LaunchTier;
  publicVisible: boolean;
  dependencies: string[];
  safetyNotes: string[];
}

export interface InfrastructureModule {
  id: string;
  publicName: string;
  internalName: string;
  description: string;
  featureFlag: string;
  products: SonaraProductId[];
  launchTier: LaunchTier;
  riskLevel: RiskLevel;
  publicVisible: boolean;
  adminOnly: boolean;
  betaGated: boolean;
  requiredHumanReview: boolean;
  connectedEngines: string[];
  blockedScope: string[];
  safetyRules: string[];
}

export interface InfrastructureReport {
  ok: true;
  system: string;
  publicNames: string[];
  internalEngines: string[];
  enabled: boolean;
  safetyRules: string[];
  nextActions: string[];
}

export interface RegistryValidationResult {
  ok: boolean;
  issues: string[];
  counts: {
    engines: number;
    modules: number;
    flags: number;
    unsafeFlags: number;
  };
}

export interface SafetyGateDecision {
  allowed: boolean;
  blockedReasons: string[];
  requiresHumanReview: boolean;
}

export function createInfrastructureReport(
  module: InfrastructureModule,
  enabled = true
): InfrastructureReport {
  return {
    ok: true,
    system: module.publicName,
    publicNames: [module.publicName],
    internalEngines: [module.internalName],
    enabled,
    safetyRules: module.safetyRules,
    nextActions: module.requiredHumanReview
      ? ["Keep human review before production changes."]
      : ["Keep scaffold feature-gated until implementation is approved."]
  };
}
