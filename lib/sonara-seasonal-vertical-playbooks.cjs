// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";
const { gzipSync } = require("node:zlib");
const { createHash } = require("node:crypto");
const approvedSummaries = new WeakSet();

// OFFLINE planning primitives. No storage, provider calls, dispatch, payment,
// location tracking or agent execution authority is granted by this module.
const SEASONS = Object.freeze(["spring", "summer", "fall", "winter", "year_round"]);
const OPERATIONS = Object.freeze([
  "customer", "booking", "job", "estimate", "invoice", "inventory",
  "dispatch", "delivery", "proof", "schedule", "media", "training",
  "maintenance", "vendor", "quote", "compliance_review"
]);
const STATUSES = Object.freeze([
  "created", "scheduled", "dispatched", "completed",
  "delivered", "invoiced", "cancelled"
]);
const MANUAL_GATES = Object.freeze([
  "financial_action", "worker_classification", "regulated_sale",
  "food_safety", "public_content", "autonomous_dispatch"
]);

function vertical(key, label, seasons, operations, reviewGates, specificTasks) {
  if (!operations.every((operation) => OPERATIONS.includes(operation))) {
    throw new Error("invalid_internal_operation");
  }
  if (!reviewGates.every((gate) => MANUAL_GATES.includes(gate))) {
    throw new Error("invalid_internal_gate");
  }
  return Object.freeze({
    key, label,
    seasons: Object.freeze(seasons),
    operations: Object.freeze(operations),
    reviewGates: Object.freeze(reviewGates),
    specificTasks: Object.freeze(specificTasks)
  });
}

const VERTICALS = Object.freeze([
  vertical("bars", "Bars and beverage venues", ["year_round"], ["customer", "booking", "inventory", "invoice", "schedule", "compliance_review"], ["regulated_sale", "financial_action"], ["age and local licence checks", "inventory reconciliation", "staff scheduling"]),
  vertical("food_trucks", "Food trucks and mobile kitchens", ["spring", "summer", "fall", "winter"], ["customer", "booking", "inventory", "schedule", "delivery", "invoice", "compliance_review"], ["food_safety", "financial_action"], ["service-location planning", "prep and temperature logs", "menu availability"]),
  vertical("package_delivery", "Package delivery", ["year_round"], ["customer", "job", "dispatch", "delivery", "proof", "invoice"], ["autonomous_dispatch", "financial_action"], ["package acceptance", "chain-of-custody exception", "delivery proof"]),
  vertical("food_delivery", "Restaurant and food delivery", ["year_round"], ["customer", "job", "dispatch", "delivery", "proof", "invoice", "compliance_review"], ["food_safety", "autonomous_dispatch", "financial_action"], ["pickup and handoff", "temperature exception", "delivery confirmation"]),
  vertical("independent_contractors", "Independent service contractors", ["year_round"], ["customer", "estimate", "job", "schedule", "invoice", "proof", "compliance_review"], ["worker_classification", "financial_action"], ["scope acceptance", "time and materials", "contractor classification review"]),
  vertical("pet_services", "Pet care, grooming and boarding", ["year_round"], ["customer", "booking", "schedule", "job", "proof", "invoice"], ["financial_action"], ["owner instructions and consent", "appointment handoff", "incident escalation"]),
  vertical("art_sellers", "Independent artists and art sellers", ["year_round"], ["customer", "media", "inventory", "quote", "invoice", "delivery", "proof"], ["public_content", "financial_action"], ["rights and provenance evidence", "edition inventory", "packaging and shipping"]),
  vertical("construction", "Construction and field trades", ["spring", "summer", "fall", "winter"], ["customer", "estimate", "job", "schedule", "vendor", "inventory", "proof", "invoice", "compliance_review"], ["financial_action"], ["change orders", "site safety checklist", "inspection records"]),
  vertical("tow_trucks", "Towing and roadside service", ["year_round"], ["customer", "job", "dispatch", "delivery", "proof", "invoice", "compliance_review"], ["autonomous_dispatch", "financial_action"], ["vehicle authorization", "incident details", "handoff and impound policy"]),
  vertical("cleaning", "Janitorial and cleaning services", ["year_round"], ["customer", "booking", "job", "schedule", "inventory", "proof", "invoice"], ["financial_action"], ["site checklist", "supply planning", "quality and revisit notes"]),
  vertical("tutoring", "Tutors, courses and instruction", ["year_round"], ["customer", "booking", "schedule", "training", "invoice"], ["financial_action", "public_content"], ["lesson plans", "consent and age-appropriate access", "attendance and progress"]),
  vertical("winter_services", "Snow, ice and winter services", ["winter"], ["customer", "booking", "job", "dispatch", "inventory", "proof", "invoice"], ["autonomous_dispatch", "financial_action"], ["storm response queue", "salt stock", "site completion evidence"]),
  vertical("spring_services", "Spring cleanup and planting", ["spring"], ["customer", "estimate", "job", "schedule", "inventory", "invoice"], ["financial_action"], ["seasonal demand intake", "soil and planting schedule", "material allocation"]),
  vertical("summer_services", "Summer landscaping and events", ["summer"], ["customer", "booking", "job", "schedule", "inventory", "invoice"], ["financial_action"], ["crew heat-safety reminders", "event demand planning", "equipment utilization"]),
  vertical("fall_services", "Fall maintenance and cleanup", ["fall"], ["customer", "estimate", "job", "schedule", "inventory", "invoice"], ["financial_action"], ["leaf and gutter schedule", "weather contingencies", "pre-winter maintenance"]),
  vertical("year_round_services", "Year-round service companies", ["year_round"], ["customer", "booking", "job", "schedule", "invoice", "proof"], ["financial_action"], ["recurring service planning", "customer follow-up", "maintenance reminders"])
]);
const VERTICAL_KEYS = Object.freeze(VERTICALS.map((entry) => entry.key));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDENTIFIER = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_EVENTS = 500;
// This helper accepts an event envelope ONLY, never customer messages,
// addresses, geolocation, payment tokens or arbitrary provider payloads.
const EVENT_FIELDS = Object.freeze([
  "organizationId", "eventId", "recordId", "status", "revision"
]);
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

function whole(name, value, max) {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) {
    throw new Error("invalid_" + name);
  }
  return BigInt(value);
}
function safe(bigint) {
  if (bigint > MAX_SAFE || bigint < -MAX_SAFE) throw new Error("scenario_overflow");
  return Number(bigint);
}
function ceilDiv(a, b) {
  return (a + b - 1n) / b;
}

// Returns inert workflow templates. Caller must authorize and implement every
// sensitive operation separately; these strings are not run as instructions.
function getVerticalPlaybook(key, season = "year_round") {
  const definition = VERTICALS.find((entry) => entry.key === key);
  if (!definition) throw new Error("unknown_vertical");
  if (!SEASONS.includes(season)) throw new Error("unknown_season");
  return Object.freeze({
    classification: "planning_template_not_live_capability",
    key: definition.key,
    label: definition.label,
    season,
    seasonFit: definition.seasons.includes("year_round") ||
      definition.seasons.includes(season) ||
      (season === "year_round" &&
        ["spring", "summer", "fall", "winter"].every((part) => definition.seasons.includes(part))),
    operations: definition.operations,
    specificTasks: definition.specificTasks,
    requiresExplicitHumanReview: definition.reviewGates,
    activeProviderIntegrations: false,
    runtimeExecution: false
  });
}

// User-provided scenario inputs, never a weather, route or demand forecast.
// Basis points are integer multipliers: 10,000 = neutral (100%).
function planSeasonalCapacity(input = {}) {
  const demand = whole("baseline_jobs", input.baselineJobs, 1000000);
  const workers = whole("workers", input.workers, 100000);
  const minutesPerWorker = whole("minutes_per_worker", input.minutesPerWorker, 1440);
  const minutesPerJob = whole("minutes_per_job", input.minutesPerJob, 1440);
  const reserve = whole("reserve_basis_points", input.reserveBasisPoints === undefined ? 0 : input.reserveBasisPoints, 9000);
  const factor = whole("season_factor_basis_points", input.seasonFactorBasisPoints === undefined ? 10000 : input.seasonFactorBasisPoints, 30000);
  if (minutesPerJob === 0n || minutesPerWorker === 0n) throw new Error("invalid_zero_minutes");
  const scenarioJobs = ceilDiv(demand * factor, 10000n);
  const usableMinutes = (workers * minutesPerWorker * (10000n - reserve)) / 10000n;
  const jobsCapacity = usableMinutes / minutesPerJob;
  return Object.freeze({
    classification: "user_supplied_capacity_scenario_not_prediction",
    baselineJobs: safe(demand),
    seasonFactorBasisPoints: safe(factor),
    scenarioJobs: safe(scenarioJobs),
    capacityJobs: safe(jobsCapacity),
    feasibleJobs: safe(scenarioJobs < jobsCapacity ? scenarioJobs : jobsCapacity),
    unservedJobs: safe(scenarioJobs > jobsCapacity ? scenarioJobs - jobsCapacity : 0n),
    unusedCapacityJobs: safe(jobsCapacity > scenarioJobs ? jobsCapacity - scenarioJobs : 0n),
    usableCrewMinutes: safe(usableMinutes),
    weatherDataConnected: false
  });
}

// Exact integer-cents math; NEVER charges a card, adds taxes or issues invoices.
function calculateJobQuote({ lineItems, deliveryFeeCents = 0, deliveryCostCents = 0 } = {}) {
  if (!Array.isArray(lineItems) || lineItems.length === 0 || lineItems.length > 100) {
    throw new Error("invalid_line_items");
  }
  let sales = 0n;
  let costs = 0n;
  for (const row of lineItems) {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("invalid_line_item");
    const quantity = whole("quantity", row.quantity, 10000);
    const price = whole("unit_price_cents", row.unitPriceCents, 100000000000);
    const cost = whole("unit_cost_cents", row.unitCostCents, 100000000000);
    sales += quantity * price;
    costs += quantity * cost;
  }
  sales += whole("delivery_fee_cents", deliveryFeeCents, 100000000000);
  costs += whole("delivery_cost_cents", deliveryCostCents, 100000000000);
  const contribution = sales - costs;
  return Object.freeze({
    classification: "estimate_only_not_invoice_or_payment",
    revenueCents: safe(sales),
    variableCostCents: safe(costs),
    contributionCents: safe(contribution),
    contributionMarginBasisPoints: sales === 0n ? null : safe((contribution * 10000n) / sales),
    excluded: Object.freeze(["taxes", "tips", "fixed_overheads", "licensing", "worker_classification"]),
    customerActionExecuted: false
  });
}

// Exact-duplicate consolidation WITHOUT cross-tenant mixing or last-write-wins.
// This returns counts only; no addresses, event payloads or customer records.
function summarizeOperationalEvents({ organizationId, events } = {}) {
  if (typeof organizationId !== "string" || !UUID.test(organizationId)) {
    throw new Error("invalid_organization");
  }
  if (!Array.isArray(events) || events.length > MAX_EVENTS) throw new Error("invalid_event_batch");
  const unique = new Map();
  const statusCounts = Object.fromEntries(STATUSES.map((status) => [status, 0]));
  let exactDuplicates = 0;
  for (const event of events) {
    if (!event || typeof event !== "object" || Array.isArray(event)) throw new Error("invalid_event");
    if (Reflect.ownKeys(event).length !== EVENT_FIELDS.length ||
        !EVENT_FIELDS.every((field) => Object.hasOwn(event, field))) {
      throw new Error("invalid_event_shape");
    }
    if (event.organizationId !== organizationId) throw new Error("organization_mismatch");
    if (typeof event.eventId !== "string" || !IDENTIFIER.test(event.eventId) ||
        typeof event.recordId !== "string" || !IDENTIFIER.test(event.recordId) ||
        !STATUSES.includes(event.status) ||
        !Number.isSafeInteger(event.revision) || event.revision < 0) {
      throw new Error("invalid_event_fields");
    }
    const fingerprint = JSON.stringify([event.recordId, event.status, event.revision]);
    if (unique.has(event.eventId)) {
      if (unique.get(event.eventId) !== fingerprint) throw new Error("conflicting_event_identity");
      exactDuplicates += 1;
      continue;
    }
    unique.set(event.eventId, fingerprint);
    statusCounts[event.status] += 1;
  }
  const summary = Object.freeze({
    classification: "counts_only_no_mutation",
    organizationId,
    totalReceived: events.length,
    uniqueEvents: unique.size,
    exactDuplicates,
    statusCounts: Object.freeze(statusCounts),
    containsRawCustomerData: false
  });
  approvedSummaries.add(summary);
  return summary;
}

// Lossless gzip of a previously validated, counts-only receipt. The branded
// summary requirement prevents accidental compression of raw customer events.
// The returned data is a transport artifact, not encrypted or persisted.
function compressOperationalSummary(summary) {
  if (!summary || typeof summary !== "object" || !approvedSummaries.has(summary)) {
    throw new Error("unvalidated_operational_summary");
  }
  const input = Buffer.from(JSON.stringify({ version: 1, ...summary }), "utf8");
  const compressed = gzipSync(input, { level: 6 });
  return Object.freeze({
    format: "gzip+base64",
    originalBytes: input.length,
    compressedBytes: compressed.length,
    bytesSaved: input.length - compressed.length,
    data: compressed.toString("base64"),
    encrypted: false,
    sha256: createHash("sha256").update(input).digest("hex")
  });
}

module.exports = {
  VERTICALS, VERTICAL_KEYS, SEASONS, OPERATIONS, STATUSES,
  MAX_EVENTS, getVerticalPlaybook, planSeasonalCapacity,
  calculateJobQuote, summarizeOperationalEvents, compressOperationalSummary
};
