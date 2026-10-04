// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const MARKET_FOCUS = Object.freeze({
  asOf: "2026-10-04",
  status: "validation_required",
  parentPosition: "Run the work, create the proof, grow repeat business.",
  firstSegment: "Owner-operated cleaning and property-service businesses with 1–10 people.",
  geography: "Columbus, Ohio pilot; expand only after retained paid use.",
  capabilityPolicy: "Narrow onboarding, templates and acquisition; preserve all three studios and existing capabilities.",
  connectedOutcome: "Consented inquiry → quote → job → verified payment → approved media → approved follow-up → measured repeat booking.",
  companies: {
    business_builder: "Complete recurring service jobs and understand their contribution margin.",
    creator_studio: "Turn owned job media into approved, portable promotional and client-delivery packages.",
    growth_studio: "Connect consented follow-up to verified bookings and repeat revenue."
  },
  pilotTargets: { interviewedOperators: 15, payingPilots: 5, retainedPayingPilotsAt60Days: 4 },
  targetNotice: "These are proposed experiment thresholds, not measured results or market-share claims.",
  evidenceContract: "Opportunity metadata.focus_evidence: customer_commitment, source_reference, measured_at (ISO timestamp), cost_ceiling_cents, revenue_cents, variable_cost_cents. Owner uses owner_name; segment uses target_segment. All amounts describe the same currency and monthly period.",
  freshnessDays: 30,
  costBoundary: "Include provider, storage, egress, payment fees and variable support cost. Missing cost is unknown, never zero.",
  deliveryPriority: ["live quote/job/payment reconciliation", "approved media export", "consented repeat-booking measurement", "marketplace verified-payment delivery", "one real connector lifecycle"],
  sources: [
    "https://www.getjobber.com/features/",
    "https://www.getjobber.com/industries/cleaning-business-software/",
    "https://www.gohighlevel.com/pricing",
    "https://buffer.com/pricing",
    "https://www.descript.com/pricing"
  ]
});

// Advisory only: recorded evidence is not independently verified customer proof.
// Never changes opportunity state, billing, campaigns, entitlements or deployment.
function assessMarketFocus(opportunity = {}, now = Date.now()) {
  const evidence = opportunity?.metadata?.focus_evidence || {};
  const blockers = [];
  for (const [key, value] of Object.entries({
    target_segment: opportunity?.target_segment,
    owner_name: opportunity?.owner_name,
    customer_commitment: evidence.customer_commitment,
    source_reference: evidence.source_reference
  })) {
    if (typeof value !== "string" || !value.trim()) blockers.push(`${key}_required`);
  }
  const measuredAt = typeof evidence.measured_at === "string" && /^\d{4}-\d{2}-\d{2}T/.test(evidence.measured_at)
    ? Date.parse(evidence.measured_at) : NaN;
  if (!Number.isFinite(now)) throw new TypeError("A finite assessment time is required");
  if (!Number.isFinite(measuredAt) || measuredAt > now || now - measuredAt > MARKET_FOCUS.freshnessDays * 86400000) {
    blockers.push("fresh_dated_evidence_required");
  }
  const amount = (value) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
  if (!amount(evidence.cost_ceiling_cents)) blockers.push("cost_ceiling_required");
  let economics = null;
  if (!amount(evidence.revenue_cents) || evidence.revenue_cents === 0 || !amount(evidence.variable_cost_cents)) {
    blockers.push("same_period_revenue_and_cost_required");
  } else {
    economics = {
      contributionCents: evidence.revenue_cents - evidence.variable_cost_cents,
      contributionMarginPercent: Math.round(10000 * (1 - evidence.variable_cost_cents / evidence.revenue_cents)) / 100
    };
    if (economics.contributionCents <= 0) blockers.push("positive_contribution_required");
    if (amount(evidence.cost_ceiling_cents) && evidence.variable_cost_cents > evidence.cost_ceiling_cents) blockers.push("cost_ceiling_exceeded");
  }
  return { advisory: true, evidenceVerified: false, decision: blockers.length ? "validate" : "pilot_candidate", blockers, economics };
}

module.exports = { MARKET_FOCUS, assessMarketFocus };
