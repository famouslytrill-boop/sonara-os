// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Source-only deterministic scenario planner. It neither authorizes nor executes
// bookings, external contact, social publication, paid media, or payments.
// All tenant, rights, consent, moderation and budget evidence must be verified
// by the respective authoritative server-side systems before any execution.

const VERSION = "2026-10-09.1";
const MIN_HISTORY = 30;
const GATES = Object.freeze([
  "server_verified_tenant_and_role",
  "verified_inventory_staffing_and_menu_terms",
  "creator_media_rights_captions_and_review",
  "growth_audience_consent_and_owner_campaign_approval",
  "moderated_public_projection_and_block_report_controls",
  "provider_grants_budget_and_signed_execution_receipt"
]);

function integer(value, key, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw Object.assign(new RangeError(`${key} must be an integer between ${min} and ${max}`), { code: "invalid_scenario_input", field: key });
  }
  return value;
}
function record(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw Object.assign(new TypeError(`${key} must be a record`), { code: "invalid_scenario_input", field: key });
  }
  return value;
}
function immutable(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(immutable));
  if (value && typeof value === "object") {
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, immutable(item)])));
  }
  return value;
}

function planRestaurantCreatorGrowthScenario(raw) {
  try {
    const input = record(raw, "scenario");
    const restaurant = record(input.restaurant, "restaurant");
    const creator = record(input.creator, "creator");
    const growth = record(input.growth, "growth");

    const price = integer(restaurant.menuPriceCents, "restaurant.menuPriceCents", 1, 10000000);
    const cost = integer(restaurant.variableCostCents, "restaurant.variableCostCents", 0, 10000000);
    const discount = integer(restaurant.offerDiscountCents, "restaurant.offerDiscountCents", 0, 10000000);
    const dailyCapacity = integer(restaurant.dailyCapacityOrders, "restaurant.dailyCapacityOrders", 0, 100000);
    const committed = integer(restaurant.committedDailyOrders, "restaurant.committedDailyOrders", 0, dailyCapacity);
    const days = integer(restaurant.campaignDays, "restaurant.campaignDays", 1, 90);

    const sourceSeconds = integer(creator.sourceVideoSeconds, "creator.sourceVideoSeconds", 0, 86400);
    const clipSeconds = integer(creator.targetClipSeconds, "creator.targetClipSeconds", 5, 600);
    const targetPosts = integer(creator.plannedPosts, "creator.plannedPosts", 0, 90);

    const visits = integer(growth.forecastQualifiedVisits, "growth.forecastQualifiedVisits", 0, 10000000);
    const budget = integer(growth.campaignBudgetCents, "growth.campaignBudgetCents", 0, 100000000);
    const historyVisits = growth.historicalQualifiedVisits;
    const historyOrders = growth.historicalAttributedOrders;
    if ((historyVisits == null) !== (historyOrders == null)) {
      throw Object.assign(new RangeError("Historical visits and attributed orders must both be present or absent"), { code: "incomplete_history", field: "growth" });
    }
    const hasHistory = historyVisits != null;
    if (hasHistory) {
      integer(historyVisits, "growth.historicalQualifiedVisits", 0, 10000000);
      integer(historyOrders, "growth.historicalAttributedOrders", 0, historyVisits);
    }

    const unitContributionCents = price - cost - discount;
    const spareDailyOrders = dailyCapacity - committed;
    const availableIncrementalOrders = spareDailyOrders * days;
    const estimatedClipCandidates = Math.floor(sourceSeconds / clipSeconds);
    const plannedClipCandidates = Math.min(targetPosts, estimatedClipCandidates);
    // An observed ratio is a user-supplied planning assumption, not a model
    // prediction or evidence that visitors cause attributable orders.
    const observedConversionRate = hasHistory && historyVisits >= MIN_HISTORY
      ? historyOrders / historyVisits : null;
    const estimatedDemandOrders = observedConversionRate === null
      ? null : Math.floor(visits * observedConversionRate);
    const projectedIncrementalOrders = estimatedDemandOrders === null
      ? null : Math.min(estimatedDemandOrders, availableIncrementalOrders);
    const estimatedNetContributionCents = projectedIncrementalOrders === null
      ? null : projectedIncrementalOrders * unitContributionCents - budget;
    const breakEvenOrders = unitContributionCents > 0 ? Math.ceil(budget / unitContributionCents) : null;
    const issues = [];
    if (spareDailyOrders === 0) issues.push("no_spare_service_capacity");
    if (unitContributionCents <= 0) issues.push("offer_has_nonpositive_unit_contribution");
    if (observedConversionRate === null) issues.push("attribution_history_insufficient");
    if (targetPosts > plannedClipCandidates) issues.push("insufficient_raw_media_for_requested_clips");
    if (breakEvenOrders !== null && breakEvenOrders > availableIncrementalOrders) issues.push("break_even_exceeds_spare_capacity");
    if (estimatedNetContributionCents !== null && estimatedNetContributionCents < 0) issues.push("scenario_contribution_below_spend");

    return immutable({
      ok: true, version: VERSION, status: "planning_only", sideEffectsExecuted: false,
      automatedPublishingAllowed: false, ownerApprovalStillRequired: true,
      formulas: {
        unitContribution: "menuPriceCents - variableCostCents - offerDiscountCents",
        spareCapacity: "(dailyCapacityOrders - committedDailyOrders) * campaignDays",
        observedRate: "historicalAttributedOrders / historicalQualifiedVisits when denominator >= 30",
        demand: "floor(forecastQualifiedVisits * observedRate)",
        incrementalOrders: "min(demand, spareCapacity)",
        scenarioNet: "incrementalOrders * unitContributionCents - campaignBudgetCents",
        breakEven: "ceil(campaignBudgetCents / unitContributionCents) when positive",
        rawClipUpperBound: "floor(sourceVideoSeconds / targetClipSeconds)"
      },
      results: {
        unitContributionCents, spareDailyOrders, availableIncrementalOrders,
        historicalSampleSize: hasHistory ? historyVisits : null,
        observedConversionRate, estimatedDemandOrders, projectedIncrementalOrders,
        estimatedNetContributionCents, breakEvenOrders,
        breakEvenWithinCapacity: breakEvenOrders === null ? null : breakEvenOrders <= availableIncrementalOrders,
        estimatedRawClipCandidates: estimatedClipCandidates, plannedClipCandidates
      },
      issues,
      stages: [
        { product: "business_builder", state: "draft_only", action: "Validate ingredient stock, labor, menu offer and service capacity" },
        { product: "creator_studio", state: "draft_only", action: "Prepare licensed video segments, captions and human-reviewed creative" },
        { product: "growth_studio", state: "draft_only", action: "Review consent, audience, campaign budget and attribution assumptions" },
        { product: "sonara_industries", state: "draft_only", action: "Request moderation approval before eligible public networking discovery" }
      ],
      requiredIndependentEvidence: GATES,
      disclosure: "Scenario estimates are not sales forecasts, publication approval, licensed media proof, or evidence that any customer was contacted. Media counts are theoretical upper bounds."
    });
  } catch (error) {
    if (error.code !== "invalid_scenario_input" && error.code !== "incomplete_history") throw error;
    return immutable({ ok: false, code: error.code, field: error.field, status: "planning_only", sideEffectsExecuted: false });
  }
}

module.exports = { VERSION, MIN_HISTORY, GATES, planRestaurantCreatorGrowthScenario };
