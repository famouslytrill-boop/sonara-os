import { createInfrastructureReport, type InfrastructureModule } from "../shared/index.ts";

export const paymentLinksEngineModule: InfrastructureModule = {
  id: "payment-options.payment-links-engine",
  publicName: "Payment Links",
  internalName: "PaymentLinksEngine",
  description:
    "Safe typed scaffold for Payment Links; production behavior requires human review and explicit enablement.",
  featureFlag: "PAYMENT_OPTIONS_ENGINE_ENABLED",
  products: ["business_builder", "creator_studio", "growth_studio"],
  launchTier: "q1_core",
  riskLevel: "high",
  publicVisible: false,
  adminOnly: false,
  betaGated: false,
  requiredHumanReview: true,
  connectedEngines: [],
  blockedScope: ["No production data writes", "No destructive commands", "No hidden automation"],
  safetyRules: ["Feature-gated scaffold", "Human review required", "Placeholder status disclosed"]
};

export function createPaymentLinksEngineReport() {
  return createInfrastructureReport(paymentLinksEngineModule);
}
