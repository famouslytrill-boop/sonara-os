import {
  defaultBusinessSnapshot,
  defaultInitiativeSnapshot,
  sonaraBusinessPrinciplesLayer,
  sonaraProductDoors,
} from "../../../config/sonara/businessPrinciples";
import type { SonaraBusinessSnapshot, SonaraFinalCompanyAudit, SonaraInitiativeSnapshot } from "../../../types/sonaraBusinessPrinciples";
import { evaluateAntiStupidityChecklist } from "./antiStupidityChecklist";
import { evaluateCircleOfCompetence } from "./circleOfCompetence";
import { evaluateFloatStrategy } from "./floatStrategy";
import { evaluateIncentiveAlignment } from "./incentiveAlignment";
import { evaluateMarginOfSafety } from "./marginOfSafety";
import { evaluateOwnerEarnings } from "./ownerEarnings";
import { weightedScore, statusFromScore } from "./scoring";
import { evaluateTrustReputationLedger } from "./trustReputationLedger";

export function runSonaraFinalCompanyAudit(
  business: SonaraBusinessSnapshot = defaultBusinessSnapshot,
  initiative: SonaraInitiativeSnapshot = defaultInitiativeSnapshot,
): SonaraFinalCompanyAudit {
  const results = [
    evaluateCircleOfCompetence(initiative),
    evaluateOwnerEarnings(business),
    evaluateMarginOfSafety(business, initiative),
    evaluateFloatStrategy(business),
    evaluateIncentiveAlignment(business),
    evaluateAntiStupidityChecklist(business, initiative),
    evaluateTrustReputationLedger(business, initiative),
  ];
  const oneOfOneCompanyScore = weightedScore(results.map((result) => ({
    label: result.name,
    score: result.score,
    weight: 1,
    rationale: result.summary,
  })));

  return {
    name: "SONARA Final Company Audit™",
    oneOfOneCompanyScore,
    status: statusFromScore(oneOfOneCompanyScore),
    productDoors: sonaraProductDoors.map((door) => door.name),
    internalSystems: [...sonaraBusinessPrinciplesLayer.adminSystems],
    hiddenOrDelayed: [...sonaraBusinessPrinciplesLayer.hiddenOrDelayed],
    skippedIntentionally: [...sonaraBusinessPrinciplesLayer.skippedIntentionally],
    results,
  };
}

export * from "./antiStupidityChecklist";
export * from "./circleOfCompetence";
export * from "./floatStrategy";
export * from "./incentiveAlignment";
export * from "./marginOfSafety";
export * from "./ownerEarnings";
export * from "./trustReputationLedger";
