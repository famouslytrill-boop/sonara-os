"use strict";

const { createHash } = require("node:crypto");
const {
  SYSTEM_DESIGN_REFERENCE_SOURCE,
  SYSTEM_DESIGN_PATTERNS,
  getSystemDesignPattern
} = require("../data/system-design-reference-catalog.cjs");

const ENGINE_VERSION = "2026-07-26.1";
const BASELINE_PATTERN_SLUGS = Object.freeze([
  "system-design-framework",
  "scaling",
  "unique-id-generator",
  "metrics-monitoring-alerting"
]);

function getSystemDesignSummary() {
  const statusCounts = {};
  const domainCounts = {};
  for (const pattern of SYSTEM_DESIGN_PATTERNS) {
    statusCounts[pattern.status] = (statusCounts[pattern.status] || 0) + 1;
    domainCounts[pattern.domain] = (domainCounts[pattern.domain] || 0) + 1;
  }
  return Object.freeze({
    engineVersion: ENGINE_VERSION,
    source: SYSTEM_DESIGN_REFERENCE_SOURCE,
    patternCount: SYSTEM_DESIGN_PATTERNS.length,
    statusCounts: Object.freeze(statusCounts),
    domainCounts: Object.freeze(domainCounts),
    executionMode: "deterministic_local_reference_engine",
    remoteRuntimeDependency: false
  });
}

function reviewSystemDesign(input = {}) {
  const normalized = normalizeReviewInput(input);
  if (!normalized.ok) return normalized;

  const searchableText = [
    normalized.value.moduleKey,
    normalized.value.product,
    normalized.value.summary,
    ...normalized.value.capabilities,
    ...normalized.value.risks,
    ...normalized.value.constraints
  ].join(" ").toLowerCase();
  const tokens = tokenize(searchableText);

  const scored = SYSTEM_DESIGN_PATTERNS.map((pattern) => ({
    pattern,
    score: scorePattern(pattern, searchableText, tokens),
    matchedTerms: matchedTerms(pattern, searchableText, tokens)
  }));

  const selected = scored
    .filter((item) => item.score > 0 || BASELINE_PATTERN_SLUGS.includes(item.pattern.slug))
    .sort((a, b) => b.score - a.score || a.pattern.order - b.pattern.order)
    .slice(0, 10);

  const selectedSlugs = new Set(selected.map((item) => item.pattern.slug));
  for (const baselineSlug of BASELINE_PATTERN_SLUGS) {
    if (selectedSlugs.has(baselineSlug)) continue;
    const baseline = getSystemDesignPattern(baselineSlug);
    if (baseline) selected.push({ pattern: baseline, score: 1, matchedTerms: ["baseline architecture gate"] });
  }

  selected.sort((a, b) => b.score - a.score || a.pattern.order - b.pattern.order);

  const blockedMatches = selected.filter((item) => item.pattern.status === "blocked_reference" && item.score >= 3);
  const reviewFingerprint = createHash("sha256")
    .update(JSON.stringify({ engineVersion: ENGINE_VERSION, input: normalized.value, patterns: selected.map((item) => item.pattern.slug) }))
    .digest("hex")
    .slice(0, 24);

  const requiredGates = unique([
    "Confirm organization and role boundaries for every read and write.",
    "Define source of truth, idempotency, failure recovery, monitoring, and rollback.",
    "Estimate traffic, storage, provider cost, queue depth, and retention from explicit assumptions.",
    "Keep secrets server-side and external services disabled until configured and verified.",
    ...selected.flatMap((item) => item.pattern.guardrails)
  ]);

  const architectureQuestions = unique(selected.flatMap((item) => item.pattern.reviewQuestions));
  const moduleMappings = unique(selected.flatMap((item) => item.pattern.sonaraModules));

  return Object.freeze({
    ok: true,
    engineVersion: ENGINE_VERSION,
    reviewFingerprint,
    decision: blockedMatches.length ? "blocked_requires_specialist_review" : "review_required",
    module: normalized.value,
    source: SYSTEM_DESIGN_REFERENCE_SOURCE,
    referenceBoundary: Object.freeze({
      copiedUpstreamContent: false,
      remoteRuntimeDependency: false,
      licenseStatus: SYSTEM_DESIGN_REFERENCE_SOURCE.licenseStatus,
      allowedUse: "original SONARA architecture mapping and review questions only"
    }),
    recommendedPatterns: Object.freeze(selected.map((item) => Object.freeze({
      order: item.pattern.order,
      slug: item.pattern.slug,
      title: item.pattern.title,
      domain: item.pattern.domain,
      status: item.pattern.status,
      score: item.score,
      matchedTerms: Object.freeze(item.matchedTerms),
      sonaraModules: item.pattern.sonaraModules,
      reviewQuestions: item.pattern.reviewQuestions,
      guardrails: item.pattern.guardrails
    }))),
    blockedPatterns: Object.freeze(blockedMatches.map((item) => item.pattern.slug)),
    moduleMappings: Object.freeze(moduleMappings),
    requiredGates: Object.freeze(requiredGates),
    architectureQuestions: Object.freeze(architectureQuestions),
    implementationSequence: Object.freeze(buildImplementationSequence(selected)),
    activationRule: "An owner/admin must convert reviewed recommendations into a scoped change, test plan, rollback plan, and approved pull request."
  });
}

function normalizeReviewInput(input) {
  const moduleKey = clean(input.moduleKey || input.module || input.name, 160);
  if (!moduleKey) return { ok: false, status: 400, code: "module_key_required" };

  return {
    ok: true,
    value: Object.freeze({
      moduleKey,
      product: clean(input.product, 120) || "sonara_platform",
      summary: clean(input.summary || input.description, 2000),
      capabilities: Object.freeze(normalizeList(input.capabilities, 30, 240)),
      risks: Object.freeze(normalizeList(input.risks, 30, 240)),
      constraints: Object.freeze(normalizeList(input.constraints, 30, 240)),
      scaleTier: oneOf(input.scaleTier, ["prototype", "launch", "growth", "large_scale"], "launch")
    })
  };
}

function scorePattern(pattern, searchableText, tokens) {
  let score = BASELINE_PATTERN_SLUGS.includes(pattern.slug) ? 1 : 0;
  for (const keyword of pattern.keywords) {
    const normalized = keyword.toLowerCase();
    if (searchableText.includes(normalized)) score += normalized.includes(" ") ? 4 : 3;
    for (const token of tokenize(normalized)) if (tokens.has(token)) score += 1;
  }
  for (const moduleName of pattern.sonaraModules) {
    const normalized = moduleName.toLowerCase();
    if (searchableText.includes(normalized)) score += 4;
    for (const token of tokenize(normalized)) if (tokens.has(token)) score += 0.5;
  }
  return Math.round(score * 10) / 10;
}

function matchedTerms(pattern, searchableText, tokens) {
  const matches = [];
  for (const keyword of pattern.keywords) {
    const normalized = keyword.toLowerCase();
    if (searchableText.includes(normalized) || [...tokenize(normalized)].some((token) => tokens.has(token))) matches.push(keyword);
  }
  return unique(matches).slice(0, 8);
}

function buildImplementationSequence(selected) {
  const domains = new Set(selected.map((item) => item.pattern.domain));
  const sequence = [
    "Requirements: define users, roles, tenant boundaries, inputs, outputs, scale assumptions, and prohibited behavior.",
    "Data and API contract: define source-of-truth records, authorization, idempotency, retention, and versioning.",
    "Failure design: define timeouts, retries, degraded states, dead-letter or reconciliation paths, and operator recovery.",
    "Evidence: add tests, metrics, audit events, readiness checks, cost assumptions, and rollback instructions.",
    "Activation: release behind the correct role, plan, provider readiness, and owner approval boundary."
  ];
  if (domains.has("regulated_finance")) sequence.unshift("Regulatory gate: specialist legal, compliance, custody, fraud, and security review is mandatory before implementation.");
  if (domains.has("location")) sequence.unshift("Privacy gate: minimize precision and retention; require explicit consent for presence or live location.");
  return sequence;
}

function normalizeList(value, maxItems, maxLength) {
  const raw = Array.isArray(value)
    ? value
    : String(value || "").split(/[,\n]/g);
  return unique(raw.map((item) => clean(item, maxLength)).filter(Boolean)).slice(0, maxItems);
}

function tokenize(value) {
  return new Set(String(value || "").toLowerCase().split(/[^a-z0-9]+/g).filter((token) => token.length >= 3));
}

function clean(value, maxLength) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function oneOf(value, allowed, fallback) {
  const normalized = String(value || "").trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

module.exports = {
  ENGINE_VERSION,
  BASELINE_PATTERN_SLUGS,
  getSystemDesignSummary,
  normalizeReviewInput,
  reviewSystemDesign
};
