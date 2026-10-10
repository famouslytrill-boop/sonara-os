// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
"use strict";

// Pure, non-networked research checks. Neither a source identifier nor a
// complete transcription proves that its contents match the publisher's list.
// Publishing, provider access, decisions, and runtime activation are out of scope.

const SOURCES = Object.freeze({
  us_revenue_2026: Object.freeze({
    title: "Fortune 500 (United States, 2026)",
    url: "https://fortune.com/ranking/fortune500/",
    region: "US",
    metric: "annual_revenue",
    maxSourceAgeDays: 450,
    automatedIngestionAllowed: false,
    republicationRightsCleared: false
  }),
  europe_revenue_2026: Object.freeze({
    title: "Fortune 500 Europe (2026)",
    url: "https://fortune.com/europe/ranking/fortune500-europe/",
    region: "Europe",
    metric: "annual_revenue",
    maxSourceAgeDays: 450,
    automatedIngestionAllowed: false,
    republicationRightsCleared: false
  }),
  global_revenue_2026: Object.freeze({
    title: "Fortune Global 500 (2026)",
    url: "https://fortune.com/ranking/global500/",
    region: "Global",
    metric: "annual_revenue",
    maxSourceAgeDays: 450,
    automatedIngestionAllowed: false,
    republicationRightsCleared: false
  }),
  billionaires_realtime: Object.freeze({
    title: "Forbes Real-Time Billionaires",
    url: "https://www.forbes.com/real-time-billionaires/",
    region: "Global",
    metric: "estimated_net_worth",
    maxSourceAgeDays: 2,
    automatedIngestionAllowed: false,
    republicationRightsCleared: false
  })
});

const DIMENSION_WEIGHTS = Object.freeze({
  customerValue: 25,
  sharedReuse: 20,
  sourceQuality: 20,
  deliveryFeasibility: 15,
  costControl: 10,
  safetyReadiness: 10
});
const DIMENSIONS = Object.freeze(Object.keys(DIMENSION_WEIGHTS));
const SENSITIVE_TAGS = new Set([
  "money_movement", "securities_advice", "legal_advice",
  "health_decision", "security_change", "customer_messaging",
  "external_provider_write", "destructive_change", "tax_advice",
  "financial_advice", "lending_decision", "banking", "securities_trade",
  "identity_change", "personal_data_export", "permissions_change",
  "customer_campaign", "legal_policy_publishing", "copyright_distribution",
  "employee_decision", "public_disclosure", "recording_consent"
]);
// This is an intake taxonomy, not a runtime authorization policy. In particular,
// unknown risk classes fail closed instead of being treated as low risk.
const SAFE_RESEARCH_TAGS = new Set([
  "read_only", "simulation_only", "local_computation", "no_personal_data",
  "licensed_content", "business_operations"
]);

function dayNumber(value, field) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError(field + " must be YYYY-MM-DD");
  }
  const ms = Date.parse(value + "T00:00:00.000Z");
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) {
    throw new TypeError(field + " must be a real calendar date");
  }
  return ms / 86400000;
}

function isNonemptyText(s) {
  return typeof s === "string" && s.trim().length > 0 && s.trim().length <= 200;
}

function isHttpsUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !!u.hostname && !u.username && !u.password;
  } catch {
    return false;
  }
}

function inspectRanking({ sourceId, records, observedAt, checkedAt, targetSize = 50 } = {}) {
  const source = SOURCES[sourceId];
  if (!Object.prototype.hasOwnProperty.call(SOURCES, sourceId || "")) {
    throw new TypeError("Unknown ranked source");
  }
  if (!Array.isArray(records) || records.length > 5000) {
    throw new TypeError("records must be an array of at most 5000 entries");
  }
  if (!Number.isInteger(targetSize) || targetSize < 1 || targetSize > 50) {
    throw new RangeError("targetSize must be between 1 and 50");
  }
  const observed = dayNumber(observedAt, "observedAt");
  const checked = dayNumber(checkedAt, "checkedAt");
  if (observed > checked) throw new RangeError("Source observation is in the future");
  const ageDays = checked - observed;
  const stale = ageDays > source.maxSourceAgeDays;
  const accepted = [];
  const rejected = [];
  const ranks = new Set();
  const names = new Set();

  for (let index = 0; index < records.length; index += 1) {
    const row = records[index];
    if (!row || typeof row !== "object" || Array.isArray(row)
      || !Number.isInteger(row.rank) || row.rank < 1 || row.rank > 500
      || !isNonemptyText(row.name) || row.sourceUrl !== source.url) {
      rejected.push(Object.freeze({ inputIndex: index, reason: "invalid_rank_name_or_source" }));
      continue;
    }
    const nameKey = row.name.trim().normalize("NFKC").toLocaleLowerCase("en-US");
    if (ranks.has(row.rank) || names.has(nameKey)) {
      rejected.push(Object.freeze({ inputIndex: index, reason: "duplicate_rank_or_entity" }));
      continue;
    }
    ranks.add(row.rank);
    names.add(nameKey);
    accepted.push(Object.freeze({ rank: row.rank, name: row.name.trim(), sourceUrl: source.url }));
  }
  accepted.sort((a, b) => a.rank - b.rank);
  const visible = accepted.filter((item) => item.rank <= targetSize);
  const missingRanks = [];
  for (let rank = 1; rank <= targetSize; rank += 1) {
    if (!ranks.has(rank)) missingRanks.push(rank);
  }

  const status = stale ? "stale_source"
    : rejected.length ? "invalid_transcription"
      : missingRanks.length ? "incomplete_transcription"
        : "source_transcription_needs_audit";
  return Object.freeze({
    sourceId, source, targetSize, observedAt, checkedAt, ageDays, status,
    count: visible.length,
    missingRanks: Object.freeze(missingRanks),
    rejected: Object.freeze(rejected),
    entries: Object.freeze(visible),
    independentlyVerified: false,
    republicationRightsCleared: false,
    automatedIngestionAllowed: false,
    canPublishAsOfficialTop50: false,
    nextGate: stale
      ? "Refresh against the live publisher before use."
      : "Independently compare each rank, identity and edition with the publisher; record an editorial approval outside this module."
  });
}

function scoreCapabilityIdeas(ideas) {
  if (!Array.isArray(ideas) || ideas.length > 250) {
    throw new TypeError("ideas must be an array of at most 250");
  }
  const seen = new Set();
  const result = ideas.map((idea) => {
    if (!idea || !isNonemptyText(idea.id) || !isNonemptyText(idea.title) || seen.has(idea.id)) {
      throw new TypeError("Every idea needs a unique id and title");
    }
    seen.add(idea.id);
    for (const dimension of DIMENSIONS) {
      if (!Number.isInteger(idea[dimension]) || idea[dimension] < 0 || idea[dimension] > 5) {
        throw new RangeError(dimension + " must be an integer from 0 to 5");
      }
    }
    const score100 = DIMENSIONS.reduce(
      (sum, dimension) => sum + idea[dimension] * DIMENSION_WEIGHTS[dimension] / 5, 0
    );
    const missing = [];
    if (!isNonemptyText(idea.owner)) missing.push("accountable_owner");
    if (!Number.isFinite(idea.costCeilingUsd) || idea.costCeilingUsd < 0) missing.push("cost_ceiling");
    if (!Number.isInteger(idea.customerCommitments) || idea.customerCommitments < 1) missing.push("customer_commitment");
    if (!Array.isArray(idea.evidenceUrls) || idea.evidenceUrls.length < 1
        || idea.evidenceUrls.length > 15 || !idea.evidenceUrls.every(isHttpsUrl)) missing.push("traceable_evidence");
    const validRiskTags = Array.isArray(idea.riskTags)
      && idea.riskTags.length <= 16 && idea.riskTags.every(isNonemptyText)
      && new Set(idea.riskTags).size === idea.riskTags.length;
    if (!validRiskTags) missing.push("risk_classification");
    const unrecognizedRiskTags = validRiskTags
      ? idea.riskTags.filter((tag) => !SENSITIVE_TAGS.has(tag) && !SAFE_RESEARCH_TAGS.has(tag))
      : [];
    const sensitive = validRiskTags && idea.riskTags.some((tag) => SENSITIVE_TAGS.has(tag));
    // The caller supplies source URLs, customer-commitment counts, risk labels
    // and rubric scores. None is an independently verified claim.
    const status = !validRiskTags || unrecognizedRiskTags.length || sensitive
      ? "specialist_and_owner_review"
      : missing.length ? "evidence_required" : "independent_validation_required";
    return Object.freeze({
      id: idea.id, title: idea.title, score100: Math.round(score100 * 10) / 10,
      status, missing: Object.freeze(missing),
      unrecognizedRiskTags: Object.freeze(unrecognizedRiskTags),
      evidenceIndependentlyVerified: false,
      ownerApprovalRequired: true, productionAuthorized: false,
      caveat: "Advisory scoring of caller-supplied assumptions only. Source URLs, customer counts and risk labels remain unverified; no production or publication approval is implied."
    });
  });
  const priority = { independent_validation_required: 0, specialist_and_owner_review: 1, evidence_required: 2 };
  result.sort((a, b) => (priority[a.status] - priority[b.status])
    || (b.score100 - a.score100) || a.id.localeCompare(b.id));
  return Object.freeze(result);
}

module.exports = Object.freeze({
  SOURCES, DIMENSION_WEIGHTS, inspectRanking, scoreCapabilityIdeas
});
