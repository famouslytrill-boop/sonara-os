import { createTaskBreakdown } from "./task-breakdown.ts";
import type { FeatureSpec, ImplementationPlan } from "./types.ts";

export function buildImplementationPlan(spec: FeatureSpec): ImplementationPlan {
  return Object.freeze({
    specId: spec.id,
    title: spec.title,
    productArea: spec.productArea,
    phases: Object.freeze([
      "Confirm spec and non-goals",
      "Implement the smallest scoped slice",
      "Apply security and privacy requirements",
      "Run required tests and launch gates"
    ]),
    tasks: createTaskBreakdown(spec),
    acceptanceCriteria: spec.acceptanceCriteria,
    testRequirements: spec.testRequirements,
    launchGateRequirements: spec.launchGateRequirements
  });
}
