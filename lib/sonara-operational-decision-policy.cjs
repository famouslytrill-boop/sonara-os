// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Cross-suite read-only decision contracts. NO networking, authority grants,
// database writes, provider calls, notifications, hiring or autonomous action.
// Callers must derive evidence from authenticated tenant-scoped server reads;
// browser-supplied evidence is never trusted as authorization.
const MAX_ALTERNATIVES = 64;
const MAX_EVIDENCE_AGE_MS = 120000;
const DOMAINS = new Set(["restaurant", "field_service", "retail", "delivery", "media", "growth", "internal_operations"]);
const PROTECTED_DOMAINS = new Set(["employment", "housing", "credit", "insurance", "medical", "legal", "safety_critical"]);
const CHANNELS = new Set(["email", "sms", "push", "in_app", "voice"]);
const PURPOSES = new Set(["transactional", "support", "marketing", "staff"]);
const UTC_OFFSET = /(?:Z|[+-]\d{2}:\d{2})$/i;

function boundedInt(value, max) {
  return Number.isSafeInteger(value) && value >= 0 && value <= max;
}
function label(value) {
  return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(value);
}
function parseInstant(value) {
  if (typeof value !== "string" || !UTC_OFFSET.test(value)) return null;
  const n = Date.parse(value);
  return Number.isFinite(n) ? n : null;
}
function blocked(code) {
  return { ok: false, code, recommendationOnly: true, mayExecute: false };
}
function evidenceCurrent(organizationId, evidence, nowUtc) {
  if (!label(organizationId) || !evidence || evidence.organizationId !== organizationId
      || evidence.authorized !== true || evidence.complete !== true || evidence.truncated !== false
      || !label(evidence.sourceRevision)) return false;
  const at = parseInstant(evidence.readAtUtc), now = parseInstant(nowUtc);
  return at !== null && now !== null && at <= now + 10000 && now - at <= MAX_EVIDENCE_AGE_MS;
}
function normalizedLowerIsBetter(value, maximum) {
  if (maximum === 0) return value === 0 ? 10000 : 0;
  return Math.max(0, 10000 - Math.round(10000 * value / maximum));
}
function sortKey(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Score measured operational alternatives against explicit immutable bounds.
 * Scores are policy-dependent preference indexes, NOT expected profit,
 * statistical confidence, safety certification or probability of success.
 * Never rank consequential individual eligibility/hiring/credit decisions.
 */
function rankOperationalAlternatives({
  organizationId, domain, evidence, nowUtc, limits, weights, alternatives
} = {}) {
  if (PROTECTED_DOMAINS.has(domain)) return blocked("specialist_human_decision_required");
  if (!DOMAINS.has(domain)) return blocked("unsupported_decision_domain");
  if (!evidenceCurrent(organizationId, evidence, nowUtc)) return blocked("decision_evidence_unverified");
  if (!limits
      || !boundedInt(limits.maxCostCents, 1000000000)
      || !boundedInt(limits.maxDurationMinutes, 1000000)
      || !boundedInt(limits.maxRiskBasisPoints, 10000)
      || !boundedInt(limits.minQualityBasisPoints, 10000)) return blocked("invalid_decision_limits");
  if (!weights || !["cost", "duration", "risk", "quality"].every(k => boundedInt(weights[k], 10000))
      || weights.cost + weights.duration + weights.risk + weights.quality !== 10000) {
    return blocked("invalid_decision_weights");
  }
  if (!Array.isArray(alternatives) || alternatives.length < 1 || alternatives.length > MAX_ALTERNATIVES) {
    return blocked("invalid_alternatives");
  }
  const keys = new Set(), valid = [];
  for (const item of alternatives) {
    if (!item || !label(item.key) || keys.has(item.key) || item.organizationId !== organizationId
        || item.measurementVerified !== true || !label(item.measurementSource)
        || !item.metrics
        || !boundedInt(item.metrics.costCents, 1000000000)
        || !boundedInt(item.metrics.durationMinutes, 1000000)
        || !boundedInt(item.metrics.riskBasisPoints, 10000)
        || !boundedInt(item.metrics.qualityBasisPoints, 10000)) {
      return blocked("unverified_decision_alternative");
    }
    keys.add(item.key);
    valid.push(item);
  }
  const ranked = [], excluded = [];
  for (const item of valid) {
    const m = item.metrics, reasons = [];
    if (m.costCents > limits.maxCostCents) reasons.push("exceeds_cost_limit");
    if (m.durationMinutes > limits.maxDurationMinutes) reasons.push("exceeds_duration_limit");
    if (m.riskBasisPoints > limits.maxRiskBasisPoints) reasons.push("exceeds_risk_limit");
    if (m.qualityBasisPoints < limits.minQualityBasisPoints) reasons.push("below_quality_minimum");
    if (reasons.length) { excluded.push({ key: item.key, reasons }); continue; }
    const components = {
      cost: normalizedLowerIsBetter(m.costCents, limits.maxCostCents),
      duration: normalizedLowerIsBetter(m.durationMinutes, limits.maxDurationMinutes),
      risk: normalizedLowerIsBetter(m.riskBasisPoints, limits.maxRiskBasisPoints),
      quality: m.qualityBasisPoints
    };
    const scoreBasisPoints = Math.round(
      (components.cost * weights.cost
        + components.duration * weights.duration
        + components.risk * weights.risk
        + components.quality * weights.quality) / 10000
    );
    ranked.push({ key: item.key, scoreBasisPoints, components,
      measurementSource: item.measurementSource });
  }
  ranked.sort((a, b) => b.scoreBasisPoints - a.scoreBasisPoints || sortKey(a.key, b.key));
  excluded.sort((a, b) => sortKey(a.key, b.key));
  return {
    ok: true, domain, organizationId,
    status: ranked.length ? "recommendation_for_review" : "no_feasible_option",
    recommendedKey: ranked[0]?.key || null,
    ranked, excluded, sourceRevision: evidence.sourceRevision,
    recommendationOnly: true, mayExecute: false, ownerApprovalRequired: true,
    caveat: "A bounded, deterministic preference ranking over verified supplied measurements; not a prediction, authorization, safety clearance or execution receipt."
  };
}

function localMinute(nowMs, timeZone) {
  let parts;
  try {
    parts = new Intl.DateTimeFormat("en-GB", {
      timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(new Date(nowMs));
  } catch { return null; }
  const hour = Number(parts.find(p => p.type === "hour")?.value);
  const minute = Number(parts.find(p => p.type === "minute")?.value);
  return Number.isInteger(hour) && hour >= 0 && hour < 24
    && Number.isInteger(minute) && minute >= 0 && minute < 60
    ? hour * 60 + minute : null;
}
function withinQuietHours(minute, start, end) {
  // Equal boundaries mean no permissible delivery window: block all day.
  if (start === end) return true;
  return start < end ? minute >= start && minute < end
    : minute >= start || minute < end;
}

/**
 * Consent- and quiet-hours-aware message PREVIEW. It never sends. Owner
 * approval, provider scopes, replay protection and durable suppression
 * enforcement MUST be rechecked independently in the actual sender.
 */
function assessCommunication({
  organizationId, evidence, nowUtc, recipient, channel, purpose, intentKey,
  quietHours, cooldownMinutes, lastSentAtUtc
} = {}) {
  if (!evidenceCurrent(organizationId, evidence, nowUtc)) return blocked("communication_evidence_unverified");
  if (!CHANNELS.has(channel) || !PURPOSES.has(purpose) || !label(intentKey)) return blocked("invalid_message_intent");
  if (!recipient || !label(recipient.id) || recipient.organizationId !== organizationId
      || recipient.consentComplete !== true || recipient.suppressed !== false
      || !Array.isArray(recipient.grants) || recipient.grants.length > 100) {
    return blocked("recipient_consent_or_scope_unverified");
  }
  for (const grant of recipient.grants) {
    if (!grant || grant.organizationId !== organizationId || grant.recipientId !== recipient.id
      || !CHANNELS.has(grant.channel) || !PURPOSES.has(grant.purpose)
      || typeof grant.active !== "boolean" || typeof grant.verified !== "boolean") {
      return blocked("invalid_consent_evidence");
    }
  }
  // Conflicting or revoked records for this exact scope must deny; an older
  // active grant is not enough to override newer/contradictory suppression.
  const scopedGrants = recipient.grants.filter(g => g.channel === channel && g.purpose === purpose);
  if (!scopedGrants.length || scopedGrants.some(g => g.active !== true || g.verified !== true)) {
    return blocked("consent_not_granted");
  }
  if (!quietHours || typeof quietHours.timeZone !== "string"
      || !boundedInt(quietHours.startMinute, 1439)
      || !boundedInt(quietHours.endMinute, 1439)
      || !boundedInt(cooldownMinutes, 10080)) return blocked("communication_policy_unverified");
  const now = parseInstant(nowUtc);
  const minute = localMinute(now, quietHours.timeZone);
  if (minute === null) return blocked("invalid_recipient_time_zone");
  if (withinQuietHours(minute, quietHours.startMinute, quietHours.endMinute)) {
    return blocked("recipient_quiet_hours");
  }
  if (lastSentAtUtc !== undefined && lastSentAtUtc !== null) {
    const previous = parseInstant(lastSentAtUtc);
    if (previous === null || previous > now) return blocked("last_delivery_timestamp_unverified");
    if (now - previous < cooldownMinutes * 60000) return blocked("message_cooldown_active");
  }
  return {
    ok: true, status: "awaiting_owner_approval", organizationId, recipientId: recipient.id,
    channel, purpose, intentKey, sourceRevision: evidence.sourceRevision,
    consentVerifiedForRequestedScope: true, quietHoursChecked: true,
    recommendationOnly: true, mayExecute: false, ownerApprovalRequired: true,
    caveat: "This is a preview, not queued, accepted, sent or delivered. Recheck suppression, authorization, idempotency and provider rules on the send path."
  };
}

module.exports = { rankOperationalAlternatives, assessCommunication };
