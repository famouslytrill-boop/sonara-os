// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

const { activityEventDefinition } = require("./sonara-activity-taxonomy.cjs");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;
const DAY_MS = 86_400_000;
const MAX_ORGS = 10_000;
const MAX_EVENTS = 200_000;

function parseTimestamp(value) {
  if (typeof value !== "string") return null;
  const match = ISO_RE.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, zone] = match;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const hh = Number(hour);
  const mm = Number(minute);
  const ss = Number(second);
  if (m < 1 || m > 12 || hh > 23 || mm > 59 || ss > 59) return null;
  const calendar = new Date(Date.UTC(y, m - 1, d));
  if (calendar.getUTCFullYear() !== y || calendar.getUTCMonth() !== m - 1 || calendar.getUTCDate() !== d) return null;
  if (zone !== "Z") {
    const [zh, zm] = zone.slice(1).split(":").map(Number);
    if (zh > 14 || zm > 59 || (zh === 14 && zm !== 0)) return null;
  }
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) ? epoch : null;
}

function ratio(numerator, denominator) {
  return denominator === 0 ? null : Math.round((numerator / denominator) * 10_000) / 10_000;
}

function percentile(values, quantile) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(quantile * sorted.length) - 1)];
}

function failure(code) {
  return Object.freeze({ ok: false, code, report: null });
}

// Sources MUST come from a server-authorized, complete, non-truncated export.
// This deterministic evaluator cannot authenticate a caller, an event producer,
// Stripe, or the source's completeness by itself; do not expose it to clients.
function evaluateCustomerCohort({ organizations, activityEvents, from, to, asOf, source } = {}) {
  if (source?.organizationsComplete !== true || source?.activityEventsComplete !== true || source?.authorized !== true) {
    return failure("source_evidence_incomplete");
  }
  if (!Array.isArray(organizations) || !Array.isArray(activityEvents) ||
      organizations.length > MAX_ORGS || activityEvents.length > MAX_EVENTS) {
    return failure("source_shape_or_limit_invalid");
  }
  const startAt = parseTimestamp(from);
  const endAt = parseTimestamp(to);
  const observedAt = parseTimestamp(asOf);
  if (startAt === null || endAt === null || observedAt === null || startAt >= endAt || endAt > observedAt) {
    return failure("observation_window_invalid");
  }

  const roster = new Map();
  for (const organization of organizations) {
    const id = organization?.id;
    const createdAt = parseTimestamp(organization?.created_at);
    if (typeof id !== "string" || !UUID_RE.test(id) || createdAt === null ||
        typeof organization.eligible !== "boolean" || roster.has(id.toLowerCase())) {
      return failure("organization_evidence_invalid");
    }
    roster.set(id.toLowerCase(), {
      createdAt,
      eligible: organization.eligible && createdAt >= startAt && createdAt < endAt,
      events: []
    });
  }

  for (const event of activityEvents) {
    const id = event?.organization_id;
    if (typeof id !== "string" || !UUID_RE.test(id)) return failure("activity_scope_invalid");
    const organization = roster.get(id.toLowerCase());
    if (!organization || !organization.eligible) continue;
    const at = parseTimestamp(event.created_at);
    if (at === null || typeof event.event_type !== "string") return failure("activity_evidence_invalid");
    if (at < organization.createdAt || at > observedAt) continue;
    const type = event.event_type.trim().toLowerCase();
    const definition = activityEventDefinition(type);
    if (definition?.metricEligible) organization.events.push({ type, at, definition });
  }

  let eligibleOrganizations = 0;
  let activatedOrganizations = 0;
  let firstValueOrganizations = 0;
  let observedPurchaseEventOrganizations = 0;
  let matureActivatedOrganizations = 0;
  let day7RetainedOrganizations = 0;
  const firstValueSeconds = [];
  for (const organization of roster.values()) {
    if (!organization.eligible) continue;
    eligibleOrganizations += 1;
    const events = organization.events.sort((a, b) => a.at - b.at);
    const activationAt = events.find((event) => event.type === "account.organization_created")?.at;
    if (activationAt === undefined) continue;
    activatedOrganizations += 1;
    const qualifying = events.filter((event) => event.at >= activationAt);
    const firstValueAt = qualifying.find((event) => event.definition.firstValue === true)?.at;
    if (firstValueAt !== undefined) {
      firstValueOrganizations += 1;
      firstValueSeconds.push(Math.round((firstValueAt - activationAt) / 1000));
    }
    if (qualifying.some((event) => event.type === "billing.purchase_completed")) {
      observedPurchaseEventOrganizations += 1;
    }
    const day7Start = organization.createdAt + 7 * DAY_MS;
    const day7End = day7Start + DAY_MS;
    if (observedAt < day7End) continue; // Immature organizations never enter D7's denominator.
    matureActivatedOrganizations += 1;
    if (qualifying.some((event) => event.at >= day7Start && event.at < day7End &&
      event.definition.productArea !== "sonara_one" && event.definition.milestone !== "paid_conversion")) {
      day7RetainedOrganizations += 1;
    }
  }

  const report = {
    from: new Date(startAt).toISOString(),
    toExclusive: new Date(endAt).toISOString(),
    asOf: new Date(observedAt).toISOString(),
    eligibleOrganizations,
    activatedOrganizations,
    firstValueOrganizations,
    observedPurchaseEventOrganizations,
    matureActivatedOrganizations,
    day7RetainedOrganizations,
    activationRate: ratio(activatedOrganizations, eligibleOrganizations),
    firstValueRate: ratio(firstValueOrganizations, eligibleOrganizations),
    day7RetentionRate: ratio(day7RetainedOrganizations, matureActivatedOrganizations),
    medianTimeToFirstValueSeconds: percentile(firstValueSeconds, 0.5),
    p90TimeToFirstValueSeconds: percentile(firstValueSeconds, 0.9),
    verifiedPaidConversionRate: null,
    paidEvidenceStatus: "provider_reconciliation_required"
  };
  return Object.freeze({ ok: true, code: "measured_source_events_not_provider_proof", report: Object.freeze(report) });
}

module.exports = { evaluateCustomerCohort };
