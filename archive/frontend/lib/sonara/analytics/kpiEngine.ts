import { areStripeSubscriptionsConfigured } from "../../../config/pricing";
import { isSupabaseConfigured } from "../../supabase";
import type { FounderKpiInput, FounderKpiSummary } from "./kpiTypes";

export function calculateFounderKpis(input: FounderKpiInput = {}): FounderKpiSummary {
  const stripeReady = areStripeSubscriptionsConfigured();
  const supabaseReady = isSupabaseConfigured();
  const hasUsage = Boolean(input.projectsCreated || input.exportsCreated);
  const openBlockers = [
    stripeReady ? "" : "Stripe products, price IDs, and webhook need manual setup.",
    supabaseReady ? "" : "Supabase URL, anon key, service role, migrations, and RLS need verification.",
    input.openBlockers ? `${input.openBlockers} manual launch blockers remain.` : "",
  ].filter(Boolean);

  return {
    launchReadinessScore: openBlockers.length ? 88 : 96,
    productReadinessScore: hasUsage ? 94 : 90,
    companyReadinessScore: 93,
    marketingReadinessScore: 88,
    profitReadinessScore: stripeReady ? 90 : 74,
    monetizationReadinessScore: stripeReady ? 92 : 76,
    storeReadinessScore: stripeReady ? 88 : 72,
    pwaReadinessScore: 92,
    stripeReadiness: stripeReady ? "configured" : "needs_manual_setup",
    supabaseReadiness: supabaseReady ? "configured" : "needs_manual_setup",
    vercelReadiness: "configured",
    googlePlayReadiness: "future",
    passkeyReadiness: "planned",
    safeAutonomyReadiness: 86,
    moatStrength: 89,
    openSourceStackReadiness: 92,
    vectorMemoryReadiness: "optional_ready",
    soundDiscoveryReadiness: "metadata_only",
    writingEngineReadiness: 91,
    openBlockers,
    nextActions: openBlockers.length
      ? openBlockers.slice(0, 5)
      : ["Run real checkout, save-project, and mobile PWA tests before paid launch."],
  };
}
